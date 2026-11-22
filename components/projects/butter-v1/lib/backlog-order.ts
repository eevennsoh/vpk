import type { JiraBacklogSprintMove } from "@/components/blocks/jira-backlog";

export interface ButterBacklogOrder {
	sprintKeys: readonly string[];
	backlogKeys: readonly string[];
}

export const INITIAL_BUTTER_BACKLOG_ORDER: ButterBacklogOrder = {
	sprintKeys: ["PAY-105", "PAY-107", "PAY-112"],
	backlogKeys: [],
};

export function moveButterBacklogItems(
	order: ButterBacklogOrder,
	{ itemIds, destination }: Pick<JiraBacklogSprintMove, "itemIds" | "destination">,
): ButterBacklogOrder {
	const moved = new Set(itemIds);
	const sprintKeys = order.sprintKeys.filter((id) => !moved.has(id));
	const backlogKeys = order.backlogKeys.filter((id) => !moved.has(id));
	return destination === "sprint"
		? { sprintKeys: [...sprintKeys, ...moved], backlogKeys }
		: { sprintKeys, backlogKeys: [...moved, ...backlogKeys] };
}
