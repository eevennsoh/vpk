"use client";

import { useReducedMotion } from "motion/react";

import type { AgentAssignmentAgent } from "@/components/blocks/agent-assignment/components/agent-assignment";
import { toAssignmentActivity } from "@/components/blocks/agent-assignment/components/assignment-session";
import { JiraIssueAgentActivityRows } from "@/components/blocks/jira-issue/agent-activity";
import { summarizeJiraIssueAgentActivities } from "@/components/blocks/jira-issue/agent-activity-model";
import { JiraIssueAgentRowContent } from "@/components/blocks/jira-issue/agent-activity-row-presentation";
import type { JiraIssueIconScale } from "@/components/blocks/jira-issue/types";
import { cn } from "@/lib/utils";

export function AgentAssignmentDefaultField({
	addAgentLabel,
	assignedAgents,
	activityIconScale,
	activityRowFlush,
	compactStatus = false,
	className,
}: Readonly<{
	addAgentLabel: string;
	assignedAgents: readonly AgentAssignmentAgent[];
	activityIconScale?: JiraIssueIconScale;
	activityRowFlush?: boolean;
	compactStatus?: boolean;
	className?: string;
}>) {
	const shouldReduceMotion = useReducedMotion();
	const activities = assignedAgents.map(toAssignmentActivity);

	if (assignedAgents.length === 0) {
		return (
			<span className={cn("pointer-events-none relative z-10 text-sm text-text-subtlest", className)}>
				{addAgentLabel}
			</span>
		);
	}
	if (compactStatus) {
		const summary = summarizeJiraIssueAgentActivities(activities);
		const featuredActivity = summary.featuredActivityIndex === null ? undefined : activities[summary.featuredActivityIndex];
		return (
			<span className={cn("pointer-events-none relative z-10 flex min-h-8 w-full min-w-0 items-center", className)}>
				<JiraIssueAgentRowContent
					activities={activities}
					avatarLayout="animated"
					compactAvatarSlot
					featuredActivity={featuredActivity}
					isAwaitingInput={summary.label === "Needs input"}
					isWorking={summary.label === "Working"}
					rowLabel={summary.label}
					showUnlinkControl={false}
					statusIcon={<></>}
				/>
			</span>
		);
	}

	return (
		<div className={cn("pointer-events-none relative z-10 w-full min-w-0", className)}>
			<JiraIssueAgentActivityRows
				activities={activities}
				avatarLayout="animated"
				flushContent={activityRowFlush}
				inheritChinSurface
				iconScale={activityIconScale}
				showAssignmentFlyout={false}
				shouldReduceMotion={shouldReduceMotion}
				usesStrokeChrome
			/>
		</div>
	);
}
