"use client";

import { JiraInsightTimelineRail } from "@/components/blocks/jira-insight/components/jira-insight-timeline-rail";
import { useJiraInsight } from "@/components/blocks/jira-insight/context-jira-insight";
import { cn } from "@/lib/utils";

export function JiraInsightScrubber({
	activityTimestamps,
	className,
}: Readonly<{
	activityTimestamps?: readonly number[];
	className?: string;
}>) {
	const { activeCheckpointId, checkpoints, selectCheckpoint } = useJiraInsight();

	return (
		<div className={cn("min-w-0", className)} data-jira-insight-scrubber>
			<JiraInsightTimelineRail
				activeCheckpointId={activeCheckpointId}
				activityTimestamps={activityTimestamps}
				checkpoints={checkpoints}
				onCheckpointSelect={selectCheckpoint}
			/>
		</div>
	);
}
