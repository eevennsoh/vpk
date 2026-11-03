"use client";

import type { ReactNode } from "react";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { projectButterPersonAvatar } from "../project-butter/people";
import type { SuggestionFieldId, WorkItemSuggestion } from "./data/suggestions";
import { SuggestionValueView } from "./suggestion-value-view";
import type { SuggestionReview } from "./use-suggestion-review";

/**
 * A static replica of the Butter Details rail for preview context. Accepted suggestions fill their rows,
 * so each variant shows the real consequence of Accept. Pass `slot` to render a variant's own UI in place of a row.
 */
export interface MockDetailsRailProps {
	review: SuggestionReview;
	/** Optional per-field override, e.g. an inline suggestion in place of the empty row. */
	slot?: (suggestion: WorkItemSuggestion) => ReactNode | null;
	/** Rows that should glow briefly because they just received a value. */
	highlighted?: ReadonlySet<SuggestionFieldId>;
	className?: string;
}

const RAIL_ORDER: readonly SuggestionFieldId[] = ["assignee", "dueDate", "parent", "labels", "components", "fixVersion", "acceptanceCriteria"];

/** Empty-state rows exist before any suggestion targets them, so later runs fill rows that were already visible. */
const EMPTY_FIELDS: Readonly<Record<Exclude<SuggestionFieldId, "description">, { label: string; placeholder: string }>> = {
	assignee: { label: "Assignee", placeholder: "Automatic" },
	dueDate: { label: "Due date", placeholder: "Add due date" },
	parent: { label: "Parent", placeholder: "Add parent" },
	labels: { label: "Labels", placeholder: "Add label" },
	components: { label: "Components", placeholder: "None" },
	fixVersion: { label: "Fix version", placeholder: "None" },
	acceptanceCriteria: { label: "Acceptance criteria", placeholder: "Add acceptance criteria" },
};

function FieldRow({ label, children, highlighted }: Readonly<{ label: string; children: ReactNode; highlighted?: boolean }>) {
	return (
		<div className={cn("flex flex-col gap-1 rounded-md px-1 py-1.5 transition-colors duration-slow ease-out", highlighted ? "bg-bg-success-subtler" : null)}>
			<span className="text-xs text-text-subtle">{label}</span>
			<div className="min-w-0 text-sm text-text">{children}</div>
		</div>
	);
}

function Placeholder({ children, icon }: Readonly<{ children: ReactNode; icon?: ReactNode }>) {
	return <span className="flex items-center gap-2 text-text-subtlest">{icon}{children}</span>;
}

export function MockDetailsRail({ review, slot, highlighted, className }: Readonly<MockDetailsRailProps>) {
	const byId = new Map(review.suggestions.map((suggestion) => [suggestion.id, suggestion]));
	const renderField = (id: SuggestionFieldId) => {
		if (id === "description") return null;
		const empty = EMPTY_FIELDS[id];
		const suggestion = byId.get(id);
		const custom = suggestion ? slot?.(suggestion) : null;
		if (custom != null) return <div key={id}>{custom}</div>;
		const accepted = suggestion != null && review.decisionOf(id) === "accepted";
		return (
			<FieldRow highlighted={highlighted?.has(id)} key={id} label={empty.label}>
				{accepted ? <SuggestionValueView value={suggestion.value} /> : (
					<Placeholder icon={id === "dueDate" ? <CalendarIcon color="currentColor" label="" size="small" /> : undefined}>{empty.placeholder}</Placeholder>
				)}
			</FieldRow>
		);
	};

	return (
		<div aria-label="Details" role="group" className={cn("flex flex-col gap-1 rounded-xl border border-border bg-surface p-4", className)}>
			<h2 className="px-1 pb-1 text-sm font-semibold text-text">Details</h2>
			<FieldRow label="Status">
				<span className="flex items-center gap-2"><span aria-hidden="true" className="size-4 rounded-full border-2 border-dashed border-border-bold" />To do</span>
			</FieldRow>
			{renderField("assignee")}
			<FieldRow label="Priority">
				<span className="flex items-center gap-2"><PriorityMediumIcon label="" size="small" />Medium</span>
			</FieldRow>
			{RAIL_ORDER.slice(1).map(renderField)}
			<FieldRow label="Reporter">
				<span className="flex items-center gap-2">
					<Avatar size="xs"><AvatarImage alt="" src={projectButterPersonAvatar("Venn")} /></Avatar>
					Venn
				</span>
			</FieldRow>
		</div>
	);
}
