"use client";

import JiraIssuePage from "@/components/blocks/jira-issue/page";

export default function JiraIssueDemo() {
	return (
		<div className="flex w-full justify-center p-6">
			<JiraIssuePage />
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
