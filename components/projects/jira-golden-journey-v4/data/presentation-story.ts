export type JiraGoldenJourneyV4PresentationChapter =
	| "track"
	| "learn"
	| "build"
	| "terminal";

export const JIRA_GOLDEN_JOURNEY_V4_PRESENTATION_CHAPTERS = [
	{ label: "Track", value: "track" },
	{ label: "Learn", value: "learn" },
	{ label: "Build", value: "build" },
	{ label: "Terminal", value: "terminal" },
] as const satisfies readonly {
	label: string;
	value: JiraGoldenJourneyV4PresentationChapter;
}[];

export {
	createJiraGoldenJourneyV4PayBoardColumns,
	toJiraGoldenJourneyV4AgentActivityFromSession,
	toJiraGoldenJourneyV4DetachedAgentSession,
	JIRA_GOLDEN_JOURNEY_V4_PAY_112_RETENTION_MESSAGE,
	JIRA_GOLDEN_JOURNEY_V4_PAY_112_RETENTION_QUESTION,
	JIRA_GOLDEN_JOURNEY_V4_PAY_BOARD_AGENTS,
	JIRA_GOLDEN_JOURNEY_V4_PAY_COMPOSER_AGENTS,
	JIRA_GOLDEN_JOURNEY_V4_PAY_CURRENT_USER,
	JIRA_GOLDEN_JOURNEY_V4_PAY_HEADER_ASSIGNEES,
	JIRA_GOLDEN_JOURNEY_V4_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID,
	JIRA_GOLDEN_JOURNEY_V4_PAY_STATUS_PHASES,
} from "./presentation-board";
export {
	getJiraGoldenJourneyV4PullRequestPreview,
	JIRA_GOLDEN_JOURNEY_V4_PULL_REQUEST_PREVIEWS,
} from "./presentation-pull-requests";

export {
	createJiraGoldenJourneyV4Pay101BuildState,
	JIRA_GOLDEN_JOURNEY_V4_PAY_101_COMMIT_SHA,
	JIRA_GOLDEN_JOURNEY_V4_PAY_101_PULL_REQUEST_NUMBER,
	JIRA_GOLDEN_JOURNEY_V4_PAY_101_SESSION_ID,
	JIRA_GOLDEN_JOURNEY_V4_PAY_101_UNCAPTURED_SESSION_ID,
	JIRA_GOLDEN_JOURNEY_V4_PAY_101_WORK_ITEM,
} from "./presentation-build";
