"use client";

import { useState } from "react";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import { Button } from "@/components/ui/button";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";

import type { SuggestionEvidence, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { ConfidenceMeter } from "./confidence-meter";
import { SourceMark } from "./source-mark";

function LoomThumbnail({ duration }: Readonly<{ duration: string }>) {
	return (
		<span aria-hidden="true" className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-linear-to-br from-bg-accent-purple-subtler to-bg-accent-blue-subtler">
			<span className="flex size-6 items-center justify-center rounded-full bg-surface-overlay text-icon">
				<VideoPlayIcon color="currentColor" label="" size="small" />
			</span>
			<span className="absolute right-1 bottom-1 rounded-xs bg-bg-neutral-bold px-1 text-[10px]/[14px] font-medium text-text-inverse">{duration}</span>
		</span>
	);
}

function EvidenceItem({ item }: Readonly<{ item: SuggestionEvidence }>) {
	return (
		<li className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-2.5">
			<div className="flex items-start gap-2.5">
				{item.kind === "loom" && item.duration ? <LoomThumbnail duration={item.duration} /> : (
					<span className="mt-0.5 shrink-0"><SourceMark kind={item.kind} size="xsmall" /></span>
				)}
				<span className="flex min-w-0 flex-col gap-0.5">
					<span className="text-sm font-medium text-pretty text-text">{item.title}</span>
					<span className="text-xs text-text-subtlest">
						{item.kind === "loom" ? <span className="sr-only">Loom video, {item.duration}. </span> : null}
						{item.meta}
					</span>
				</span>
			</div>
			{item.excerpt ? (
				<blockquote className="border-l-2 border-border-bold pl-2.5 text-xs/5 text-pretty text-text-subtle">“{item.excerpt}”</blockquote>
			) : null}
		</li>
	);
}

function Feedback() {
	const [vote, setVote] = useState<"up" | "down" | null>(null);
	const toggle = (next: "up" | "down") => setVote((current) => (current === next ? null : next));
	return (
		<div className="flex items-center gap-0.5">
			<span aria-live="polite" className="mr-1 text-xs text-text-subtlest">{vote ? "Thanks for the feedback" : "Helpful?"}</span>
			<Button aria-label="Helpful reasoning" aria-pressed={vote === "up"} onClick={() => toggle("up")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost">
				<ThumbsUpIcon color="currentColor" label="" size="small" />
			</Button>
			<Button aria-label="Unhelpful reasoning" aria-pressed={vote === "down"} onClick={() => toggle("down")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost">
				<ThumbsDownIcon color="currentColor" label="" size="small" />
			</Button>
		</div>
	);
}

/** Body of the "why" popover: the agent's reasoning first, then the evidence it read, then confidence. */
export function WhyCard({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	const { reason } = suggestion;
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1.5">
				<span className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
					<TeamworkGraphMark className="size-3.5" />
					Why we suggested this {suggestion.label.toLowerCase()}
				</span>
				<PopoverTitle className="text-sm/5 font-semibold text-pretty text-text">{reason.headline}</PopoverTitle>
				<PopoverDescription className="text-sm/5 text-pretty text-text-subtle">{reason.detail}</PopoverDescription>
			</div>
			<ul aria-label="Evidence" className="flex flex-col gap-1.5">
				{reason.evidence.map((item) => <EvidenceItem item={item} key={item.id} />)}
			</ul>
			<div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
				<ConfidenceMeter confidence={suggestion.confidence} wording="full" />
				<Feedback />
			</div>
		</div>
	);
}
