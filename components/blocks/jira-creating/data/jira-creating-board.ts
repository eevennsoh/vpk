import type {
	JiraIssueAgentActivity,
	JiraIssueAgentActivityMode,
	JiraIssuePriority,
	JiraIssueTag,
} from "@/components/blocks/jira-issue";

export type JiraCreateExample = "work-item" | "work-item-sessions";

export interface JiraCreateBoardCard {
	agentActivities?: readonly JiraIssueAgentActivity[];
	agentActivityMode?: JiraIssueAgentActivityMode;
	assigneeAvatarLabel: string;
	assigneeAvatarSrc: string;
	code: string;
	priority: JiraIssuePriority;
	tags: readonly JiraIssueTag[];
	title: string;
}

export interface JiraCreateBoardColumn {
	cards: readonly JiraCreateBoardCard[];
	title: string;
}

export interface JiraCreateColumnItem {
	card: JiraCreateBoardCard;
	enterDelayS: number;
	id: string;
	kind: "created" | "resting";
}

const AVATARS = {
	diego: "/avatar-user/dev-rana/color/asow-product-purple.png",
	jordan: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
	maya: "/avatar-user/chloe-lee/color/asow-dev-lime.png",
	priya: "/avatar-user/ting-chen/color/asow-teamwork-blue.png",
} as const;

function workingActivity(
	id: string,
	name: string,
	agentBrandName: JiraIssueAgentActivity["agentBrandName"],
	label: string,
	labels: readonly string[],
): JiraIssueAgentActivity {
	return {
		agentBrandName,
		cycleIntervalJitterMs: 1800,
		cycleIntervalMs: 2600,
		id,
		label,
		labels,
		message: `${name} is working and will post the next result to the Jira work item.`,
		name,
		state: "working",
	};
}

export const JIRA_CREATE_ISSUE: JiraCreateBoardCard = {
	assigneeAvatarLabel: "Diego Santos",
	assigneeAvatarSrc: AVATARS.diego,
	code: "PAY-132",
	priority: "minor",
	tags: [{ text: "copy", color: "purple" }],
	title: "Approve the final issuer-unavailable recovery message",
};

export const JIRA_CREATE_ISSUE_POOL: readonly JiraCreateBoardCard[] = [
	JIRA_CREATE_ISSUE,
	{
		assigneeAvatarLabel: "Priya Raman",
		assigneeAvatarSrc: AVATARS.priya,
		code: "PAY-133",
		priority: "medium",
		tags: [{ text: "wallet", color: "purple" }],
		title: "Draft the wallet artwork handoff for the next epic",
	},
	{
		assigneeAvatarLabel: "Jordan Okafor",
		assigneeAvatarSrc: AVATARS.jordan,
		code: "PAY-134",
		priority: "major",
		tags: [{ text: "checkout-web", color: "blue" }],
		title: "Confirm the English-only retry copy on the challenge screen",
	},
	{
		assigneeAvatarLabel: "Maya Chen",
		assigneeAvatarSrc: AVATARS.maya,
		code: "PAY-135",
		priority: "medium",
		tags: [{ text: "localisation", color: "purple" }],
		title: "Ship the nine-language decline string review",
	},
];

export const JIRA_CREATE_SESSION_ISSUE_POOL: readonly JiraCreateBoardCard[] = [
	{
		...JIRA_CREATE_ISSUE,
		agentActivities: [
			workingActivity(
				"PAY-132:cursor",
				"Cursor",
				"cursor",
				"Drafting the issuer-unavailable recovery message",
				[
					"Drafting the issuer-unavailable recovery message",
					"Comparing recovery copy variants",
					"Checking the checkout empty state",
				],
			),
		],
		agentActivityMode: "working",
	},
	{
		...JIRA_CREATE_ISSUE_POOL[1],
		agentActivities: [
			workingActivity(
				"PAY-133:claude",
				"Claude",
				"claude",
				"Preparing the wallet artwork handoff",
				[
					"Preparing the wallet artwork handoff",
					"Listing epic metadata gaps",
					"Drafting the handoff checklist",
				],
			),
		],
		agentActivityMode: "working",
	},
	{
		...JIRA_CREATE_ISSUE_POOL[2],
		agentActivities: [
			workingActivity(
				"PAY-134:cursor",
				"Cursor",
				"cursor",
				"Reviewing challenge-screen retry copy",
				[
					"Reviewing challenge-screen retry copy",
					"Comparing English-only strings",
					"Running checkout copy checks",
				],
			),
			workingActivity(
				"PAY-134:claude",
				"Claude",
				"claude",
				"Wiring retry copy into the v2 client",
				[
					"Wiring retry copy into the v2 client",
					"Updating client assertions",
					"Running checkout recovery cases",
				],
			),
		],
		agentActivityMode: "working",
	},
	{
		...JIRA_CREATE_ISSUE_POOL[3],
		agentActivities: [
			workingActivity(
				"PAY-135:cursor",
				"Cursor",
				"cursor",
				"Reviewing the nine-language decline strings",
				[
					"Reviewing the nine-language decline strings",
					"Flagging untranslated fallbacks",
					"Checking locale coverage",
				],
			),
		],
		agentActivityMode: "working",
	},
];

export const JIRA_CREATE_COLUMN_TITLE = "To do";

export const JIRA_CREATE_BOARD_COLUMNS: readonly JiraCreateBoardColumn[] = [
	{
		title: "To do",
		cards: [
			{
				assigneeAvatarLabel: "Diego Santos",
				assigneeAvatarSrc: AVATARS.diego,
				code: "PAY-118",
				priority: "medium",
				tags: [{ text: "wallet", color: "purple" }],
				title: "Carry card-artwork metadata into the next wallet epic",
			},
			{
				assigneeAvatarLabel: "Priya Raman",
				assigneeAvatarSrc: AVATARS.priya,
				code: "PAY-124",
				priority: "major",
				tags: [{ text: "rollout", color: "blue" }],
				title: "Confirm the English-only account allow-list",
			},
		],
	},
	{
		title: "In progress",
		cards: [
			{
				assigneeAvatarLabel: "Jordan Okafor",
				assigneeAvatarSrc: AVATARS.jordan,
				code: "PAY-105",
				priority: "major",
				tags: [{ text: "checkout-web", color: "blue" }],
				title: "Port confirmPaymentIntent and the 3-D Secure challenge flow",
			},
			{
				assigneeAvatarLabel: "Diego Santos",
				assigneeAvatarSrc: AVATARS.diego,
				code: "PAY-130",
				priority: "major",
				tags: [{ text: "localisation", color: "purple" }],
				title: "Localise eleven v2 decline strings into nine languages",
			},
		],
	},
	{
		title: "In review",
		cards: [
			{
				assigneeAvatarLabel: "Priya Raman",
				assigneeAvatarSrc: AVATARS.priya,
				code: "PAY-112",
				priority: "medium",
				tags: [{ text: "idempotency", color: "red" }],
				title: "Confirm the sandbox key retention window before replay",
			},
			{
				assigneeAvatarLabel: "Priya Raman",
				assigneeAvatarSrc: AVATARS.priya,
				code: "PAY-115",
				priority: "medium",
				tags: [{ text: "release note", color: "blue" }],
				title: "Rewrite the customer ship note after the wallet cut",
			},
		],
	},
];

export function getJiraCreateIssuePool(
	example: JiraCreateExample,
): readonly JiraCreateBoardCard[] {
	return example === "work-item-sessions"
		? JIRA_CREATE_SESSION_ISSUE_POOL
		: JIRA_CREATE_ISSUE_POOL;
}
