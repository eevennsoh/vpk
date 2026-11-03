"use client";

import { useState } from "react";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import { Button } from "@/components/ui/button";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import type { SuggestionConfidence, SuggestionEvidence, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { CONFIDENCE_LABEL, SOURCE_META } from "./model";
import { SourceIcon } from "./source-icon";

/** Three-step meter: high fills all three, medium fills two. Colour is never the only signal; the label always follows. */
export function ConfidenceMeter({ confidence, className }: Readonly<{ confidence: SuggestionConfidence; className?: string }>) {
	const filled = confidence === "high" ? 3 : 2;
	const tone = confidence === "high" ? "bg-icon-success" : "bg-icon-warning";
	return (
		<span aria-hidden="true" className={cn("inline-flex items-end gap-0.5", className)}>
			{[0, 1, 2].map((step) => (
				<span className={cn("w-[3px] rounded-full", step < filled ? tone : "bg-bg-neutral-hovered")} key={step} style={{ height: 6 + step * 2 }} />
			))}
		</span>
	);
}

function LoomThumbnail({ duration }: Readonly<{ duration?: string }>) {
	return (
		<span aria-hidden="true" className="relative flex h-14 w-24 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-purple-200 to-blue-200">
			<span className="flex size-6 items-center justify-center rounded-full bg-surface-overlay text-icon" style={{ boxShadow: token("elevation.shadow.raised") }}>
				<VideoPlayIcon color="currentColor" label="" size="small" />
			</span>
			{duration ? (
				<span className="absolute right-1 bottom-1 rounded-xs bg-bg-neutral-bold px-1 text-[10px]/3.5 font-semibold text-text-inverse">{duration}</span>
			) : null}
		</span>
	);
}

function EvidenceItem({ evidence, showExcerpt }: Readonly<{ evidence: SuggestionEvidence; showExcerpt: boolean }>) {
	const isLoom = evidence.kind === "loom";
	return (
		<li className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
			<div className="flex items-start gap-2.5">
				{isLoom ? <LoomThumbnail duration={evidence.duration} /> : <SourceIcon className="mt-0.5" kind={evidence.kind} />}
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className="text-sm/5 font-medium text-pretty text-text">{evidence.title}</span>
					<span className="text-xs text-text-subtlest">
						{isLoom ? <span className="sr-only">Loom video, {evidence.duration}. </span> : <span className="sr-only">{SOURCE_META[evidence.kind].name}: </span>}
						{evidence.meta}
					</span>
				</div>
			</div>
			{showExcerpt && evidence.excerpt ? (
				<blockquote className="border-l-2 border-border-bold pl-2.5 text-xs/5 text-pretty text-text-subtle">“{evidence.excerpt}”</blockquote>
			) : null}
		</li>
	);
}

export function EvidenceList({ evidence, showExcerpt = true }: Readonly<{ evidence: readonly SuggestionEvidence[]; showExcerpt?: boolean }>) {
	return (
		<ul aria-label="Evidence" className="flex flex-col gap-2">
			{evidence.map((item) => <EvidenceItem evidence={item} key={item.id} showExcerpt={showExcerpt} />)}
		</ul>
	);
}

type Feedback = "up" | "down" | null;

/** Thumbs feedback. Local only; the pressed state is the whole outcome. */
export function ReasonFeedback() {
	const [feedback, setFeedback] = useState<Feedback>(null);
	const toggle = (next: Exclude<Feedback, null>) => setFeedback((prev) => (prev === next ? null : next));
	return (
		<div className="flex items-center justify-between gap-3">
			<span aria-live="polite" className="text-xs text-text-subtlest">{feedback ? "Thanks — this helps the agent learn." : "Was this reasoning helpful?"}</span>
			<span className="flex items-center gap-0.5">
				<Button aria-label="Helpful" aria-pressed={feedback === "up"} onClick={() => toggle("up")} selectedAppearance="icon-only" size="icon-compact" variant="ghost">
					<ThumbsUpIcon color="currentColor" label="" size="small" />
				</Button>
				<Button aria-label="Not helpful" aria-pressed={feedback === "down"} onClick={() => toggle("down")} selectedAppearance="icon-only" size="icon-compact" variant="ghost">
					<ThumbsDownIcon color="currentColor" label="" size="small" />
				</Button>
			</span>
		</div>
	);
}

/** Headline, reasoning and confidence: the shared core of the hover card and the inline disclosure. */
export function ReasonSummary({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	return (
		<div className="flex flex-col gap-1.5">
			<p className="text-sm/5 font-medium text-pretty text-text">{suggestion.reason.headline}</p>
			<p className="text-sm/5 text-pretty text-text-subtle">{suggestion.reason.detail}</p>
			<span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-subtle">
				<ConfidenceMeter confidence={suggestion.confidence} />
				{CONFIDENCE_LABEL[suggestion.confidence]}
				<span aria-hidden="true" className="text-text-subtlest">·</span>
				<span className="text-text-subtlest">{suggestion.reason.evidence.length} {suggestion.reason.evidence.length === 1 ? "source" : "sources"}</span>
			</span>
		</div>
	);
}
