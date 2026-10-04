import { createJiraTeamEu26PayBoardColumns } from "@/components/projects/jira-team-eu26/data/presentation-story";
import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { withAutoArrangeDestinations } from "@/components/blocks/jira-kanban/experimental/lib/board-auto-arrange";

/** Sample cards start in To do; destinations keep the Team EU26 workflow. */
export function createJiraDraggingColumns(): JiraKanbanColumnData[] {
	const columns = createJiraTeamEu26PayBoardColumns();
	const sourceCards = columns.find((column) => column.title === "In progress")?.cards.slice(0, 4) ?? [];
	return withAutoArrangeDestinations(columns
		.filter((column) => ["To do", "In progress", "In review", "Done"].includes(column.title))
		.map((column) => {
			const cards = column.title === "To do"
				? sourceCards.map((card, index) => ({
					...card,
					status: "To do",
					...(index < 2 ? {} : { agentActivities: [], agentDoneRuns: [], agentActivityMode: "none" as const }),
				}))
				: [];
			return { ...column, cards, count: cards.length };
		}));
}
