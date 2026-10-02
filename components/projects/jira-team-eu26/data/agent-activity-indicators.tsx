import type { JiraIssueAgentActivityIndicatorRenderer } from "@/components/blocks/jira-issue";
import { AgentSessionShortLifecycleIcon } from "@/components/blocks/agent-session/agent-session-lifecycle";

/** Keep board chins aligned with the compact session-column status indicators. */
export const renderJiraTeamEu26AgentActivityIndicator: JiraIssueAgentActivityIndicatorRenderer = (
	state,
) => (
	<AgentSessionShortLifecycleIcon
		showWorkingSpinner
		state={state === "finished" ? "complete" : state === "awaiting-input" ? "needs-input" : "running"}
	/>
);
