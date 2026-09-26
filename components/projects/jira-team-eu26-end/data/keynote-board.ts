import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import { JIRA_TEAM_EU26_END_PRESENTERS, JIRA_TEAM_EU26_END_SECTION_PRESENTERS } from "./keynote-presenters";

export const JIRA_TEAM_EU26_END_KEYNOTE_BOARD_TITLE = "Team ’26 EU keynote";

export { JIRA_TEAM_EU26_END_HEADER_ASSIGNEES } from "./keynote-presenters";

const KEYNOTE_SECTIONS = ["Context", "Collaboration", "Confidence"] as const;

// Reuse local illustrations until the keynote's final product covers are supplied.
const COVERS = {
	loom: { src: "/avatar-project/loom-video.svg", alt: "Loom video illustration" },
	ai: { src: "/illustration-ai/ai/light.svg", alt: "AI collaboration illustration" },
	code: { src: "/illustration-ai/code/light.svg", alt: "Code illustration" },
	focus: { src: "/illustration-spot/general/focus-mode/light.svg", alt: "Focus mode illustration" },
	team: { src: "/illustration/rich-icon/online-groups/standard.svg", alt: "Team collaboration illustration" },
	security: { src: "/illustration-spot/empty-state/security-permissions/light.svg", alt: "Security permissions illustration" },
} as const;

const KEYNOTE_STORIES = [
	{ section: "Context", title: "Desktop search & chat", cover: COVERS.focus, assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Context", title: "Code context", cover: COVERS.code, assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Context", title: "Rovo for Work & Mobile", cover: COVERS.ai, assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ section: "Context", title: "Artifacts", cover: COVERS.team, assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ section: "Collaboration", title: "Loom Desktop recording", cover: COVERS.loom, assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Collaboration", title: "Whiteboard → Figma → Loom collaboration", cover: COVERS.team, assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ section: "Collaboration", title: "AI Planner & human–agent collaboration", cover: COVERS.ai, assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ section: "Confidence", title: "Loom AI overlays", cover: COVERS.loom, assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ section: "Confidence", title: "Loom PR previews", cover: COVERS.loom, assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ section: "Confidence", title: "Jira Agent Sessions & real-time boards", cover: COVERS.ai, assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Confidence", title: "DX: session quality & comparative ROI", cover: COVERS.code, assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ section: "Confidence", title: "Strategy Collection: Focus & Talent", cover: COVERS.focus, assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Confidence", title: "Enterprise governance & Guard", cover: COVERS.security, assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
] as const satisfies readonly {
	section: typeof KEYNOTE_SECTIONS[number];
	title: string;
	cover: Omit<NonNullable<JiraKanbanCardData["coverImage"]>, "maxHeight">;
	assignee: JiraKanbanAssigneeData;
}[];

export const JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES = KEYNOTE_STORIES.map(
	(_, index) => `TEU-${index + 1}`,
);

export function createJiraTeamEu26EndKeynoteBoardColumns(): JiraKanbanColumnData[] {
	const cards: JiraKanbanCardData[] = KEYNOTE_STORIES.map((story, index) => ({
		code: JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES[index],
		title: story.title,
		coverImage: { ...story.cover, maxHeight: 120 },
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
