import type { AgentLoadingAgent } from "@/components/ui-custom/agent-loading";
import type { JiraIssueAgentActivity } from "./agent-activity";
import type { JiraIssueIconScale } from "./types";

export function getJiraIssueAgentRowInset(iconScale: JiraIssueIconScale): string {
	return iconScale === "comfortable" ? "pr-2 pl-1" : "px-2";
}

function getAgentInitial(name: string): string {
	return name.trim()[0]?.toUpperCase() ?? "A";
}

/** The session identity a card's agent row renders; the invocation handoff renders the same one so settling swaps nothing. */
export function toAgentLoadingAgent(activity: JiraIssueAgentActivity): AgentLoadingAgent {
	return {
		id: activity.id,
		name: activity.name,
		status: activity.state === "completed" ? "finished" : "working",
		avatar: {
			appearance: "coding",
			...(activity.avatarSrc ? { avatarSrc: activity.avatarSrc } : {}),
			...(activity.agentBrandName ? { brandName: activity.agentBrandName } : {}),
			...(activity.agentVpkLogo ? { vpkLogo: activity.agentVpkLogo } : {}),
			fallbackText: getAgentInitial(activity.name),
		},
	};
}
