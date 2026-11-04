"use client";

import type { MouseEvent } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import { cn } from "@/lib/utils";

interface ReceiptParts {
	/** The emphasised subject, e.g. "Due date" or "4 labels". */
	subject: string;
	/** The rest of the sentence, e.g. "set to" or "added". */
	verb: string;
	/** A short, complete identifier for the value. Never a clipped excerpt of it. */
	value?: string;
}

/**
 * The one-line record of an accepted suggestion. Short values are named in full; long values
 * (paragraphs, several labels, checklists) are counted instead of cut, so nothing is ellipsised.
 */
function acceptedReceipt(suggestion: WorkItemSuggestion): ReceiptParts {
	const { label, value } = suggestion;
	switch (value.kind) {
		case "paragraph":
			return { subject: label, verb: "added" };
		case "person":
			return { subject: label, verb: "set to", value: value.person.name };
		case "date":
			return { subject: label, verb: "set to", value: value.display };
		case "issue":
			return { subject: label, verb: "set to", value: value.issue.key };
		case "labels":
			return value.labels.length <= 2
				? { subject: label, verb: "set to", value: value.labels.join(", ") }
				: { subject: `${value.labels.length} ${label.toLowerCase()}`, verb: "added" };
		case "checklist":
			return { subject: `${value.items.length} ${label.toLowerCase()}`, verb: "added" };
		default: {
			const unreachable: never = value;
			return unreachable;
		}
	}
}

export interface ReceiptProps {
	suggestion: WorkItemSuggestion;
	decision: Exclude<SuggestionDecision, "pending">;
	/** The latest decision keeps Undo in view; older receipts show it only on hover or focus. */
	isLatest: boolean;
	onUndo: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * A decided suggestion as one calm sentence that starts on the label column: "Due date set to Dec 15, 2026 · Undo".
 * Undo follows the words rather than sitting in the ✓ column, so a double-click on ✓ can never land on it.
 * It stays in the tab order; on touch, where nothing hovers, it shows instead of hiding.
 */
export function Receipt({ suggestion, decision, isLatest, onUndo }: Readonly<ReceiptProps>) {
	const accepted = decision === "accepted";
	const parts = acceptedReceipt(suggestion);
	return (
		<div className="flex min-h-8 items-start gap-1.5 py-1.5">
			<span className={cn("flex h-5 w-4 shrink-0 items-center justify-center", accepted ? "text-icon-success" : "text-icon-subtlest")}>
				{accepted ? <CheckMarkIcon color="currentColor" label="Accepted" size="small" /> : <CrossIcon color="currentColor" label="Dismissed" size="small" />}
			</span>
			<p className={cn("min-w-0 flex-1 text-xs leading-5 text-pretty", accepted ? "text-text-subtle" : "text-text-subtlest")}>
				{accepted ? (
					<>
						<span className="text-text">{parts.subject}</span> {parts.verb}
						{parts.value != null ? <> <span className="text-text">{parts.value}</span></> : null}
					</>
				) : (
					<>{suggestion.label} dismissed</>
				)}
				{" "}
				<span
					className={cn(
						"whitespace-nowrap transition-opacity duration-xxshort ease-out-practical group-hover/row:opacity-100 group-focus-within/row:opacity-100 pointer-coarse:opacity-100",
						isLatest ? "opacity-100" : "opacity-0",
					)}
				>
					<span aria-hidden="true" className="text-text-subtlest">·</span>
					{" "}
					<button
						aria-label={`Undo ${suggestion.label} ${accepted ? "accept" : "dismiss"}`}
						className="-mx-1 rounded-sm px-1 text-text-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
						data-undo=""
						onClick={onUndo}
						type="button"
					>
						Undo
					</button>
				</span>
			</p>
		</div>
	);
}
