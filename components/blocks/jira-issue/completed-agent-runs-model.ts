import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue/agent-activity";
import type { JiraIssueCompletedAgentRun } from "@/components/blocks/jira-issue/completed-agent-runs";
import type { JiraIssueIconScale } from "@/components/blocks/jira-issue/types";

export function toJiraIssueAgentActivityFromCompletedRun(
	run: JiraIssueCompletedAgentRun,
): JiraIssueAgentActivity {
	return {
		id: run.id,
		name: run.agentName,
		avatarSrc: run.agentAvatarSrc,
		agentBrandName: run.agentBrandName,
		...(run.invokedBy ? { invokedBy: run.invokedBy } : {}),
		label: run.state === "failed" ? "Failed" : "Finished",
		state: "completed",
	};
}

export function resolveComfortableCompletedRunViewChat(
	onAgentActivityViewChat: ((activity: JiraIssueAgentActivity) => void) | undefined,
	onAgentDoneRunView: ((run: JiraIssueCompletedAgentRun) => void) | undefined,
	agentDoneRuns: readonly JiraIssueCompletedAgentRun[],
	iconScale: JiraIssueIconScale,
): ((activity: JiraIssueAgentActivity) => void) | undefined {
	if (onAgentActivityViewChat) {
		return onAgentActivityViewChat;
	}
	if (iconScale !== "comfortable" || !onAgentDoneRunView) {
		return undefined;
	}
	return (activity) => {
		const run = agentDoneRuns.find((candidate) => candidate.id === activity.id);
		if (run) {
			onAgentDoneRunView(run);
		}
	};
}
