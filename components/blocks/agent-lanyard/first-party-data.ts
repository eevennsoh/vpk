import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";
import type { AgentLanyardAgent } from "./data";
import { customFirstPartyBadge, namedFirstPartyBadge, type AgentLanyardFirstPartyBadge, type NamedFirstPartyAgentId } from "./first-party-badges";

export type AgentLanyardCollection = "teamwork" | "software" | "product" | "service" | "strategy";

export type AgentLanyardFirstPartyAgent = AgentLanyardAgent & {
	avatarSrc: string;
	sources: readonly TwgToolSource[];
	badge: AgentLanyardFirstPartyBadge;
};

// Figma collection colors and logo-only exports; the shared Avatar owns the hexagon.
export const AGENT_LANYARD_COLLECTIONS = {
	teamwork: { label: "Teamwork", color: "#1868DB", avatarSrc: "/1p/agent-lanyard/glyph-custom-white.svg" },
	software: { label: "Software", color: "#94C748", avatarSrc: "/1p/agent-lanyard/glyph-custom-black.svg" },
	product: { label: "Product", color: "#C97CF4", avatarSrc: "/1p/agent-lanyard/glyph-custom-black.svg" },
	service: { label: "Service", color: "#FFC716", avatarSrc: "/1p/agent-lanyard/glyph-custom-black.svg" },
	strategy: { label: "Strategy", color: "#FB9700", avatarSrc: "/1p/agent-lanyard/glyph-custom-black.svg" },
} as const satisfies Record<AgentLanyardCollection, { label: string; color: string; avatarSrc: string }>;

const APPS = {
	confluence: { id: "confluence", label: "Confluence", provider: "confluence" },
	jira: { id: "jira", label: "Jira", provider: "jira" },
	bitbucket: { id: "bitbucket", label: "Bitbucket", provider: "bitbucket" },
	service: { id: "jira-service-management", label: "Jira Service Management", provider: "jira-service-management" },
	goals: { id: "goals", label: "Goals", provider: "goals" },
} as const satisfies Record<string, TwgToolSource>;

export interface CustomFirstPartyAgentOptions {
	id: string;
	name: string;
	description: string;
	collection: AgentLanyardCollection;
	publisher?: string;
	verified?: boolean;
	sources: readonly TwgToolSource[];
}

export function createCustomFirstPartyAgent({
	collection, publisher = "You", verified = false, ...identity
}: Readonly<CustomFirstPartyAgentOptions>): AgentLanyardFirstPartyAgent {
	const family = AGENT_LANYARD_COLLECTIONS[collection];
	return { ...identity, publisher, verified, action: "chat", avatarSrc: family.avatarSrc, accentColor: family.color, badge: customFirstPartyBadge(collection) };
}

export const AGENT_LANYARD_CUSTOM_AGENTS: readonly AgentLanyardFirstPartyAgent[] = [
	createCustomFirstPartyAgent({ id: "custom-teamwork", name: "Teamwork Agent", collection: "teamwork", description: "Help your team collaborate, share context, and keep work moving.", sources: [APPS.confluence, APPS.jira] }),
	createCustomFirstPartyAgent({ id: "custom-software", name: "Software Agent", collection: "software", description: "Support your development workflow with an agent tailored to your team.", sources: [APPS.bitbucket, APPS.jira] }),
	createCustomFirstPartyAgent({ id: "custom-product", name: "Product Agent", collection: "product", description: "Turn product feedback and research into clear plans and decisions.", sources: [APPS.confluence, APPS.jira] }),
	createCustomFirstPartyAgent({ id: "custom-service", name: "Service Agent", collection: "service", description: "Help your service team triage requests and find answers faster.", sources: [APPS.service, APPS.confluence] }),
	createCustomFirstPartyAgent({ id: "custom-strategy", name: "Strategy Agent", collection: "strategy", description: "Connect team goals with the work and decisions that matter most.", sources: [APPS.goals, APPS.confluence] }),
];

function namedAgent(
	id: NamedFirstPartyAgentId, name: string, collection: AgentLanyardCollection,
	description: string, sources: readonly TwgToolSource[],
): AgentLanyardFirstPartyAgent {
	return { id, name, description, sources, publisher: "Atlassian", verified: true, action: "chat", avatarSrc: `/1p/agent-lanyard/glyph-${id}.svg`, accentColor: AGENT_LANYARD_COLLECTIONS[collection].color, badge: namedFirstPartyBadge(id) };
}

// The reference supplies these names and identities; descriptions are demo copy.
export const AGENT_LANYARD_FIRST_PARTY_AGENTS: readonly AgentLanyardFirstPartyAgent[] = [
	namedAgent("content-reviewer", "Content Reviewer", "teamwork", "Review content and help your team share clear, useful information.", [APPS.confluence]),
	namedAgent("jira-admin", "Jira Admin Agent", "teamwork", "Help maintain and configure your Jira space for your team.", [APPS.jira]),
	namedAgent("jira-delivery", "Jira Delivery Agent", "teamwork", "Keep delivery moving with context from your team's Jira work.", [APPS.jira, APPS.confluence]),
	namedAgent("jira-planner", "Jira Planner", "teamwork", "Help your team plan work, align priorities, and track progress.", [APPS.jira, APPS.confluence]),
	namedAgent("jira-triage", "Jira Triage Agent", "teamwork", "Triage incoming work and route it to the right people.", [APPS.jira, APPS.service]),
	namedAgent("code-reviewer", "Code Reviewer", "software", "Review code and help your team improve quality and consistency.", [APPS.bitbucket, APPS.jira]),
	namedAgent("jira-autodev", "Jira AutoDev", "software", "Turn planned Jira work into development tasks and working code.", [APPS.jira, APPS.bitbucket]),
	namedAgent("jira-coding", "Jira Coding Agent", "software", "Analyses work items and proposes a world class coding approach to deliver", [APPS.jira, APPS.bitbucket]),
	namedAgent("ops-expert", "Ops Expert", "service", "Help your team investigate operational issues and respond to incidents.", [APPS.service, APPS.confluence]),
	namedAgent("request-resolver", "Request Resolver", "service", "Help resolve service requests using your team's knowledge and context.", [APPS.service, APPS.confluence]),
];
