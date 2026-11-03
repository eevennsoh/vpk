"use client";

import type { ReactNode } from "react";
import CrossIcon from "@atlaskit/icon/core/cross";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StoryIcon from "@atlaskit/icon/core/story";

import { cn } from "@/lib/utils";

import { SUGGESTION_WORK_ITEM } from "./data/suggestions";

export interface WorkItemPreviewShellProps {
	/** Right column content: the variant's suggestion UI plus the Details rail. */
	rail: ReactNode;
	/** Optional replacement for the default left column. */
	main?: ReactNode;
	/** Absolutely positioned layers (sheets, scrims) scoped to the preview. The shell root is `relative`. */
	overlay?: ReactNode;
	railClassName?: string;
}

function DefaultMain() {
	return (
		<div className="flex flex-col gap-6">
			<p className="text-sm text-text-subtlest">Add description</p>
			<div className="flex w-fit gap-0.5 rounded-md bg-bg-neutral p-0.5 text-sm">
				<span className="rounded-sm bg-surface px-2.5 py-1 text-text shadow-sm">Activity</span>
				<span className="px-2.5 py-1 text-text-subtle">Audit</span>
			</div>
			<div className="rounded-lg border border-border px-3 py-2.5 text-sm text-text-subtlest">Add a comment…</div>
		</div>
	);
}

/** Work item modal context shared by every canvas variant, so only the suggestion design differs between previews. */
export function WorkItemPreviewShell({ rail, main, overlay, railClassName }: Readonly<WorkItemPreviewShellProps>) {
	return (
		<div className="relative flex h-full flex-col overflow-hidden bg-surface">
			<header className="flex shrink-0 flex-col gap-3 px-6 pt-5 pb-4">
				<div className="flex items-center justify-between">
					<span className="flex items-center gap-1.5 text-xs text-text-subtle">
						<span className="text-icon-success"><StoryIcon color="currentColor" label="Story" size="small" /></span>
						{SUGGESTION_WORK_ITEM.key}
					</span>
					<span aria-hidden="true" className="flex items-center gap-3 text-icon-subtle">
						<ShowMoreHorizontalIcon color="currentColor" label="" size="small" />
						<CrossIcon color="currentColor" label="" size="small" />
					</span>
				</div>
				<h1 className="text-xl font-semibold text-text">{SUGGESTION_WORK_ITEM.summary}</h1>
			</header>
			<div className="flex min-h-0 flex-1 gap-6 px-6 pb-6">
				<div className="min-w-0 flex-1 pt-2">{main ?? <DefaultMain />}</div>
				<div className={cn("relative flex w-[360px] shrink-0 flex-col gap-3 overflow-y-auto", railClassName)}>{rail}</div>
			</div>
			{overlay}
		</div>
	);
}
