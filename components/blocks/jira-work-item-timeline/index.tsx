"use client";

import type { HTMLAttributes, ReactNode, Ref } from "react";
import type { MotionValue } from "motion/react";
import type { JiraActivityEntry } from "@/components/blocks/jira-activity";
import { ActivityTimelineRail } from "@/components/blocks/jira-work-item-timeline/activity-timeline";
import { cn } from "@/lib/utils";

export interface JiraWorkItemTimelineProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
	rows: readonly JiraActivityEntry[];
	visibleId: string | null;
	progress: MotionValue<number>;
	onSelect: (id: string) => void;
	onSeek: (progress: number) => void;
	getPreviewLabel?: (entry: JiraActivityEntry) => string;
	stuck?: boolean;
	headerTime?: string;
	actions?: ReactNode;
	ref?: Ref<HTMLDivElement>;
}

export function JiraWorkItemTimeline({ rows, visibleId, progress, onSelect, onSeek, getPreviewLabel = (entry) => entry.timestamp, stuck = false, headerTime, actions, className, ref, ...props }: Readonly<JiraWorkItemTimelineProps>) {
	return (
		<div
			className={cn("sticky top-0 z-20 -mx-1 mb-3 flex shrink-0 items-center gap-4 bg-surface px-1 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-surface after:to-transparent", className)}
			data-jira-work-item-timeline
			data-stuck={stuck || undefined}
			ref={ref}
			{...props}
		>
			<div className="shrink-0 text-sm font-medium text-text">
				<h2 className={cn("text-sm font-medium text-text", stuck && headerTime ? "sr-only" : undefined)}>Activity</h2>
				{stuck && headerTime ? <span aria-hidden data-jira-work-item-timeline-header-time>{headerTime}</span> : null}
			</div>
			<ActivityTimelineRail getPreviewLabel={getPreviewLabel} onSeek={onSeek} onSelect={onSelect} progress={progress} rows={rows} visibleId={visibleId} />
			{actions}
		</div>
	);
}

export { useJiraWorkItemTimelineNavigation, type JiraWorkItemTimelineNavigationOptions } from "@/components/blocks/jira-work-item-timeline/use-activity-navigation";
