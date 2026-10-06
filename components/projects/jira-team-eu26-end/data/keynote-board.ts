import type { JiraKanbanAssigneeData, JiraKanbanCardData, JiraKanbanColumnData } from "@/components/blocks/jira-kanban";
import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";
import { JIRA_TEAM_EU26_END_PRESENTERS, JIRA_TEAM_EU26_END_SECTION_PRESENTERS } from "./keynote-presenters";

export const JIRA_TEAM_EU26_END_KEYNOTE_BOARD_TITLE = "Team ’26 EU keynote";

export { JIRA_TEAM_EU26_END_HEADER_ASSIGNEES } from "./keynote-presenters";

const KEYNOTE_SECTIONS = ["Context", "Collaboration", "Confidence"] as const;
const KEYNOTE_COVER_ARTWORK_HEIGHT = 140;
const KEYNOTE_COVER_HEIGHT = 160;
type KeynoteCoverTheme = "light" | "dark";
const COVER_LAYERS: Readonly<Record<string, Readonly<Record<KeynoteCoverTheme, readonly string[]>>>> = {
	"TEU-106": {
		light: ["/illustration/jira-team-eu26-end/loom-record-for-agent-edge-fade.svg"],
		dark: ["/illustration/jira-team-eu26-end/loom-record-for-agent-edge-fade-dark.svg"],
	},
	"TEU-7": {
		light: ["/illustration/jira-team-eu26-end/planner-left-fade.svg", "/illustration/jira-team-eu26-end/planner-readiness.svg"],
		dark: ["/illustration/jira-team-eu26-end/planner-left-fade-dark.svg", "/illustration/jira-team-eu26-end/planner-readiness-dark.svg"],
	},
	"TEU-8": {
		light: ["/illustration/jira-team-eu26-end/loom-overlay-photo-layer.svg"],
		dark: ["/illustration/jira-team-eu26-end/loom-overlay-photo-layer-dark.svg"],
	},
};

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
	admin: { id: "admin", label: "Admin", provider: "admin" },
} as const satisfies Record<string, TwgToolSource>;

/** Shared product marks for keynote covers and the finale wall. */
export const JIRA_TEAM_EU26_END_COVER_APPS = COVER_APPS;

const KEYNOTE_STORIES = [
	{ code: "TEU-1", section: "Context", heading: "Rovo\nDesktop", title: "Rovo Desktop", cover: "rovo-desktop.svg", apps: [COVER_APPS.rovo], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-101", section: "Context", heading: "Data\nContext", title: "Data Context", cover: "data-context.svg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-2", section: "Context", heading: "Code\nContext", title: "Code Context", cover: "code-context.svg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-4", section: "Context", heading: "Rovo\nArtifacts", title: "Artifacts", cover: "artifacts.svg", apps: [COVER_APPS.studio], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ code: "TEU-102", section: "Context", heading: "Code Search\nApp", title: "Code Search App", cover: "code-search-app.svg", apps: [COVER_APPS.search], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-3", section: "Context", heading: "Rovo\nFor Work", title: "Rovo For Work", cover: "rovo-for-work.svg", apps: [COVER_APPS.rovo], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ code: "TEU-103", section: "Context", heading: "People\nContext", title: "People Context", cover: "people-context-no-app.svg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ code: "TEU-104", section: "Context", heading: "Communications\nContext", title: "Communications Context", cover: "communications-context.svg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.tamar },
	{ code: "TEU-105", section: "Collaboration", heading: "Atlassian\nMCP", title: "Atlassian MCP", cover: "atlassian-mcp.svg", apps: [COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ code: "TEU-5", section: "Collaboration", heading: "Loom\nDesktop", title: "Loom Desktop", cover: "loom-desktop.svg", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-106", section: "Collaboration", heading: "Loom Record\nfor Agent", title: "Loom Record for Agent", cover: "loom-record-for-agent-browser.svg", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-7", section: "Collaboration", heading: "AI\nPlanner", title: "Planner", cover: "planner-copy.svg", apps: [COVER_APPS.jira, COVER_APPS.confluence, COVER_APPS.graph], assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ code: "TEU-8", section: "Collaboration", heading: "Loom\nOverlay", title: "Loom Overlay", cover: "loom-overlay.svg", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ code: "TEU-107", section: "Collaboration", heading: "ChatGPT Codex\nfrom Jira", title: "ChatGPT Codex from Jira", cover: "chatgpt-codex-from-jira.svg", apps: [COVER_APPS.jira], assignee: JIRA_TEAM_EU26_END_PRESENTERS.sherif },
	{ code: "TEU-9", section: "Confidence", heading: "Loom\nPR Reviews", title: "Loom PR Reviews", cover: "loom-pr-reviews.svg", apps: [COVER_APPS.loom], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ code: "TEU-10", section: "Confidence", heading: "Agent Session\nTracking", title: "Agent Session Tracking", cover: "agent-session-tracking.svg", apps: [COVER_APPS.jira], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-11", section: "Confidence", heading: "Agent\nEffectiveness", title: "Agent Effectiveness", cover: "agent-effectiveness.svg", apps: [COVER_APPS.dx], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ code: "TEU-109", section: "Confidence", heading: "Change Risk\nAssessment", title: "Change Risk Assessment", cover: "change-risk-assessment.svg", apps: [COVER_APPS.service], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-111", section: "Confidence", heading: "Incident\nCommand Center", title: "Incident Command Center", cover: "incident-command-center.svg", apps: [COVER_APPS.service], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-108", section: "Confidence", heading: "EU AI\nInference", title: "EU AI Inference", cover: "eu-ai-inference.svg", apps: [COVER_APPS.admin], assignee: JIRA_TEAM_EU26_END_PRESENTERS.taroon },
	{ code: "TEU-112", section: "Confidence", heading: "Employee\nOnboarding", title: "Employee Onboarding", cover: "employee-onboarding.svg", apps: [COVER_APPS.service], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-12", section: "Confidence", heading: "AI Capital\nManagement", title: "AI Capital Management", cover: "ai-capital-management.svg", apps: [COVER_APPS.talent], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
	{ code: "TEU-13", section: "Confidence", heading: "Guard\nScanning", title: "Guard Scanning", cover: "guard-scanning.svg", apps: [COVER_APPS.guard], assignee: JIRA_TEAM_EU26_END_PRESENTERS.mike },
] as const satisfies readonly {
	code: string;
	section: typeof KEYNOTE_SECTIONS[number];
	title: string;
	heading: string;
	cover: string;
	apps: readonly TwgToolSource[];
	assignee: JiraKanbanAssigneeData;
}[];

const DARK_COVERS = {
	"TEU-1": "rovo-desktop-dark.svg",
	"TEU-101": "data-context-dark.svg",
	"TEU-2": "code-context-dark.svg",
	"TEU-4": "artifacts-dark.svg",
	"TEU-102": "code-search-app-dark.svg",
	"TEU-3": "rovo-for-work-dark.svg",
	"TEU-103": "people-context-dark.svg",
	"TEU-104": "communications-context-dark.svg",
	"TEU-105": "atlassian-mcp-dark.svg",
	"TEU-5": "loom-desktop-dark.svg",
	"TEU-106": "loom-record-for-agent-browser-dark.svg",
	"TEU-7": "planner-copy-dark.svg",
	"TEU-8": "loom-overlay-dark.svg",
	"TEU-107": "chatgpt-codex-from-jira-dark.svg",
	"TEU-9": "loom-pr-reviews-dark.svg",
	"TEU-10": "agent-session-tracking-dark.svg",
	"TEU-11": "agent-effectiveness-dark.svg",
	"TEU-109": "change-risk-assessment-dark.svg",
	"TEU-111": "incident-command-center-dark.svg",
	"TEU-108": "eu-ai-inference-dark.svg",
	"TEU-112": "employee-onboarding-dark.svg",
	"TEU-12": "ai-capital-management-dark.svg",
	"TEU-13": "guard-scanning-dark.svg",
} satisfies Record<typeof KEYNOTE_STORIES[number]["code"], string>;

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

function createKeynoteCover(story: typeof KEYNOTE_STORIES[number], theme: KeynoteCoverTheme = "light") {
	return {
		src: `/illustration/jira-team-eu26-end/${theme === "dark" ? DARK_COVERS[story.code] : story.cover}`,
		alt: `${story.title} preview`,
		appSources: story.apps.map((app) => ({ ...app })),
		height: KEYNOTE_COVER_HEIGHT,
		maxHeight: KEYNOTE_COVER_HEIGHT,
		padding: { blockStart: 0, blockEnd: 0, backgroundColor: "var(--ds-surface-sunken)" },
		fit: "cover",
		objectPosition: undefined,
		mask: undefined,
		layers: COVER_LAYERS[story.code]?.[theme],
		foreground: undefined,
	} satisfies NonNullable<JiraKanbanCardData["coverImage"]>;
}

function appsMatch(retained: readonly TwgToolSource[] | undefined, expected: readonly TwgToolSource[]): boolean {
	return retained?.length === expected.length
		&& retained.every((app, index) => app.id === expected[index].id
			&& app.label === expected[index].label && app.provider === expected[index].provider
			&& app.name === expected[index].name && app.iconSrc === expected[index].iconSrc
			&& app.icon === expected[index].icon);
}

function coverLayersMatch(retained: readonly string[] | undefined, expected: readonly string[] | undefined): boolean {
	return retained?.length === expected?.length
		&& (retained ?? []).every((src, index) => src === expected?.[index]);
}

const LEGACY_COVER_FILES: Readonly<Partial<Record<typeof KEYNOTE_STORIES[number]["code"], readonly string[]>>> = {
	"TEU-4": ["artifacts-no-fade.png", "artifacts.jpeg", "artifacts-no-app.jpeg"],
	"TEU-104": ["communications-context.jpeg", "communications-context-figma.jpeg", "communications-context-no-app.jpeg"],
	"TEU-106": ["loom-record-for-agent.jpeg"],
	"TEU-7": ["planner.jpeg"],
	"TEU-108": ["eu-ai-inference.jpeg", "eu-ai-inference-map.svg"],
	"TEU-103": ["people-context-solid.svg", "people-context.jpeg"],
};

function isAuthoredCoverSource(src: string, story: typeof KEYNOTE_STORIES[number]): boolean {
	return [story.cover, DARK_COVERS[story.code], story.cover.replace(/\.[^.]+$/u, ".jpeg"), ...(LEGACY_COVER_FILES[story.code] ?? [])]
		.some((file) => src === `/illustration/jira-team-eu26-end/${file}`);
}

function normalizedHeading(heading: string): string {
	return heading.replaceAll("\n", " ").toLowerCase();
}

/** Refresh recognized authored artwork and copy while retaining live board edits. */
export function restoreJiraTeamEu26EndKeynoteCoverArtwork(columns: readonly JiraKanbanColumnData[], theme: KeynoteCoverTheme = "light"): readonly JiraKanbanColumnData[] {
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
			const authoredSource = cover?.src !== undefined && isAuthoredCoverSource(cover.src, story);
			if (cover?.src !== undefined && !authoredSource) return card;
			let coverImage = cover;
			const expected = createKeynoteCover(story, theme);
			const retainedHeading = cover?.heading;
			const authoredHeading = retainedHeading !== undefined && (
				normalizedHeading(retainedHeading) === normalizedHeading(story.heading)
				|| legacy?.headings.some((heading) => normalizedHeading(heading) === normalizedHeading(retainedHeading)) === true
			);
			const placeholder = cover?.backgroundClassName === "bg-bg-accent-gray-subtler" && cover.maxHeight === 120;
			if (authoredHeading || placeholder) {
				coverImage = expected;
			} else if (cover?.src !== undefined && authoredSource) {
				const authoredAlt = legacy?.title.endsWith(" (Confirm Visual)") === true && cover.alt === `${legacy.title} preview`;
				if (cover.src !== expected.src || cover.height !== expected.height || cover.maxHeight !== expected.maxHeight || cover.fit !== "cover" || cover.zoom !== undefined || cover.mask !== undefined || !coverLayersMatch(cover.layers, expected.layers) || cover.foreground !== undefined
					|| cover.padding?.blockStart !== expected.padding.blockStart || cover.padding?.blockEnd !== expected.padding.blockEnd || cover.padding?.backgroundColor !== expected.padding.backgroundColor || cover.objectPosition !== expected.objectPosition
					|| !appsMatch(cover.appSources, story.apps) || authoredAlt) {
					coverImage = { ...cover, src: expected.src, alt: authoredAlt ? expected.alt : cover.alt, height: expected.height, maxHeight: expected.maxHeight, padding: expected.padding, fit: "cover", objectPosition: expected.objectPosition, zoom: undefined, mask: expected.mask, layers: expected.layers, foreground: expected.foreground, appSources: expected.appSources };
				}
			} else if (cover?.heading !== undefined && (cover.maxHeight !== KEYNOTE_COVER_ARTWORK_HEIGHT
				|| cover.backgroundPattern !== "grid" || !appsMatch(cover.appSources, story.apps))) {
				coverImage = {
					...cover,
					maxHeight: KEYNOTE_COVER_ARTWORK_HEIGHT,
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

export function createJiraTeamEu26EndKeynoteBoardColumns(theme: KeynoteCoverTheme = "light"): JiraKanbanColumnData[] {
	const cards: JiraKanbanCardData[] = KEYNOTE_STORIES.map((story) => ({
		code: story.code,
		title: story.title,
		coverImage: createKeynoteCover(story, theme),
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
