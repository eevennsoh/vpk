"use client";

import Image from "next/image";

import { Avatar } from "@/components/ui/avatar";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { SUGGESTION_WORK_ITEM, type SuggestionConfidence, type WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { EvidenceItem } from "./evidence";
import { KeepKeys } from "./keep-keys";

const CONFIDENCE: Readonly<Record<SuggestionConfidence, { label: string; filled: number; tone: string }>> = {
	high: { label: "High confidence", filled: 3, tone: "bg-icon-success" },
	medium: { label: "Medium confidence", filled: 2, tone: "bg-icon-warning" },
};

function ConfidenceMeter({ confidence }: Readonly<{ confidence: SuggestionConfidence }>) {
	const { label, filled, tone } = CONFIDENCE[confidence];
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 text-xs leading-4 text-text-subtle">
			<span aria-hidden="true" className="flex items-end gap-0.5">
				{[0, 1, 2].map((bar) => (
					<span className={cn("w-0.75 rounded-full", bar < filled ? tone : "bg-bg-neutral-hovered")} key={bar} style={{ height: 6 + bar * 2 }} />
				))}
			</span>
			{label}
		</span>
	);
}

function AgentMark() {
	return (
		<Avatar animate={false} shape="hexagon" size="xs">
			<span className="flex size-full items-center justify-center bg-blue-700">
				<Image alt="" className="size-2.5!" height={10} src="/1p/agent-lanyard/glyph-jira-triage.svg" width={10} />
			</span>
		</Avatar>
	);
}

/** Reasoning for one suggestion: headline, detail, confidence, sources and attribution. Text-led, no nested cards. */
export function QuietWhyCard({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	const { reason } = suggestion;
	return (
		<div className="flex min-h-0 flex-col">
			<div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-3.5 pb-4">
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between gap-3">
						<span className="min-w-0 text-xs leading-4 text-text-subtlest">{suggestion.label}</span>
						<ConfidenceMeter confidence={suggestion.confidence} />
					</div>
					<PopoverTitle className="text-sm leading-5 font-medium text-pretty text-text"><KeepKeys text={reason.headline} /></PopoverTitle>
					<PopoverDescription className="text-sm leading-5 text-pretty text-text-subtle"><KeepKeys text={reason.detail} /></PopoverDescription>
				</div>
				<section aria-label="Sources" className="flex flex-col gap-2.5">
					<h3 className="text-xs leading-4 text-text-subtlest">
						{reason.evidence.length === 1 ? "1 source" : `${reason.evidence.length} sources`}
					</h3>
					<ul className="flex flex-col gap-3">
						{reason.evidence.map((evidence) => <EvidenceItem evidence={evidence} key={evidence.id} />)}
					</ul>
				</section>
			</div>
			<p className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-xs leading-4 text-text-subtlest">
				<AgentMark />
				<span className="text-text-subtle">{SUGGESTION_WORK_ITEM.agent.name}</span>
				<span aria-hidden="true">·</span>
				Teamwork Graph
			</p>
		</div>
	);
}
