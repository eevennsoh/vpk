import type { AgentBrowserAgent } from "@/components/blocks/agent-browser";
import type { AgentTemplateAgent } from "@/components/blocks/agent-template";
import {
	AGENT_LANYARD_AGENTS,
	AGENT_LANYARD_FIRST_PARTY_AGENTS,
	AGENT_LANYARD_TEMPLATES,
	type AgentLanyardAgent,
	type AgentLanyardCollection,
	type AgentLanyardTemplate,
} from "@/components/blocks/agent-lanyard";

export const DIRECTORY_TABS = [
	{ id: "recommended", label: "Recommended" },
	{ id: "your-agents", label: "Your agents" },
	{ id: "verified", label: "Verified" },
	{ id: "templates", label: "Templates" },
	{ id: "all-agents", label: "All agents" },
] as const;

export type DirectoryTab = (typeof DIRECTORY_TABS)[number]["id"];

export const DIRECTORY_CATEGORIES = [
	{ id: "data", label: "Data & analytics", keywords: ["data", "analytics", "analys", "analyz", "insight", "research", "report"] },
	{ id: "team", label: "Team productivity", keywords: ["team", "meeting", "ritual", "summary", "summar", "content", "collaborat", "trivia"] },
	{ id: "work", label: "Work management", keywords: ["work", "jira", "backlog", "plan", "priorit", "delivery", "project", "code", "coding"] },
	{ id: "service", label: "Service & support", keywords: ["service", "support", "incident", "triag", "request", "customer", "ops"] },
] as const;

export type DirectoryCategory = "all" | (typeof DIRECTORY_CATEGORIES)[number]["id"];
export type DirectorySort = "relevance" | "name" | "rating" | "popular";
export type DirectoryOwner = "all" | "you" | "company" | "team" | "person";
export type DirectoryApp = "all" | "jira" | "confluence" | "bitbucket";

export interface DirectoryFilters {
	sort: DirectorySort;
	owner: DirectoryOwner;
	app: DirectoryApp;
	category: DirectoryCategory;
}

export const DEFAULT_DIRECTORY_FILTERS: Readonly<DirectoryFilters> = {
	sort: "relevance", owner: "all", app: "all", category: "all",
};

export const DIRECTORY_SORT_OPTIONS: readonly { value: DirectorySort; label: string }[] = [
	{ value: "relevance", label: "Relevance" },
	{ value: "name", label: "Name" },
	{ value: "rating", label: "Top rated" },
	{ value: "popular", label: "Most chats" },
];

export const DIRECTORY_OWNER_OPTIONS: readonly { value: DirectoryOwner; label: string }[] = [
	{ value: "all", label: "All owners" },
	{ value: "you", label: "Owned by you" },
	{ value: "company", label: "Companies" },
	{ value: "team", label: "Teams" },
	{ value: "person", label: "People" },
];

export const DIRECTORY_APP_OPTIONS: readonly { value: DirectoryApp; label: string }[] = [
	{ value: "all", label: "All apps" },
	{ value: "jira", label: "Jira" },
	{ value: "confluence", label: "Confluence" },
	{ value: "bitbucket", label: "Bitbucket" },
];

export const DIRECTORY_GRID_CLASS_NAME = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,216px),1fr))] gap-4";

const HERO_NAMES = ["Jira Coding Agent", "Team Rituals Fiend"];
const RECOMMENDED_NAMES = [
	"Bug Report Assistant", "Workflow Builder", "Code Reviewer", "Service Triager",
	"Feedback Organiser", "Triager", "Incident Responder", "Backlog Trivia",
];
const POPULAR_NAMES = [
	"UX Feedback Analyser", "Meeting Prep", "Stack Ranker", "PRD Writer",
	"Strategist", "Trends summariser", "Research planner", "Test planner",
];

function normalizedIdentity(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sameIdentity(agent: Pick<AgentBrowserAgent, "id" | "name">, candidate: { id: string; name: string }): boolean {
	return normalizedIdentity(agent.id) === normalizedIdentity(candidate.id)
		|| normalizedIdentity(agent.name) === normalizedIdentity(candidate.name);
}

function orderByNames(agents: readonly AgentBrowserAgent[], names: readonly string[]): AgentBrowserAgent[] {
	return [...agents].sort((left, right) => {
		const leftIndex = names.findIndex((name) => normalizedIdentity(name) === normalizedIdentity(left.name));
		const rightIndex = names.findIndex((name) => normalizedIdentity(name) === normalizedIdentity(right.name));
		return (leftIndex < 0 ? names.length : leftIndex) - (rightIndex < 0 ? names.length : rightIndex);
	});
}

export function getCodingLanyard(agent: AgentBrowserAgent): AgentLanyardAgent | undefined {
	return AGENT_LANYARD_AGENTS.find((candidate) => sameIdentity(agent, candidate));
}

export function getFirstPartyLanyard(agent: AgentBrowserAgent) {
	return AGENT_LANYARD_FIRST_PARTY_AGENTS.find((candidate) => sameIdentity(agent, candidate));
}

export function getDirectoryPublisher(agent: AgentBrowserAgent): string {
	return agent.byline.replace(/^(?:created by|agent by|by)\s+/i, "");
}

export function isDirectoryAgentOwned(agent: AgentBrowserAgent): boolean {
	return /\byou\b/i.test(agent.byline);
}

export function getDirectoryCollection(agent: AgentBrowserAgent): AgentLanyardCollection {
	const text = `${agent.name} ${agent.description ?? ""}`.toLowerCase();
	if (/code|coding|developer|software|bug|pipeline/.test(text)) return "software";
	if (/service|support|incident|triag|ops|request/.test(text)) return "service";
	if (/product|feedback|ritual|trivia/.test(text)) return "product";
	if (/strateg|goal/.test(text)) return "strategy";
	return "teamwork";
}

export function toDirectoryLanyard(agent: AgentBrowserAgent): AgentLanyardAgent {
	const known = getCodingLanyard(agent) ?? getFirstPartyLanyard(agent);
	const identity = {
		id: agent.id,
		name: agent.name,
		publisher: getDirectoryPublisher(agent),
		description: agent.description ?? "",
		action: known?.action ?? "chat",
		verified: agent.verified ?? false,
		accentColor: known?.accentColor,
	};
	if (known) return { ...known, ...identity };
	return agent.brandName
		? { ...identity, brandName: agent.brandName }
		: { ...identity, avatarSrc: agent.avatarSrc ?? "/1p/agent-lanyard/glyph-custom-white.svg" };
}

export function toDirectoryTemplate(agent: AgentTemplateAgent): AgentLanyardTemplate {
	const known = AGENT_LANYARD_TEMPLATES.find((candidate) => sameIdentity(agent, candidate));
	return {
		id: agent.id,
		name: agent.name,
		description: agent.description ?? "",
		iconSrc: known?.iconSrc ?? "/illustration/agent-lanyard-template/documents.svg",
		sources: agent.sources ?? known?.sources ?? [],
	};
}

const TEMPLATE_ICON_LABELS: Readonly<Record<string, string>> = {
	"okr-generator": "goal-alignment",
	"opportunity-explorer": "research-scan",
	"experiment-planner": "experiment-shaping",
	"tradeoff-mapper": "tradeoff-analysis",
	"assumption-tester": "assumption-check",
	"criteria-builder": "rubric-building",
	"brainstorm-facilitator": "facilitation",
	"customer-insights": "feedback-clustering",
	"jira-theme-analyzer": "theme-mining",
	"transcript-insights-reporter": "meeting-recap",
	"meeting-insights": "meeting-recap",
	"trend-spotter": "trend-analysis",
	"sentiment-mapper": "sentiment-mapping",
	"funnel-analyzer": "funnel-diagnosis",
	"research-synthesizer": "research-synthesis",
	"service-triage": "triage",
	"service-request-helper": "support-reply",
	"rovo-ops": "incident-routing",
	"rovo-expert": "knowledge-gap",
	"user-manual-writer": "content-briefing",
	"knowledge-base-guide": "policy-lookup",
	"incident-recap-writer": "postmortem-scan",
	"teamwork-coach": "facilitation",
	"product-requirements-guide": "prd-outline",
	"release-notes-drafter": "release-note-grouping",
	"brand-voice-crafter": "brand-review",
	"social-media-writer": "social-adaptation",
	"global-translator": "translation-review",
	"executive-briefing-writer": "executive-summary",
	"stakeholder-update-builder": "stakeholder-update",
	"team-recap": "meeting-recap",
	"work-item-planner": "work-breakdown",
	"work-item-organizer": "queue-cleanup",
	"bug-report-assistant": "bug-reporting",
	"blocker-checker": "blocker-scan",
	"readiness-checker": "readiness",
	"progress-tracker": "progress-summary",
	"sprint-capacity-planner": "sprint-scope",
	"workflow-synthesizer": "workflow-design",
};

export function getDirectoryTemplateIconLabel(agent: AgentTemplateAgent): string | undefined {
	if (AGENT_LANYARD_TEMPLATES.some((candidate) => sameIdentity(agent, candidate))) return undefined;
	return TEMPLATE_ICON_LABELS[agent.id] ?? "capability";
}

export function filterDirectoryAgents<Agent extends AgentTemplateAgent>(
	agents: readonly Agent[], query: string, filters: Readonly<DirectoryFilters>,
	ownedAgentIds: readonly string[] = [],
): Agent[] {
	const search = query.trim().toLowerCase();
	const category = DIRECTORY_CATEGORIES.find((candidate) => candidate.id === filters.category);
	const visible = agents.filter((agent) => {
		const text = `${agent.name} ${agent.byline} ${agent.description ?? ""}`.toLowerCase();
		if (search && !text.includes(search)) return false;
		if (category && !category.keywords.some((keyword) => text.includes(keyword))) return false;
		if (filters.owner === "you" && !ownedAgentIds.includes(agent.id) && !isDirectoryAgentOwned(agent)) return false;
		if (filters.owner !== "all" && filters.owner !== "you" && agent.attributionKind !== filters.owner) return false;
		if (filters.app !== "all") {
			const sources = agent.sources ?? [];
			const knownSources = getFirstPartyLanyard(agent)?.sources ?? [];
			const appMatches = [...sources, ...knownSources].some((source) => source.id.includes(filters.app));
			if (!appMatches && !text.includes(filters.app)) return false;
		}
		return true;
	});
	if (filters.sort === "name") return visible.sort((left, right) => left.name.localeCompare(right.name, "en-US"));
	if (filters.sort === "rating") return visible.sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0));
	if (filters.sort === "popular") return visible.sort((left, right) => (right.chatCount ?? 0) - (left.chatCount ?? 0));
	return visible;
}

export function getDirectoryRecommendations(agents: readonly AgentBrowserAgent[]) {
	const coding = agents.filter((agent) => getCodingLanyard(agent));
	const nonCoding = agents.filter((agent) => !getCodingLanyard(agent));
	const featuredPool = nonCoding.length > 0 ? nonCoding : agents;
	const featured = orderByNames(featuredPool, HERO_NAMES).slice(0, 2);
	const featuredIds = new Set(featured.map((agent) => agent.id));
	const recommended = orderByNames(nonCoding.filter((agent) => !featuredIds.has(agent.id)), RECOMMENDED_NAMES).slice(0, 8);
	const popular = orderByNames(agents.filter((agent) =>
		agent.favorite || (agent.chatCount ?? 0) > 0 || POPULAR_NAMES.some((name) => normalizedIdentity(name) === normalizedIdentity(agent.name)),
	), POPULAR_NAMES).slice(0, 8);
	return { featured, coding, recommended, popular };
}
