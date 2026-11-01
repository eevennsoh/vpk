import { token } from "@/lib/tokens";

import type { JiraIssueAppearance, JiraIssueChrome } from "./types";

export interface JiraIssueChromeStyles {
	readonly restClassName: string; // idle border only, no fill
	readonly hoverClassName: string; // :hover for root; skipped while a nested subtask is hovered
	readonly agentSurfaceHoverClassName: string; // group hover on the agent surface; same nested skip
	readonly boxShadow: string; // raised token, or "none"
}

const RAISED_JIRA_ISSUE_CHROME_STYLES: JiraIssueChromeStyles = Object.freeze({
	restClassName: "border-transparent",
	hoverClassName: "hover:not-has-[[data-slot=jira-issue-subtask-card]:hover]:bg-surface-hovered",
	agentSurfaceHoverClassName: "group-[&:hover:not(:has([data-slot=jira-issue-subtask-card]:hover))]/jira-issue-card:bg-surface-hovered",
	boxShadow: token("elevation.shadow.raised"),
});

const STROKE_JIRA_ISSUE_CHROME_STYLES: JiraIssueChromeStyles = Object.freeze({
	restClassName: "border-border-disabled",
	hoverClassName: "hover:not-has-[[data-slot=jira-issue-subtask-card]:hover]:border-border",
	agentSurfaceHoverClassName: "group-[&:hover:not(:has([data-slot=jira-issue-subtask-card]:hover))]/jira-issue-card:border-border",
	boxShadow: "none",
});

const JIRA_ISSUE_CHROME_STYLES: Readonly<Record<JiraIssueChrome, JiraIssueChromeStyles>> = Object.freeze({
	raised: RAISED_JIRA_ISSUE_CHROME_STYLES,
	stroke: STROKE_JIRA_ISSUE_CHROME_STYLES,
});

const BUTTER_RAISED_CHROME_STYLES: JiraIssueChromeStyles = Object.freeze({
	...RAISED_JIRA_ISSUE_CHROME_STYLES,
	hoverClassName: "hover:bg-surface-raised-hovered",
	agentSurfaceHoverClassName: "group-hover/jira-issue-card:bg-surface-raised-hovered",
});

export function resolveJiraIssueChrome(
	chrome?: JiraIssueChrome,
	appearance: JiraIssueAppearance = "default",
): JiraIssueChromeStyles {
	if (appearance === "project-butter" && chrome !== "stroke") return BUTTER_RAISED_CHROME_STYLES;
	return JIRA_ISSUE_CHROME_STYLES[chrome ?? "raised"];
}
