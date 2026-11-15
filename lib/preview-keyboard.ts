type ModifierKeyEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">;

const hasModifier = (event: ModifierKeyEvent) => event.altKey || event.ctrlKey || event.metaKey;

/**
 * Remote-preview viewports forward keys to an embedded browser, but plain Tab and
 * Shift+Tab stay with the host page so keyboard users can always move focus out of
 * the viewport (WCAG 2.1.2 No Keyboard Trap). To Tab between links and fields inside
 * the remote page, users turn on the explicit "capture keys" mode (see
 * `resolvePreviewKeyCaptureKey`), which forwards Tab too until Escape releases it.
 */
export function isPreviewFocusNavigationKey(event: ModifierKeyEvent): boolean {
	return event.key === "Tab" && !hasModifier(event);
}

/**
 * What a remote-preview viewport does with a keydown:
 * - `forward`: send the key to the remote page.
 * - `leave`: plain Tab/Shift+Tab while not captured; the browser moves focus out.
 * - `start`: plain Enter while not captured starts capture and is not forwarded.
 * - `release`: plain Escape while captured releases capture and is not forwarded.
 */
export type PreviewKeyCaptureResolution = "forward" | "leave" | "start" | "release";

export function resolvePreviewKeyCaptureKey(
	event: ModifierKeyEvent,
	captured: boolean,
): PreviewKeyCaptureResolution {
	const plain = !hasModifier(event) && !event.shiftKey;
	if (captured) {
		return event.key === "Escape" && plain ? "release" : "forward";
	}
	if (isPreviewFocusNavigationKey(event)) {
		return "leave";
	}
	return event.key === "Enter" && plain ? "start" : "forward";
}

/** Screen-reader hint for preview viewports, referenced through aria-describedby. */
export const PREVIEW_KEYBOARD_HINT =
	"Keys are sent to the page. Press Tab to leave the preview. Press Enter to capture all keys, including Tab, and Escape to release them.";

export const PREVIEW_KEY_CAPTURE_STARTED_MESSAGE = "Keyboard captured — press Escape to release";
export const PREVIEW_KEY_CAPTURE_RELEASED_MESSAGE = "Keyboard released — press Tab to leave the preview";
