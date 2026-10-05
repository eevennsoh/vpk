import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";
import { JIRA_TEAM_EU26_END_PRESENTERS, JIRA_TEAM_EU26_END_SECTION_PRESENTERS } from "./keynote-presenters";

export const JIRA_TEAM_EU26_END_KEYNOTE_BOARD_TITLE = "Team ’26 EU keynote";

export { JIRA_TEAM_EU26_END_HEADER_ASSIGNEES } from "./keynote-presenters";

const KEYNOTE_SECTIONS = ["Context", "Collaboration", "Confidence"] as const;
const KEYNOTE_COVER_MAX_HEIGHT = 140;

const COVER_APPS = {
	studio: { id: "studio", label: "Artifacts", provider: "studio" },
	rovo: { id: "rovo", label: "Rovo", provider: "rovo" },
	bitbucket: { id: "bitbucket", label: "Bitbucket", provider: "bitbucket" },
	github: { id: "github", label: "GitHub", provider: "twg", name: "github" },
	figma: { id: "figma", label: "Figma", provider: "twg", name: "figma" },
	graph: { id: "teamwork-graph", label: "Teamwork Graph", provider: "teamwork-graph" },
	search: { id: "code-search", label: "Code Search", provider: "code-search" },
	loom: { id: "loom", label: "Loom", provider: "loom" },
	confluence: { id: "confluence", label: "Confluence", provider: "confluence" },
	jira: { id: "jira", label: "Jira", provider: "jira" },
	dx: { id: "dx", label: "DX", provider: "dx" },
	service: { id: "jira-service-management", label: "Jira Service Management", provider: "jira-service-management" },
	talent: { id: "talent", label: "Talent", provider: "talent" },
	guard: { id: "guard", label: "Guard", provider: "guard" },
} as const satisfies Record<string, TwgToolSource>;

/** Shared product marks for keynote covers and the finale wall. */
export const JIRA_TEAM_EU26_END_COVER_APPS = COVER_APPS;

const KEYNOTE_STORIES = [
	{ code: "TEU-4", section: "Context", heading: "Rovo\nArtifacts", title: "Artifacts", cover: "artifacts.jpeg", apps: [COVER_APPS.studio], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ code: "TEU-1", section: "Context", heading: "Rovo\nDesktop", title: "Rovo Desktop", cover: "rovo-desktop.jpeg", apps: [COVER_APPS.rovo], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-101", section: "Context", heading: "Data\nContext", title: "Data Context", cover: "data-context.jpeg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-2", section: "Context", heading: "Code\nContext", title: "Code Context", cover: "code-context.jpeg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-102", section: "Context", heading: "Code Search\nApp", title: "Code Search App", cover: "code-search-app.jpeg", apps: [COVER_APPS.search], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-3", section: "Context", heading: "Rovo\nFor Work", title: "Rovo For Work", cover: "rovo-for-work.jpeg", apps: [COVER_APPS.rovo], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ code: "TEU-103", section: "Context", heading: "People\nContext", title: "People Context", cover: "people-context.jpeg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ code: "TEU-104", section: "Context", heading: "Communications\nContext", title: "Communications Context", cover: "communications-context.jpeg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ code: "TEU-105", section: "Collaboration", heading: "Atlassian\nMCP", title: "Atlassian MCP", cover: "atlassian-mcp.jpeg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ code: "TEU-5", section: "Collaboration", heading: "Loom\nDesktop", title: "Loom Desktop", cover: "loom-desktop.jpeg", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-106", section: "Collaboration", heading: "Loom Record\nfor Agent", title: "Loom Record for Agent", cover: "loom-record-for-agent.jpeg", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-7", section: "Collaboration", heading: "AI\nPlanner", title: "Planner", cover: "planner.jpeg", apps: [COVER_APPS.jira, COVER_APPS.confluence, COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ code: "TEU-8", section: "Collaboration", heading: "Loom\nOverlay", title: "Loom Overlay", cover: "loom-overlay.jpeg", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ code: "TEU-107", section: "Collaboration", heading: "ChatGPT Codex\nfrom Jira", title: "ChatGPT Codex from Jira", cover: "chatgpt-codex-from-jira.jpeg", apps: [COVER_APPS.jira], assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ code: "TEU-9", section: "Confidence", heading: "Loom\nPR Reviews", title: "Loom PR Reviews", cover: "loom-pr-reviews.jpeg", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ code: "TEU-108", section: "Confidence", heading: "EU AI\nInference", title: "EU AI Inference", cover: "eu-ai-inference.jpeg", apps: [], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ code: "TEU-11", section: "Confidence", heading: "Agent\nEffectiveness", title: "Agent Effectiveness", cover: "agent-effectiveness.jpeg", apps: [COVER_APPS.dx], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ code: "TEU-109", section: "Confidence", heading: "Change Risk\nAssessment", title: "Change Risk Assessment", cover: "change-risk-assessment.jpeg", apps: [COVER_APPS.service], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-110", section: "Confidence", heading: "Agent\nIdentities", title: "Agent Identities", cover: "agent-identities.jpeg", apps: [], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-10", section: "Confidence", heading: "Agent Session\nTracking", title: "Agent Session Tracking", cover: "agent-session-tracking.jpeg", apps: [COVER_APPS.jira], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-111", section: "Confidence", heading: "Incident\nCommand Center", title: "Incident Command Center", cover: "incident-command-center.jpeg", apps: [COVER_APPS.service], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-112", section: "Confidence", heading: "Employee\nOnboarding", title: "Employee Onboarding", cover: "employee-onboarding.jpeg", apps: [COVER_APPS.service], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-12", section: "Confidence", heading: "AI Capital\nManagement", title: "AI Capital Management", cover: "ai-capital-management.jpeg", apps: [COVER_APPS.talent], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
	{ code: "TEU-13", section: "Confidence", heading: "Guard\nScanning", title: "Guard Scanning", cover: "guard-scanning.jpeg", apps: [COVER_APPS.guard], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mcb },
] as const satisfies readonly {
	code: string;
	section: typeof KEYNOTE_SECTIONS[number];
	title: string;
	heading: string;
	cover: string;
	apps: readonly TwgToolSource[];
	assignee: JiraKanbanAssigneeData;
}[];

/** The keynote's announcements in presentation order; the closing finale reuses them. */
export const JIRA_TEAM_EU26_END_KEYNOTE_STORIES = KEYNOTE_STORIES;

export const JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES: readonly string[] = KEYNOTE_STORIES.map((story) => story.code);

const LEGACY_STORIES: Readonly<Record<string, { title: string; headings: readonly string[] }>> = {
	"TEU-1": { title: "Search across your work", headings: ["Desktop Search & Chat"] },
	"TEU-2": { title: "Ground AI in your codebase", headings: ["Code Context"] },
	"TEU-3": { title: "Pick up work anywhere", headings: ["Rovo for Work & Mobile"] },
	"TEU-4": { title: "Turn ideas into outputs", headings: ["Rovo Artifacts", "Artifacts"] },
	"TEU-5": { title: "Record Share Collaborate", headings: ["Loom Desktop Recording"] },
	"TEU-7": { title: "Humans and agents One plan", headings: ["AI Planner"] },
	"TEU-8": { title: "Make every video clearer", headings: ["Loom AI Overlays"] },
	"TEU-9": { title: "Preview code changes in video", headings: ["Loom PR Previews"] },
	"TEU-10": { title: "See agent work as it happens", headings: ["Jira Agent Sessions"] },
	"TEU-11": { title: "Measure session quality and ROI", headings: ["DX Session Quality & ROI", "DX: session quality & ROI"] },
	"TEU-12": { title: "Align talent and investment", headings: ["Strategy Collection"] },
	"TEU-13": { title: "Govern AI at every level", headings: ["Enterprise Governance & Guard"] },
	"TEU-103": { title: "People Context (Confirm Visual)", headings: ["People Context"] },
	"TEU-104": { title: "Communications Context (Confirm Visual)", headings: ["Communications Context"] },
};

function createKeynoteCover(story: typeof KEYNOTE_STORIES[number]) {
	return {
		src: `/illustration/jira-team-eu26-end/${story.cover}`,
		alt: `${story.title} preview`,
		appSources: story.apps.map((app) => ({ ...app })),
		maxHeight: KEYNOTE_COVER_MAX_HEIGHT,
		fit: "cover",
	} satisfies NonNullable<JiraKanbanCardData["coverImage"]>;
}

function appsMatch(retained: readonly TwgToolSource[] | undefined, expected: readonly TwgToolSource[]): boolean {
	return retained?.length === expected.length
		&& retained.every((app, index) => app.id === expected[index].id
			&& app.label === expected[index].label && app.provider === expected[index].provider
			&& app.name === expected[index].name && app.iconSrc === expected[index].iconSrc
			&& app.icon === expected[index].icon);
}

function normalizedHeading(heading: string): string {
	return heading.replaceAll("\n", " ").toLowerCase();
}

/** Refresh recognized authored artwork and copy while retaining live board edits. */
export function restoreJiraTeamEu26EndKeynoteCoverArtwork(columns: readonly JiraKanbanColumnData[]): readonly JiraKanbanColumnData[] {
	let changed = false;
	const restored = columns.map((column) => {
		let columnChanged = false;
		const cards = column.cards.map((card) => {
			const story = KEYNOTE_STORIES.find((candidate) => candidate.code === card.code);
			if (!story) {
				return card;
			}
			const legacy = LEGACY_STORIES[card.code];
			const title = card.title === legacy?.title ? story.title : card.title;
			const cover = card.coverImage;
			let coverImage = cover;
			const expected = createKeynoteCover(story);
			const retainedHeading = cover?.heading;
			const authoredHeading = retainedHeading !== undefined && (
				normalizedHeading(retainedHeading) === normalizedHeading(story.heading)
				|| legacy?.headings.some((heading) => normalizedHeading(heading) === normalizedHeading(retainedHeading)) === true
			);
			const placeholder = cover?.backgroundClassName === "bg-bg-accent-gray-subtler" && cover.maxHeight === 120;
			if (authoredHeading || placeholder) {
				coverImage = expected;
			} else if (cover && (cover.src === expected.src
				|| (story.code === "TEU-4" && cover.src === "/illustration/jira-team-eu26-end/artifacts-no-fade.png")
				|| (story.code === "TEU-103" && cover.src === "/illustration/jira-team-eu26-end/people-context-solid.svg"))) {
				const authoredAlt = legacy?.title.endsWith(" (Confirm Visual)") === true && cover.alt === `${legacy.title} preview`;
				if (cover.src !== expected.src || cover.maxHeight !== KEYNOTE_COVER_MAX_HEIGHT || cover.fit !== "cover" || cover.zoom !== undefined || cover.mask !== undefined || !appsMatch(cover.appSources, story.apps) || authoredAlt) {
					coverImage = { ...cover, src: expected.src, alt: authoredAlt ? expected.alt : cover.alt, maxHeight: KEYNOTE_COVER_MAX_HEIGHT, fit: "cover", zoom: undefined, mask: undefined, appSources: expected.appSources };
				}
			} else if (cover?.heading !== undefined && (cover.maxHeight !== KEYNOTE_COVER_MAX_HEIGHT
				|| cover.backgroundPattern !== "grid" || !appsMatch(cover.appSources, story.apps))) {
				coverImage = {
					...cover,
					maxHeight: KEYNOTE_COVER_MAX_HEIGHT,
					backgroundPattern: "grid",
					appSources: appsMatch(cover.appSources, story.apps) ? cover.appSources : expected.appSources,
				};
			}
			if (title === card.title && coverImage === cover) {
				return card;
			}
			columnChanged = true;
			return { ...card, title, coverImage };
		});
		changed ||= columnChanged;
		return columnChanged ? { ...column, cards } : column;
	});
	return changed ? restored : columns;
}

/** The keynote's auto-arrange plan always completes work, including newly created items. */
export function withJiraTeamEu26EndDoneDestinations(columns: readonly JiraKanbanColumnData[]): readonly JiraKanbanColumnData[] {
	let changed = false;
	const prepared = columns.map((column) => {
		if (column.cards.every((card) => card.autoArrangeStatus === "Done")) return column;
		changed = true;
		return {
			...column,
			cards: column.cards.map((card) => card.autoArrangeStatus === "Done" ? card : { ...card, autoArrangeStatus: "Done" }),
		};
	});
	return changed ? prepared : columns;
}

export function createJiraTeamEu26EndKeynoteBoardColumns(): JiraKanbanColumnData[] {
	const cards: JiraKanbanCardData[] = KEYNOTE_STORIES.map((story) => ({
		code: story.code,
		title: story.title,
		coverImage: createKeynoteCover(story),
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
