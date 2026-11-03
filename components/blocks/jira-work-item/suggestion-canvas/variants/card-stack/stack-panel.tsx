"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import CrossIcon from "@atlaskit/icon/core/cross";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";

import { AutoHeight } from "./auto-height";
import { CardMeasure, type CardHeights } from "./card-face";
import { CaughtUp } from "./caught-up";
import { DeckStack } from "./deck-stack";
import { ReviewedList } from "./reviewed-list";
import { RunByline } from "./run-status";
import { StackFooter } from "./stack-footer";
import type { Deck } from "./use-deck";

export interface StackPanelProps {
	id: string;
	feed: SuggestionFeed;
	deck: Deck;
	panelRef: RefObject<HTMLDivElement | null>;
	deckRef: RefObject<HTMLDivElement | null>;
	/** The preview's overlay layer, where the why card renders. */
	overlay: HTMLElement | null;
	onClose: () => void;
}

export type BodyMode = "deck" | "caught-up" | "reviewed";

function PanelHeader({ feed, titleId, showRerun, onClose }: Readonly<{ feed: SuggestionFeed; titleId: string; showRerun: boolean; onClose: () => void }>) {
	return (
		<header className="flex shrink-0 flex-col gap-1 px-4 pt-3.5 pb-1">
			<div className="flex items-center gap-2">
				<h2 className="min-w-0 flex-1 text-text" id={titleId} style={{ font: token("font.heading.xsmall") }}>Work item suggestions</h2>
				<div className="-my-1 -mr-2 flex items-center">
					{showRerun ? (
						<Tooltip>
							<TooltipTrigger render={<Button aria-label="Check for new suggestions" disabled={feed.status === "running"} onClick={feed.rerun} size="icon" type="button" variant="ghost" />}>
								<RefreshIcon color="currentColor" label="" size="small" />
							</TooltipTrigger>
							<TooltipContent>Check for new suggestions</TooltipContent>
						</Tooltip>
					) : null}
					<Button aria-label="Close suggestions" onClick={onClose} size="icon" type="button" variant="ghost">
						<CrossIcon color="currentColor" label="" size="small" />
					</Button>
				</div>
			</div>
			<RunByline feed={feed} />
		</header>
	);
}

/**
 * The deck popover: header with the agent and run status, a body that is exactly as tall as what it shows (the
 * deck sized to its top card, the caught-up state, or the reviewed list) and eases between them, and the footer.
 */
export function StackPanel({ id, feed, deck, panelRef, deckRef, overlay, onClose }: Readonly<StackPanelProps>) {
	const [whyId, setWhyId] = useState<SuggestionFieldId | null>(null);
	const [reviewedOpen, setReviewedOpen] = useState(false);
	const [heights, setHeights] = useState<CardHeights>({});
	const onHeights = useCallback((next: CardHeights) => setHeights(next), []);
	const checkRef = useRef<HTMLButtonElement>(null);
	const titleId = `${id}-title`;
	const reviewedId = `${id}-reviewed`;
	const running = feed.status === "running";
	const mode: BodyMode = reviewedOpen && deck.reviewed.length > 0 ? "reviewed" : deck.order.length > 0 || running ? "deck" : "caught-up";
	const focusDeck = () => requestAnimationFrame(() => deckRef.current?.focus({ preventScroll: true }));
	const undo = () => {
		deck.undo();
		focusDeck();
	};
	const restore = (suggestionId: SuggestionFieldId) => {
		deck.restore(suggestionId);
		setReviewedOpen(false);
		focusDeck();
	};

	// Whether focus is (or was, until its element unmounted) inside the popover. Removing a focused element sends focus
	// to <body> without a focusout that names a destination, so this stays true through that.
	const holdsFocus = useRef(false);
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return undefined;
		const onFocusIn = () => {
			holdsFocus.current = true;
		};
		const onFocusOut = (event: FocusEvent) => {
			const next = event.relatedTarget as Node | null;
			if (next && !panel.contains(next)) holdsFocus.current = false;
		};
		panel.addEventListener("focusin", onFocusIn);
		panel.addEventListener("focusout", onFocusOut);
		return () => {
			panel.removeEventListener("focusin", onFocusIn);
			panel.removeEventListener("focusout", onFocusOut);
		};
	}, [panelRef]);

	const hasCards = deck.order.length > 0;
	useEffect(() => {
		// The control that decided the last card unmounts with the deck, and Check again unmounts while the agent runs:
		// hand focus to whatever replaced them. Only when the popover held focus, so opening it never draws a
		// keyboard ring for someone who only pointed at it.
		const active = document.activeElement;
		if (!holdsFocus.current || (active != null && active !== document.body && active !== panelRef.current)) return;
		if (mode === "caught-up") checkRef.current?.focus({ preventScroll: true });
		else if (mode === "deck" && hasCards) deckRef.current?.focus({ preventScroll: true });
		else panelRef.current?.focus({ preventScroll: true });
	}, [deckRef, hasCards, mode, panelRef]);

	const onEscape = useEffectEvent((event: KeyboardEvent) => {
		if (event.key !== "Escape" || event.defaultPrevented) return;
		event.preventDefault();
		if (whyId) setWhyId(null);
		else onClose();
	});
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return undefined;
		const listener = (event: KeyboardEvent) => onEscape(event);
		panel.addEventListener("keydown", listener);
		return () => panel.removeEventListener("keydown", listener);
	}, [panelRef]);

	return (
		<div
			aria-labelledby={titleId}
			className="flex max-h-full w-96 flex-col rounded-xl bg-surface-overlay outline-none"
			id={id}
			ref={panelRef}
			role="dialog"
			style={{ boxShadow: token("elevation.shadow.overlay") }}
			tabIndex={-1}
		>
			<PanelHeader feed={feed} onClose={onClose} showRerun={mode === "deck" && deck.order.length > 0} titleId={titleId} />
			<div className="relative shrink-0">
				<CardMeasure newIds={feed.newIds} onHeights={onHeights} suggestions={feed.review.suggestions} />
				<AutoHeight mode={mode}>
					{mode === "reviewed" ? (
						<div className="max-h-80 overflow-y-auto overscroll-contain px-4 pt-2 pb-3 mask-b-from-[calc(100%-1.5rem)] mask-b-to-100%">
							<p className="pb-1 text-xs font-medium text-text-subtlest">Reviewed · newest first</p>
							<ReviewedList id={reviewedId} onRestore={restore} review={feed.review} reviewed={deck.reviewed} />
						</div>
					) : mode === "deck" ? (
						<div className="px-4 pt-3 pb-1">
							<DeckStack
								deck={deck}
								deckRef={deckRef}
								heights={heights}
								newIds={feed.newIds}
								onUndo={undo}
								onWhyIdChange={setWhyId}
								running={running}
								whyAnchor={panelRef}
								whyContainer={overlay}
								whyId={whyId}
							/>
						</div>
					) : (
						<div className="px-4">
							<CaughtUp checkRef={checkRef} deck={deck} feed={feed} onUndo={undo} />
						</div>
					)}
				</AutoHeight>
			</div>
			<StackFooter
				deck={deck}
				mode={mode}
				onToggleReviewed={() => setReviewedOpen((open) => !open)}
				reviewedId={reviewedId}
			/>
			<p aria-live="polite" className="sr-only">{deck.announcement}</p>
		</div>
	);
}
