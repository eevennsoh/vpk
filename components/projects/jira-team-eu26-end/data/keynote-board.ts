import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { JIRA_TEAM_EU26_END_PRESENTERS, JIRA_TEAM_EU26_END_SECTION_PRESENTERS } from "./keynote-presenters";

export const JIRA_TEAM_EU26_END_KEYNOTE_BOARD_TITLE = "Team ’26 EU keynote";

export { JIRA_TEAM_EU26_END_HEADER_ASSIGNEES } from "./keynote-presenters";

const KEYNOTE_SECTIONS = ["Context", "Collaboration", "Confidence"] as const;

// Quiet placeholder covers until the final product imagery is supplied.
const KEYNOTE_STORIES = [
	{ section: "Context", title: "Desktop search & chat", assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Context", title: "Code context", assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Context", title: "Rovo for Work & Mobile", assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ section: "Context", title: "Artifacts", assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ section: "Collaboration", title: "Loom Desktop recording", assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Collaboration", title: "Whiteboard → Figma → Loom collaboration", assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ section: "Collaboration", title: "AI Planner & human–agent collaboration", assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ section: "Confidence", title: "Loom AI overlays", assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ section: "Confidence", title: "Loom PR previews", assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ section: "Confidence", title: "Jira Agent Sessions & real-time boards", assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Confidence", title: "DX: session quality & comparative ROI", assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ section: "Confidence", title: "Strategy Collection: Focus & Talent", assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Confidence", title: "Enterprise governance & Guard", assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
] as const satisfies readonly {
	section: typeof KEYNOTE_SECTIONS[number];
	title: string;
	assignee: JiraKanbanAssigneeData;
}[];

export const JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES = KEYNOTE_STORIES.map(
	(_, index) => `TEU-${index + 1}`,
);

export function createJiraTeamEu26EndKeynoteBoardColumns(): JiraKanbanColumnData[] {
	const cards: JiraKanbanCardData[] = KEYNOTE_STORIES.map((story, index) => ({
		code: JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES[index],
		title: story.title,
		coverImage: { backgroundClassName: "bg-bg-accent-gray-subtler", maxHeight: 120 },
		assignee: { ...story.assignee },
		status: story.section,
		issueType: "task",
		priority: "medium",
		tags: [],
	}));

	return [
		...KEYNOTE_SECTIONS.map((title) => {
			const sectionCards = cards.filter((card) => card.status === title);
			return { title, count: sectionCards.length, cards: sectionCards, presenters: JIRA_TEAM_EU26_END_SECTION_PRESENTERS[title] };
		}),
		{ title: "Done", count: 0, cards: [] },
	];
}
