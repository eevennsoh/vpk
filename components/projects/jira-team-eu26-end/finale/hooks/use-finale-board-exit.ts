"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { useFinaleFrame } from "./use-finale-frame";
import { FINALE_COLORS } from "../data/finale-palette";
import { queryJiraTeamEu26DoneCards } from "../lib/capture-done-column";
import { boardDoneCardsHidden, boardExitStyle } from "../lib/finale-board-exit";
import { parseRgb } from "../lib/finale-math";

const SLIDE_RGB = parseRgb(FINALE_COLORS.slide).join(", ");

interface HiddenElement {
	readonly element: HTMLElement;
	readonly visibility: string;
}

/**
 * Drives the board's exit (see `lib/finale-board-exit.ts`) on the finale clock:
 * writes the full-viewport exit layer's blur and slide colour, and hides the
 * live Done column's DOM cards from the toss on (restored when scrubbed back or
 * when the finale closes). The slide's fade is its background alpha, not the
 * layer's `opacity`, which would also fade the backdrop blur.
 */
export function useFinaleBoardExit(layerRef: RefObject<HTMLDivElement | null>): void {
	const hiddenRef = useRef<readonly HiddenElement[] | null>(null);
	const writtenRef = useRef("");

	useLayoutEffect(() => {
		const scrollbars = document.querySelectorAll<HTMLElement>('[data-jira-team-eu26-end-board-surface] [data-jira-kanban-column="Done"] [data-slot="scroll-area-scrollbar"]');
		const hidden = [...scrollbars].map((element) => {
			const previous = { element, visibility: element.style.visibility };
			element.style.visibility = "hidden";
			return previous;
		});
		return () => restore(hidden);
	}, []);

	useFinaleFrame((time) => {
		const layer = layerRef.current;
		const style = boardExitStyle(time);
		const background = `rgba(${SLIDE_RGB}, ${style.opacity.toFixed(4)})`;
		const written = `${style.visibility}|${background}|${style.backdropFilter}`;
		if (layer && writtenRef.current !== written) {
			writtenRef.current = written;
			layer.style.visibility = style.visibility;
			layer.style.backgroundColor = background;
			layer.style.backdropFilter = style.backdropFilter;
			layer.style.setProperty("-webkit-backdrop-filter", style.backdropFilter);
		}
		const hide = boardDoneCardsHidden(time);
		if (hide && !hiddenRef.current) {
			hiddenRef.current = queryJiraTeamEu26DoneCards().map((element) => {
				const hidden = { element, visibility: element.style.visibility };
				element.style.visibility = "hidden";
				return hidden;
			});
		} else if (!hide && hiddenRef.current) {
			restore(hiddenRef.current);
			hiddenRef.current = null;
		}
	});

	useEffect(() => () => {
		if (hiddenRef.current) restore(hiddenRef.current);
		hiddenRef.current = null;
	}, []);
}

function restore(cards: readonly HiddenElement[]): void {
	for (const { element, visibility } of cards) element.style.visibility = visibility;
}
