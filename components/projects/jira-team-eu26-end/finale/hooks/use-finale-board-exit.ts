"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { useFinaleFrame } from "./use-finale-frame";
import { FINALE_COLORS } from "../data/finale-palette";
import { queryJiraTeamEu26DoneCards } from "../lib/capture-done-column";
import { boardDoneCardsHidden, boardExitStyle } from "../lib/finale-board-exit";
import { parseRgb } from "../lib/finale-math";

const SLIDE_RGB = parseRgb(FINALE_COLORS.slide).join(", ");

interface HiddenCard {
	readonly element: HTMLElement;
	/** Its inline opacity and transition before, restored as they were. */
	readonly opacity: string;
	readonly transition: string;
}

/**
 * Drives the board's exit (see `lib/finale-board-exit.ts`) on the finale clock:
 * writes the full-viewport exit layer's blur and slide colour, and hides the
 * live Done column's DOM cards from the toss on (restored when scrubbed back or
 * when the finale closes). The slide's fade is its background alpha, not the
 * layer's `opacity`, which would also fade the backdrop blur.
 *
 * The cards hide with `opacity`, not `visibility`: visibility is inherited,
 * so hiding 13 cards restyled all ~650 of their elements (8ms) on the toss
 * frame, which already starts the blur and the GL sheets. Under the modal
 * finale the board is inert, so an invisible card is all that is needed. The
 * cards' own opacity transition is held off both ways: a fading original
 * would ghost under its lifting sheet, and fade back in on a replay.
 */
export function useFinaleBoardExit(layerRef: RefObject<HTMLDivElement | null>): void {
	const hiddenRef = useRef<readonly HiddenCard[] | null>(null);
	const writtenRef = useRef("");

	useLayoutEffect(() => {
		const scrollbars = document.querySelectorAll<HTMLElement>('[data-jira-team-eu26-end-board-surface] [data-jira-kanban-column="Done"] [data-slot="scroll-area-scrollbar"]');
		const hidden = [...scrollbars].map((element) => {
			const previous = { element, value: element.style.visibility };
			element.style.visibility = "hidden";
			return previous;
		});
		return () => {
			for (const { element, value } of hidden) element.style.visibility = value;
		};
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
				const hidden = { element, opacity: element.style.opacity, transition: element.style.transition };
				element.style.transition = "none";
				element.style.opacity = "0";
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

function restore(cards: readonly HiddenCard[]): void {
	for (const { element, opacity } of cards) element.style.opacity = opacity;
	// Apply the restored opacity before the cards' own transition returns, or they fade back in.
	if (cards.length > 0) void getComputedStyle(cards[0].element).opacity;
	for (const { element, transition } of cards) element.style.transition = transition;
}
