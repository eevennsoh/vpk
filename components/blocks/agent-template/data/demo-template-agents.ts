import type {
	AgentTemplateAgent,
	AgentTemplateCategoryId,
} from "../components/agent-template";
import type { EntityCardCapability } from "@/components/ui-custom/entity-card";
import { AGENT_TEMPLATE_CONFIGS } from "@/app/data/directory/agent-templates";
import { getSkillIcon } from "@/lib/skill-icons";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

type DemoTemplateSource = NonNullable<AgentTemplateAgent["sources"]>[number];
type DemoTemplateSkill = NonNullable<AgentTemplateAgent["skills"]>[number];
type DemoTemplateCollaborator = NonNullable<AgentTemplateAgent["collaborators"]>[number];

type DemoTemplateConfig = {
	id: string;
	categoryId: AgentTemplateCategoryId;
	name: string;
	description: string;
	instructions?: string;
	avatarSrc: string;
	publisher: string;
	attributionKind?: AgentTemplateAgent["attributionKind"];
	publisherBrandName?: ThirdPartyLogoName;
	templatePrompt?: string;
	verified?: boolean;
	sources?: readonly DemoTemplateSource[];
	skills?: readonly DemoTemplateSkill[];
	capabilities?: readonly EntityCardCapability[];
	remix: string;
	updated: string;
	peopleOffset: number;
	collaboratorOverflow?: number;
};

const SOURCE = {
	bitbucket: { id: "bitbucket", label: "Bitbucket", provider: "bitbucket" },
	figma: { id: "figma", label: "Figma", provider: "teams", name: "figma" },
	amplitude: { id: "amplitude", label: "Amplitude", provider: "teams", name: "amplitude" },
	confluence: { id: "confluence", label: "Confluence", provider: "confluence" },
	github: { id: "github", label: "GitHub", provider: "teams", name: "github" },
	googleDrive: { id: "google-drive", label: "Google Drive", provider: "google-drive" },
	jira: { id: "jira", label: "Jira", provider: "jira" },
	jiraProductDiscovery: { id: "jira-product-discovery", label: "Jira Product Discovery", provider: "jira-product-discovery" },
	jiraServiceManagement: { id: "jira-service-management", label: "Jira Service Management", provider: "jira-service-management" },
	loom: { id: "loom", label: "Loom", provider: "loom" },
	microsoftTeams: { id: "microsoft-teams", label: "Microsoft Teams", provider: "teams", name: "microsoft-teams" },
	monday: { id: "monday", label: "monday.com", provider: "teams", name: "monday" },
	pagerDuty: { id: "pagerduty", label: "PagerDuty", provider: "teams", name: "pagerduty" },
	powerBi: { id: "powerbi", label: "Power BI", provider: "teams", name: "powerbi" },
	salesforce: { id: "salesforce", label: "Salesforce", provider: "salesforce" },
	slack: { id: "slack", label: "Slack", provider: "teams", name: "slack" },
	smartSheet: { id: "smartsheet", label: "Smartsheet", provider: "teams", name: "smartsheet" },
	trello: { id: "trello", label: "Trello", provider: "trello" },
} satisfies Record<string, DemoTemplateSource>;

const SOURCE_SEQUENCE: readonly DemoTemplateSource[] = [
	SOURCE.jira,
	SOURCE.confluence,
	SOURCE.googleDrive,
	SOURCE.slack,
	SOURCE.loom,
	SOURCE.figma,
	SOURCE.bitbucket,
	SOURCE.github,
	SOURCE.salesforce,
	SOURCE.jiraProductDiscovery,
	SOURCE.jiraServiceManagement,
	SOURCE.trello,
	SOURCE.amplitude,
	SOURCE.microsoftTeams,
	SOURCE.pagerDuty,
	SOURCE.powerBi,
	SOURCE.smartSheet,
	SOURCE.monday,
];

const SKILL_COLORS = [
	"product",
	"strategy",
	"teamwork",
	"software",
	"service",
	"platform",
	"marketplace",
	"default",
] satisfies readonly NonNullable<DemoTemplateSkill["color"]>[];

const SKILL_LABELS: Record<AgentTemplateCategoryId, readonly string[]> = {
	brainstorm: [
		"decision-framing",
		"planning",
		"rubric-building",
		"option-mapping",
		"assumption-check",
		"tradeoff-analysis",
		"hypothesis-shaping",
		"research-scan",
		"idea-ranking",
		"constraint-mapping",
		"opportunity-sizing",
		"confidence-scoring",
		"concept-briefing",
		"facilitation",
		"next-step-planning",
		"evidence-gap-check",
		"risk-spotting",
		"stakeholder-input",
		"experiment-shaping",
		"goal-alignment",
	],
	analyze: [
		"signal-detection",
		"synthesis",
		"briefing",
		"feedback-clustering",
		"sentiment-mapping",
		"theme-mining",
		"transcript-review",
		"funnel-diagnosis",
		"research-synthesis",
		"trend-analysis",
		"evidence-linking",
		"insight-prioritization",
		"quote-selection",
		"anomaly-scan",
		"source-tracing",
		"impact-mapping",
		"segment-compare",
		"need-finding",
		"metric-context",
		"decision-brief",
	],
	review: [
		"triage",
		"handoff",
		"risk-review",
		"incident-routing",
		"queue-health",
		"escalation-drafting",
		"sla-check",
		"owner-mapping",
		"policy-lookup",
		"process-review",
		"service-summary",
		"on-call-briefing",
		"postmortem-scan",
		"dependency-check",
		"readiness-review",
		"support-reply",
		"status-update",
		"runbook-match",
		"compliance-note",
		"knowledge-gap",
	],
	summarize: [
		"drafting",
		"editing",
		"audience-fit",
		"release-note-grouping",
		"executive-summary",
		"tone-matching",
		"translation-review",
		"social-adaptation",
		"prd-outline",
		"message-polish",
		"changelog-writing",
		"content-briefing",
		"decision-summary",
		"meeting-recap",
		"stakeholder-update",
		"brand-review",
		"accessibility-copy",
		"clarity-pass",
		"narrative-structure",
		"action-extraction",
	],
	create: [
		"work-breakdown",
		"sequencing",
		"readiness",
		"sprint-scope",
		"blocker-scan",
		"bug-reporting",
		"epic-shaping",
		"owner-routing",
		"queue-cleanup",
		"progress-summary",
		"dependency-map",
		"acceptance-criteria",
		"task-slicing",
		"milestone-planning",
		"risk-log",
		"handoff-plan",
		"capacity-check",
		"workflow-design",
		"prioritization",
		"status-drafting",
	],
};

const PICK_STEPS = [7, 11, 13, 17, 19] as const;
const MAX_VISIBLE_TEMPLATE_COLLABORATORS = 4;
type CapabilityIcon = NonNullable<EntityCardCapability["icon"]>;
// Each tab draws capability icons from its own themed, diverse pool, so the whole
// tab reads differently from the others (planning vs insights vs operations vs
// writing vs work management). Every pool holds nine icons; capability icons are
// assigned by tab position in `withTabVariedCapabilityIcons` so no two cards in a
// tab share the same set.
const CATEGORY_CAPABILITY_ICONS: Record<AgentTemplateCategoryId, readonly CapabilityIcon[]> = {
	brainstorm: ["lightbulb", "compass", "roadmap", "scales", "target", "question", "discovery", "branch", "objective"],
	analyze: ["trend", "chartBar", "chartPie", "dashboard", "data", "filter", "search", "pulse", "bubble"],
	review: ["check", "shield", "alert", "queue", "onCall", "incident", "handoff", "support", "refresh"],
	summarize: ["draft", "document", "quote", "translate", "megaphone", "text", "book", "highlight", "list"],
	create: ["work", "board", "epic", "subtasks", "timeline", "calendar", "checklist", "dependency", "milestone"],
};
// Walking each nine-icon pool by a stride coprime with the pool size gives every
// card a distinct, well-spread set: the five picks never repeat within a card, and
// consecutive cards in a tab share at most one icon.
const CAPABILITY_ICON_STRIDE = 2;

const CATEGORY_CAPABILITY_DETAIL: Record<AgentTemplateCategoryId, readonly [string, string]> = {
	brainstorm: ["Compares options, confidence, constraints, and open questions", "Turns the strongest path into a facilitation-ready brief"],
	analyze: ["Clusters patterns, quotes, anomalies, and measurable impact", "Packages the signal into a decision-ready insight brief"],
	review: ["Flags risk, owners, service state, and handoff gaps", "Prepares the follow-through note for the right queue or team"],
	summarize: ["Preserves audience, tone, source context, and decisions", "Shapes the summary into a polished stakeholder-ready draft"],
	create: ["Breaks work into owners, scope, dependencies, and readiness", "Turns the plan into update-ready work items and next steps"],
};

const PEOPLE: readonly DemoTemplateCollaborator[] = [
	{ name: "Michael Chu", src: "/avatar-human/michael-chu.png" },
	{ name: "Melanie Lee", src: "/avatar-human/melanie-lee.png" },
	{ name: "David Hsieh", src: "/avatar-human/david-hsieh.png" },
	{ name: "Aoife Burke", src: "/avatar-human/aoife-burke.png" },
	{ name: "Andrew Park", src: "/avatar-human/andrew-park.png" },
	{ name: "Christine Sanchez", src: "/avatar-human/christine-sanchez.png" },
	{ name: "Maia Ma", src: "/avatar-human/maia-ma.png" },
	{ name: "Brian Lin", src: "/avatar-human/brian-lin.png" },
	{ name: "Liam Estrada", src: "/avatar-human/liam-estrada.png" },
	{ name: "Issac Varghese", src: "/avatar-human/issac-varghese.png" },
	{ name: "Kayla Parajuli", src: "/avatar-human/kayla-parajuli.png" },
	{ name: "Luna Delacour", src: "/avatar-human/luna-delacour.png" },
];

function pickCollaborators(offset: number, count: number): readonly DemoTemplateCollaborator[] {
	return Array.from({ length: count }, (_, step) => PEOPLE[(offset + step) % PEOPLE.length]);
}

function getTemplateSeed(value: string): number {
	return Array.from(value).reduce((hash, character) => (
		(hash * 31 + character.charCodeAt(0)) % 9973
	), 17);
}

function pickDeterministicItems<T>(items: readonly T[], seed: number, count: number): readonly T[] {
	const step = PICK_STEPS[seed % PICK_STEPS.length] ?? 1;
	const start = seed % items.length;

	return Array.from({ length: count }, (_, index) => {
		const item = items[(start + index * step) % items.length];
		if (item === undefined) {
			throw new Error("Template source data is empty.");
		}
		return item;
	});
}

function defaultSources(id: string, categoryId: AgentTemplateCategoryId): readonly DemoTemplateSource[] {
	const seed = getTemplateSeed(`${categoryId}:${id}:sources`);
	const sourceCount = 2 + (seed % 7);

	return pickDeterministicItems(SOURCE_SEQUENCE, seed, sourceCount);
}

function defaultSkills(id: string, categoryId: AgentTemplateCategoryId): readonly DemoTemplateSkill[] {
	const seed = getTemplateSeed(`${categoryId}:${id}:skills`);
	const skillCount = 3 + (seed % 8);

	return pickDeterministicItems(SKILL_LABELS[categoryId], seed, skillCount).map((label, index) => ({
		color: SKILL_COLORS[(seed + index) % SKILL_COLORS.length],
		icon: getSkillIcon(label),
		label,
	}));
}

function defaultCapabilities({
	categoryId,
	description,
	id,
	name,
	sources,
}: {
	categoryId: AgentTemplateCategoryId;
	description: string;
	id: string;
	name: string;
	sources: readonly DemoTemplateSource[];
}): readonly EntityCardCapability[] {
	const seed = getTemplateSeed(`${categoryId}:${id}:capabilities`);
	const [categoryInsight, categoryOutput] = CATEGORY_CAPABILITY_DETAIL[categoryId];
	const sourceLabel = sources[seed % sources.length]?.label ?? "trusted sources";

	// Labels only — capability icons are assigned per tab position by
	// `withTabVariedCapabilityIcons` so every card in a tab looks distinct.
	return [
		{ label: description.replace(/\.$/u, "") },
		{ label: `Connects ${sourceLabel} context for ${name}` },
		{ label: categoryInsight },
		{ label: `Recommends next moves for ${name}` },
		{ label: categoryOutput },
	];
}

function buildTemplatePrompt({
	name,
	description,
	sources,
	skills,
	capabilities,
}: {
	name: string;
	description: string;
	sources: readonly DemoTemplateSource[];
	skills: readonly DemoTemplateSkill[];
	capabilities: readonly EntityCardCapability[];
}): string {
	const appList = sources.map((source) => source.label).join(", ");
	const skillList = skills.map((skill) => skill.label).join(", ");
	const featureList = capabilities.map((capability) => capability.label).join("; ");

	return `Use the ${name} template to create a Rovo agent. ${description} Connect it to ${appList}. Include skills for ${skillList}. It should support these features: ${featureList}. Keep the agent focused, reusable, and ready for me to review before sending.`;
}

function demoTemplateAgent({
	id,
	categoryId,
	name,
	description,
	instructions,
	avatarSrc,
	publisher,
	attributionKind = "team",
	publisherBrandName,
	templatePrompt,
	verified = false,
	sources,
	skills,
	capabilities,
	remix,
	updated,
	peopleOffset,
	collaboratorOverflow,
}: DemoTemplateConfig): AgentTemplateAgent {
	const resolvedSources = sources ?? defaultSources(id, categoryId);
	const resolvedSkills = skills ?? defaultSkills(id, categoryId);
	const resolvedCapabilities = capabilities ?? defaultCapabilities({
		categoryId,
		description,
		id,
		name,
		sources: resolvedSources,
	});
	const collaboratorSeed = getTemplateSeed(`${categoryId}:${id}:collaborators`);
	const collaboratorMode = collaboratorSeed % 3;
	const visibleCollaboratorCount = collaboratorMode === 0 ? 3 : MAX_VISIBLE_TEMPLATE_COLLABORATORS;
	const resolvedCollaboratorOverflow = collaboratorOverflow ?? (
		collaboratorMode === 2 ? 1 + (collaboratorSeed % 8) : undefined
	);

	return {
		id,
		categoryId,
		name,
		byline: `${name} by ${publisher}`,
		publisher,
		attributionKind,
		publisherBrandName,
		avatarSrc,
		description,
		verified,
		...(instructions ? { instructions } : {}),
		capabilities: resolvedCapabilities,
		sources: resolvedSources,
		skills: resolvedSkills,
		templatePrompt: templatePrompt ?? buildTemplatePrompt({
			name,
			description,
			sources: resolvedSources,
			skills: resolvedSkills,
			capabilities: resolvedCapabilities,
		}),
		stats: [
			{ label: "Remix", value: remix },
			{ label: "Last update", value: updated },
		],
		collaborators: pickCollaborators(peopleOffset, visibleCollaboratorCount),
		...(resolvedCollaboratorOverflow ? { collaboratorOverflow: resolvedCollaboratorOverflow } : {}),
	};
}

/**
 * Assigns capability icons by each agent's position within its tab. Walking the
 * category's themed icon pool by a coprime stride gives every card a distinct,
 * well-spread icon set — so within a tab no two tiles look alike, and the themed
 * pools keep each tab visually different from the others.
 */
function withTabVariedCapabilityIcons(
	agents: readonly AgentTemplateAgent[],
): readonly AgentTemplateAgent[] {
	const tabPosition = new Map<AgentTemplateCategoryId, number>();

	return agents.map((agent) => {
		const { categoryId, capabilities } = agent;
		if (!categoryId || !capabilities) return agent;

		const pool = CATEGORY_CAPABILITY_ICONS[categoryId];
		const start = tabPosition.get(categoryId) ?? 0;
		tabPosition.set(categoryId, start + 1);

		return {
			...agent,
			capabilities: capabilities.map((capability, row) => ({
				...capability,
				icon: pool[(start + row * CAPABILITY_ICON_STRIDE) % pool.length],
			})),
		};
	});
}

// Connected-app sources are authored as keys into the SOURCE map above; resolve
// them to display sources here (unknown keys are dropped defensively).
function resolveTemplateSources(
	sourceKeys: readonly string[] | undefined,
): readonly DemoTemplateSource[] | undefined {
	if (!sourceKeys) return undefined;
	const resolved: DemoTemplateSource[] = [];
	for (const key of sourceKeys) {
		const source = SOURCE[key as keyof typeof SOURCE];
		if (source) resolved.push(source);
	}
	return resolved;
}

function templateConfigToDemo(
	config: (typeof AGENT_TEMPLATE_CONFIGS)[number],
): DemoTemplateConfig {
	const sources = resolveTemplateSources(config.sourceKeys);
	return {
		id: config.id,
		categoryId: config.categoryId,
		name: config.name,
		description: config.description,
		instructions: config.instructions,
		avatarSrc: config.avatarSrc,
		publisher: config.publisher,
		remix: config.remix,
		updated: config.updated,
		peopleOffset: config.peopleOffset,
		...(config.attributionKind ? { attributionKind: config.attributionKind } : {}),
		...(config.publisherBrandName ? { publisherBrandName: config.publisherBrandName } : {}),
		...(config.verified ? { verified: config.verified } : {}),
		...(config.templatePrompt ? { templatePrompt: config.templatePrompt } : {}),
		...(config.collaboratorOverflow ? { collaboratorOverflow: config.collaboratorOverflow } : {}),
		...(sources ? { sources } : {}),
	};
}

// Demo data aligned to the Studio HomeStarterBento buckets, sourced from the
// centralized agent-template catalog (app/data/directory/agent-templates.json).
// Each active tab renders up to eight expanded entity-card agents from its
// matching category.
export const DEMO_AGENT_TEMPLATES: readonly AgentTemplateAgent[] = withTabVariedCapabilityIcons(
	AGENT_TEMPLATE_CONFIGS.map((config) => demoTemplateAgent(templateConfigToDemo(config))),
);

// Kept as a separate export for the docs demo API; tab content now lives in the
// category-aligned catalog above so every tab can cap at eight expanded cards.
export const DEMO_AGENT_TEMPLATES_SESSION: readonly AgentTemplateAgent[] = [];
