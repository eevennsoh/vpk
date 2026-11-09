"use client";

import { JiraInsightContent } from "@/components/blocks/jira-insight/components/jira-insight-content";
import { JiraInsightScrubber } from "@/components/blocks/jira-insight/components/jira-insight-scrubber";
import { JiraInsightProvider } from "@/components/blocks/jira-insight/context-jira-insight";
import type { JiraInsightSource, JiraInsightSnapshot } from "@/components/blocks/jira-insight/jira-insight-types";
import { cn } from "@/lib/utils";

export interface JiraInsightProps {
	className?: string;
	onSourceSelect?: (source: JiraInsightSource) => void;
	snapshot: JiraInsightSnapshot;
}

export function JiraInsight({ className, onSourceSelect, snapshot }: Readonly<JiraInsightProps>) {
	return (
		<JiraInsightProvider onSourceSelect={onSourceSelect} snapshot={snapshot}>
			<div className={cn("flex min-w-0 flex-col", className)} data-jira-insight>
				<JiraInsightContent />
				<JiraInsightScrubber className="mt-6" />
			</div>
		</JiraInsightProvider>
	);
}

export { JiraInsightContent } from "@/components/blocks/jira-insight/components/jira-insight-content";
export { JiraInsightEditorialPane } from "@/components/blocks/jira-insight/components/jira-insight-editorial-pane";
export { JiraInsightScrubber } from "@/components/blocks/jira-insight/components/jira-insight-scrubber";
export {
	JiraInsightTimelineRail,
	type JiraInsightTimelineRailProps,
} from "@/components/blocks/jira-insight/components/jira-insight-timeline-rail";
export {
	JiraInsightProvider,
	useJiraInsight,
} from "@/components/blocks/jira-insight/context-jira-insight";
export type {
	JiraInsightCheckpoint,
	JiraInsightSource,
	JiraInsightSelectionState,
	JiraInsightSnapshot,
} from "@/components/blocks/jira-insight/jira-insight-types";
