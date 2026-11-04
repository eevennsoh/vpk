"use client";

import { useState } from "react";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";

import type { SuggestionConfidence, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { Button } from "@/components/ui/button";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { EvidenceCard } from "./evidence";

type Feedback = "up" | "down" | null;

const CONFIDENCE: Readonly<Record<SuggestionConfidence, { label: string; filled: number; tone: string }>> = {
	high: { label: "High confidence", filled: 3, tone: "bg-icon-success" },
	medium: { label: "Medium confidence", filled: 2, tone: "bg-icon-warning" },
};

/** What the title calls the suggested value: a name when it is short, the field otherwise. */
export function whySubject(suggestion: WorkItemSuggestion): string {
	switch (suggestion.value.kind) {
		case "person":
			return suggestion.value.person.name;
		case "date":
			return suggestion.value.display;
		case "issue":
			return suggestion.value.issue.key;
		case "labels":
			return "these labels";
		case "checklist":
			return "these criteria";
		case "paragraph":
			return "this description";
		default: {
			const unreachable: never = suggestion.value;
			return unreachable;
		}
	}
}

export function ConfidenceMeter({ confidence, className }: Readonly<{ confidence: SuggestionConfidence; className?: string }>) {
	const { label, filled, tone } = CONFIDENCE[confidence];
	return (
		<span className={cn("inline-flex items-center gap-1.5 text-xs text-text-subtle", className)}>
			<span aria-hidden="true" className="flex items-end gap-0.5">
				{[0, 1, 2].map((bar) => (
					<span className={cn("w-[3px] rounded-full", bar < filled ? tone : "bg-bg-neutral-hovered")} key={bar} style={{ height: 6 + bar * 2 }} />
				))}
			</span>
			{label}
		</span>
	);
}

function FeedbackRow({ subject }: Readonly<{ subject: string }>) {
	const [feedback, setFeedback] = useState<Feedback>(null);
	const toggle = (next: Exclude<Feedback, null>) => setFeedback((current) => (current === next ? null : next));
	return (
		<div className="flex min-h-11 items-center justify-between gap-3 border-t border-border px-4 py-2">
			<p aria-live="polite" className="text-xs text-text-subtle">
				{feedback == null ? "Was this reasoning helpful?" : "Thanks. The agent learns from this."}
			</p>
			<div className="flex items-center gap-0.5">
				<Button aria-label={`Helpful reasoning for ${subject}`} aria-pressed={feedback === "up"} onClick={() => toggle("up")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost" className="aria-pressed:text-icon-success aria-pressed:[&_svg]:text-icon-success">
					<ThumbsUpIcon color="currentColor" label="" size="small" />
				</Button>
				<Button aria-label={`Unhelpful reasoning for ${subject}`} aria-pressed={feedback === "down"} onClick={() => toggle("down")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost" className="aria-pressed:text-icon-danger aria-pressed:[&_svg]:text-icon-danger">
					<ThumbsDownIcon color="currentColor" label="" size="small" />
				</Button>
			</div>
		</div>
	);
}

/** The body of a row's "why" popover: reasoning, confidence, evidence and feedback. */
export function WhyCardBody({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	const subject = whySubject(suggestion);
	const { reason } = suggestion;
	return (
		<>
			<div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pt-3.5 pb-4">
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between gap-3">
						<span className="text-xs text-text-subtlest">{suggestion.label}</span>
						<ConfidenceMeter confidence={suggestion.confidence} />
					</div>
					<PopoverTitle className="text-sm leading-5 font-semibold text-pretty text-text">Why we suggested {subject}</PopoverTitle>
				</div>
				<PopoverDescription className="flex flex-col gap-1.5 text-sm leading-5 text-pretty">
					<span className="text-text">{reason.headline}</span>
					<span className="text-text-subtle">{reason.detail}</span>
				</PopoverDescription>
				<section aria-label="Sources" className="flex flex-col gap-2">
					<h3 className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
						Sources
						<span className="text-text-subtlest tabular-nums">{reason.evidence.length}</span>
					</h3>
					<ul className="flex flex-col">
						{reason.evidence.map((evidence) => (
							<li className="border-t border-border py-3 first:border-t-0 first:pt-1 last:pb-0" key={evidence.id}><EvidenceCard evidence={evidence} /></li>
						))}
					</ul>
				</section>
			</div>
			<FeedbackRow subject={subject} />
		</>
	);
}
