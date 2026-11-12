export type ButterPresentationChapter =
	| "track"
	| "learn"
	| "build"
	| "terminal";

export const BUTTER_PRESENTATION_CHAPTERS = [
	{ label: "Track", value: "track" },
	{ label: "Learn", value: "learn" },
	{ label: "Build", value: "build" },
	{ label: "Terminal", value: "terminal" },
] as const satisfies readonly {
	label: string;
	value: ButterPresentationChapter;
}[];

export {
	createButterPayBoardColumns,
	toButterAgentActivityFromSession,
	toButterDetachedAgentSession,
	BUTTER_PAY_112_RETENTION_MESSAGE,
	BUTTER_PAY_112_RETENTION_QUESTION,
	BUTTER_PAY_BOARD_AGENTS,
	BUTTER_PAY_COMPOSER_AGENTS,
	BUTTER_PAY_CURRENT_USER,
	BUTTER_PAY_HEADER_ASSIGNEES,
	BUTTER_PAY_SESSION_MEMBER_ID_BY_ASSIGNEE_ID,
	BUTTER_PAY_STATUS_PHASES,
} from "./presentation-board";
export {
	getButterPullRequestPreview,
	BUTTER_PULL_REQUEST_PREVIEWS,
} from "./presentation-pull-requests";

export {
	createButterPay101BuildState,
	BUTTER_PAY_101_COMMIT_SHA,
	BUTTER_PAY_101_PULL_REQUEST_NUMBER,
	BUTTER_PAY_101_SESSION_ID,
	BUTTER_PAY_101_UNCAPTURED_SESSION_ID,
	BUTTER_PAY_101_WORK_ITEM,
} from "./presentation-build";
export { BUTTER_PAY_SESSION_MEMBERS } from "./presentation-people";
