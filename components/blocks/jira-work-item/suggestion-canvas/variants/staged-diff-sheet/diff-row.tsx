"use client";

import { useId, useState } from "react";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CrossCircleIcon from "@atlaskit/icon/core/cross-circle";
import UndoIcon from "@atlaskit/icon/core/undo";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { EvidenceList, ReasonSummary } from "./reasoning";
import { ValueContent } from "./value-content";
import { WhyChip } from "./why-chip";

export interface DiffRowProps {
	suggestion: WorkItemSuggestion;
	decision: SuggestionDecision;
	included: boolean;
	onIncludedChange: (included: boolean) => void;
	onAccept: () => void;
	onDismiss: () => void;
	onUndo: () => void;
}

const GUTTER = "select-none text-center font-mono text-sm/6";

function DecisionBadge({ decision }: Readonly<{ decision: Exclude<SuggestionDecision, "pending"> }>) {
	const accepted = decision === "accepted";
	return (
		<span className={cn("inline-flex items-center gap-1 text-xs font-semibold", accepted ? "text-text-success" : "text-text-subtlest")}>
			<span className={cn("flex", accepted ? "text-icon-success" : "text-icon-subtlest")}>
				{accepted ? <CheckCircleIcon color="currentColor" label="" size="small" /> : <CrossCircleIcon color="currentColor" label="" size="small" />}
			</span>
			{accepted ? "Accepted" : "Dismissed"}
		</span>
	);
}

/** One staged change: field, removed placeholder, added value, and its own include / accept / dismiss controls. */
export function DiffRow({ suggestion, decision, included, onIncludedChange, onAccept, onDismiss, onUndo }: Readonly<DiffRowProps>) {
	const [reasoningOpen, setReasoningOpen] = useState(false);
	const labelId = useId();
	const reasoningId = useId();
	const pending = decision === "pending";
	const accepted = decision === "accepted";
	const dismissed = decision === "dismissed";
	const staged = pending && included;

	return (
		<li aria-labelledby={labelId} className="flex gap-3 border-t border-border px-5 py-4 first:border-t-0">
			<div className="flex h-6 w-4 shrink-0 items-center">
				{pending ? (
					<Checkbox aria-label={`Include ${suggestion.label} when applying`} checked={included} onCheckedChange={(checked) => onIncludedChange(checked === true)} />
				) : (
					<span aria-hidden="true" className="size-1.5 translate-x-[5px] rounded-full bg-border-bold" />
				)}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-2.5">
				<div className="flex min-h-6 items-center gap-2">
					<span className={cn("text-sm font-semibold", dismissed ? "text-text-subtlest" : "text-text")} id={labelId}>{suggestion.label}</span>
					<WhyChip suggestion={suggestion} />
					<span className="flex-1" />
					{pending ? (
						<span className="flex items-center gap-1">
							<Button onClick={onDismiss} size="compact" variant="ghost">Dismiss</Button>
							<Button onClick={onAccept} size="compact" variant="outline">
								<CheckMarkIcon color="currentColor" label="" size="small" />
								Accept
							</Button>
						</span>
					) : (
						<span className="flex items-center gap-2">
							<DecisionBadge decision={decision} />
							<Button aria-label={`Undo ${decision === "accepted" ? "accepting" : "dismissing"} ${suggestion.label}`} onClick={onUndo} size="compact" variant="ghost">
								<UndoIcon color="currentColor" label="" size="small" />
								Undo
							</Button>
						</span>
					)}
				</div>

				<div className={cn("grid grid-cols-[2rem_minmax(0,1fr)] rounded-lg border transition-colors duration-normal ease-out-practical", accepted ? "border-border-success-subtle" : "border-border", dismissed ? "opacity-60" : null)}>
					{pending ? (
						<>
							<span aria-hidden="true" className={cn(GUTTER, "rounded-tl-[7px] border-b border-border bg-surface-sunken py-1 text-text-subtlest")}>−</span>
							<span className="flex flex-wrap items-baseline gap-x-2 rounded-tr-[7px] border-b border-border bg-surface-sunken py-1 pr-3 pl-3 text-sm/6">
								<span className="sr-only">Current value:</span>
								<span className="text-text-subtlest line-through decoration-border-bold">{suggestion.currentDisplay}</span>
								<span className="text-xs text-text-subtlest">empty</span>
							</span>
						</>
					) : null}
					<span
						aria-hidden="true"
						className={cn(
							GUTTER,
							"py-2 transition-colors duration-normal ease-out-practical",
							pending ? "rounded-bl-[7px]" : "rounded-l-[7px]",
							staged || accepted ? "bg-green-50 font-semibold text-text-success" : "bg-surface-sunken text-text-subtlest",
						)}
					>
						+
					</span>
					<div className={cn("min-w-0 py-2 pr-3 pl-3", pending ? "rounded-br-[7px]" : "rounded-r-[7px]")}>
						<span className="sr-only">{accepted ? "Applied value:" : "Suggested value:"}</span>
						<ValueContent value={suggestion.value} />
					</div>
				</div>

				<div className="flex flex-col gap-2.5">
					<button
						aria-controls={reasoningOpen ? reasoningId : undefined}
						aria-expanded={reasoningOpen}
						className="-ml-1 inline-flex w-fit items-center gap-1 rounded-sm px-1 text-xs font-medium text-text-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:text-text focus-visible:ring-2 focus-visible:ring-border-focused"
						onClick={() => setReasoningOpen((prev) => !prev)}
						type="button"
					>
						<span className={cn("flex text-icon-subtle transition-transform duration-normal ease-out-practical", reasoningOpen ? "rotate-90" : null)}>
							<ChevronRightIcon color="currentColor" label="" size="small" />
						</span>
						{reasoningOpen ? "Hide reasoning" : "Show reasoning"}
					</button>
					{reasoningOpen ? (
						<div className="flex flex-col gap-3 rounded-lg bg-surface-sunken p-3" id={reasoningId}>
							<ReasonSummary suggestion={suggestion} />
							<EvidenceList evidence={suggestion.reason.evidence} />
						</div>
					) : null}
				</div>
			</div>
		</li>
	);
}
