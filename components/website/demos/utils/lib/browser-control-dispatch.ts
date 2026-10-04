import type { BrowserPreviewControlMessage } from "@/components/website/demos/utils/hooks/use-browser-preview-session";

export type BrowserControlCommand =
	| { type: "click"; x: number; y: number }
	| { type: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
	| { type: "paste"; text: string }
	| {
		type: "key";
		key: string;
		code: string;
		ctrlKey?: boolean;
		metaKey?: boolean;
		altKey?: boolean;
		shiftKey?: boolean;
	};

type WorkspaceControlAction = "click" | "wheel" | "type" | "press";

interface BrowserControlDelivery {
	preview: ((message: BrowserPreviewControlMessage) => boolean) | null;
	workspace: (action: WorkspaceControlAction, body: Record<string, unknown>) => Promise<unknown>;
}

const SPECIAL_KEY_MAP: Readonly<Record<string, string>> = {
	" ": "Space",
	ArrowDown: "ArrowDown",
	ArrowLeft: "ArrowLeft",
	ArrowRight: "ArrowRight",
	ArrowUp: "ArrowUp",
	Backspace: "Backspace",
	Delete: "Delete",
	End: "End",
	Enter: "Enter",
	Escape: "Escape",
	Home: "Home",
	PageDown: "PageDown",
	PageUp: "PageUp",
	Tab: "Tab",
};

// Preview delivery reports whether it accepted the message. A closed socket can
// also throw before accepting it; only an unaccepted command may fall back.
function tryPreview(delivery: BrowserControlDelivery, message: BrowserPreviewControlMessage): boolean {
	try {
		return delivery.preview?.(message) ?? false;
	} catch {
		return false;
	}
}

export async function dispatchBrowserControl(
	command: BrowserControlCommand,
	delivery: Readonly<BrowserControlDelivery>,
): Promise<void> {
	switch (command.type) {
		case "click":
			if (tryPreview(delivery, { type: "preview-click", x: command.x, y: command.y })) return;
			await delivery.workspace("click", { x: command.x, y: command.y });
			return;
		case "wheel":
			if (tryPreview(delivery, {
				type: "preview-wheel", x: command.x, y: command.y, deltaX: command.deltaX, deltaY: command.deltaY,
			})) return;
			// The HTTP workspace action scrolls its current tab; preview transport
			// additionally positions the pointer before sending the wheel event.
			await delivery.workspace("wheel", { deltaX: command.deltaX, deltaY: command.deltaY });
			return;
		case "paste":
			if (tryPreview(delivery, { type: "preview-paste", text: command.text })) return;
			await delivery.workspace("type", { text: command.text });
			return;
		case "key": {
			const isPrintable = command.key.length === 1 && !command.metaKey && !command.ctrlKey && !command.altKey;
			if (tryPreview(delivery, {
				type: "preview-key", eventType: "keyDown", key: command.key, code: command.code,
				text: isPrintable ? command.key : undefined,
			})) {
				// Once keyDown is accepted, retrying through HTTP would duplicate the
				// input. Attempt its release without replaying an accepted command.
				tryPreview(delivery, { type: "preview-key", eventType: "keyUp", key: command.key, code: command.code });
				return;
			}
			if (isPrintable) {
				await delivery.workspace("type", { text: command.key });
				return;
			}
			const mappedKey = SPECIAL_KEY_MAP[command.key];
			if (!mappedKey) return;
			const modifiers = [
				command.ctrlKey ? "Control" : null,
				command.metaKey ? "Meta" : null,
				command.altKey ? "Alt" : null,
				command.shiftKey ? "Shift" : null,
			].filter((modifier) => modifier !== null);
			await delivery.workspace("press", {
				key: modifiers.length ? `${modifiers.join("+")}+${mappedKey}` : mappedKey,
			});
		}
	}
}
