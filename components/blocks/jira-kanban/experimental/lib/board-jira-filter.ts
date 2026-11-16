import type { JiraFilterCondition, JiraFilterField } from "@/components/blocks/jira-filter";
import type { JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban/index";
const normalizeStatus = (status: string) => status.toLowerCase().replaceAll(" ", "-");

function cardValues(card: JiraKanbanCardData, column: JiraKanbanColumnData, field: string): readonly string[] | null {
	switch (field) {
		case "assignee": return card.assignee ? [card.assignee.id] : column.presenters?.map((presenter) => presenter.id) ?? ["unassigned"];
		case "status": return [normalizeStatus(card.status ?? column.title)];
		case "type": return [card.issueType ?? "task"];
		case "label": return card.tags.length ? card.tags.map((tag) => tag.text) : ["no-label"];
		case "prStatus": return [card.pullRequestStatus ?? (card.pullRequestNumber ? "open" : "none")];
		case "agentStatus": return [
			...(card.agentActivities ?? []).map((activity) => activity.state === "awaiting-input" ? "needsInput" : activity.state === "completed" ? "finished" : "working"),
			...(card.agentDoneRuns?.length ? ["finished"] : []),
		];
		default: return null;
	}
}

export function filterBoardByJiraConditions(columns: readonly JiraKanbanColumnData[], conditions: readonly JiraFilterCondition[]) {
	if (!conditions.length) return columns;
	return columns.map((column) => {
		const cards = column.cards.filter((card) => conditions.every((condition) => {
			const values = cardValues(card, column, condition.field);
			if (values === null || !condition.values.length) return true;
			const matches = condition.values.some((value) => values.includes(value));
			return condition.operator === "is not" ? !matches : matches;
		}));
		return { ...column, cards, count: cards.length };
	});
}

export function boardJiraFilterFields(columns: readonly JiraKanbanColumnData[]): JiraFilterField[] {
	const cards = columns.flatMap((column) => column.cards);
	const options = (values: readonly string[]) => [...new Set(values)].map((value) => ({ value, label: value }));
	return [
		{ id: "agentStatus", label: "Agent status", multiple: true, options: [
			{ value: "working", label: "Working" }, { value: "needsInput", label: "Needs input" }, { value: "finished", label: "Finished" },
		] },
		{ id: "prStatus", label: "Pull request", multiple: true, options: [
			{ value: "open", label: "Open" }, { value: "draft", label: "Draft" }, { value: "failed", label: "Failed" },
			{ value: "merged", label: "Merged" }, { value: "none", label: "No PR" },
		] },
		{ id: "status", label: "Status", multiple: true, options: columns.flatMap((column) =>
			(column.statuses ?? [column.title]).map((label) => ({ value: normalizeStatus(label), label }))) },
		{ id: "type", label: "Work type", multiple: true, options: options(cards.map((card) => card.issueType ?? "task")) },
		{ id: "label", label: "Labels", multiple: true, options: [{ value: "no-label", label: "No label" }, ...options(cards.flatMap((card) => card.tags.map((tag) => tag.text)))] },
	];
}
