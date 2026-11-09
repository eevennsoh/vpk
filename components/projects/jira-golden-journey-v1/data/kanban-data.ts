import type {
	JiraIssueAgentActivity,
	JiraIssueCompletedAgentRun,
} from "@/components/blocks/jira-issue";
import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { ChangedFile, CodeReviewWorkItem } from "@/components/blocks/code-review/data/types";
import { getDirectoryAgentAvatar } from "./kanban-activity-data";

export {
	createJgpKanbanActivity,
	createJgpKanbanCompletedRun,
	getJgpGenerativeActivityId,
	getJgpGenerativeAgentSelection,
	JGP_GLOBAL_KANBAN_SELECTION_AGENTS,
	JGP_KANBAN_AGENTS,
	JGP_KANBAN_CURSOR_AGENT_ID,
	JGP_KANBAN_DEFAULT_AGENT_ID,
	JGP_KANBAN_SELECTION_AGENTS,
	type JgpKanbanAgentSelection,
} from "./kanban-activity-data";

export const JGP_KANBAN_TODO_COLUMN = "To do";
export const JGP_KANBAN_IN_PROGRESS_COLUMN = "In progress";
export const JGP_KANBAN_REVIEW_COLUMN = "Review";
export const JGP_KANBAN_DONE_COLUMN = "Done";

export type JgpKanbanScenario = "local-review" | "local-completed" | "global-assignment";
export type JgpKanbanCompletionStoryPhase = "in-progress" | "departing" | "arriving" | "done";

const CARL: JiraKanbanAssigneeData = {
	id: "carl",
	name: "Carl",
	avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
};

const SARAH: JiraKanbanAssigneeData = {
	id: "sarah",
	name: "Sarah",
	avatarSrc: "/avatar-user/annie-clare/color/asow-strategy-orange.png",
};

const MAYA: JiraKanbanAssigneeData = {
	id: "maya-chen",
	name: "Maya Chen",
	avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
};

const ELENA: JiraKanbanAssigneeData = {
	id: "elena-ruiz",
	name: "Elena Ruiz",
	avatarSrc: "/avatar-user/aoife-burke/color/asow-service-yellow.png",
};

const NOAH: JiraKanbanAssigneeData = {
	id: "noah-patel",
	name: "Noah Patel",
	avatarSrc: "/avatar-user/bradley-phillips/color/asow-product-purple.png",
};

const SOFIA: JiraKanbanAssigneeData = {
	id: "sofia-garcia",
	name: "Sofia Garcia",
	avatarSrc: "/avatar-user/brian-lin/color/asow-teamwork-blue.png",
};

const OWEN: JiraKanbanAssigneeData = {
	id: "owen-kim",
	name: "Owen Kim",
	avatarSrc: "/avatar-user/david-hsieh/color/asow-service-yellow.png",
};

function createCard(params: Readonly<{
	assignee: JiraKanbanAssigneeData;
	code: string;
	priority?: JiraKanbanCardData["priority"];
	pullRequestNumber?: JiraKanbanCardData["pullRequestNumber"];
	pullRequestStatus?: JiraKanbanCardData["pullRequestStatus"];
	tags: JiraKanbanCardData["tags"];
	title: string;
}>): JiraKanbanCardData {
	return {
		assignee: params.assignee,
		avatarSrc: params.assignee.avatarSrc,
		code: params.code,
		priority: params.priority ?? "minor",
		pullRequestNumber: params.pullRequestNumber,
		pullRequestStatus: params.pullRequestStatus,
		tags: params.tags,
		title: params.title,
	};
}

function createWorkingCard(
	card: JiraKanbanCardData,
	activities: readonly JiraIssueAgentActivity[],
	mode: JiraKanbanCardData["agentActivityMode"] = "working",
): JiraKanbanCardData {
	return {
		...card,
		agentActivities: activities,
		agentActivityMode: mode,
	};
}

function createCompletedCard(
	card: JiraKanbanCardData,
	runs: readonly JiraIssueCompletedAgentRun[],
): JiraKanbanCardData {
	return {
		...card,
		agentActivityMode: "completed",
		agentDoneRuns: runs,
	};
}

function createCompletedRun(params: Readonly<{
	agentAvatarSrc?: string;
	agentBrandName?: JiraIssueCompletedAgentRun["agentBrandName"];
	agentName: string;
	description: string;
	elapsedSeconds: number;
	issueKey: string;
	issueSummary: string;
	outputs?: JiraIssueCompletedAgentRun["outputs"];
	pullRequestNumber?: number;
	state: JiraIssueCompletedAgentRun["state"];
	summary: string;
}>): JiraIssueCompletedAgentRun {
	return {
		id: `${params.issueKey}:${params.agentName.toLowerCase().replaceAll(" ", "-")}`,
		actionLabel: params.agentBrandName ? undefined : "View",
		agentAvatarSrc: params.agentAvatarSrc,
		agentBrandName: params.agentBrandName,
		agentName: params.agentName,
		description: params.description,
		elapsedSeconds: params.elapsedSeconds,
		issueKey: params.issueKey,
		issueSummary: params.issueSummary,
		outputs: params.outputs,
		pullRequestNumber: params.pullRequestNumber,
		relativeTime: params.state === "done" ? "This week" : "Today",
		state: params.state,
		summary: params.summary,
	};
}

const JGP_247_BASE = createCard({
	assignee: CARL,
	code: "JGP-247",
	priority: "major",
	pullRequestNumber: 247,
	pullRequestStatus: "merged",
	tags: [
		{ text: "assignee focus", color: "blue" },
		{ text: "kanban", color: "teal" },
	],
	title: "Add assignee focus mode",
});

const JGP_247_REVIEW_RUN: JiraIssueCompletedAgentRun = {
	id: "JGP-247:claude-code",
	agentBrandName: "claude",
	agentName: "Claude",
	description: "Opened pull request #247 with assignee focus mode. It is ready for your review.",
	elapsedSeconds: 312,
	issueKey: "JGP-247",
	issueSummary: "Add assignee focus mode",
	outputs: [
		{
			id: "jgp-247-assignee-focus-pr",
			logoName: "github",
			pullRequest: {
				additions: 86,
				deletions: 18,
				number: 247,
				status: "Open",
			},
			source: "Pull request",
			title: "Add assignee focus mode",
		},
	],
	pullRequestNumber: 247,
	relativeTime: "Yesterday",
	state: "review",
	summary: "Opened assignee focus mode PR",
};

const LOCAL_TEAM_TODO: readonly JiraKanbanCardData[] = [
	createCard({
		assignee: NOAH,
		code: "JGP-231",
		title: "Stabilize gallery snapshot coverage",
		tags: [{ text: "testing", color: "purple" }],
	}),
	createCard({
		assignee: MAYA,
		code: "JGP-244",
		title: "Compress board illustration assets",
		tags: [
			{ text: "performance", color: "orange" },
			{ text: "assets", color: "teal" },
		],
	}),
	createCard({
		assignee: ELENA,
		code: "JGP-217",
		title: "Migrate date picker to ADS",
		tags: [
			{ text: "design system", color: "blue" },
			{ text: "migration", color: "purple" },
			{ text: "date picker", color: "teal" },
		],
	}),
];

const LOCAL_TEAM_IN_PROGRESS: readonly JiraKanbanCardData[] = [
	createWorkingCard(
		createCard({
			assignee: SARAH,
			code: "JGP-241",
			title: "Keep board filters in the URL",
			tags: [
				{ text: "navigation", color: "blue" },
				{ text: "filters", color: "teal" },
			],
		}),
		[
			{
				id: "cursor",
				name: "Cursor",
				agentBrandName: "cursor",
				label: "Updating URL state synchronization",
				labels: ["Updating URL state synchronization", "Checking browser history", "Running navigation tests"],
				cycleIntervalMs: 2100,
				cycleIntervalJitterMs: 300,
				message: "I’m keeping board filters synchronized with the URL and checking back-forward navigation.",
				initialElapsedSeconds: 164,
				state: "working",
			},
			{
				id: "code-reviewer",
				name: "Code Reviewer",
				avatarSrc: getDirectoryAgentAvatar("code-reviewer"),
				label: "Reviewing URL-state edge cases",
				labels: ["Reviewing URL-state edge cases", "Checking filter serialization", "Verifying navigation coverage"],
				cycleIntervalMs: 2400,
				cycleIntervalJitterMs: 300,
				message: "I’m reviewing the URL-state changes for edge cases while Cursor finishes the implementation.",
				initialElapsedSeconds: 102,
				state: "working",
			},
		],
	),
	createCard({
		assignee: MAYA,
		code: "JGP-242",
		title: "Improve board loading performance",
		tags: [{ text: "performance", color: "orange" }],
	}),
	createWorkingCard(
		createCard({
			assignee: OWEN,
			code: "JGP-243",
			title: "Map dependencies for board permissions",
			tags: [
				{ text: "permissions", color: "teal" },
				{ text: "dependencies", color: "blue" },
				{ text: "blocked", color: "orange" },
			],
		}),
		[{
			id: "dependency-mapper",
			name: "Dependency Mapper",
			avatarSrc: getDirectoryAgentAvatar("work-item-planner"),
			label: "Needs input",
			labels: ["Mapping permission dependencies", "Checking project boundaries", "Needs input"],
			message: "I found two permission boundaries that change the implementation path.",
			initialElapsedSeconds: 391,
			question: {
				id: "permission-boundary",
				label: "Which permission boundary should the board use?",
				kind: "single-select",
				options: [
					{ id: "project", label: "Project permissions", description: "Follow the current project permission scheme." },
					{ id: "board", label: "Board permissions", description: "Use a board-specific permission boundary." },
				],
			},
			state: "awaiting-input",
		}],
		"awaiting-input",
	),
];

const LOCAL_TEAM_REVIEW: readonly JiraKanbanCardData[] = [
	createCompletedCard(
		createCard({
			assignee: CARL,
			code: "JGP-239",
			title: "Fix assignee facepile overflow",
			tags: [
				{ text: "facepile", color: "orange" },
				{ text: "responsive", color: "blue" },
				{ text: "bug", color: "purple" },
			],
		}),
		[
			createCompletedRun({
				agentBrandName: "claude",
				agentName: "Claude",
				description: "Resolved the facepile overflow at narrow board widths and prepared the change for review.",
				elapsedSeconds: 226,
				issueKey: "JGP-239",
				issueSummary: "Fix assignee facepile overflow",
				outputs: [{
					id: "jgp-239-facepile-pr",
					logoName: "github",
					pullRequest: {
						additions: 42,
						deletions: 11,
						number: 812,
						status: "Open",
					},
					source: "Pull request",
					title: "Fix assignee facepile overflow",
				}],
				pullRequestNumber: 812,
				state: "review",
				summary: "Fixed the facepile overflow",
			}),
			createCompletedRun({
				agentAvatarSrc: getDirectoryAgentAvatar("brand-voice-crafter"),
				agentName: "Unit Test Creator",
				description: "Added responsive regression coverage for the assignee facepile.",
				elapsedSeconds: 142,
				issueKey: "JGP-239",
				issueSummary: "Fix assignee facepile overflow",
				outputs: [{
					id: "jgp-239-facepile-coverage",
					iconName: "page",
					owner: "Page",
					source: "Confluence",
					title: "Assignee facepile responsive coverage",
				}],
				state: "review",
				summary: "Added responsive facepile coverage",
			}),
		],
	),
	createCompletedCard(
		createCard({
			assignee: CARL,
			code: "JGP-232",
			title: "Announce filtered result counts",
			tags: [{ text: "accessibility", color: "green" }],
		}),
		[createCompletedRun({
			agentAvatarSrc: getDirectoryAgentAvatar("chatgpt-wrapper-app"),
			agentName: "Accessibility Tester",
			description: "Added regression coverage for result-count announcements across filter changes.",
			elapsedSeconds: 194,
			issueKey: "JGP-232",
			issueSummary: "Announce filtered result counts",
			outputs: [{
				id: "jgp-232-announcement-coverage",
				iconName: "video",
				owner: "Video",
				source: "Loom",
				title: "Filtered result-count accessibility walkthrough",
			}],
			state: "review",
			summary: "Added result-count announcement coverage",
		})],
	),
	createCompletedCard(
		createCard({
			assignee: CARL,
			code: "JGP-234",
			title: "Preserve keyboard focus after filtering",
			tags: [
				{ text: "keyboard", color: "purple" },
				{ text: "accessibility", color: "green" },
			],
		}),
		[createCompletedRun({
			agentBrandName: "claude",
			agentName: "Claude",
			description: "Preserved keyboard focus across filter changes and prepared the result for review.",
			elapsedSeconds: 171,
			issueKey: "JGP-234",
			issueSummary: "Preserve keyboard focus after filtering",
			outputs: [{
				id: "jgp-234-keyboard-focus-pr",
				logoName: "github",
				pullRequest: {
					additions: 31,
					deletions: 8,
					number: 819,
					status: "Open",
				},
				source: "Pull request",
				title: "Preserve keyboard focus after filtering",
			}],
			pullRequestNumber: 819,
			state: "review",
			summary: "Preserved keyboard focus across filters",
		})],
	),
];

const LOCAL_TEAM_DONE: readonly JiraKanbanCardData[] = [
	createCard({
		assignee: SOFIA,
		code: "JGP-240",
		title: "Clarify focused-assignee empty states",
		tags: [{ text: "content", color: "green" }],
	}),
	createCard({
		assignee: ELENA,
		code: "JGP-236",
		title: "Document assignee focus shortcuts",
		tags: [
			{ text: "documentation", color: "blue" },
			{ text: "shortcuts", color: "teal" },
		],
	}),
	createCard({
		assignee: NOAH,
		code: "JGP-238",
		title: "Align board filter analytics events",
		tags: [
			{ text: "analytics", color: "purple" },
			{ text: "filters", color: "blue" },
			{ text: "instrumentation", color: "teal" },
		],
	}),
];

const GLOBAL_TASKS: readonly JiraKanbanCardData[] = [
	createCard({ assignee: SARAH, code: "JGP-251", title: "Remember assignee focus per board", tags: [{ text: "preferences", color: "blue" }] }),
	createCard({ assignee: SARAH, code: "JGP-252", title: "Add a Clear focus action", tags: [{ text: "interaction", color: "teal" }] }),
	createCard({ assignee: SARAH, code: "JGP-253", title: "Preserve keyboard focus in the assignee facepile", tags: [{ text: "keyboard", color: "purple" }] }),
	createCard({ assignee: SARAH, code: "JGP-254", title: "Announce filtered result counts to screen readers", tags: [{ text: "accessibility", color: "green" }] }),
	createCard({ assignee: SARAH, code: "JGP-255", title: "Add an empty state when an assignee has no visible work", tags: [{ text: "empty state", color: "orange" }] }),
];

const GLOBAL_BACKGROUND_TASKS: readonly JiraKanbanCardData[] = [
	createCard({ assignee: MAYA, code: "JGP-257", title: "Persist quick filters across board refreshes", tags: [{ text: "filters", color: "blue" }] }),
	createCard({ assignee: ELENA, code: "JGP-258", title: "Clarify the focused-assignee tooltip", tags: [{ text: "content", color: "teal" }] }),
	createCard({ assignee: NOAH, code: "JGP-259", title: "Track assignee focus adoption", tags: [{ text: "analytics", color: "purple" }] }),
	createCard({ assignee: SOFIA, code: "JGP-260", title: "Document board focus shortcuts", tags: [{ text: "documentation", color: "green" }] }),
];

const GLOBAL_TEAM_WORK = {
	inProgress: [
		createCard({ assignee: MAYA, code: "JGP-248", title: "Keep board filters in the URL", tags: [{ text: "navigation", color: "blue" }] }),
		createCard({ assignee: OWEN, code: "JGP-249", title: "Add keyboard shortcuts to assignee focus", tags: [{ text: "keyboard", color: "purple" }] }),
	],
	review: [
		createCard({ assignee: ELENA, code: "JGP-250", title: "Restore focus after clearing filters", tags: [{ text: "accessibility", color: "green" }] }),
		{
			...createCard({ assignee: NOAH, code: "JGP-256", title: "Remove the retired assignee-focus feature flag", tags: [{ text: "cleanup", color: "teal" }] }),
			agentActivityMode: "completed" as const,
			agentDoneRuns: [{
				id: "JGP-256:cursor",
				agentBrandName: "cursor",
				agentName: "Cursor",
				description: "Removed the retired feature flag and opened pull request #839 for review.",
				elapsedSeconds: 184,
				issueKey: "JGP-256",
				issueSummary: "Remove the retired assignee-focus feature flag",
				outputs: [{
					id: "jgp-256-retired-flag-pr",
					logoName: "github",
					pullRequest: {
						additions: 24,
						deletions: 61,
						number: 839,
						status: "Open",
					},
					source: "Pull request",
					title: "Remove the retired assignee-focus feature flag",
				}],
				pullRequestNumber: 839,
				relativeTime: "Today",
				state: "review",
				summary: "Opened retired feature flag cleanup PR",
			}],
		},
	],
	done: [
		createCard({ assignee: SOFIA, code: "JGP-246", title: "Add assignee facepile overflow", tags: [{ text: "facepile", color: "orange" }] }),
		JGP_247_BASE,
	],
} as const;

function createColumns(cardsByTitle: Readonly<Record<string, readonly JiraKanbanCardData[]>>): JiraKanbanColumnData[] {
	return [
		JGP_KANBAN_TODO_COLUMN,
		JGP_KANBAN_IN_PROGRESS_COLUMN,
		JGP_KANBAN_REVIEW_COLUMN,
		JGP_KANBAN_DONE_COLUMN,
	].map((title) => {
		const cards = (cardsByTitle[title] ?? []).map((card) => ({
			...card,
			assignee: card.assignee ? { ...card.assignee } : undefined,
			tags: card.tags.map((tag) => ({ ...tag })),
			agentActivities: card.agentActivities?.map((activity) => ({
				...activity,
				labels: activity.labels ? [...activity.labels] : undefined,
				question: activity.question ? {
					...activity.question,
					options: activity.question.options.map((option) => ({ ...option })),
				} : undefined,
			})),
			agentDoneRuns: card.agentDoneRuns?.map((run) => ({
				...run,
				outputs: run.outputs?.map((output) => ({ ...output })),
			})),
		}));
		return { title, count: cards.length, cards };
	});
}

/** Creates a fresh, deterministic board for one gallery segment. */
export function createJgpKanbanColumns(scenario: JgpKanbanScenario = "local-review"): JiraKanbanColumnData[] {
	if (scenario === "global-assignment") {
		return createColumns({
			[JGP_KANBAN_TODO_COLUMN]: [...GLOBAL_TASKS, ...GLOBAL_BACKGROUND_TASKS],
			[JGP_KANBAN_IN_PROGRESS_COLUMN]: GLOBAL_TEAM_WORK.inProgress,
			[JGP_KANBAN_REVIEW_COLUMN]: GLOBAL_TEAM_WORK.review,
			[JGP_KANBAN_DONE_COLUMN]: GLOBAL_TEAM_WORK.done,
		});
	}

	if (scenario === "local-completed") {
		return createColumns({
			[JGP_KANBAN_TODO_COLUMN]: LOCAL_TEAM_TODO,
			[JGP_KANBAN_IN_PROGRESS_COLUMN]: LOCAL_TEAM_IN_PROGRESS,
			[JGP_KANBAN_REVIEW_COLUMN]: LOCAL_TEAM_REVIEW,
			[JGP_KANBAN_DONE_COLUMN]: [JGP_247_BASE, ...LOCAL_TEAM_DONE],
		});
	}

	return createColumns({
		[JGP_KANBAN_TODO_COLUMN]: LOCAL_TEAM_TODO,
		[JGP_KANBAN_IN_PROGRESS_COLUMN]: LOCAL_TEAM_IN_PROGRESS,
		[JGP_KANBAN_REVIEW_COLUMN]: [
			{
				...JGP_247_BASE,
				agentActivityMode: "completed",
				agentDoneRuns: [JGP_247_REVIEW_RUN],
				pullRequestStatus: "open",
			},
			...LOCAL_TEAM_REVIEW,
		],
		[JGP_KANBAN_DONE_COLUMN]: LOCAL_TEAM_DONE,
	});
}

export function createJgpKanbanCompletionStoryColumns(
	phase: JgpKanbanCompletionStoryPhase,
): JiraKanbanColumnData[] {
	const completedColumns = createJgpKanbanColumns("local-completed");
	if (phase === "arriving" || phase === "done") return completedColumns;

	const completedCard = completedColumns
		.flatMap((column) => column.cards)
		.find((card) => card.code === "JGP-247");
	if (!completedCard) return completedColumns;

	const openCard: JiraKanbanCardData = {
		...completedCard,
		pullRequestStatus: "open",
	};

	return completedColumns.map((column) => {
		const cards = column.title === JGP_KANBAN_IN_PROGRESS_COLUMN
			? [openCard, ...column.cards]
			: column.cards.filter((card) => card.code !== completedCard.code);
		return { ...column, cards, count: cards.length };
	});
}

export const JGP_CODE_REVIEW_WORK_ITEM: CodeReviewWorkItem = {
	key: "JGP-247",
	title: "Add assignee focus mode",
	environment: "Development",
	repoName: "atlassian/jira",
	localBranchName: "carl/jgp-247-assignee-focus-mode",
	branchName: "main",
};

const JGP_ASSIGNEE_FOCUS_PREFIX = `export interface BoardCard {
	code: string;
	assigneeId?: string;
	columnId: string;
}

export interface SelectionAnchor {
	cardCode: string;
	columnId: string;
}

interface SelectVisibleRangeOptions {
	anchor: SelectionAnchor | null;
	targetCode: string;
	visibleCards: readonly BoardCard[];
}

function findVisibleIndex(cards: readonly BoardCard[], cardCode: string): number {
	return cards.findIndex((card) => card.code === cardCode);
}

function orderRange(startIndex: number, endIndex: number): readonly [number, number] {
	return startIndex <= endIndex
		? [startIndex, endIndex]
		: [endIndex, startIndex];
}

export function selectVisibleRange({
	anchor,
	targetCode,
	visibleCards,
}: SelectVisibleRangeOptions): readonly BoardCard[] {`;

const JGP_ASSIGNEE_FOCUS_AFTER_RANGE = `}

function selectOnlyTarget(
	visibleCards: readonly BoardCard[],
	targetCode: string,
): readonly BoardCard[] {
	const target = visibleCards.find((card) => card.code === targetCode);
	return target ? [target] : [];
}

function createVisibleCodeSet(visibleCards: readonly BoardCard[]): ReadonlySet<string> {
	return new Set(visibleCards.map((card) => card.code));
}

export function reconcileSelection(
	selectedCodes: ReadonlySet<string>,
	visibleCards: readonly BoardCard[],
	anchor: SelectionAnchor | null,
): ReadonlySet<string> {`;

const JGP_ASSIGNEE_FOCUS_AFTER_RECONCILE = `}

export function isSelectionVisible(
	selectedCodes: ReadonlySet<string>,
	visibleCards: readonly BoardCard[],
): boolean {
	const visibleCodes = createVisibleCodeSet(visibleCards);
	return Array.from(selectedCodes).every((cardCode) => visibleCodes.has(cardCode));
}

function findAnchorCard(
	visibleCards: readonly BoardCard[],
	cardCode: string,
): BoardCard | undefined {
	return visibleCards.find((card) => card.code === cardCode);
}

export function resolveSelectionAnchor(
	visibleCards: readonly BoardCard[],
	targetCode: string,
	previousAnchor: SelectionAnchor | null,
): SelectionAnchor | null {`;

const JGP_ASSIGNEE_FOCUS_OLD = [
	JGP_ASSIGNEE_FOCUS_PREFIX,
	`	// Legacy range selection used the unfiltered board index.
	// It could select cards hidden by the active assignee filter.
	// Reversed ranges were normalized by mutating the source list.
	// Missing anchors silently selected every card in the column.
	// Duplicate card codes were not removed from the result.
	// Keyboard selection did not follow the rendered card order.`,
	JGP_ASSIGNEE_FOCUS_AFTER_RANGE,
	`	// Legacy reconciliation retained hidden card codes.
	// Empty results discarded the current keyboard anchor.
	// Selection order changed whenever filters were toggled.
	// Duplicate codes could survive into the toolbar state.
	// The returned Set reused mutable caller-owned state.`,
	JGP_ASSIGNEE_FOCUS_AFTER_RECONCILE,
	`	// Legacy anchor lookup ignored the filtered card collection.
	// Moving between columns could retain an invalid anchor.
	// Hidden cards remained eligible as the next range start.
	// Repeated selection always allocated a new anchor object.
	// Missing target cards defaulted to the first board card.`,
	"}",
].join("\n");

const JGP_ASSIGNEE_FOCUS_NEW = [
	JGP_ASSIGNEE_FOCUS_PREFIX,
	`	if (!anchor) {
		return selectOnlyTarget(visibleCards, targetCode);
	}
	const anchorIndex = findVisibleIndex(visibleCards, anchor.cardCode);
	const targetIndex = findVisibleIndex(visibleCards, targetCode);
	if (anchorIndex === -1) {
		return selectOnlyTarget(visibleCards, targetCode);
	}
	if (targetIndex === -1) {
		return selectOnlyTarget(visibleCards, targetCode);
	}
	const [startIndex, endIndex] = orderRange(anchorIndex, targetIndex);
	const selectedCards = visibleCards.slice(startIndex, endIndex + 1);
	if (selectedCards.length === 0) {
		return selectOnlyTarget(visibleCards, targetCode);
	}
	if (!selectedCards.some((card) => card.code === targetCode)) {
		return selectOnlyTarget(visibleCards, targetCode);
	}
	// Range selection follows the exact filtered order rendered on the board.
	return selectedCards.filter(
		(card, index, cards) =>
			cards.findIndex((candidate) => candidate.code === card.code) === index,
	);`,
	JGP_ASSIGNEE_FOCUS_AFTER_RANGE,
	`	const visibleCodes = createVisibleCodeSet(visibleCards);
	const nextSelection = new Set<string>();
	for (const cardCode of selectedCodes) {
		if (visibleCodes.has(cardCode)) {
			nextSelection.add(cardCode);
		}
	}
	if (nextSelection.size === 0) {
		const firstVisibleCard = visibleCards.at(0);
		if (firstVisibleCard) {
			nextSelection.add(firstVisibleCard.code);
		}
	}
	if (anchor && visibleCodes.has(anchor.cardCode)) {
		nextSelection.add(anchor.cardCode);
	}
	// Stable ordering keeps selection snapshots deterministic across renders.
	return new Set(
		Array.from(nextSelection).sort((left, right) => left.localeCompare(right)),
	);`,
	JGP_ASSIGNEE_FOCUS_AFTER_RECONCILE,
	`	const anchorCard = findAnchorCard(visibleCards, targetCode);
	const anchorColumnId = anchorCard?.columnId;
	if (!anchorCard || !anchorColumnId) {
		return null;
	}
	const columnCards = visibleCards.filter((card) => card.columnId === anchorColumnId);
	const visibleIndex = findVisibleIndex(columnCards, targetCode);
	const isStillVisible = visibleIndex >= 0;
	if (!isStillVisible) {
		return null;
	}
	const normalizedAnchor = {
		cardCode: anchorCard.code,
		columnId: anchorColumnId,
	} satisfies SelectionAnchor;
	// Keep the anchor stable when the same visible card remains selected.
	if (previousAnchor?.cardCode === normalizedAnchor.cardCode) {
		return previousAnchor;
	}
	return normalizedAnchor;`,
	"}",
].join("\n");

export const JGP_CODE_REVIEW_FILES: readonly ChangedFile[] = [
	{
		id: "assignee-focus-selection",
		path: "components/kanban/assignee-focus.ts",
		status: "modified",
		language: "typescript",
		oldContents: JGP_ASSIGNEE_FOCUS_OLD,
		newContents: JGP_ASSIGNEE_FOCUS_NEW,
		additions: 64,
		deletions: 16,
		defaultExpanded: true,
	},
	...[
		{
			path: ".editorconfig",
			language: "ini",
			contents: "root = true\n[*]\nindent_style = tab\nend_of_line = lf",
		},
		{
			path: ".eslintignore",
			language: "text",
			contents: "build\nout\nnode_modules",
		},
		{
			path: ".git-blame-ignore",
			language: "text",
			contents: "# Formatting-only revisions are recorded here.",
		},
		{
			path: ".gitattributes",
			language: "text",
			contents: "* text=auto eol=lf\n*.png binary",
		},
		{
			path: ".mailmap",
			language: "text",
			contents: "Jira Design <jira-design@atlassian.com>",
		},
		{
			path: ".mention-bot",
			language: "json",
			contents: "{\"reviewers\":[\"jira-design\"]}",
		},
		{
			path: ".yarnrc",
			language: "text",
			contents: "--install.frozen-lockfile true",
		},
		{
			path: "yarn.lock",
			language: "yaml",
			contents: "# Mock lockfile for the scripted review.",
		},
		{
			path: "gulpfile.js",
			language: "javascript",
			contents: "export { build } from \"./scripts/build\";",
		},
		{
			path: ".eslintrc.json",
			language: "json",
			contents: "{\"extends\":[\"@atlassian\"]}",
		},
		{
			path: ".lsifrc.json",
			language: "json",
			contents: "{\"projectRoot\":\".\"}",
		},
		{
			path: "cglicenses.json",
			language: "json",
			contents: "{\"licenses\":[]}",
		},
		{
			path: "cgmanifest.json",
			language: "json",
			contents: "{\"registrations\":[]}",
		},
		{
			path: "product.json",
			language: "json",
			contents: "{\"name\":\"Jira Design\"}",
		},
		{
			path: "tsfmt.json",
			language: "json",
			contents: "{\"tabs\":true}",
		},
		{
			path: "ipc.mp.test.ts",
			language: "typescript",
			contents: "export const ipcContract = \"stable\";",
			id: "ipc-mp-test",
		},
	].map(({ contents, id, language, path }) => ({
		id: id ?? `jgp-explorer:${path}`,
		path,
		explorerPath: path,
		status: "modified" as const,
		language,
		oldContents: contents,
		newContents: contents,
		additions: 0,
		deletions: 0,
		defaultExpanded: false,
	})),
	{
		id: "jgp-explorer:.gitignore",
		path: ".gitignore",
		explorerPath: ".gitignore",
		status: "modified",
		language: "text",
		oldContents: "legacy-dist",
		newContents: "dist\n.next\ncoverage\noutput\n*.log\n.DS_Store",
		additions: 6,
		deletions: 1,
		defaultExpanded: false,
	},
	{
		id: "jgp-explorer:package.json",
		path: "package.json",
		explorerPath: "package.json",
		status: "modified",
		language: "json",
		oldContents: "{\"name\":\"jira\"}",
		newContents: `{
	"name": "@atlassian/jira-board",
	"private": true,
	"scripts": {
		"test": "pnpm test",
		"typecheck": "tsc --noEmit"
	}
}`,
		additions: 8,
		deletions: 1,
		defaultExpanded: false,
	},
	{
		id: "jgp-explorer:CONTRIBUTING.md",
		path: "CONTRIBUTING.md",
		explorerPath: "CONTRIBUTING.md",
		status: "added",
		language: "markdown",
		oldContents: "",
		newContents: `# Contributing

1. Create a focused branch.
2. Keep board filters reflected in the URL.
3. Test keyboard and pointer selection.
4. Run the focused unit tests.
5. Request review from Jira Design.
6. Merge after approval.`,
		additions: 8,
		deletions: 0,
		defaultExpanded: false,
	},
];
