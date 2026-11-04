"use client";

import type { SuggestionConfidence, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { EvidenceSource } from "./evidence";

const CONFIDENCE: Readonly<Record<SuggestionConfidence, { label: string; filled: number; tone: string }>> = {
	high: { label: "High confidence", filled: 3, tone: "bg-icon-success" },
	medium: { label: "Medium confidence", filled: 2, tone: "bg-icon-warning" },
};

function ConfidenceMeter({ confidence }: Readonly<{ confidence: SuggestionConfidence }>) {
	const { label, filled, tone } = CONFIDENCE[confidence];
	return (
		<span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-text-subtle">
			<span aria-hidden="true" className="flex items-end gap-0.5">
				{[0, 1, 2].map((bar) => (
					<span className={cn("w-[3px] rounded-full", bar < filled ? tone : "bg-bg-neutral-hovered")} key={bar} style={{ height: 6 + bar * 2 }} />
				))}
			</span>
			{label}
		</span>
	);
}

/**
 * Everything behind a suggestion beyond the headline already on the card: the reasoning, how sure the agent is,
 * and each source with its quote. The source whose chip was hovered is spotlit.
 */
export function WhyBody({ suggestion, pointedId }: Readonly<{ suggestion: WorkItemSuggestion; pointedId: string | null }>) {
	const { reason } = suggestion;
	return (
		<div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-3.5 pb-3">
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between gap-3">
					<PopoverTitle className="text-xs font-normal text-text-subtlest">Why this {suggestion.label.toLowerCase()}</PopoverTitle>
					<ConfidenceMeter confidence={suggestion.confidence} />
				</div>
				<PopoverDescription className="text-sm leading-5 text-pretty text-text">{reason.detail}</PopoverDescription>
			</div>
			<section aria-label="Sources" className="flex flex-col gap-1.5">
				<h3 className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
					Sources
					<span className="font-normal text-text-subtlest tabular-nums">{reason.evidence.length}</span>
				</h3>
				<ul className="-mx-2 flex flex-col gap-0.5">
					{reason.evidence.map((evidence) => (
						<li
							className={cn("rounded-lg px-2 py-1.5 transition-colors duration-normal ease-out-practical", pointedId === evidence.id ? "bg-bg-neutral-subtle-hovered" : null)}
							data-pointed={pointedId === evidence.id || undefined}
							key={evidence.id}
						>
							<EvidenceSource evidence={evidence} />
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
