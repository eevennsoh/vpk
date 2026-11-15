import type { ReactRenderer } from "@tiptap/react";

import type { RichTextSuggestionMenuProps } from "./suggestion-menu-types";

export interface SuggestionPopupState {
	component: ReactRenderer<unknown, RichTextSuggestionMenuProps> | null;
	element: HTMLDivElement | null;
	// Detaches the resize/scroll listeners used by the input-anchored (chat
	// composer) positioning mode. Null for caret-anchored menus.
	cleanup: (() => void) | null;
}

export function createPopup(anchorToInput = false): HTMLDivElement {
	const element = document.createElement("div");
	element.className = anchorToInput
		? "rich-text-command-menu-popover rich-text-command-menu-popover-anchored"
		: "rich-text-command-menu-popover";
	document.body.appendChild(element);
	return element;
}

export function positionPopup(
	element: HTMLDivElement | null,
	clientRect?: (() => DOMRect | null) | null,
): void {
	if (!element || !clientRect) {
		return;
	}

	const rect = clientRect();
	if (!rect) {
		return;
	}

	element.style.left = `${rect.left}px`;
	element.style.top = `${rect.bottom + 6}px`;
}

/**
 * Chat-composer positioning: instead of opening at the caret, anchor the palette
 * to the prompt-input root, span its full width, and sit 8px away. Prefer the
 * Studio-style placement above the input; use the old below placement only when
 * the menu would clip above the viewport.
 */
const COMPOSER_POPUP_GAP = 8;
const PROMPT_INPUT_ROOT_SELECTOR = "[data-prompt-input-root]";

function getComposerAnchorBox(editorDom: HTMLElement): HTMLElement | null {
	const root =
		editorDom.closest<HTMLElement>(PROMPT_INPUT_ROOT_SELECTOR) ??
		editorDom.closest<HTMLElement>(".chat-composer-form") ??
		editorDom.closest<HTMLElement>("form");
	return root ? resolveComposerVisualBox(root) : null;
}

/**
 * The palette must clear the VISIBLE composer card, but `[data-prompt-input-root]`
 * is the inner `<form>`, which paints the visible border only for the floating /
 * blocks composers. The card composer (e.g. the Rovo "/rovo" + Studio panels)
 * wraps that border-less form in a padded, bordered container, so measuring the
 * 8px gap from the form drops the palette ~12px INSIDE the visible card instead of
 * outside it.
 *
 * Walk up from the form and return the first (innermost) ancestor that tightly
 * wraps it (≈ same width — not the whole panel) and is a ROUNDED card (has a
 * corner radius). Requiring a radius — not merely a top border — is deliberate:
 * composers are wrapped in `border-t p-*` footer/divider containers (e.g.
 * components/blocks/cursor/page.tsx, components/blocks/workflow/page.tsx) whose
 * top border would otherwise be mistaken for the input's edge, climbing the
 * anchor PAST the real (already-rounded) composer into the footer. Returning at
 * the first rounded match means an already-rounded form (floating / blocks) stops
 * there, while a border-less card form ascends one level to its rounded wrapper.
 */
function resolveComposerVisualBox(root: HTMLElement): HTMLElement {
	const rootWidth = root.getBoundingClientRect().width;
	let element: HTMLElement | null = root;
	for (let depth = 0; depth < 3 && element; depth++) {
		const styles = window.getComputedStyle(element);
		const isRoundedCard = Number.parseFloat(styles.borderTopLeftRadius) > 0;
		// Guard against climbing into a much larger layout container (e.g. the chat
		// panel): only adopt an ancestor that hugs the form's width.
		const tightlyWraps = element.getBoundingClientRect().width <= rootWidth + 48;
		if (isRoundedCard && tightlyWraps) {
			return element;
		}
		element = element.parentElement;
	}
	// No rounded card within reach (border-less / square composer): fall back to the
	// form so behavior is unchanged for those surfaces.
	return root;
}

export function positionComposerPopup(
	element: HTMLDivElement | null,
	editorDom?: HTMLElement | null,
): void {
	if (!element || !editorDom) {
		return;
	}

	const box = getComposerAnchorBox(editorDom);
	if (!box) {
		return;
	}

	const rect = box.getBoundingClientRect();
	const popupHeight = element.offsetHeight || 0;
	const spaceAbove = rect.top - COMPOSER_POPUP_GAP;
	const placeAbove = popupHeight <= spaceAbove;

	element.style.maxWidth = "none";
	element.style.left = `${rect.left}px`;
	element.style.width = `${rect.width}px`;
	element.style.top = placeAbove
		? `${Math.max(COMPOSER_POPUP_GAP, rect.top - popupHeight - COMPOSER_POPUP_GAP)}px`
		: `${rect.bottom + COMPOSER_POPUP_GAP}px`;
}

/**
 * Attach the input-anchored positioning + a resize/scroll reposition loop for a
 * chat-composer palette. Returns a cleanup that detaches the listeners. A double
 * rAF lets the menu render (and re-render after a category drill-in) so its
 * measured height drives the up/down flip on the next frame.
 */
export function attachComposerAnchor(
	element: HTMLDivElement | null,
	editorDom: HTMLElement | null,
): () => void {
	let frame = 0;
	const reposition = () => positionComposerPopup(element, editorDom);
	// Coalesce bursty scroll/resize events into a single reposition per frame —
	// each reposition does a getBoundingClientRect read + style writes, so an
	// unthrottled capture-phase scroll listener would force-reflow on every event
	// during momentum scrolling.
	const scheduleReposition = () => {
		if (frame) {
			return;
		}
		frame = requestAnimationFrame(() => {
			frame = 0;
			reposition();
		});
	};
	reposition();
	requestAnimationFrame(reposition);
	window.addEventListener("resize", scheduleReposition);
	// Capture phase so we also catch scrolls inside scrollable ancestors; passive
	// since we never preventDefault.
	window.addEventListener("scroll", scheduleReposition, { capture: true, passive: true });

	// The palette is BOTTOM-anchored: `positionComposerPopup` sets `top = anchorTop
	// - height - gap`, so its bottom hugs `anchorTop - gap` ONLY when recomputed at
	// the menu's current height. The list grows/shrinks AFTER the initial double
	// rAF — filtering the "/" query down to a couple of rows, a category drill-in,
	// or async row content — and neither the window resize nor scroll listener
	// fires for an element's OWN size change. Without observing it, a menu that
	// opened tall and then shrank keeps its stale `top` and floats high above the
	// composer instead of hugging it. Observe the popup (its height) and the anchor
	// box (its position/size) so every height change re-hugs the bottom edge.
	const resizeObserver =
		typeof ResizeObserver === "undefined"
			? null
			: new ResizeObserver(scheduleReposition);
	if (resizeObserver) {
		if (element) {
			resizeObserver.observe(element);
		}
		const anchorBox = editorDom ? getComposerAnchorBox(editorDom) : null;
		if (anchorBox) {
			resizeObserver.observe(anchorBox);
		}
	}

	return () => {
		if (frame) {
			cancelAnimationFrame(frame);
		}
		resizeObserver?.disconnect();
		window.removeEventListener("resize", scheduleReposition);
		window.removeEventListener("scroll", scheduleReposition, { capture: true });
	};
}
