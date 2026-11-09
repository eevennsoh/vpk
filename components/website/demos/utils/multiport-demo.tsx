"use client";

import { type KeyboardEvent as ReactKeyboardEvent, type ReactElement, useCallback, useEffect, useRef } from "react";
import { RovoChatProvider } from "@/app/contexts";
import ChatPanel from "@/components/projects/sidebar-chat/page";
import type { GenerativeCardAnimationProps } from "@/components/projects/shared/components/generative-widget-card";

const PORT_COUNT = 3;

const MULTIPORT_GENERATIVE_CARD_ANIMATION: GenerativeCardAnimationProps = {
	distortion: false,
};

export default function MultiportDemo(): ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);

	const handleKeyDown = useCallback((e: ReactKeyboardEvent) => {
		if (e.key !== "Tab") return;

		const container = containerRef.current;
		if (!container) return;

		const textareas = Array.from(
			container.querySelectorAll<HTMLTextAreaElement>(
				'textarea[aria-label="Chat message input"]'
			)
		);
		if (textareas.length === 0) return;

		const currentIndex = textareas.indexOf(
			document.activeElement as HTMLTextAreaElement
		);

		let nextIndex: number;
		if (e.shiftKey) {
			nextIndex = currentIndex <= 0 ? textareas.length - 1 : currentIndex - 1;
		} else {
			nextIndex = currentIndex >= textareas.length - 1 ? 0 : currentIndex + 1;
		}

		e.preventDefault();
		textareas[nextIndex].focus();
	}, []);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const textarea = container.querySelector<HTMLTextAreaElement>(
			'textarea[aria-label="Chat message input"]'
		);
		textarea?.focus();
	}, []);

	return (
		<div
			ref={containerRef}
			className="mx-auto flex h-screen items-center justify-center gap-12 px-6"
			onKeyDown={handleKeyDown}
		>
			{Array.from({ length: PORT_COUNT }, (_, i) => (
				<div key={i} className="flex h-full min-w-0 flex-1 justify-center" style={{ maxWidth: 400 }}>
					<RovoChatProvider portIndex={i}>
						<ChatPanel
							onClose={() => {}}
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
