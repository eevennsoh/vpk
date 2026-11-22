import type { JiraInlineCreateProps } from "@/components/blocks/jira-inline-create";
import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData, JiraKanbanPriority } from "@/components/blocks/jira-kanban";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import type { BoardSwimlaneOptionId } from "../data/board-group-options";
import type { JiraListGroupVisual, JiraWorkItemGroup } from "@/components/blocks/jira-list/jira-list-grouping";

type BoardSwimlaneIdentity =
	| { kind: "assignee"; assignee: JiraKanbanAssigneeData | null }
	| { kind: "agent"; avatarSrc?: string; brandName?: ThirdPartyLogoName; vpkLogo?: "rovo" }
	| { kind: "priority"; priority: JiraKanbanPriority }
	| { kind: "work-type"; issueType: NonNullable<JiraKanbanCardData["issueType"]> }
	| { kind: "epic" | "labels" | "subtask" | "status" | "parent" };

interface BoardSwimlaneValue {
	key: string | null;
	label: string;
	identity: BoardSwimlaneIdentity;
}

export interface BoardSwimlane extends BoardSwimlaneValue {
	id: string;
	count: number;
	columns: JiraKanbanColumnData[];
}

export function inlineCreateSwimlaneDefaults(lane: BoardSwimlane): JiraInlineCreateProps["defaults"] {
	const { identity, key } = lane;
	switch (identity.kind) {
		case "assignee": return { assignee: identity.assignee ?? undefined };
		case "priority": return { priority: identity.priority };
		case "labels": return key ? { tags: [key] } : undefined;
		case "epic": return key ? { parentIssueKey: key } : undefined;
		default: return undefined;
	}
}

const PRIORITY_ORDER: readonly JiraKanbanPriority[] = ["critical", "major", "medium", "minor", "trivial"];
const byLabel = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function swimlaneValue(
	card: JiraKanbanCardData,
	columnTitle: string,
	groupBy: BoardSwimlaneOptionId,
	cardsByCode: ReadonlyMap<string, JiraKanbanCardData>,
): BoardSwimlaneValue | null {
	switch (groupBy) {
		case "assignee": {
			const assignee = card.assignee ?? null;
			return { key: assignee?.id ?? null, label: assignee?.name ?? "Unassigned", identity: { kind: "assignee", assignee } };
		}
		case "agent": {
			const activity = card.agentActivities?.[0];
			const run = card.agentDoneRuns?.[0];
			const name = activity?.name ?? run?.agentName;
			if (!name) return null;
			return {
				key: name,
				label: name,
				identity: activity
					? { kind: "agent", avatarSrc: activity.avatarSrc, brandName: activity.agentBrandName, vpkLogo: activity.agentVpkLogo }
					: { kind: "agent", avatarSrc: run?.agentAvatarSrc, brandName: run?.agentBrandName },
			};
		}
		case "priority":
			return {
				key: card.priority,
				label: card.priority[0].toUpperCase() + card.priority.slice(1),
				identity: { kind: "priority", priority: card.priority },
			};
		case "status": {
			const status = card.status ?? columnTitle;
			return { key: status, label: status, identity: { kind: "status" } };
		}
		case "work-type": {
			const type = card.issueType ?? "task";
			return { key: type, label: type === "subtask" ? "Subtask" : type[0].toUpperCase() + type.slice(1), identity: { kind: "work-type", issueType: type } };
		}
		case "labels": {
			const label = card.tags[0]?.text.trim();
			return { key: label || null, label: label || "Uncategorised", identity: { kind: "labels" } };
		}
		case "epic":
		case "subtask":
		case "parent": {
			const parentKey = card.parentIssueKey;
			const parent = parentKey ? cardsByCode.get(parentKey) : undefined;
			const key = (groupBy === "epic" ? parent?.issueType === "epic" : groupBy === "parent" || card.issueType === "subtask") ? parentKey : undefined;
			return {
				key: key ?? null,
				label: key ? (parent ? `${key} ${parent.title}` : key) : "Uncategorised",
				identity: { kind: groupBy },
			};
		}
	}
}

export function groupBoardColumns(
	visibleColumns: readonly JiraKanbanColumnData[],
	groupBy: BoardSwimlaneOptionId,
	allColumns: readonly JiraKanbanColumnData[] = visibleColumns,
): BoardSwimlane[] {
	const cardsByCode = new Map(allColumns.flatMap((column) => column.cards.map((card) => [card.code, card] as const)));
	const lanes = new Map<string | null, BoardSwimlane>();

	for (const [columnIndex, column] of visibleColumns.entries()) {
		for (const card of column.cards) {
			const value = swimlaneValue(cardsByCode.get(card.code) ?? card, column.title, groupBy, cardsByCode);
			if (!value) continue;
			let lane = lanes.get(value.key);
			if (!lane) {
				lane = {
					...value,
					id: JSON.stringify([groupBy, value.key]),
					count: 0,
					columns: visibleColumns.map((status) => ({ ...status, count: 0, cards: [] })),
				};
				lanes.set(value.key, lane);
			}
			lane.count++;
			lane.columns[columnIndex].count++;
			lane.columns[columnIndex].cards.push(card);
		}
	}

	const statusOrder = groupBy === "status" ? allColumns.flatMap((column) => column.statuses ?? [column.title]) : undefined;
	return [...lanes.values()].sort((left, right) => {
		if (left.key === null) return 1;
		if (right.key === null) return -1;
		if (left.identity.kind === "priority" && right.identity.kind === "priority") {
			return PRIORITY_ORDER.indexOf(left.identity.priority) - PRIORITY_ORDER.indexOf(right.identity.priority);
		}
		if (statusOrder) {
			return statusOrder.indexOf(left.label) - statusOrder.indexOf(right.label);
		}
		return byLabel.compare(left.label, right.label) || byLabel.compare(left.key, right.key);
	});
}

function groupVisual({ identity, key, label }: BoardSwimlaneValue): JiraListGroupVisual {
	switch (identity.kind) {
		case "assignee": return { kind: "assignee", person: identity.assignee };
		case "labels": return { kind: "label", hasValue: key !== null };
		case "parent":
		case "epic": return { kind: "epic", key, name: key && label.startsWith(`${key} `) ? label.slice(key.length + 1) : label };
		case "status": return { kind: "status" };
		case "subtask": return { kind: "subtask" };
		default: return identity;
	}
}

export function toJiraWorkItemGroups(lanes?: readonly BoardSwimlane[], groupBy?: BoardSwimlaneOptionId | null): JiraWorkItemGroup[] | undefined {
	return lanes?.map(({ id, label, columns, identity, key }) => ({
		id, label, issueKeys: columns.flatMap(({ cards }) => cards.map(({ code }) => code)),
		visual: groupVisual({ identity, key, label }),
		keepChildrenWithParent: groupBy !== "parent" && groupBy !== "subtask",
	}));
}
