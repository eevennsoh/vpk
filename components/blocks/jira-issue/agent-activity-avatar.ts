import type { JiraIssueIconScale } from "./types";

export function getJiraIssueAgentRowInset(iconScale: JiraIssueIconScale): string {
	return iconScale === "comfortable" ? "pr-2 pl-1" : "px-2";
}
