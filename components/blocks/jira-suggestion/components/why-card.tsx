"use client";

import ClockIcon from "@atlaskit/icon/core/clock";
import VideoPlayIcon from "@atlaskit/icon/core/video-play";

import type { SuggestionConfidence, SuggestionEvidence, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { ConfluenceIcon, JiraIcon, LoomIcon } from "@/components/ui/logo";
import { SlackLogo } from "@/components/ui/logo-third-party";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { Tile } from "@/components/ui/tile";
import { cn } from "@/lib/utils";

const KIND_LABEL: Readonly<Record<SuggestionEvidence["kind"], string>> = {
	confluence: "Confluence page",
	loom: "Loom video",
	jira: "Jira",
	slack: "Slack message",
	history: "Work history",
};

const CONFIDENCE: Readonly<Record<SuggestionConfidence, { label: string; filled: number; tone: string }>> = {
	high: { label: "High confidence", filled: 3, tone: "bg-icon-success" },
	medium: { label: "Medium confidence", filled: 2, tone: "bg-icon-warning" },
};

function EvidenceMark({ kind }: Readonly<{ kind: SuggestionEvidence["kind"] }>) {
	switch (kind) {
		case "confluence":
			return <ConfluenceIcon appearance="brand" label={KIND_LABEL.confluence} size="xsmall" />;
		case "loom":
			return <LoomIcon appearance="brand" label={KIND_LABEL.loom} size="xsmall" />;
		case "jira":
			return <JiraIcon appearance="brand" label={KIND_LABEL.jira} size="xsmall" />;
		case "slack":
			return <SlackLogo label={KIND_LABEL.slack} size="xsmall" />;
		case "history":
			return (
				<Tile className="text-icon-subtle" label={KIND_LABEL.history} size="xsmall" variant="neutral">
					<ClockIcon color="currentColor" label="" size="small" />
				</Tile>
			);
		default: {
			const unreachable: never = kind;
			return unreachable;
		}
	}
}

function ConfidenceMeter({ confidence }: Readonly<{ confidence: SuggestionConfidence }>) {
	const { label, filled, tone } = CONFIDENCE[confidence];
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-text-subtlest">
			<span aria-hidden="true" className="flex items-end gap-0.5">
				{[0, 1, 2].map((bar) => (
					<span className={cn("w-0.75 rounded-full", bar < filled ? tone : "bg-bg-neutral-hovered")} key={bar} style={{ height: 6 + bar * 2 }} />
				))}
			</span>
			{label}
		</span>
	);
}

/**
 * Who, when and how long, each part kept whole and spaced rather than dotted, so a wrap never strands a separator.
 * The author reads a step stronger than the date, and a Loom's length sits in a small play chip so it reads as video.
 */
function SourceMeta({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	const parts = evidence.meta.split(" · ").filter((part) => part !== evidence.duration);
	return (
		<p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-4 text-text-subtlest">
			{parts.map((part, index) => (
				<span className={cn("whitespace-nowrap tabular-nums", index === 0 && parts.length > 1 ? "text-text-subtle" : null)} key={part}>{part}</span>
			))}
			{evidence.duration ? (
				<span className="inline-flex h-4 items-center gap-0.5 rounded-sm bg-bg-neutral pr-1 pl-0.5 whitespace-nowrap text-text-subtle tabular-nums">
					<span className="flex text-icon-subtle"><VideoPlayIcon color="currentColor" label="" size="small" /></span>
					<span className="sr-only">Video, </span>
					{evidence.duration}
				</span>
			) : null}
		</p>
	);
}

/** One source as a quiet row: product mark, title, who/when, and the passage the agent relied on. */
function SourceRow({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return (
		<li className="flex gap-2.5">
			<span className="mt-0.5 shrink-0"><EvidenceMark kind={evidence.kind} /></span>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-sm leading-5 font-medium text-pretty text-text">{evidence.title}</p>
				<SourceMeta evidence={evidence} />
				{evidence.excerpt ? (
					<blockquote className="mt-1.5 border-l-2 border-border pl-2.5 text-xs leading-4.5 text-pretty text-text-subtle">
						&ldquo;{evidence.excerpt}&rdquo;
					</blockquote>
				) : null}
			</div>
		</li>
	);
}

/** The reasoning behind one card: the headline as the title, supporting detail, confidence and sources. */
export function WhyCard({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	const { reason } = suggestion;
	return (
		<div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-3.5 pb-4">
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between gap-3">
					<span className="text-xs text-text-subtlest">{suggestion.label}</span>
					<ConfidenceMeter confidence={suggestion.confidence} />
				</div>
				<PopoverTitle className="text-sm leading-5 font-semibold text-pretty text-text">{reason.headline}</PopoverTitle>
				<PopoverDescription className="text-sm leading-5 text-pretty text-text-subtle">{reason.detail}</PopoverDescription>
			</div>
			<section aria-label="Sources" className="flex flex-col gap-3">
				<h3 className="text-xs font-medium text-text-subtlest">
					{reason.evidence.length} {reason.evidence.length === 1 ? "source" : "sources"}
				</h3>
				<ul className="flex flex-col gap-3.5">
					{reason.evidence.map((evidence) => <SourceRow evidence={evidence} key={evidence.id} />)}
				</ul>
			</section>
		</div>
	);
}
