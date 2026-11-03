"use client";

import { useState } from "react";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { token } from "@/lib/tokens";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { EvidenceSourceIcon } from "./evidence";
import { ConfidenceMeter, DeckValue, whyTitle } from "./field-visuals";

type Feedback = "up" | "down" | null;

/** Thumbs up/down on a suggestion's reasoning. Local only: it changes the acknowledgement copy. */
export function ReasonFeedback({ label }: Readonly<{ label: string }>) {
	const [feedback, setFeedback] = useState<Feedback>(null);
	const toggle = (next: Exclude<Feedback, null>) => setFeedback((current) => (current === next ? null : next));
	return (
		<div className="flex items-center gap-1">
			<span aria-live="polite" className="pr-1 text-xs text-text-subtlest">{feedback ? "Thanks for the feedback" : "Helpful?"}</span>
			<Button aria-label={`Helpful reasoning for ${label}`} aria-pressed={feedback === "up"} onClick={() => toggle("up")} size="icon-compact" type="button" variant="ghost">
				<ThumbsUpIcon label="" size="small" />
			</Button>
			<Button aria-label={`Unhelpful reasoning for ${label}`} aria-pressed={feedback === "down"} onClick={() => toggle("down")} size="icon-compact" type="button" variant="ghost">
				<ThumbsDownIcon label="" size="small" />
			</Button>
		</div>
	);
}

/** Everything behind a suggestion, for the queue's hover/focus/tap card. */
export function WhyContent({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	const { reason } = suggestion;
	return (
		<div className="flex flex-col">
			<div className="flex flex-col gap-3 p-4 pb-3">
				<div className="flex items-start justify-between gap-3">
					<span className="flex items-center gap-1.5 text-xs font-medium text-text-discovery">
						<LightbulbIcon color="currentColor" label="" size="small" />
						{suggestion.label}
					</span>
					<ConfidenceMeter confidence={suggestion.confidence} />
				</div>
				<h3 className="text-sm leading-5 font-semibold text-pretty text-text">{whyTitle(suggestion)}</h3>
				<div className="rounded-lg bg-bg-neutral-subtle p-2.5 ring-1 ring-border ring-inset">
					<DeckValue size="compact" value={suggestion.value} />
				</div>
				<p className="text-sm leading-5 font-medium text-pretty text-text">{reason.headline}</p>
				<p className="text-sm leading-5 text-pretty text-text-subtle">{reason.detail}</p>
			</div>
			<ul aria-label="Evidence" className="flex flex-col gap-2.5 border-t border-border px-4 py-3">
				{reason.evidence.map((evidence) => (
					<li className="flex items-start gap-2.5" key={evidence.id}>
						<span className="shrink-0 pt-px"><EvidenceSourceIcon kind={evidence.kind} size="xsmall" /></span>
						<span className="flex min-w-0 flex-col gap-0.5">
							<span className="text-sm leading-5 font-medium text-pretty text-text">{evidence.title}</span>
							<span className="flex flex-wrap items-center gap-x-1.5 text-xs text-text-subtlest">
								{evidence.meta}
								{evidence.duration ? (
									<span className="inline-flex items-center gap-1 font-medium text-text-discovery">
										<VideoPlayIcon color="currentColor" label="" size="small" />
										{evidence.duration}
									</span>
								) : null}
							</span>
							{evidence.excerpt ? <span className="mt-0.5 text-xs text-pretty text-text-subtle italic">“{evidence.excerpt}”</span> : null}
						</span>
					</li>
				))}
			</ul>
			<div className="flex items-center justify-end border-t border-border px-3 py-1.5">
				<ReasonFeedback label={suggestion.label} />
			</div>
		</div>
	);
}

/** The queue's "why" affordance: opens on hover, keyboard focus + Enter, or tap. */
export function WhyPopoverButton({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	return (
		<Popover>
			<PopoverTrigger
				render={<Button aria-label={whyTitle(suggestion)} size="icon-compact" type="button" variant="ghost" />}
				closeDelay={120}
				delay={250}
				openOnHover
			>
				<LightbulbIcon label="" size="small" />
			</PopoverTrigger>
			<PopoverContent
				align="center"
				aria-label={whyTitle(suggestion)}
				className="max-h-[min(640px,var(--available-height))] w-[340px] gap-0 overflow-y-auto p-0"
				side="left"
				sideOffset={12}
				style={{ boxShadow: token("elevation.shadow.overlay") }}
			>
				<WhyContent suggestion={suggestion} />
			</PopoverContent>
		</Popover>
	);
}
