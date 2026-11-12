export type JiraGoldenJourneyV3PresentationChapter =
	| "track"
	| "learn"
	| "build"
	| "terminal";

export const JIRA_GOLDEN_JOURNEY_V3_PRESENTATION_CHAPTERS = [
	{ label: "Track", value: "track" },
	{ label: "Learn", value: "learn" },
	{ label: "Build", value: "build" },
	{ label: "Terminal", value: "terminal" },
] as const satisfies readonly {
	label: string;
	value: JiraGoldenJourneyV3PresentationChapter;
}[];

export {
	createJiraGoldenJourneyV3PayBoardColumns,
	JIRA_GOLDEN_JOURNEY_V3_PAY_BOARD_AGENTS,
	JIRA_GOLDEN_JOURNEY_V3_PAY_COMPOSER_AGENTS,
	JIRA_GOLDEN_JOURNEY_V3_PAY_HEADER_ASSIGNEES,
	JIRA_GOLDEN_JOURNEY_V3_PAY_STATUS_PHASES,
} from "./presentation-board";

export {
	createJiraGoldenJourneyV3Pay101BuildState,
	JIRA_GOLDEN_JOURNEY_V3_PAY_101_COMMIT_SHA,
	JIRA_GOLDEN_JOURNEY_V3_PAY_101_PULL_REQUEST_NUMBER,
	JIRA_GOLDEN_JOURNEY_V3_PAY_101_SESSION_ID,
	JIRA_GOLDEN_JOURNEY_V3_PAY_101_UNCAPTURED_SESSION_ID,
	JIRA_GOLDEN_JOURNEY_V3_PAY_101_WORK_ITEM,
} from "./presentation-build";
