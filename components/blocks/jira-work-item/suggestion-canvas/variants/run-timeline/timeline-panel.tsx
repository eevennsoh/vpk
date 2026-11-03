"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { AnimatePresence } from "motion/react";

import type { SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionFeed, SuggestionRun } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-feed";
import { token } from "@/lib/tokens";

import { CheckedNode, RunDot, RunningSection, RunSection, type RunTone } from "./run-section";
import { TimelineFooter } from "./timeline-footer";
import { TimelineHeader } from "./timeline-header";
import { PendingRow, ReceiptRow } from "./timeline-row";
import type { ViewportRect } from "./use-overlay-placement";
import { useRowDecisions } from "./use-row-decisions";

export interface TimelinePanelProps {
	id: string;
	feed: SuggestionFeed;
	panelRef: RefObject<HTMLDivElement | null>;
	/** The single decision whose Undo stays in view. */
	latestDecisionId: SuggestionFieldId | null;
	getWhyBoundary: () => ViewportRect | undefined;
	onAccept: (id: SuggestionFieldId) => void;
	onDismiss: (id: SuggestionFieldId) => void;
	onUndo: (id: SuggestionFieldId) => void;
	onAcceptAll: () => void;
	onDismissAll: () => void;
	onClose: () => void;
}

/** Newest first. A run that found nothing is only worth showing while it is the latest word. */
function visibleRuns(runs: readonly SuggestionRun[]): readonly SuggestionRun[] {
	return runs.filter((run, index) => run.ids.length > 0 || index === runs.length - 1).toReversed();
}

function pendingFirst(run: SuggestionRun, feed: SuggestionFeed): readonly SuggestionFieldId[] {
	const isPending = (fieldId: SuggestionFieldId) => feed.review.decisionOf(fieldId) === "pending";
	return [...run.ids.filter(isPending), ...run.ids.filter((fieldId) => !isPending(fieldId))];
}

function runState(run: SuggestionRun, feed: SuggestionFeed): { tone: RunTone; meta: string } {
	const fresh = run.ids.filter((id) => feed.newIds.has(id)).length;
	if (fresh > 0) return { tone: "new", meta: `${fresh} new` };
	const open = run.ids.some((id) => feed.review.decisionOf(id) === "pending");
	// Progress is counted once, in the footer. Run lines only say what the run brought, or that it is settled.
	if (!open) return { tone: "settled", meta: "All reviewed" };
	return { tone: "open", meta: `${run.ids.length} ${run.ids.length === 1 ? "suggestion" : "suggestions"}` };
}

/** Popover surface: suggestions grouped by agent run, newest first, on a thread that appears once there are two runs. */
export function TimelinePanel({ id, feed, panelRef, latestDecisionId, getWhyBoundary, onAccept, onDismiss, onUndo, onAcceptAll, onDismissAll, onClose }: Readonly<TimelinePanelProps>) {
	const { review } = feed;
	const [whyId, setWhyId] = useState<SuggestionFieldId | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const titleId = `${id}-title`;
	const runs = visibleRuns(feed.runs);
	const running = feed.status === "running";
	const byId = new Map(review.suggestions.map((suggestion) => [suggestion.id, suggestion]));
	const latest = feed.runs.at(-1);
	const showThread = runs.length + (running ? 1 : 0) > 1;

	// A decided row's why card goes with it, so Escape never spends itself on a card that is no longer there.
	const forgetWhy = (fieldId: SuggestionFieldId) => setWhyId((current) => (current === fieldId ? null : current));
	const decide = useRowDecisions(panelRef, {
		accept: (fieldId) => {
			forgetWhy(fieldId);
			onAccept(fieldId);
		},
		dismiss: (fieldId) => {
			forgetWhy(fieldId);
			onDismiss(fieldId);
		},
		undo: onUndo,
	});

	// Escape peels one layer at a time: an open why card first (focus stays where it is), then the popover.
	const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
		if (event.key !== "Escape" || event.defaultPrevented) return;
		// Claim the key: the pan/zoom canvas also listens for Escape and would otherwise reframe the preview.
		event.preventDefault();
		event.stopPropagation();
		if (whyId != null) {
			setWhyId(null);
			return;
		}
		onClose();
	});
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return undefined;
		const listener = (event: KeyboardEvent) => closeOnEscape(event);
		panel.addEventListener("keydown", listener);
		return () => panel.removeEventListener("keydown", listener);
	}, [panelRef]);

	// Newest runs land at the top; bring the reader there when the agent starts or finishes.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
	}, [running, feed.runs.length]);

	const announcement = running
		? "Checking for new suggestions"
		: feed.runs.length > 1 && latest
			? latest.ids.length === 0 ? "No new suggestions" : `${latest.ids.length} new suggestions`
			: "";

	return (
		<div
			aria-labelledby={titleId}
			className="flex max-h-full w-104 flex-col rounded-xl bg-surface-overlay outline-none"
			id={id}
			ref={panelRef}
			role="dialog"
			tabIndex={-1}
			style={{ boxShadow: token("elevation.shadow.overlay") }}
		>
			<TimelineHeader feed={feed} onClose={onClose} titleId={titleId} />
			<p aria-live="polite" className="sr-only">{announcement}</p>
			<div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain" ref={scrollRef}>
				<ol aria-label="Agent runs" className="flex flex-col">
					<AnimatePresence initial={false}>
						{running ? <RunningSection hasOlder={runs.length > 0} key="running" /> : null}
						{runs.map((run, index) => {
							const empty = run.ids.length === 0;
							const state = runState(run, feed);
							return (
								<RunSection
									hasNewer={running || index > 0}
									showThread={showThread}
									hasOlder={index < runs.length - 1}
									key={`run-${run.number}`}
									label={empty ? `${run.ranAt}, nothing new` : `Run ${run.number}, ${run.ranAt}, ${state.meta}`}
									meta={<span className={!empty && state.tone === "new" ? "font-medium text-text-information" : "text-text-subtlest"}>{empty ? "Nothing new" : state.meta}</span>}
									node={empty ? <CheckedNode /> : <RunDot tone={state.tone} />}
									when={run.ranAt}
								>
									{empty ? null : (
										<ul aria-label={`Suggestions from run ${run.number}`} className="flex flex-col gap-px">
											<AnimatePresence initial={false}>
												{/* Pending work stays together at the top of its run; decided receipts collect below it, in run order. */}
												{pendingFirst(run, feed).map((fieldId) => {
													const suggestion = byId.get(fieldId);
													if (!suggestion) return null;
													const decision = review.decisionOf(fieldId);
													return decision === "pending" ? (
														<PendingRow
															getWhyBoundary={getWhyBoundary}
															isNew={feed.newIds.has(fieldId)}
															key={`${fieldId}:pending`}
															onAccept={(event) => decide("accept", fieldId, event)}
															onDismiss={(event) => decide("dismiss", fieldId, event)}
															onWhyOpenChange={(open) => setWhyId((current) => (open ? fieldId : current === fieldId ? null : current))}
															panelRef={panelRef}
															suggestion={suggestion}
															whyOpen={whyId === fieldId}
														/>
													) : (
														<ReceiptRow
															decision={decision}
															isLatest={latestDecisionId === fieldId}
															key={`${fieldId}:receipt`}
															onUndo={(event) => decide("undo", fieldId, event)}
															suggestion={suggestion}
														/>
													);
												})}
											</AnimatePresence>
										</ul>
									)}
								</RunSection>
							);
						})}
					</AnimatePresence>
				</ol>
				{/* A soft edge above the footer, so a row cut by the fold reads as "more below", not clipped. */}
				<div aria-hidden="true" className="pointer-events-none sticky bottom-0 z-10 -mt-4 h-4 bg-linear-to-t from-surface-overlay" />
			</div>
			<TimelineFooter feed={feed} onAcceptAll={onAcceptAll} onClose={onClose} onDismissAll={onDismissAll} />
		</div>
	);
}
