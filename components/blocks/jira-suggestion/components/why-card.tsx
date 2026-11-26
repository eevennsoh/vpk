"use client";

import ClockIcon from "@atlaskit/icon/core/clock";

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

/** One source as a quiet row: product mark and title. */
function SourceRow({ evidence }: Readonly<{ evidence: SuggestionEvidence }>) {
	return (
		<li className="flex gap-3">
			<span className="mt-0.5 shrink-0"><EvidenceMark kind={evidence.kind} /></span>
			<p className="min-w-0 flex-1 text-sm leading-5 font-medium text-pretty text-text">{evidence.title}</p>
		</li>
	);
}

/**
 * The reasoning behind one card: the headline as the title, supporting detail, confidence and sources. In a popover it
 * names the field and titles the popup; inline, under the card's own label, it skips the field and pads like the card it
 * expands. Sources are listed by mark and title.
 */
export function WhyCard({ suggestion, inline = false, showField = !inline }: Readonly<{ suggestion: WorkItemSuggestion; inline?: boolean; /** Name the field; left out wherever the reasoning already sits on that field. */ showField?: boolean }>) {
	const { reason } = suggestion;
	const headline = "text-sm leading-5 font-semibold text-pretty text-text";
	const detail = "text-sm leading-5 text-pretty text-text-subtle";
	return (
		<div className={cn("flex min-h-0 flex-col gap-4", inline ? "p-4 pt-3" : "overflow-y-auto overscroll-contain px-4 pt-4 pb-4")}>
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between gap-3">
					{showField ? <span className="text-xs text-text-subtlest">{suggestion.label}</span> : null}
					<ConfidenceMeter confidence={suggestion.confidence} />
				</div>
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
			<section aria-label="Sources" className="flex flex-col gap-3">
				<h3 className="text-xs font-medium text-text-subtlest">
					{reason.evidence.length} {reason.evidence.length === 1 ? "source" : "sources"}
				</h3>
				<ul className="flex flex-col gap-2">
					{reason.evidence.map((evidence) => <SourceRow evidence={evidence} key={evidence.id} />)}
				</ul>
			</section>
		</div>
	);
}
