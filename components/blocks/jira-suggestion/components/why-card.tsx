"use client";

import ClockIcon from "@atlaskit/icon/core/clock";

import type { SuggestionConfidence, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SourcesMenu } from "@/components/ui-custom/sources-menu";
import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";
import { cn } from "@/lib/utils";

const SOURCE_TYPES: Readonly<Record<WorkItemSuggestion["reason"]["evidence"][number]["kind"], TwgToolSource>> = {
	confluence: { id: "confluence", label: "Confluence", provider: "confluence" },
	jira: { id: "jira", label: "Jira", provider: "jira" },
	loom: { id: "loom", label: "Loom", provider: "loom" },
	slack: { id: "slack", label: "Slack", provider: "twg", name: "slack" },
	history: { id: "history", label: "Work history", provider: "twg", iconSize: "small", iconInset: true, icon: <span className="inline-flex text-icon-subtle"><ClockIcon color="currentColor" label="" size="small" /></span> },
};

const CONFIDENCE: Readonly<Record<SuggestionConfidence, { label: string; filled: number; tone: string }>> = {
	high: { label: "High confidence", filled: 3, tone: "bg-icon-success" },
	medium: { label: "Medium confidence", filled: 2, tone: "bg-icon-warning" },
};

function ConfidenceMeter({ confidence }: Readonly<{ confidence: SuggestionConfidence }>) {
	const { label, filled, tone } = CONFIDENCE[confidence];
	return (
		<Tooltip>
			<TooltipTrigger render={<span role="img" tabIndex={0} aria-label={label} />} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent hover:bg-bg-neutral-subtle-hovered focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
				<span aria-hidden="true" className="flex items-end gap-0.5">
					{[0, 1, 2].map((bar) => (
						<span className={cn("w-0.75 rounded-full", bar < filled ? tone : "bg-bg-neutral-hovered")} key={bar} style={{ height: 6 + bar * 2 }} />
					))}
				</span>
			</TooltipTrigger>
			<TooltipContent positionerClassName="z-[750]">{label}</TooltipContent>
		</Tooltip>
	);
}

/**
 * The reasoning behind one card: the headline as the title, supporting detail, confidence and sources. In a popover it
 * names the field and titles the popup; inline, under the card's own label, it skips the field and pads like the card it
 * expands. Sources are grouped in a menu.
 */
export function WhyCard({ suggestion, inline = false, showField = !inline }: Readonly<{ suggestion: WorkItemSuggestion; inline?: boolean; /** Name the field; left out wherever the reasoning already sits on that field. */ showField?: boolean }>) {
	const { reason } = suggestion;
	const headline = "text-sm leading-5 font-medium text-pretty text-text";
	const detail = "text-sm leading-5 text-pretty text-text-subtle";
	return (
		<div className={cn("flex min-h-0 flex-col gap-3", inline ? "px-4 py-3" : "overflow-y-auto overscroll-contain px-4 pt-4 pb-3")}>
			<div className="flex flex-col gap-1.5">
				{showField ? <span className="mb-1.5 text-xs text-text-subtlest">{suggestion.label}</span> : null}
				{inline ? (
					<>
						<p className={headline}>{reason.headline}</p>
						<p className={detail}>{reason.detail}</p>
					</>
				) : (
					<>
						<PopoverTitle className={headline}>{reason.headline}</PopoverTitle>
						<PopoverDescription className={detail}>{reason.detail}</PopoverDescription>
					</>
				)}
			</div>
			<div className="flex items-center justify-between gap-3">
				<div className="-ml-1">
					<SourcesMenu
						positionerClassName="z-[750]"
						simpleSources={reason.evidence.map((evidence) => ({ id: evidence.id, title: evidence.title, href: "", source: SOURCE_TYPES[evidence.kind] }))}
						variant="simple"
					/>
				</div>
				<ConfidenceMeter confidence={suggestion.confidence} />
			</div>
		</div>
	);
}
