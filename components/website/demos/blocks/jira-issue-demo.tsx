"use client";

import JiraIssuePage from "@/components/blocks/jira-issue/page";
import { JiraIssue } from "@/components/blocks/jira-issue";

export default function JiraIssueDemo() {
	return (
		<div className="flex min-h-[360px] w-full items-center justify-center p-6">
			<JiraIssue
				assigneeAvatarSrc="/avatar-user/andrea-wilson/color/asow-service-yellow.png"
				className="w-[276px]"
				issueKey="PD-40"
				metadata={{ issueType: "story", dueDate: "2026-04-11", storyPoints: 3 }}
				summary="Implement advanced date-range filter"
			/>
		</div>
	);
}

export function JiraIssueDemoExperimental() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage variant="experimental" />
		</div>
	);
}

export function JiraIssueDemoUncapturedWork() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage variant="uncaptured-work" />
		</div>
	);
}

export function JiraIssueDemoSubtasksCollapsed() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage variant="subtasks-collapsed" />
		</div>
	);
}

export function JiraIssueDemoSubtasksExpanded() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage variant="subtasks-expanded" />
		</div>
	);
}

export function JiraIssueDemoParentEpic() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage variant="parent-epic" />
		</div>
	);
}

export function JiraIssueDemoAgentActivityStates() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage variant="agent-activity-states" />
		</div>
	);
}

export function JiraIssueDemoAgentActivityStatesExperimental() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage variant="agent-activity-states-experimental" />
		</div>
	);
}

export function JiraIssueDemoAgentActivityStatesExperimentalV2() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage variant="agent-activity-states-experimental-v2" />
		</div>
	);
}

export function JiraIssueDemoProjectButter() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage variant="project-butter" />
		</div>
	);
}
