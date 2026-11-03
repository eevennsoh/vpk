"use client";

import { cn } from "@/lib/utils";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";

/** Left column of the work item. Mirrors the shell default, but shows the description once it is accepted. */
export function MainColumn({ description, highlighted }: Readonly<{ description: WorkItemSuggestion | null; highlighted: boolean }>) {
	return (
		<div className="flex flex-col gap-6">
			{description && description.value.kind === "paragraph" ? (
				<section aria-label="Description" className={cn("-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-1.5 transition-colors duration-slow ease-out", highlighted ? "bg-bg-success-subtler" : null)}>
					<h2 className="text-sm font-semibold text-text">Description</h2>
					<p className="text-sm/6 text-pretty text-text">{description.value.text}</p>
				</section>
			) : (
				<p className="text-sm text-text-subtlest">Add description</p>
			)}
			<div className="flex w-fit gap-0.5 rounded-md bg-bg-neutral p-0.5 text-sm">
				<span className="rounded-sm bg-surface px-2.5 py-1 text-text shadow-sm">Activity</span>
				<span className="px-2.5 py-1 text-text-subtle">Audit</span>
			</div>
			<div className="rounded-lg border border-border px-3 py-2.5 text-sm text-text-subtlest">Add a comment…</div>
		</div>
	);
}
