"use client";

import type { RelatedStatusCounts } from "@/components/blocks/jira-work-item/project-butter-v1/related-model";
import { ProgressCircle, type ProgressCircleSegment } from "@/components/ui-custom/progress-circle";

export function RelatedProgress({ counts }: Readonly<{ counts: RelatedStatusCounts }>) {
	const segments = ([
		{ status: "pending", weight: counts.todo },
		{ status: "in-progress", weight: counts.inProgress },
		{ status: "passed", weight: counts.done },
	] satisfies ProgressCircleSegment[]).filter((segment) => segment.weight > 0);
	return (
		<span aria-hidden className="ml-1 flex items-center gap-1" data-component="SubItemsProgress">
			<ProgressCircle inline segmented segments={segments} size="xs" />
			<span className="inline-flex items-center gap-0.5 rounded-xs px-1 py-0.5 text-xs font-normal text-text tabular-nums">{counts.done}/{counts.total}</span>
		</span>
	);
}
