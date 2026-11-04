"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { AnimatePresence } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { arrivalLine } from "./arrival";
import { CaughtUp, DecidedSummary } from "./decided-summary";
import { PeekDrawer } from "./peek-drawer";
import { PeekFooter, PeekHeader } from "./peek-chrome";
import { PeekRow } from "./peek-row";
import { useDecidedHistory } from "./use-decided-history";
import { useFollowOffset } from "./use-follow-offset";
import { useNewArrivalScroll } from "./use-new-arrival-scroll";
import { useDecisionFocus, useElementHeight, useOpeningOrder, usePanelEscape } from "./use-panel-behavior";
import { usePeek } from "./use-peek";
import { useRunNotice } from "./use-run-notice";
import { edgeFadeStyle, useScrollEdges } from "./use-scroll-edges";

export interface PeekPanelProps {
	id: string;
	feed: SuggestionFeed;
	panelRef: RefObject<HTMLDivElement | null>;
	maxHeight?: number;
	onAccept: (id: SuggestionFieldId) => void;
	onAcceptAll: () => void;
	onClose: () => void;
}

/**
 * The popover: a narrow list of suggestions, and beneath its left edge a drawer that slides out beside whichever row
 * is hovered, keyboard-focused or pinned. One surface reads as the list; the drawer is its extension.
 */
export function PeekPanel({ id, feed, panelRef, maxHeight, onAccept, onAcceptAll, onClose }: Readonly<PeekPanelProps>) {
	const { review } = feed;
	const peek = usePeek();
	const notice = useRunNotice(feed);
	const focus = useDecisionFocus(panelRef);
	const rows = useOpeningOrder(review);
	const history = useDecidedHistory(review, rows, feed.runs.length);
	const popoverRef = useRef<HTMLDivElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const listEdges = useScrollEdges(scrollRef);
	const popoverHeight = useElementHeight(popoverRef);
	const [drawerHeight, setDrawerHeight] = useState<number | null>(null);
	const titleId = `${id}-title`;
	const paneId = `${id}-why`;
	const lastRun = feed.runs.at(-1);
	const ranAt = lastRun?.ranAt ?? "2m ago";
	const running = feed.status === "running";
	const caughtUp = review.suggestions.length > 0 && review.pending.length === 0;
	const followUpIds = new Set(feed.runs.slice(1).flatMap((run) => run.ids));
	const peeked = peek.id == null ? undefined : review.suggestions.find((suggestion) => suggestion.id === peek.id && review.decisionOf(suggestion.id) === "pending");
	const { offset } = useFollowOffset({ popoverRef, scrollRef, rowId: peeked?.id ?? null, drawerHeight, popoverHeight });
	// The popover corners the drawer covers turn square, so the pair reads as one shape wherever the drawer rides.
	const joinedTop = peeked != null && offset <= 1;
	const joinedBottom = peeked != null && drawerHeight != null && popoverHeight != null && offset + drawerHeight >= popoverHeight - 1;

	useNewArrivalScroll(scrollRef, lastRun);
	usePanelEscape(panelRef, peek.pinned, peek.close, onClose);

	const { close: closePeek } = peek;
	useEffect(() => {
		if (review.pending.length === 0) closePeek();
	}, [closePeek, review.pending.length]);

	/** A pinned pane moves on to the next pending row; a peeking one closes with the row it explained. */
	const settlePeek = (decidedId: SuggestionFieldId) => {
		if (peek.id !== decidedId) return;
		if (!peek.pinned) {
			peek.close();
			return;
		}
		const order = rows.map((suggestion) => suggestion.id);
		const from = order.indexOf(decidedId);
		const next = [...order.slice(from + 1), ...order.slice(0, from)].find((candidate) => review.decisionOf(candidate) === "pending");
		peek.retarget(next ?? null);
	};
	const decide = (suggestionId: SuggestionFieldId, decision: "accept" | "dismiss", keyboard: boolean) => {
		settlePeek(suggestionId);
		if (decision === "accept") onAccept(suggestionId);
		else review.dismiss(suggestionId);
		history.record([suggestionId]);
		if (keyboard) focus.focusRow(suggestionId, "undo");
	};
	const undo = (ids: readonly SuggestionFieldId[], keyboard: boolean) => {
		for (const undone of ids) review.undo(undone);
		history.release(ids);
		if (keyboard && ids[0]) focus.focusRow(ids[0], "accept");
	};
	const decideAll = (decision: "accept" | "dismiss", keyboard: boolean) => {
		history.record(review.pending.map((suggestion) => suggestion.id));
		if (decision === "accept") onAcceptAll();
		else review.dismissAll();
		if (keyboard) focus.focusDone();
	};

	const handleFocusOut = useEffectEvent((event: FocusEvent) => {
		const surface = panelRef.current;
		if (surface && !surface.contains(event.relatedTarget as Node | null)) peek.blurSurface();
	});
	const { enterSurface, leaveSurface } = peek;
	// The dialog is not itself interactive, so its surface-level listeners attach natively.
	useEffect(() => {
		const surface = panelRef.current;
		if (!surface) return undefined;
		const focusout = (event: FocusEvent) => handleFocusOut(event);
		surface.addEventListener("focusout", focusout);
		surface.addEventListener("pointerenter", enterSurface);
		surface.addEventListener("pointerleave", leaveSurface);
		return () => {
			surface.removeEventListener("focusout", focusout);
			surface.removeEventListener("pointerenter", enterSurface);
			surface.removeEventListener("pointerleave", leaveSurface);
		};
	}, [enterSurface, leaveSurface, panelRef]);

	return (
		<div aria-labelledby={titleId} className="relative flex" id={id} ref={panelRef} role="dialog">
			<PeekDrawer
				arrival={peeked && followUpIds.has(peeked.id) ? arrivalLine(peeked.id, review.decisionOf) : undefined}
				cap={popoverHeight}
				id={paneId}
				offset={offset}
				onHeight={setDrawerHeight}
				onPointerEnter={peek.enterPane}
				onUnpin={peek.close}
				pinned={peek.pinned}
				suggestion={peeked}
				titleId={`${id}-why-title`}
			/>
			<div
				className={cn(
					"relative z-10 flex w-[332px] flex-col rounded-xl bg-surface-overlay transition-[border-radius] duration-medium ease-in-out",
					joinedTop ? "rounded-tl-none" : null,
					joinedBottom ? "rounded-bl-none" : null,
				)}
				ref={popoverRef}
				style={{ boxShadow: token("elevation.shadow.overlay"), maxHeight }}
			>
				<PeekHeader notice={notice} onClose={onClose} onRerun={feed.rerun} ranAt={ranAt} running={running} titleId={titleId} />
				<div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pt-0.5 pb-2" ref={scrollRef} style={edgeFadeStyle(listEdges)}>
					{caughtUp ? (
						<CaughtUp
							lastBatch={history.lastBatch}
							onUndoBatch={(keyboard) => undo([...history.lastBatch], keyboard)}
							review={review}
							settled={history.settled}
						/>
					) : null}
					<DecidedSummary caughtUp={caughtUp} key={caughtUp ? "caught-up" : "reviewing"} onUndo={(undone, keyboard) => undo([undone], keyboard)} review={review} settled={history.settled} />
					<ol aria-label="Suggested field values" className="flex flex-col gap-px">
						<AnimatePresence initial={false}>
							{history.inline.map((suggestion) => (
								<PeekRow
									decision={review.decisionOf(suggestion.id)}
									isNew={feed.newIds.has(suggestion.id)}
									key={suggestion.id}
									onAccept={(keyboard) => decide(suggestion.id, "accept", keyboard)}
									onDismiss={(keyboard) => decide(suggestion.id, "dismiss", keyboard)}
									onFocusVisible={() => peek.focusRow(suggestion.id)}
									onHover={() => peek.hoverRow(suggestion.id)}
									onLeave={peek.leaveRow}
									onTogglePin={() => peek.togglePin(suggestion.id)}
									onUndo={(keyboard) => undo([suggestion.id], keyboard)}
									paneId={paneId}
									peeked={peeked?.id === suggestion.id}
									pinned={peek.pinned}
									recent={history.lastBatch.has(suggestion.id)}
									suggestion={suggestion}
								/>
							))}
						</AnimatePresence>
					</ol>
				</div>
				<PeekFooter
					onAcceptAll={(keyboard) => decideAll("accept", keyboard)}
					onClose={onClose}
					onDismissAll={(keyboard) => decideAll("dismiss", keyboard)}
					review={review}
				/>
			</div>
		</div>
	);
}
