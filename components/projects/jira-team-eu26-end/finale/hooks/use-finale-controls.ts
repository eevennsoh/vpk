"use client";

import { useEffect } from "react";

const INTERACTIVE_SELECTOR = "input, textarea, select, button, a[href], [contenteditable=''], [contenteditable='true'], [role='button'], [role='link'], [role='menuitem'], [role='option'], [role='tab']";

function isInteractiveTarget(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}

export interface FinaleControlHandlers {
	readonly onExit: () => void;
	readonly onTogglePause: () => void;
	readonly onSeek: (delta: number) => void;
	readonly onReplay: () => void;
}

/**
 * Presenter/rehearsal keys, active only while the finale is open:
 * Esc exits to the board, Space pauses, ←/→ nudge a beat, R replays.
 */
export function useFinaleControls(open: boolean, handlers: FinaleControlHandlers): void {
	const { onExit, onTogglePause, onSeek, onReplay } = handlers;
	useEffect(() => {
		if (!open) return undefined;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey || isInteractiveTarget(event.target)) return;
			switch (event.key) {
				case "Escape":
					onExit();
					break;
				case " ":
					onTogglePause();
					break;
				case "ArrowLeft":
					onSeek(-0.5);
					break;
				case "ArrowRight":
					onSeek(0.5);
					break;
				case "r":
				case "R":
					onReplay();
					break;
				default:
					return;
			}
			event.preventDefault();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onExit, onReplay, onSeek, onTogglePause, open]);
}
