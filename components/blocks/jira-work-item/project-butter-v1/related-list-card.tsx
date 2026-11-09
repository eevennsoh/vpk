"use client";

import type { ReactNode } from "react";
import { ProjectButterExpandControl } from "@/components/blocks/jira-work-item/project-butter-v1/project-butter-expand-control";
import { relatedListWindow } from "@/components/blocks/jira-work-item/project-butter-v1/related-work-model";
import { cn } from "@/lib/utils";

export interface RelatedListRowContext {
	index: number;
	/** Last shown row with more hidden below: apply `related-row-fade` to its text. */
	faded: boolean;
}

export interface RelatedListCardProps<T> {
	/** List accessible name; its lowercase form names the pill ("Show 3 more child work items"). */
	label: string;
	/** Ordered, filtered rows. The card decides which are shown. */
	items: readonly T[];
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	/** Composer row rendered first; it takes one of the 5 slots. */
	composer?: ReactNode;
	/** Shown when no rows and no composer render. */
	empty?: ReactNode;
	/** Dims and inerts the pill (another row is being edited). */
	toggleDisabled?: boolean;
	renderItem: (item: T, context: RelatedListRowContext) => ReactNode;
	className?: string;
}

/** Bordered list card shared by child, linked and attachment lists: pagination, last-row fade and the border pill. */
export function RelatedListCard<T>({ className, composer, empty, expanded, items, label, onExpandedChange, renderItem, toggleDisabled = false }: Readonly<RelatedListCardProps<T>>) {
	const page = relatedListWindow(items, { expanded, composerOpen: Boolean(composer) });
	const noun = label.toLowerCase();
	return (
		<div className={cn("relative rounded-lg border border-border py-1.5", className)}>
			<ul aria-label={label}>
				{composer}
				{page.shown.map((item, index) => renderItem(item, { index, faded: page.fadedIndex === index }))}
				{page.shown.length === 0 && !composer ? empty : null}
			</ul>
			{page.showToggle ? (
				<div className={cn(toggleDisabled && "opacity-(--opacity-disabled)")} inert={toggleDisabled || undefined}>
					<ProjectButterExpandControl ariaLabel={expanded ? `Show less ${noun}` : `Show ${page.hiddenCount} more ${noun}`} expanded={expanded} label={expanded ? "Show less" : `Show ${page.hiddenCount} more`} onClick={() => onExpandedChange(!expanded)} />
				</div>
			) : null}
		</div>
	);
}
