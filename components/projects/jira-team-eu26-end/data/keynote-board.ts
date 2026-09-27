import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";
import { JIRA_TEAM_EU26_END_PRESENTERS, JIRA_TEAM_EU26_END_SECTION_PRESENTERS } from "./keynote-presenters";

export const JIRA_TEAM_EU26_END_KEYNOTE_BOARD_TITLE = "Team ’26 EU keynote";

export { JIRA_TEAM_EU26_END_HEADER_ASSIGNEES } from "./keynote-presenters";

const KEYNOTE_SECTIONS = ["Context", "Collaboration", "Confidence"] as const;

const COVER_APPS = {
	rovo: { id: "rovo", label: "Rovo", provider: "rovo" },
	bitbucket: { id: "bitbucket", label: "Bitbucket", provider: "bitbucket" },
	github: { id: "github", label: "GitHub", provider: "twg", name: "github" },
	gitlab: { id: "gitlab", label: "GitLab", provider: "twg", name: "gitlab" },
	loom: { id: "loom", label: "Loom", provider: "loom" },
	confluence: { id: "confluence", label: "Confluence", provider: "confluence" },
	figma: { id: "figma", label: "Figma", provider: "twg", name: "figma" },
	jira: { id: "jira", label: "Jira", provider: "jira" },
	dx: { id: "dx", label: "DX", provider: "dx" },
	focus: { id: "focus", label: "Focus", provider: "focus" },
	talent: { id: "talent", label: "Talent", provider: "talent" },
	guard: { id: "guard", label: "Guard", provider: "guard" },
} as const satisfies Record<string, TwgToolSource>;

// Feature headings live on the cover; card titles describe each demo's core benefit.
const KEYNOTE_STORIES = [
	{ section: "Context", heading: "Desktop search\n& chat", title: "Search across your work", apps: [COVER_APPS.rovo], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Context", heading: "Code\ncontext", title: "Ground AI in your codebase", apps: [COVER_APPS.bitbucket, COVER_APPS.github, COVER_APPS.gitlab], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Context", heading: "Rovo for Work\n& Mobile", title: "Pick up work anywhere", apps: [COVER_APPS.rovo], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ section: "Context", heading: "Rovo\nArtifacts", title: "Turn ideas into outputs", apps: [COVER_APPS.rovo], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ section: "Collaboration", heading: "Loom desktop\nrecording", title: "Record. Share. Collaborate.", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Collaboration", heading: "Whiteboard →\nFigma → Loom", title: "From ideas to shared outcomes", apps: [COVER_APPS.confluence, COVER_APPS.figma, COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ section: "Collaboration", heading: "AI\nPlanner", title: "Humans and agents. One plan.", apps: [COVER_APPS.jira], assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ section: "Confidence", heading: "Loom\nAI overlays", title: "Make every video clearer", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ section: "Confidence", heading: "Loom\nPR previews", title: "Preview code changes in video", apps: [COVER_APPS.loom, COVER_APPS.bitbucket], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ section: "Confidence", heading: "Jira\nAgent Sessions", title: "See agent work as it happens", apps: [COVER_APPS.jira], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Confidence", heading: "DX session quality\n& ROI", title: "Measure session quality and ROI", apps: [COVER_APPS.dx], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ section: "Confidence", heading: "Strategy\nCollection", title: "Align talent and investment", apps: [COVER_APPS.focus, COVER_APPS.talent], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ section: "Confidence", heading: "Enterprise governance\n& Guard", title: "Govern AI at every level", apps: [COVER_APPS.guard], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
] as const satisfies readonly {
	section: typeof KEYNOTE_SECTIONS[number];
	title: string;
	heading: string;
	apps: readonly TwgToolSource[];
	assignee: JiraKanbanAssigneeData;
}[];

export const JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES = KEYNOTE_STORIES.map(
	(_, index) => `TEU-${index + 1}`,
);

const LEGACY_COVER_HEADINGS: Readonly<Record<string, readonly string[]>> = {
	"TEU-4": ["Artifacts"],
	"TEU-5": ["Loom Desktop recording"],
	"TEU-11": ["DX: session quality & ROI"],
};

/** Restore static artwork on retained pre-artwork cards while keeping the user's board state. */
export function restoreJiraTeamEu26EndKeynoteCoverArtwork(columns: readonly JiraKanbanColumnData[]): readonly JiraKanbanColumnData[] {
	let changed = false;
	const restored = columns.map((column) => {
		let columnChanged = false;
		const cards = column.cards.map((card) => {
			const story = KEYNOTE_STORIES[JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES.indexOf(card.code)];
			const cover = card.coverImage;
			if (!story || cover?.heading === undefined) {
				return card;
			}
			const appsCurrent = cover.appSources?.length === story.apps.length
				&& cover.appSources.every((app, index) => app.id === story.apps[index].id);
			const retainedHeading = cover.heading.replaceAll("\n", " ");
			const canRefreshHeading = retainedHeading === story.heading.replaceAll("\n", " ")
				|| LEGACY_COVER_HEADINGS[card.code]?.includes(retainedHeading) === true;
			const heading = canRefreshHeading ? story.heading : cover.heading;
			if (cover.backgroundPattern === "grid" && appsCurrent && cover.heading === heading) {
				return card;
			}
			columnChanged = true;
			return {
				...card,
				coverImage: {
					...cover,
					heading,
					backgroundPattern: "grid" as const,
					appSources: appsCurrent ? cover.appSources : story.apps.map((app) => ({ ...app })),
				},
			};
		});
		changed ||= columnChanged;
		return columnChanged ? { ...column, cards } : column;
	});
	return changed ? restored : columns;
}

export function createJiraTeamEu26EndKeynoteBoardColumns(): JiraKanbanColumnData[] {
	const cards: JiraKanbanCardData[] = KEYNOTE_STORIES.map((story, index) => ({
		code: JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES[index],
		title: story.title,
		coverImage: { heading: story.heading, appSources: story.apps.map((app) => ({ ...app })), maxHeight: 144, backgroundPattern: "grid" },
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
