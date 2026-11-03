"use client";

import { useState } from "react";
import AiSparkleIcon from "@atlaskit/icon/core/ai-sparkle";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { TwgToolSourceIcon } from "@/components/ui-custom/twg-tool";
import { cn } from "@/lib/utils";

import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { SUGGESTION_WORK_ITEM, type SuggestionEvidence, type WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { evidenceKindLabel, evidenceSource } from "./evidence-sources";

function whyTitle(suggestion: WorkItemSuggestion) {
	if (suggestion.value.kind === "person") return `Why we suggested ${suggestion.value.person.name}`;
	if (suggestion.value.kind === "date") return `Why we suggested ${suggestion.value.display}`;
	if (suggestion.value.kind === "issue") return `Why we suggested ${suggestion.value.issue.key}`;
	return `Why we suggested this ${suggestion.label.toLowerCase()}`;
}

/** Loom-style recording thumbnail: presenter bubble, play affordance and duration, without a fetched image. */
function LoomThumbnail({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	const presenter = evidence.meta.split(" · ")[0] ?? "";
	return (
		<span aria-hidden="true" className="relative flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-linear-to-br from-purple-700 via-purple-500 to-blue-500">
			<span className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
			<span className="relative flex size-6 items-center justify-center rounded-full bg-white/90 text-purple-700">
				<VideoPlayIcon color="currentColor" label="" size="small" />
			</span>
			<span className="absolute bottom-1 left-1 rounded-full ring-2 ring-white/80">
				<Avatar size="xs"><AvatarImage alt="" src={projectButterPersonAvatar(presenter)} /></Avatar>
			</span>
			{evidence.duration ? (
				<span className="absolute right-1 bottom-1 rounded-sm bg-black/65 px-1 text-[10px]/4 font-medium text-white tabular-nums">{evidence.duration}</span>
			) : null}
		</span>
	);
}

function EvidenceItem({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	const isLoom = evidence.kind === "loom";
	return (
		<li className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-2.5">
			<div className="flex items-start gap-2.5">
				{isLoom ? <LoomThumbnail evidence={evidence} /> : <TwgToolSourceIcon className="mt-px" size="small" source={evidenceSource(evidence.kind)} />}
				<div className="flex min-w-0 flex-col gap-0.5">
					<span className="text-sm/5 font-medium text-pretty text-text">{evidence.title}</span>
					<span className="text-xs text-text-subtlest">
						<span className="sr-only">{evidenceKindLabel(evidence.kind)}: </span>
						{evidence.meta}
					</span>
				</div>
			</div>
			{evidence.excerpt ? (
				<blockquote className="border-l-2 border-border-discovery pl-2.5 text-xs/5 text-pretty text-text-subtle">“{evidence.excerpt}”</blockquote>
			) : null}
		</li>
	);
}

type Feedback = "up" | "down" | null;

function FeedbackButtons() {
	const [feedback, setFeedback] = useState<Feedback>(null);
	const toggle = (next: Exclude<Feedback, null>) => setFeedback((current) => (current === next ? null : next));
	return (
		<span className="flex items-center gap-0.5">
			<span aria-live="polite" className="mr-1 text-xs text-text-subtlest">{feedback ? "Thanks for the feedback" : "Helpful?"}</span>
			<Button aria-label="Helpful" aria-pressed={feedback === "up"} className={cn(feedback === "up" ? "text-icon-success [&_svg]:text-icon-success" : null)} onClick={() => toggle("up")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost">
				<ThumbsUpIcon color="currentColor" label="" size="small" />
			</Button>
			<Button aria-label="Not helpful" aria-pressed={feedback === "down"} className={cn(feedback === "down" ? "text-icon-danger [&_svg]:text-icon-danger" : null)} onClick={() => toggle("down")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost">
				<ThumbsDownIcon color="currentColor" label="" size="small" />
			</Button>
		</span>
	);
}

/** "Why" card body: reasoning first, then the evidence it rests on, then confidence and feedback. */
export function WhyCard({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	const high = suggestion.confidence === "high";
	return (
		<div className="flex flex-col">
			<div className="flex flex-col gap-2 px-4 pt-4 pb-3">
				<div className="flex items-center justify-between gap-3">
					<span className="flex items-center gap-1.5 text-xs font-medium text-text-discovery">
						<AiSparkleIcon color="currentColor" label="" size="small" />
						{suggestion.label}
					</span>
					<span className="flex items-center gap-1.5 text-xs text-text-subtle">
						<span aria-hidden="true" className="flex gap-0.5">
							{[0, 1, 2].map((bar) => (
								<span className={cn("h-2.5 w-1 rounded-full", bar < (high ? 3 : 2) ? "bg-chart-success-bold" : "bg-bg-neutral")} key={bar} />
							))}
						</span>
						{high ? "High confidence" : "Medium confidence"}
					</span>
				</div>
				<PopoverTitle className="text-base font-semibold text-pretty text-text">{whyTitle(suggestion)}</PopoverTitle>
				<PopoverDescription className="text-sm/5 text-pretty text-text">{suggestion.reason.headline}</PopoverDescription>
				<p className="text-sm/5 text-pretty text-text-subtle">{suggestion.reason.detail}</p>
			</div>
			<div className="flex flex-col gap-2 px-4 pb-3">
				<span className="text-xs font-semibold text-text-subtlest">
					{suggestion.reason.evidence.length === 1 ? "1 source" : `${suggestion.reason.evidence.length} sources`}
				</span>
				<ul className="flex flex-col gap-1.5">
					{suggestion.reason.evidence.map((evidence) => <EvidenceItem evidence={evidence} key={evidence.id} />)}
				</ul>
			</div>
			<div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2">
				<span className="flex items-center gap-1.5 text-xs text-text-subtle">
					<TeamworkGraphMark className="size-3.5" />
					{SUGGESTION_WORK_ITEM.agent.name}
				</span>
				<FeedbackButtons />
			</div>
		</div>
	);
}
