"use client";

import { type ReactElement, useEffect, useId, useRef } from "react";
import { RovoChatProvider } from "@/app/contexts";
import ChatPanel from "@/components/projects/sidebar-chat/page";
import type { GenerativeCardAnimationProps } from "@/components/projects/shared/components/generative-widget-card";

const PORT_COUNT = 3;

const MULTIPORT_GENERATIVE_CARD_ANIMATION: GenerativeCardAnimationProps = {
	distortion: false,
};

// The live composer is a contenteditable Tiptap editor inside the container ChatComposer marks
// with data-chat-composer-input, so match the textbox there rather than its tag or visible label.
const MULTIPORT_COMPOSER_SELECTOR = '[data-chat-composer-input] [role="textbox"]';

/**
 * F6 / Shift+F6 cycle focus between the ports' composers, the conventional "next pane" key, so
 * Tab and Shift+Tab keep their normal order through each port's controls.
 */
function handlePortSwitchKeyDown(container: HTMLElement, event: KeyboardEvent) {
	if (event.key !== "F6" || event.altKey || event.ctrlKey || event.metaKey) {
		return;
	}
	const ports = Array.from(container.querySelectorAll<HTMLElement>("[data-multiport-port]"));
	const composers = ports.map((port) => port.querySelector<HTMLElement>(MULTIPORT_COMPOSER_SELECTOR));
	if (composers.every((composer) => composer === null)) {
		return;
	}
	const target = event.target instanceof Node ? event.target : null;
	const currentIndex = ports.findIndex((port) => target !== null && port.contains(target));
	const step = event.shiftKey ? -1 : 1;
	const count = ports.length;
	const start = currentIndex === -1 ? (event.shiftKey ? 0 : -1) : currentIndex;
	for (let offset = 1; offset <= count; offset += 1) {
		const index = (((start + step * offset) % count) + count) % count;
		const composer = composers[index];
		if (composer) {
			event.preventDefault();
			composer.focus();
			return;
		}
	}
}

export default function MultiportDemo(): ReactElement {
	const shortcutHintId = useId();
	const containerRef = useRef<HTMLDivElement>(null);

	// A native listener scoped to the demo container: F6 only acts while focus is inside it.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const onKeyDown = (event: KeyboardEvent) => handlePortSwitchKeyDown(container, event);
		container.addEventListener("keydown", onKeyDown);
		return () => container.removeEventListener("keydown", onKeyDown);
	}, []);

	return (
		<div
			ref={containerRef}
			aria-describedby={shortcutHintId}
			aria-label="Multiport chat"
			className="mx-auto flex h-screen items-center justify-center gap-12 px-6"
			role="group"
		>
			<span id={shortcutHintId} className="sr-only">
				Press F6 to move to the next chat composer, Shift+F6 for the previous one. On Mac laptops, hold Fn with F6.
			</span>
			{Array.from({ length: PORT_COUNT }, (_, i) => (
				<div key={i} data-multiport-port={i} className="flex h-full min-w-0 flex-1 justify-center" style={{ maxWidth: 400 }}>
					<RovoChatProvider portIndex={i}>
						<ChatPanel
							onClose={() => {}}
							autoFocusComposer={i === 0}
							enableSmartWidgets={true}
							sendPromptOptions={{
								smartGeneration: {
									enabled: true,
									surface: "multiport",
								},
							}}
							cards={{ generativeAnimation: MULTIPORT_GENERATIVE_CARD_ANIMATION }}
						/>
					</RovoChatProvider>
				</div>
			))}
		</div>
	);
}
