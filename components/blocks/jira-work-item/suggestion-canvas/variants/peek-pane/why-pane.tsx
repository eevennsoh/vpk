"use client";

import { useState } from "react";
import CrossIcon from "@atlaskit/icon/core/cross";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";

import type { SuggestionConfidence, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { EvidenceItem } from "./evidence";

type Feedback = "up" | "down" | null;

const CONFIDENCE: Readonly<Record<SuggestionConfidence, { label: string; filled: number; tone: string }>> = {
	high: { label: "High confidence", filled: 3, tone: "bg-icon-success" },
	medium: { label: "Medium confidence", filled: 2, tone: "bg-icon-warning" },
};

function ConfidenceMeter({ confidence }: Readonly<{ confidence: SuggestionConfidence }>) {
	const { label, filled, tone } = CONFIDENCE[confidence];
	return (
		<span className="inline-flex items-center gap-1.5 text-xs leading-4 text-text-subtle">
			<span aria-hidden="true" className="flex items-end gap-0.5">
				{[0, 1, 2].map((bar) => (
					<span className={cn("w-0.75 rounded-full", bar < filled ? tone : "bg-bg-neutral-hovered")} key={bar} style={{ height: 6 + bar * 2 }} />
				))}
			</span>
			{label}
		</span>
	);
}

function FeedbackRow({ label }: Readonly<{ label: string }>) {
	const [feedback, setFeedback] = useState<Feedback>(null);
	const toggle = (next: Exclude<Feedback, null>) => setFeedback((current) => (current === next ? null : next));
	return (
		<div className="flex items-center justify-between gap-3">
			<p aria-live="polite" className="text-xs leading-4 text-text-subtlest">
				{feedback == null ? "Was this helpful?" : "Thanks for the feedback"}
			</p>
			<div className="-mr-1.5 flex items-center">
				<Button aria-label={`Helpful reasoning for ${label}`} aria-pressed={feedback === "up"} className="aria-pressed:[&_svg]:text-icon-success" onClick={() => toggle("up")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost">
					<ThumbsUpIcon color="currentColor" label="" size="small" />
				</Button>
				<Button aria-label={`Unhelpful reasoning for ${label}`} aria-pressed={feedback === "down"} className="aria-pressed:[&_svg]:text-icon-danger" onClick={() => toggle("down")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost">
					<ThumbsDownIcon color="currentColor" label="" size="small" />
				</Button>
			</div>
		</div>
	);
}

export interface WhyPaneContentProps {
	suggestion: WorkItemSuggestion;
	/** Found on a later run: what let the agent find it, already resolved against the current decisions. */
	arrival: string | undefined;
	pinned: boolean;
	onUnpin: () => void;
	titleId: string;
}

/** The explanation for one suggestion: reasoning first, confidence, then the sources it rests on. */
export function WhyPaneContent({ suggestion, arrival, pinned, onUnpin, titleId }: Readonly<WhyPaneContentProps>) {
	const { reason } = suggestion;
	return (
		<div className={cn("flex flex-col gap-4 px-4 pt-3.5", pinned ? "pb-2.5" : "pb-4")}>
			<div className="flex flex-col gap-1.5">
				<div className="flex min-h-6 items-center justify-between gap-2">
					<span className="text-xs leading-4 text-text-subtlest">{suggestion.label}</span>
					{pinned ? (
						<Tooltip>
							<TooltipTrigger
								render={<Button aria-label="Unpin explanation" className="-mr-1.5" onClick={onUnpin} size="icon-compact" type="button" variant="ghost" />}
							>
								<CrossIcon color="currentColor" label="" size="small" />
							</TooltipTrigger>
							<TooltipContent>Unpin</TooltipContent>
						</Tooltip>
					) : null}
				</div>
				{arrival ? (
					<span className="inline-flex items-center gap-1 text-xs leading-4 font-medium text-text-discovery">
						<RefreshIcon color="currentColor" label="" size="small" />
						{arrival}
					</span>
				) : null}
				<h3 className="text-sm leading-5 font-semibold text-pretty text-text" id={titleId}>{reason.headline}</h3>
				<p className="text-sm leading-5 text-pretty text-text-subtle">{reason.detail}</p>
				<span className="pt-0.5"><ConfidenceMeter confidence={suggestion.confidence} /></span>
			</div>
			<section aria-label="Sources" className="flex flex-col gap-3">
				<h4 className="flex items-center gap-1.5 text-xs leading-4 text-text-subtlest">
					Sources
					<span aria-hidden="true">·</span>
					<span className="tabular-nums">{reason.evidence.length}</span>
				</h4>
				<ul className="flex flex-col gap-3.5">
					{reason.evidence.map((evidence) => (
						<li key={evidence.id}><EvidenceItem evidence={evidence} /></li>
					))}
				</ul>
			</section>
			{/* Feedback is for a pane someone stopped to read, so a passing peek stays free of it. */}
			{pinned ? <FeedbackRow label={suggestion.label} /> : null}
		</div>
	);
}
