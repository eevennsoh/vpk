"use client";

import { useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";

import { focusKey } from "./ledger-focus";
import { LedgerFooter } from "./ledger-footer";
import { LedgerHeader } from "./ledger-header";
import { LedgerRow } from "./ledger-row";
import { LedgerStatus } from "./ledger-status";
import { useFocusHandoff, useLedgerEscape, useRevealArrivals, useScrollEdges } from "./use-ledger-panel";

export interface LedgerPanelProps {
	id: string;
	feed: SuggestionFeed;
	panelRef: RefObject<HTMLDivElement | null>;
	/** The banner button that opened the ledger; Escape there still closes it. */
	triggerRef: RefObject<HTMLButtonElement | null>;
	/** The free area below the trigger banner; why cards stay inside it. */
	whyBoundary: Element | null;
	onAccept: (id: SuggestionFieldId) => void;
	onAcceptAll: () => void;
	onClose: () => void;
}

interface RunGroup {
	number: number;
	/** Divider copy for earlier runs. The newest run needs none: its rows carry "New" and the byline says "Just now". */
	label: string | null;
	rows: readonly WorkItemSuggestion[];
}

/** Newest run first, each run in the agent's order, so arrivals land at the top. */
function runGroups(feed: SuggestionFeed): readonly RunGroup[] {
	const byId = new Map(feed.review.suggestions.map((suggestion) => [suggestion.id, suggestion]));
	const latest = feed.runs.at(-1)?.number;
	return feed.runs.toReversed().flatMap((run) => {
		const rows = run.ids.flatMap((id) => byId.get(id) ?? []);
		return rows.length > 0 ? [{ number: run.number, label: run.number === latest ? null : `Earlier · ${run.ranAt}`, rows }] : [];
	});
}

const DIVIDER = { duration: motionDuration.medium, ease: motionEase.inOut };
const DIVIDER_EXIT = { duration: motionDuration.normal, ease: motionEase.in };

/** A section break on the row grid: the same inset hairline as between rows, then a small label at the row's top inset. */
function RunDivider({ label }: Readonly<{ label: string }>) {
	return (
		<motion.li
			animate={{ height: "auto", opacity: 1 }}
			className="relative overflow-hidden before:pointer-events-none before:absolute before:inset-x-2.5 before:top-0 before:h-px before:bg-border"
			exit={{ height: 0, opacity: 0, transition: DIVIDER_EXIT }}
			initial={{ height: 0, opacity: 0 }}
			role="presentation"
			transition={DIVIDER}
		>
			<p className="px-2.5 pt-3 pb-0.5 text-[11px] leading-4 font-medium text-text-subtlest">{label}</p>
		</motion.li>
	);
}

/** The ledger surface: header with re-run, one status block, airy rows grouped by run, and a progress footer. */
export function LedgerPanel({ id, feed, panelRef, triggerRef, whyBoundary, onAccept, onAcceptAll, onClose }: Readonly<LedgerPanelProps>) {
	const { review } = feed;
	const [whyId, setWhyId] = useState<SuggestionFieldId | null>(null);
	const [reviewedOpen, setReviewedOpen] = useState(false);
	const { bodyRef, topRef, bottomRef, scrolled, moreBelow } = useScrollEdges();
	useRevealArrivals(feed, bodyRef);
	const requestFocus = useFocusHandoff(panelRef, feed);
	useLedgerEscape({ panelRef, triggerRef, whyOpen: whyId != null, closeWhy: () => setWhyId(null), onClose });

	const titleId = `${id}-title`;
	const listId = `${id}-list`;
	const groups = runGroups(feed);
	const ordered = groups.flatMap((group) => group.rows);
	const caughtUp = review.pending.length === 0;
	const showRows = !caughtUp || reviewedOpen;
	const grouped = feed.newIds.size > 0 && groups.length > 1;

	/** After a decision, focus the row's Undo; the last decision hands focus to the caught-up "Check again". */
	const decide = (suggestionId: SuggestionFieldId, apply: () => void) => {
		const last = review.pending.length === 1 && review.decisionOf(suggestionId) === "pending";
		if (last) setReviewedOpen(false);
		setWhyId(null);
		apply();
		requestFocus(last ? focusKey.checkAgain : focusKey.undo(suggestionId));
	};
	const decideAll = (apply: () => void) => {
		setReviewedOpen(false);
		setWhyId(null);
		apply();
		requestFocus(focusKey.checkAgain);
	};

	return (
		<div
			aria-labelledby={titleId}
			className="flex max-h-full w-[400px] flex-col rounded-xl bg-surface-overlay outline-none"
			id={id}
			ref={panelRef}
			role="dialog"
			style={{ boxShadow: token("elevation.shadow.overlay") }}
			// A click on the panel's quiet areas keeps focus inside it, so Escape stays in scope.
			tabIndex={-1}
		>
			<LedgerHeader feed={feed} onClose={onClose} scrolled={scrolled} titleId={titleId} />
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5" ref={bodyRef}>
				<div aria-hidden="true" className="h-px" ref={topRef} />
				<LedgerStatus feed={feed} />
				<ol aria-label="Suggested field values" className="flex flex-col" id={listId}>
					<AnimatePresence initial={false}>
						{showRows ? groups.flatMap((group) => [
							grouped && group.label ? <RunDivider key={`run-${group.number}`} label={group.label} /> : null,
							...group.rows.map((suggestion, index) => (
								<LedgerRow
									decision={review.decisionOf(suggestion.id)}
									isNew={feed.newIds.has(suggestion.id)}
									key={suggestion.id}
									compact={caughtUp}
									leading={grouped && group.label != null && index === 0}
									onAccept={() => decide(suggestion.id, () => onAccept(suggestion.id))}
									onDismiss={() => decide(suggestion.id, () => review.dismiss(suggestion.id))}
									onUndo={() => {
										review.undo(suggestion.id);
										requestFocus(focusKey.accept(suggestion.id));
									}}
									onWhyOpenChange={(open) => setWhyId((current) => (open ? suggestion.id : current === suggestion.id ? null : current))}
									otherWhyOpen={whyId != null && whyId !== suggestion.id}
									suggestion={suggestion}
									whyBoundary={whyBoundary}
									whyOpen={whyId === suggestion.id}
								/>
							)),
						]) : null}
					</AnimatePresence>
				</ol>
				<div aria-hidden="true" className="h-px" ref={bottomRef} />
			</div>
			<LedgerFooter
				moreBelow={moreBelow}
				onAcceptAll={() => decideAll(onAcceptAll)}
				onClose={onClose}
				onDismissAll={() => decideAll(review.dismissAll)}
				onToggleReviewed={() => setReviewedOpen((current) => !current)}
				ordered={ordered}
				review={review}
				reviewedListId={listId}
				reviewedOpen={reviewedOpen}
			/>
		</div>
	);
}
