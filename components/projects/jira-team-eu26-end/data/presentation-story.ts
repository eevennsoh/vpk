export type JiraTeamEu26PresentationChapter =
	| "track"
	| "learn"
	| "build"
	| "terminal";

export const JIRA_TEAM_EU26_PRESENTATION_CHAPTERS = [
	{ label: "Track", value: "track" },
	{ label: "Learn", value: "learn" },
	{ label: "Build", value: "build" },
	{ label: "Terminal", value: "terminal" },
] as const satisfies readonly {
	label: string;
	value: JiraTeamEu26PresentationChapter;
}[];

export {
	createJiraTeamEu26PayBoardColumns,
	toJiraTeamEu26AgentActivityFromSession,
	toJiraTeamEu26DetachedAgentSession,
	JIRA_TEAM_EU26_PAY_112_RETENTION_MESSAGE,
	JIRA_TEAM_EU26_PAY_112_RETENTION_QUESTION,
	JIRA_TEAM_EU26_PAY_BOARD_AGENTS,
	JIRA_TEAM_EU26_PAY_COMPOSER_AGENTS,
	JIRA_TEAM_EU26_PAY_CURRENT_USER,
	JIRA_TEAM_EU26_PAY_HEADER_ASSIGNEES,
	JIRA_TEAM_EU26_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID,
	JIRA_TEAM_EU26_PAY_STATUS_PHASES,
} from "./presentation-board";
export {
	getJiraTeamEu26PullRequestPreview,
	JIRA_TEAM_EU26_PULL_REQUEST_PREVIEWS,
} from "./presentation-pull-requests";

export {
	createJiraTeamEu26Pay101BuildState,
	JIRA_TEAM_EU26_PAY_101_COMMIT_SHA,
	JIRA_TEAM_EU26_PAY_101_PULL_REQUEST_NUMBER,
	JIRA_TEAM_EU26_PAY_101_SESSION_ID,
	JIRA_TEAM_EU26_PAY_101_UNCAPTURED_SESSION_ID,
	JIRA_TEAM_EU26_PAY_101_WORK_ITEM,
} from "./presentation-build";
export { JIRA_TEAM_EU26_PAY_SESSION_MEMBERS } from "./presentation-people";
