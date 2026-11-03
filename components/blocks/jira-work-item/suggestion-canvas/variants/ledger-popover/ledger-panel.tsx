"use client";

import { useEffect, useEffectEvent, useState, type RefObject } from "react";
import Image from "next/image";
import CrossIcon from "@atlaskit/icon/core/cross";

import { SUGGESTION_WORK_ITEM, type SuggestionFieldId } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { LedgerRow } from "./ledger-row";

export interface LedgerPanelProps {
	id: string;
	review: SuggestionReview;
	panelRef: RefObject<HTMLDivElement | null>;
	/** Keeps the why cards inside the preview frame; they open top-aligned with the panel. */
	cardMaxHeight?: number;
	onAccept: (id: SuggestionFieldId) => void;
	onAcceptAll: () => void;
	onClose: () => void;
}

function AgentMark() {
	return (
		<Avatar animate={false} shape="hexagon" size="xs">
			<span className="flex size-full items-center justify-center bg-blue-700">
				<Image alt="" className="size-2.5!" height={10} src="/1p/agent-lanyard/glyph-jira-triage.svg" width={10} />
			</span>
		</Avatar>
	);
}

function PanelHeader({ titleId, onClose }: Readonly<{ titleId: string; onClose: () => void }>) {
	const { agent } = SUGGESTION_WORK_ITEM;
	return (
		<header className="flex items-start gap-3 px-4 pt-3.5 pb-3">
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<h2 className="text-text" id={titleId} style={{ font: token("font.heading.xsmall") }}>Work item suggestions</h2>
				<p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-4 text-text-subtle">
					<AgentMark />
					<span className="text-text">{agent.name}</span>
					<span aria-hidden="true" className="text-text-subtlest">·</span>
					<time className="text-text-subtlest" dateTime="PT2M">2m</time>
					<span aria-hidden="true" className="text-text-subtlest">·</span>
					<span className="inline-flex items-center gap-1 text-text-subtlest">
						<TeamworkGraphMark className="size-3" />
						Teamwork Graph
					</span>
				</p>
			</div>
			<Button aria-label="Close suggestions" className="-mt-0.5 -mr-1.5" onClick={onClose} size="icon" type="button" variant="ghost">
				<CrossIcon color="currentColor" label="" size="small" />
			</Button>
		</header>
	);
}

/** One segment per suggestion, in ledger order, so progress also shows where the decisions landed. */
function ProgressSegments({ review }: Readonly<{ review: SuggestionReview }>) {
	return (
		<span aria-hidden="true" className="flex gap-0.5">
			{review.suggestions.map((suggestion) => {
				const decision = review.decisionOf(suggestion.id);
				return (
					<span
						className={cn(
							"h-1 w-3 rounded-full transition-colors duration-normal ease-out-practical",
							decision === "accepted" ? "bg-icon-success" : decision === "dismissed" ? "bg-icon-subtlest" : "bg-bg-neutral-hovered",
						)}
						key={suggestion.id}
					/>
				);
			})}
		</span>
	);
}

function PanelFooter({ review, onAcceptAll, onClose }: Readonly<{ review: SuggestionReview; onAcceptAll: () => void; onClose: () => void }>) {
	const total = review.suggestions.length;
	const reviewed = total - review.pending.length;
	const done = review.pending.length === 0;
	return (
		<footer className="flex items-center gap-3 border-t border-border px-4 py-3">
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<span aria-live="polite" className="text-xs leading-4 text-text-subtle tabular-nums">
					{done ? `All reviewed · ${review.accepted.length} applied` : `${reviewed} of ${total} reviewed`}
				</span>
				<ProgressSegments review={review} />
			</div>
			{done ? (
				<>
					<Button onClick={review.reset} type="button" variant="ghost">Start over</Button>
					<Button onClick={onClose} type="button">Done</Button>
				</>
			) : (
				<>
					<Button onClick={review.dismissAll} type="button" variant="ghost">Dismiss all</Button>
					<Button onClick={onAcceptAll} type="button">Accept all</Button>
				</>
			)}
		</footer>
	);
}

/** The ledger surface: header, one row per suggestion with the label above its full value, and a progress footer. */
export function LedgerPanel({ cardMaxHeight, id, review, panelRef, onAccept, onAcceptAll, onClose }: Readonly<LedgerPanelProps>) {
	const [whyId, setWhyId] = useState<SuggestionFieldId | null>(null);
	const titleId = `${id}-title`;
	const closeOnEscape = useEffectEvent((event: KeyboardEvent) => {
		if (event.key === "Escape" && !event.defaultPrevented) onClose();
	});
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return undefined;
		const listener = (event: KeyboardEvent) => closeOnEscape(event);
		panel.addEventListener("keydown", listener);
		return () => panel.removeEventListener("keydown", listener);
	}, [panelRef]);
	return (
		<div
			aria-labelledby={titleId}
			className="flex max-h-full w-[404px] flex-col rounded-xl bg-surface-overlay"
			id={id}
			ref={panelRef}
			role="dialog"
			style={{ boxShadow: token("elevation.shadow.overlay") }}
		>
			<PanelHeader onClose={onClose} titleId={titleId} />
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3">
				<ol aria-label="Suggested field values" className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
					{review.suggestions.map((suggestion) => (
						<LedgerRow
							decision={review.decisionOf(suggestion.id)}
							key={suggestion.id}
							onAccept={() => onAccept(suggestion.id)}
							onDismiss={() => review.dismiss(suggestion.id)}
							onUndo={() => review.undo(suggestion.id)}
							onWhyOpenChange={(open) => setWhyId((current) => (open ? suggestion.id : current === suggestion.id ? null : current))}
							suggestion={suggestion}
							whyAnchor={panelRef}
							whyMaxHeight={cardMaxHeight}
							whyOpen={whyId === suggestion.id}
						/>
					))}
				</ol>
				<div aria-hidden="true" className="h-3" />
			</div>
			<PanelFooter onAcceptAll={onAcceptAll} onClose={onClose} review={review} />
		</div>
	);
}
