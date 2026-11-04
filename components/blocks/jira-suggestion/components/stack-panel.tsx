"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, type RefObject } from "react";
import { AnimatePresence, LayoutGroup, type MotionValue } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { TooltipProvider } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";

import { CHROME_HEIGHT } from "./constants";
import { PanelBody } from "./panel-body";
import { PanelHeader } from "./panel-header";
import { StackFooter } from "./stack-footer";
import type { BodyMode } from "./use-body-height";
import type { Deck, SwipeDirection } from "./use-deck";
import { useDeckView } from "./use-deck-view";
import { usePanelFocus } from "./use-panel-focus";

export interface StackPanelProps {
	id: string;
	feed: SuggestionFeed;
	deck: Deck;
	panelRef: RefObject<HTMLDivElement | null>;
	deckRef: RefObject<HTMLDivElement | null>;
	/** The preview's overlay layer, where the why card renders. */
	overlay: HTMLElement | null;
	/** The popover's height budget inside the frame. */
	maxHeight: number;
	onClose: () => void;
}

/**
 * The suggestions popover: "Suggested 2 min ago" with view · re-run · close, a body that is the stack, the unpacked
 * list or the caught-up state, and the progress footer.
 */
export function StackPanel({ id, feed, deck, panelRef, deckRef, overlay, maxHeight, onClose }: Readonly<StackPanelProps>) {
	const [whyId, setWhyId] = useState<SuggestionFieldId | null>(null);
	const [grab, setGrab] = useState<{ id: SuggestionFieldId; progress: MotionValue<number> } | null>(null);
	const checkRef = useRef<HTMLButtonElement>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const layoutGroup = useId();
	const titleId = `${id}-title`;
	const view = useDeckView(feed, deck);
	// A check from the caught-up state runs in place there: the stack and footer only come back for real finds.
	const mode: BodyMode = view.listed ? "list" : deck.order.length > 0 ? "stack" : "caught-up";
	const shortcuts = [
		...(mode === "stack" ? ["ArrowLeft", "ArrowRight"] : []),
		...(deck.lastDecision && feed.status !== "running" ? ["Meta+Z", "Control+Z"] : []),
	].join(" ") || undefined;

	const commit = (direction: SwipeDirection) => {
		const top = deck.order.at(0);
		if (!top) return;
		setGrab(null);
		setWhyId(null);
		deck.decide(top.id, direction);
	};
	const toggleView = () => {
		setWhyId(null);
		if (view.listed) view.collapse();
		else view.unpack();
	};
	const undo = () => {
		if (mode === "caught-up" && panelRef.current?.contains(document.activeElement)) panelRef.current.focus({ preventScroll: true });
		// Undoing the only decision removes the Undo button; hand focus to the stack rather than dropping it.
		if (deck.undoDepth === 1 && panelRef.current?.contains(document.activeElement) && document.activeElement?.closest("[data-deck-controls]")) deckRef.current?.focus({ preventScroll: true });
		view.undo();
	};
	usePanelFocus({ panelRef, deckRef, checkRef, toggleRef, mode, hasCards: deck.order.length > 0 });

	const onPanelKeyDown = useEffectEvent((event: KeyboardEvent) => {
		if (event.defaultPrevented) return;
		if (event.key === "Escape") {
			event.preventDefault();
			if (whyId) { event.stopPropagation(); setWhyId(null); }
			else onClose();
			return;
		}
		if (event.isComposing || event.altKey || event.shiftKey || whyId) return;
		const target = event.target;
		if (!(target instanceof Element) || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="menu"], [role="listbox"], [role="slider"], [role="spinbutton"]')) return;
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
			if (!deck.lastDecision || feed.status === "running") return;
			event.preventDefault();
			event.stopPropagation();
			undo();
		} else if (!event.metaKey && !event.ctrlKey && mode === "stack" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
			event.preventDefault();
			event.stopPropagation();
			commit(event.key === "ArrowRight" ? "accept" : "dismiss");
		}
	});
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return undefined;
		const listener = (event: KeyboardEvent) => onPanelKeyDown(event);
		panel.addEventListener("keydown", listener);
		return () => panel.removeEventListener("keydown", listener);
	}, [panelRef]);

	const panel = (
		<div
			aria-keyshortcuts={shortcuts}
			aria-labelledby={titleId}
			className="flex max-h-full w-96 max-w-[calc(100vw-1rem)] flex-col rounded-xl bg-surface-overlay outline-none"
			id={id}
			ref={panelRef}
			role="dialog"
			style={{ boxShadow: token("elevation.shadow.overlay") }}
			tabIndex={-1}
		>
			<PanelHeader
				feed={feed}
				onClose={onClose}
				onRerun={mode === "caught-up" ? undefined : feed.rerun}
				onToggleView={feed.review.suggestions.length > 0 ? toggleView : undefined}
				titleId={titleId}
				toggleRef={toggleRef}
				view={view.listed ? "list" : "stack"}
			/>
			<LayoutGroup id={layoutGroup}>
				<PanelBody
					checkRef={checkRef}
					deck={deck}
					deckRef={deckRef}
					feed={feed}
					grab={grab}
					maxHeight={maxHeight - CHROME_HEIGHT}
					mode={mode}
					onCommit={commit}
					onGrab={setGrab}
					onUndo={undo}
					onUnpack={toggleView}
					onWhyIdChange={setWhyId}
					view={view}
					whyAnchor={panelRef}
					whyContainer={overlay}
					whyId={whyId}
				/>
			</LayoutGroup>
			<AnimatePresence initial={false}>
				{mode === "caught-up" ? null : <StackFooter deck={deck} key="footer" />}
			</AnimatePresence>
			<p aria-live="polite" className="sr-only">{deck.announcement}</p>
		</div>
	);
	return <TooltipProvider portalContainer={panelRef}>{panel}</TooltipProvider>;
}
