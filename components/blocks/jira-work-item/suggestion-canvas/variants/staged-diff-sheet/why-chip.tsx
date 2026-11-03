"use client";

import InformationCircleIcon from "@atlaskit/icon/core/information-circle";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";

import { SUGGESTION_WORK_ITEM, type WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { CONFIDENCE_LABEL, whyTitle } from "./model";
import { ConfidenceMeter, EvidenceList, ReasonFeedback, ReasonSummary } from "./reasoning";

const HOVER_OPEN_DELAY = 250;
const HOVER_CLOSE_DELAY = 120;

/**
 * Confidence chip that doubles as the "why" trigger. A popover (not a preview card) so the same
 * content opens on hover, on click/tap, and with Enter/Space from the keyboard.
 */
export function WhyChip({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	const short = suggestion.confidence === "high" ? "High" : "Medium";
	return (
		<Popover>
			<PopoverTrigger
				aria-label={`Why this ${suggestion.label.toLowerCase()} was suggested. ${CONFIDENCE_LABEL[suggestion.confidence]}`}
				className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface pr-1.5 pl-2 text-xs font-medium text-text-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-surface-hovered hover:text-text focus-visible:ring-2 focus-visible:ring-border-focused data-popup-open:border-border-selected data-popup-open:bg-bg-selected data-popup-open:text-text-selected"
				closeDelay={HOVER_CLOSE_DELAY}
				delay={HOVER_OPEN_DELAY}
				openOnHover
			>
				<ConfidenceMeter confidence={suggestion.confidence} />
				{short}
				<span className="flex text-icon-subtle [[data-popup-open]_&]:text-icon-selected"><InformationCircleIcon color="currentColor" label="" size="small" /></span>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[360px] gap-3 p-3.5" side="bottom" sideOffset={6}>
				<div className="flex items-center gap-1.5 text-xs text-text-subtlest">
					<TeamworkGraphMark className="size-3.5" />
					{SUGGESTION_WORK_ITEM.agent.name}
					<span aria-hidden="true">·</span>
					via Teamwork Graph
				</div>
				<h3 className="-mt-1 text-base font-semibold text-text">{whyTitle(suggestion)}</h3>
				<ReasonSummary suggestion={suggestion} />
				<EvidenceList evidence={suggestion.reason.evidence} />
				<div className="-mx-3.5 border-t border-border px-3.5 pt-2.5">
					<ReasonFeedback />
				</div>
			</PopoverContent>
		</Popover>
	);
}
