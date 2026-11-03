"use client";

import { useId } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CrossIcon from "@atlaskit/icon/core/cross";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";
import UndoIcon from "@atlaskit/icon/core/undo";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tile } from "@/components/ui/tile";
import { TwgToolBannerBackground } from "@/components/ui-custom/twg-tool";
import { token } from "@/lib/tokens";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { EvidenceCard } from "./evidence";
import { ConfidenceMeter, DeckValue, FIELD_ICONS } from "./field-visuals";
import { ReasonFeedback } from "./why-popover";

export interface FocusCardProps {
	suggestion: WorkItemSuggestion;
	decision: SuggestionDecision;
	position: { index: number; total: number };
	hasNext: boolean;
	onAccept: () => void;
	onDismiss: () => void;
	onUndo: () => void;
	onNext: () => void;
}

function DecisionBadge({ decision }: Readonly<{ decision: Exclude<SuggestionDecision, "pending"> }>) {
	return decision === "accepted" ? (
		<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-bg-success px-2 py-0.5 text-xs font-medium whitespace-nowrap text-text-success">
			<CheckMarkIcon color="currentColor" label="" size="small" />Accepted
		</span>
	) : (
		<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-bg-neutral px-2 py-0.5 text-xs font-medium whitespace-nowrap text-text-subtle">
			<CrossIcon color="currentColor" label="" size="small" />Dismissed
		</span>
	);
}

function PendingActions({ label, onAccept, onDismiss }: Readonly<{ label: string; onAccept: () => void; onDismiss: () => void }>) {
	return (
		<>
			<span className="mr-auto flex items-center gap-1.5 text-xs text-text-subtlest">
				<Kbd>←</Kbd><Kbd>→</Kbd>
				<span>to browse</span>
			</span>
			<Button aria-keyshortcuts="D" aria-label={`Dismiss ${label} suggestion`} onClick={onDismiss} type="button" variant="outline">
				<CrossIcon label="" size="small" />
				Dismiss
				<Kbd className="ml-0.5">D</Kbd>
			</Button>
			<Button aria-keyshortcuts="A" aria-label={`Accept ${label} suggestion`} onClick={onAccept} type="button">
				<CheckMarkIcon label="" size="small" />
				Accept
				<Kbd className="ml-0.5 bg-text-inverse/20 text-text-inverse">A</Kbd>
			</Button>
		</>
	);
}

function DecidedActions({ decision, label, hasNext, onUndo, onNext }: Readonly<{ decision: Exclude<SuggestionDecision, "pending">; label: string; hasNext: boolean; onUndo: () => void; onNext: () => void }>) {
	return (
		<>
			<span className="mr-auto text-sm text-text-subtle">
				{decision === "accepted" ? (label === "Description" ? "Added to the description" : "Added to Details") : "Won’t be applied"}
			</span>
			<Button aria-keyshortcuts="U" aria-label={`Undo ${label} decision`} onClick={onUndo} type="button" variant="outline">
				<UndoIcon label="" size="small" />
				Undo
				<Kbd className="ml-0.5">U</Kbd>
			</Button>
			{hasNext ? (
				<Button onClick={onNext} type="button" variant="ghost">
					Next
					<ChevronRightIcon label="" size="small" />
				</Button>
			) : null}
		</>
	);
}

/** The suggestion in focus: field, full value, and its reasoning laid out as a visible evidence trail. */
export function FocusCard({ suggestion, decision, position, hasNext, onAccept, onDismiss, onUndo, onNext }: Readonly<FocusCardProps>) {
	const titleId = useId();
	const FieldIcon = FIELD_ICONS[suggestion.id];
	const { reason } = suggestion;
	const evidenceCount = reason.evidence.length;

	return (
		<article aria-labelledby={titleId} className="flex min-h-0 flex-col rounded-2xl bg-surface-raised" style={{ boxShadow: token("elevation.shadow.raised") }}>
			<header className="relative px-6 pt-4 pb-3">
				<div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-2xl mask-b-from-30% mask-b-to-100%"><TwgToolBannerBackground /></div>
				<div className="relative flex items-center gap-3">
					<Tile className="text-icon-discovery" label={suggestion.label} size="large" variant="discovery">
						<FieldIcon color="currentColor" label="" />
					</Tile>
					<div className="flex min-w-0 flex-1 flex-col">
						<span className="text-xs text-text-subtlest">
							Empty field · suggestion {position.index + 1} of {position.total}
						</span>
						<h2 className="text-text" id={titleId} style={{ font: token("font.heading.medium") }}>{suggestion.label}</h2>
					</div>
					{decision === "pending" ? <ConfidenceMeter confidence={suggestion.confidence} /> : <DecisionBadge decision={decision} />}
				</div>
			</header>

			<div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-5">
				<DeckValue muted={decision === "dismissed"} value={suggestion.value} />

				<section aria-label={`Why this ${suggestion.label.toLowerCase()} was suggested`} className="flex flex-col gap-2.5 rounded-xl bg-surface-sunken p-3.5">
					<div className="flex items-center justify-between gap-3">
						<span className="flex items-center gap-1.5 text-xs font-semibold text-text-discovery">
							<LightbulbIcon color="currentColor" label="" size="small" />
							Why this suggestion
						</span>
						<ReasonFeedback label={suggestion.label} />
					</div>
					<div className="flex flex-col gap-1">
						<p className="text-sm leading-5 font-medium text-pretty text-text">{reason.headline}</p>
						<p className="text-sm leading-5 text-pretty text-text-subtle">{reason.detail}</p>
					</div>
					<div className="flex flex-col gap-2">
						<span className="text-xs text-text-subtlest">Evidence · {evidenceCount} {evidenceCount === 1 ? "source" : "sources"}</span>
						<ul className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
							{reason.evidence.map((evidence) => (
								<li className="flex" key={evidence.id}><EvidenceCard evidence={evidence} /></li>
							))}
						</ul>
					</div>
				</section>
			</div>

			<footer className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
				{decision === "pending" ? (
					<PendingActions label={suggestion.label} onAccept={onAccept} onDismiss={onDismiss} />
				) : (
					<DecidedActions decision={decision} hasNext={hasNext} label={suggestion.label} onNext={onNext} onUndo={onUndo} />
				)}
			</footer>
		</article>
	);
}
