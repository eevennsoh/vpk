import type { AgentSessionItem } from "@/components/blocks/agent-session";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import type {
	JiraKanbanAgentData,
	JiraKanbanCardData,
	JiraKanbanColumnData,
} from "@/components/blocks/jira-kanban";
import type {
	JiraListAssignedAgent,
	JiraListInsertion,
	JiraListPerson,
	JiraListRowData,
	JiraListStatusOption,
} from "@/components/blocks/jira-list";

/** Mirrors TopNavigation / `JIRA_TEAM_EU26_PAY_CURRENT_USER`; covered by the list-row contract tests. */
const CURRENT_USER_ASSIGNEE = {
	id: "venn",
	name: "Venn",
	avatarSrc: "/avatar-user/venn/venn.png",
} as const;

const CURRENT_USER_INVOKER = {
	avatarSrc: CURRENT_USER_ASSIGNEE.avatarSrc,
	name: CURRENT_USER_ASSIGNEE.name,
} as const;

export const JIRA_TEAM_EU26_LIST_STATUS_OPTIONS: readonly JiraListStatusOption[] = [
	{ status: "To do", statusVariant: "neutral" },
	{ status: "In progress", statusVariant: "information" },
	{ status: "In review", statusVariant: "warning" },
	{ status: "Done", statusVariant: "success" },
];

const STATUS_VARIANTS: Readonly<Record<string, JiraListRowData["statusVariant"]>> = {
	"To do": "neutral",
	"In progress": "information",
	"In review": "warning",
	Done: "success",
};

const JIRA_AGENT_AUTO_PROGRESS_SOURCES = new Set(["To do", "Done"]);
const JIRA_AGENT_ACTIVE_COLUMN = "In progress";

export function progressJiraTeamEu26WorkItemOnStart(
	columns: readonly JiraKanbanColumnData[],
	issueKey: string,
): JiraKanbanColumnData[] {
	const sourceColumn = columns.find((column) => (
		column.cards.some((card) => card.code === issueKey)
	));
	const activeColumn = columns.find((column) => column.title === JIRA_AGENT_ACTIVE_COLUMN);

	if (!sourceColumn || !activeColumn || !JIRA_AGENT_AUTO_PROGRESS_SOURCES.has(sourceColumn.title)) {
		return [...columns];
	}

	const card = sourceColumn.cards.find((candidate) => candidate.code === issueKey);
	if (!card) {
		return [...columns];
	}

	return columns.map((column) => {
		const cards = column.title === sourceColumn.title
			? column.cards.filter((candidate) => candidate.code !== issueKey)
			: column.title === JIRA_AGENT_ACTIVE_COLUMN
				? [card, ...column.cards]
				: column.cards;
		return cards === column.cards ? column : { ...column, cards, count: cards.length };
	});
}

function slugAgentName(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function resolveCatalogAgentId(
	name: string,
	idHint: string | undefined,
	catalog: readonly JiraKanbanAgentData[],
): string {
	if (idHint) {
		if (catalog.some((agent) => agent.id === idHint)) {
			return idHint;
		}
		const suffix = idHint.includes(":") ? idHint.slice(idHint.lastIndexOf(":") + 1) : "";
		if (suffix && catalog.some((agent) => agent.id === suffix)) {
			return suffix;
		}
	}

	const byName = catalog.find((agent) => agent.name === name);
	if (byName) {
		return byName.id;
	}

	return idHint && idHint.length > 0 ? idHint : slugAgentName(name);
}

function assignedStatusFromActivityState(
	state: string | undefined,
	fallback: JiraListAssignedAgent["statusKind"],
): Pick<JiraListAssignedAgent, "statusKind" | "statusLabel"> {
	switch (state) {
		case "working":
		case "in-progress":
			return { statusKind: "working", statusLabel: "Working" };
		case "awaiting-input":
		case "needs-input":
			return { statusKind: "needs-input", statusLabel: "Needs input" };
		case "completed":
		case "finished":
		case "done":
		case "failed":
		case "review":
			return { statusKind: "finished", statusLabel: "Finished" };
		case undefined:
			return fallback === "finished"
				? { statusKind: "finished", statusLabel: "Finished" }
				: { statusKind: "working", statusLabel: "Working" };
		default:
			return { statusKind: "idle", statusLabel: "Assigned" };
	}
}

function toAssignedAgent(
	input: Readonly<{
		avatarSrc?: string;
		brandName?: JiraListAssignedAgent["brandName"];
		catalog: readonly JiraKanbanAgentData[];
		fallbackStatusKind: JiraListAssignedAgent["statusKind"];
		idHint?: string;
		invokedBy?: JiraListAssignedAgent["invokedBy"];
		name: string;
		role?: JiraListAssignedAgent["role"];
		state?: string;
	}>,
): JiraListAssignedAgent {
	const id = resolveCatalogAgentId(input.name, input.idHint, input.catalog);
	const catalogAgent = input.catalog.find((agent) => agent.id === id);
	const status = assignedStatusFromActivityState(input.state, input.fallbackStatusKind);

	return {
		id,
		name: catalogAgent?.name ?? input.name,
		...(catalogAgent?.byline ? { byline: catalogAgent.byline } : {}),
		...((catalogAgent?.avatarSrc ?? input.avatarSrc)
			? { avatarSrc: catalogAgent?.avatarSrc ?? input.avatarSrc }
			: {}),
		...((catalogAgent?.brandName ?? input.brandName)
			? { brandName: catalogAgent?.brandName ?? input.brandName }
			: {}),
		...(input.invokedBy ? { invokedBy: input.invokedBy } : {}),
		...(input.role ? { role: input.role } : {}),
		statusKind: status.statusKind,
		statusLabel: status.statusLabel,
	};
}

export function assignedAgentsFromCard(
	card: Pick<JiraKanbanCardData, "agentActivities" | "agentDoneRuns">,
	catalog: readonly JiraKanbanAgentData[],
): JiraListAssignedAgent[] {
	const assigned: JiraListAssignedAgent[] = [];
	const seenIds = new Set<string>();

	for (const activity of card.agentActivities ?? []) {
		const agent = toAssignedAgent({
			avatarSrc: activity.avatarSrc,
			brandName: activity.agentBrandName,
			catalog,
			fallbackStatusKind: "working",
			idHint: activity.id,
			invokedBy: activity.invokedBy,
			name: activity.name,
			role: activity.role,
			state: activity.state,
		});
		if (seenIds.has(agent.id)) {
			continue;
		}
		seenIds.add(agent.id);
		assigned.push(agent);
	}

	for (const run of card.agentDoneRuns ?? []) {
		const agent = toAssignedAgent({
			avatarSrc: run.agentAvatarSrc,
			brandName: run.agentBrandName,
			catalog,
			fallbackStatusKind: "finished",
			idHint: run.id,
			name: run.agentName,
			state: run.state,
		});
		if (seenIds.has(agent.id)) {
			continue;
		}
		seenIds.add(agent.id);
		assigned.push(agent);
	}

	return assigned;
}

function createAssignedActivity(
	card: JiraKanbanCardData,
	agent: JiraKanbanAgentData,
): JiraIssueAgentActivity {
	return {
		id: `${card.code}:${agent.id}`,
		name: agent.name,
		avatarSrc: agent.avatarSrc,
		agentBrandName: agent.brandName,
		label: `Assigned to ${card.title}`,
		message: `${agent.name} is working and will post the next result to the Jira work item.`,
		invokedBy: CURRENT_USER_INVOKER,
		role: "owner",
		startedAtMs: Date.now(),
		startupSequence: "jira-work-item-start",
		state: "working",
	};
}

function canonicalizeAssignedAgentIds(
	agentIds: readonly string[],
	catalog: readonly JiraKanbanAgentData[],
): string[] {
	return agentIds.map((agentId) => {
		if (catalog.some((agent) => agent.id === agentId)) {
			return agentId;
		}
		const suffix = agentId.includes(":") ? agentId.slice(agentId.lastIndexOf(":") + 1) : "";
		if (suffix && catalog.some((agent) => agent.id === suffix)) {
			return suffix;
		}
		return agentId;
	});
}

export function applyAssignedAgentIdsToCard(
	card: JiraKanbanCardData,
	agentIds: readonly string[],
	catalog: readonly JiraKanbanAgentData[],
): JiraKanbanCardData {
	const nextIds = canonicalizeAssignedAgentIds(agentIds, catalog);
	const nextIdSet = new Set(nextIds);
	const activities = (card.agentActivities ?? []).filter((activity) => (
		nextIdSet.has(resolveCatalogAgentId(activity.name, activity.id, catalog))
	));
	const doneRuns = (card.agentDoneRuns ?? []).filter((run) => (
		nextIdSet.has(resolveCatalogAgentId(run.agentName, run.id, catalog))
	));
	const presentIds = new Set([
		...activities.map((activity) => resolveCatalogAgentId(activity.name, activity.id, catalog)),
		...doneRuns.map((run) => resolveCatalogAgentId(run.agentName, run.id, catalog)),
	]);
	const addedActivities = nextIds.flatMap((agentId) => {
		if (presentIds.has(agentId)) {
			return [];
		}
		const agent = catalog.find((candidate) => candidate.id === agentId);
		return agent ? [createAssignedActivity(card, agent)] : [];
	});
	const nextActivities = [...activities, ...addedActivities];

	return {
		...card,
		agentActivities: nextActivities.length > 0 ? nextActivities : undefined,
		agentDoneRuns: doneRuns.length > 0 ? doneRuns : undefined,
	};
}

export function applyAssignedAgentIdsToColumns(
	columns: readonly JiraKanbanColumnData[],
	issueKey: string,
	agentIds: readonly string[],
	catalog: readonly JiraKanbanAgentData[],
): JiraKanbanColumnData[] {
	let started = false;
	const nextColumns = columns.map((column) => {
		const cards = column.cards.map((card) => {
			if (card.code !== issueKey) {
				return card;
			}

			const nextCard = applyAssignedAgentIdsToCard(card, agentIds, catalog);
			const previousActivityIds = new Set(card.agentActivities?.map((activity) => activity.id) ?? []);
			started = nextCard.agentActivities?.some((activity) => (
				activity.state === "working" && !previousActivityIds.has(activity.id)
			)) ?? false;
			return nextCard;
		});
		return {
			...column,
			cards,
			count: cards.length,
		};
	});

	return started
		? progressJiraTeamEu26WorkItemOnStart(nextColumns, issueKey)
		: nextColumns;
}

function createListRow(
	card: JiraKanbanCardData,
	columnTitle: string,
	catalog: readonly JiraKanbanAgentData[],
): JiraListRowData {
	return {
		issueKey: card.code,
		summary: card.title,
		issueType: card.issueType ?? "task",
		priority: card.priority,
		status: columnTitle,
		statusVariant: STATUS_VARIANTS[columnTitle],
		assignee: card.assignee,
		agentSessions: assignedAgentsFromCard(card, catalog),
		labels: card.tags,
		dueDate: card.dueDate,
		contributors: card.assignee ? [card.assignee] : [],
	};
}

export function createListRows(
	columns: readonly JiraKanbanColumnData[],
	catalog: readonly JiraKanbanAgentData[],
): JiraListRowData[] {
	return columns.flatMap((column) => column.cards.map((card) => (
		createListRow(card, column.title, catalog)
	)));
}

type ListRowIndex = ReadonlyMap<JiraKanbanCardData, JiraListRowData>;

/** Build once per board snapshot; selection never writes into this index. */
export function createListRowIndex(
	columns: readonly JiraKanbanColumnData[],
	catalog: readonly JiraKanbanAgentData[],
): ListRowIndex {
	return new Map(columns.flatMap((column) => column.cards.map((card) => (
		[card, createListRow(card, column.title, catalog)] as const
	))));
}

/** Filters can replace cards to hide sessions, so reuse requires card and status identity. */
export function selectListRows(
	columns: readonly JiraKanbanColumnData[],
	catalog: readonly JiraKanbanAgentData[],
	index: ListRowIndex,
): JiraListRowData[] {
	return columns.flatMap((column) => column.cards.map((card) => {
		const row = index.get(card);
		return row?.status === column.title ? row : createListRow(card, column.title, catalog);
	}));
}

export function applyListOrder(
	rows: readonly JiraListRowData[],
	order: readonly string[],
): JiraListRowData[] {
	if (order.length === 0) {
		return [...rows];
	}

	const byKey = new Map(rows.map((row) => [row.issueKey, row]));
	const next: JiraListRowData[] = [];
	for (const key of order) {
		const row = byKey.get(key);
		if (row) {
			next.push(row);
			byKey.delete(key);
		}
	}
	for (const row of rows) {
		if (byKey.has(row.issueKey)) {
			next.push(row);
		}
	}
	return next;
}

export function moveListOrder(
	order: readonly string[],
	visibleKeys: readonly string[],
	issueKey: string,
	targetIndex: number,
): string[] {
	const visibleKeySet = new Set(visibleKeys);
	const baseOrder = (order.length === 0 ? visibleKeys : order)
		.filter((key, index, keys) => keys.indexOf(key) === index);
	const nextOrder = [
		...baseOrder,
		...visibleKeys.filter((key) => !baseOrder.includes(key)),
	];
	const visibleInOrder = nextOrder.filter((key) => visibleKeySet.has(key));
	const sourceVisibleIndex = visibleInOrder.indexOf(issueKey);
	if (sourceVisibleIndex < 0) {
		return nextOrder;
	}

	const boundedTargetIndex = Math.min(Math.max(targetIndex, 0), visibleInOrder.length - 1);
	if (sourceVisibleIndex === boundedTargetIndex) {
		return nextOrder;
	}

	const reorderedVisible = [...visibleInOrder];
	const [movedKey] = reorderedVisible.splice(sourceVisibleIndex, 1);
	if (!movedKey) {
		return nextOrder;
	}
	reorderedVisible.splice(boundedTargetIndex, 0, movedKey);

	let visibleCursor = 0;
	return nextOrder.map((key) => (
		visibleKeySet.has(key) ? reorderedVisible[visibleCursor++] ?? key : key
	));
}

export function insertListOrderKey(
	order: readonly string[],
	visibleKeys: readonly string[],
	issueKey: string,
	insertAtIndex: number | null,
): string[] {
	const baseOrder = (order.length === 0 ? visibleKeys : order)
		.filter((key) => key !== issueKey);
	if (insertAtIndex === null) {
		return [...baseOrder, issueKey];
	}

	const visibleOrder = baseOrder.filter((key) => visibleKeys.includes(key));
	const boundedIndex = Math.min(Math.max(insertAtIndex, 0), visibleOrder.length);
	const keyAtIndex = visibleOrder[boundedIndex];
	if (!keyAtIndex) {
		return [...baseOrder, issueKey];
	}

	const fullIndex = baseOrder.indexOf(keyAtIndex);
	return [
		...baseOrder.slice(0, fullIndex),
		issueKey,
		...baseOrder.slice(fullIndex),
	];
}

export function appendBoardCreatedListOrder({
	columns,
	issueKey,
	listOrder,
	visibleKeys,
}: Readonly<{
	columns: readonly JiraKanbanColumnData[];
	issueKey: string;
	listOrder: readonly string[];
	visibleKeys: readonly string[];
}>): string[] {
	const insertionKeys = visibleKeys.length > 0
		? visibleKeys
		: columns.flatMap((column) => column.cards.map((card) => card.code));

	return insertListOrderKey(listOrder, insertionKeys, issueKey, null);
}

export function getNextPayIssueKey(columns: readonly JiraKanbanColumnData[]): string {
	const highestIssueNumber = columns.flatMap((column) => column.cards).reduce((maxIssueNumber, card) => {
		const parsedIssueNumber = Number.parseInt(card.code.split("-")[1] ?? "0", 10);
		return Number.isNaN(parsedIssueNumber) ? maxIssueNumber : Math.max(maxIssueNumber, parsedIssueNumber);
	}, 0);

	return `PAY-${highestIssueNumber + 1}`;
}

export function insertWorkItemCard(
	columns: readonly JiraKanbanColumnData[],
	card: JiraKanbanCardData,
	columnTitle: string,
	insertAtIndex?: number,
): JiraKanbanColumnData[] {
	const targetTitle = columns.some((column) => column.title === columnTitle)
		? columnTitle
		: columns[0]?.title;
	if (!targetTitle) {
		return [...columns];
	}

	return columns.map((column) => {
		if (column.title !== targetTitle) {
			return column;
		}

		// Omitted index means append, which is what every create-well caller wants.
		// A gap drop names the slot it landed in, clamped because the column can
		// have changed between the drag resolving and the drop committing.
		const cards = [...column.cards];
		if (insertAtIndex === undefined) {
			cards.push(card);
		} else {
			cards.splice(Math.min(Math.max(insertAtIndex, 0), cards.length), 0, card);
		}
		return {
			...column,
			cards,
			count: cards.length,
		};
	});
}

export function toKanbanCardFromDraft(input: Readonly<{
	assignee?: JiraListPerson;
	dueDate?: string;
	issueKey: string;
	issueType?: JiraKanbanCardData["issueType"];
	summary: string;
}>): JiraKanbanCardData {
	const assignee = input.assignee
		? {
			id: input.assignee.id,
			name: input.assignee.name,
			avatarSrc: input.assignee.avatarSrc ?? "",
		}
		: undefined;

	return {
		assignee,
		avatarShape: input.assignee?.avatarShape,
		avatarSrc: assignee?.avatarSrc || undefined,
		avatarUnassignedKind: input.assignee
			? input.assignee.avatarUnassignedKind
			: "person",
		code: input.issueKey,
		dueDate: input.dueDate,
		issueType: input.issueType ?? "task",
		priority: "medium",
		tags: [],
		title: input.summary,
	};
}

export interface CreateListWorkItemFromSessionInput {
	activity: JiraIssueAgentActivity;
	columns: readonly JiraKanbanColumnData[];
	insertion: JiraListInsertion;
	linkSession: (
		columns: readonly JiraKanbanColumnData[],
		issueKey: string,
		activity: JiraIssueAgentActivity,
	) => readonly JiraKanbanColumnData[];
	listOrder: readonly string[];
	session: Readonly<Pick<AgentSessionItem, "id" | "invokedBy" | "title">>;
	visibleKeys: readonly string[];
}

export interface CreateBoardWorkItemFromSessionInput {
	activity: JiraIssueAgentActivity;
	columns: readonly JiraKanbanColumnData[];
	columnTitle: string;
	/** Type the viewer picked in the session menu. Defaults to a task. */
	issueType?: JiraKanbanCardData["issueType"];
	/**
	 * Slot the card lands in within its column. Omitted by the create well,
	 * which appends; supplied by a drop in the gap between two cards.
	 */
	insertAtIndex?: number;
	linkSession: (
		columns: readonly JiraKanbanColumnData[],
		issueKey: string,
		activity: JiraIssueAgentActivity,
	) => readonly JiraKanbanColumnData[];
	session: Readonly<Pick<AgentSessionItem, "id" | "invokedBy" | "title">>;
}

export type CreateBoardWorkItemFromSessionResult =
	| {
		kind: "created";
		columns: readonly JiraKanbanColumnData[];
		issueKey: string;
	}
	| {
		kind: "already-attached";
		columns: readonly JiraKanbanColumnData[];
		issueKey: string;
	};

export type CreateListWorkItemFromSessionResult =
	| {
		kind: "created";
		columns: readonly JiraKanbanColumnData[];
		issueKey: string;
		listOrder: readonly string[];
	}
	| {
		kind: "already-attached";
		columns: readonly JiraKanbanColumnData[];
		issueKey: string;
		listOrder: readonly string[];
	};

export function createBoardWorkItemFromSession(
	input: CreateBoardWorkItemFromSessionInput,
): CreateBoardWorkItemFromSessionResult {
	const attachedCard = input.columns
		.flatMap((column) => column.cards)
		.find((card) => card.agentActivities?.some((activity) => activity.id === input.activity.id));
	if (attachedCard) {
		return {
			kind: "already-attached",
			columns: input.columns,
			issueKey: attachedCard.code,
		};
	}

	const issueKey = getNextPayIssueKey(input.columns);
	const card = toKanbanCardFromDraft({
		assignee: CURRENT_USER_ASSIGNEE,
		issueKey,
		issueType: input.issueType ?? "task",
		summary: input.session.title,
	});
	const columnsWithCard = insertWorkItemCard(
		input.columns,
		card,
		input.columnTitle,
		input.insertAtIndex,
	);
	const columns = input.linkSession(columnsWithCard, issueKey, input.activity);

	return {
		kind: "created",
		columns,
		issueKey,
	};
}

export function createListWorkItemFromSession(
	input: CreateListWorkItemFromSessionInput,
): CreateListWorkItemFromSessionResult {
	const result = createBoardWorkItemFromSession({
		activity: input.activity,
		columns: input.columns,
		columnTitle: "To do",
		linkSession: input.linkSession,
		session: input.session,
	});
	if (result.kind === "already-attached") {
		return {
			kind: "already-attached",
			columns: result.columns,
			issueKey: result.issueKey,
			listOrder: input.listOrder,
		};
	}

	const listOrder = insertListOrderKey(
		input.listOrder,
		input.visibleKeys,
		result.issueKey,
		input.insertion.insertAtIndex,
	);

	return {
		kind: "created",
		columns: result.columns,
		issueKey: result.issueKey,
		listOrder,
	};
}
