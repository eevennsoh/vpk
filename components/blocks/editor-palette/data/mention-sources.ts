import {
	DEFAULT_KNOWLEDGE_APPS,
	DEFAULT_SKILLS,
	DEMO_AGENT_BROWSER_AGENTS,
	DEMO_SESSION_TOOLS,
	DEMO_TEAMS,
	DEMO_TOOLS,
	DIRECTORY_APPS,
	getAgentDirectoryVisual,
	getAppDirectoryVisual,
	getPersonDirectoryVisual,
	getSkillDirectoryVisual,
	slugifySkillName,
	getTeamDirectoryVisual,
	getToolDirectoryVisual,
	resolveDirectoryVisual,
	SAMPLE_AGENT_PEOPLE,
	type AgentPerson,
	type DirectoryApp,
	type DirectoryTeam,
	type KnowledgeDirectoryApp,
	type SkillDirectorySkill,
	type ToolDirectoryTool,
} from "@/app/data/directory";
import type { AgentBrowserAgent } from "@/components/blocks/agent-browser";
import type {
	RichTextMentionCategory,
	RichTextMentionItem,
	RichTextMentionSources,
	RichTextReferenceCategory,
	RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor";

function toMentionId(category: RichTextMentionCategory, id: string): string {
	return `${category}:${id.trim().replace(/\s+/g, "-")}`;
}

function normalizeLookupValue(value: string): string {
	return value.trim().toLowerCase();
}

const FIRST_PARTY_MENTION_AVATARS: Readonly<Record<string, string>> = {
	"/1p/agent-lanyard/glyph-content-reviewer.svg": "/avatar-agent-new/blue/auto-review.svg",
	"/1p/agent-lanyard/glyph-jira-admin.svg": "/avatar-agent-new/1P/jira-admin-helper.svg",
	"/1p/agent-lanyard/glyph-jira-delivery.svg": "/avatar-agent-new/1P/work-starter.svg",
	"/1p/agent-lanyard/glyph-jira-planner.svg": "/avatar-agent-new/1P/planner.svg",
	"/1p/agent-lanyard/glyph-jira-triage.svg": "/avatar-agent-new/1P/work-triage.svg",
	"/1p/agent-lanyard/glyph-code-reviewer.svg": "/avatar-agent-new/lime/auto-review.svg",
	"/1p/agent-lanyard/glyph-jira-autodev.svg": "/avatar-agent-new/1P/auto-dev.svg",
	"/1p/agent-lanyard/glyph-jira-coding.svg": "/avatar-agent-new/1P/jira-coder.svg",
	"/1p/agent-lanyard/glyph-ops-expert.svg": "/avatar-agent-new/1P/ops-expert.svg",
	"/1p/agent-lanyard/glyph-request-resolver.svg": "/avatar-agent-new/1P/request-resolver.svg",
};

export function mapAgentToMentionItem(agent: AgentBrowserAgent): RichTextMentionItem {
	const avatarSrc = agent.avatarSrc ? FIRST_PARTY_MENTION_AVATARS[agent.avatarSrc] ?? agent.avatarSrc : undefined;
	return {
		category: "subagent",
		description: agent.description ?? agent.byline,
		id: toMentionId("subagent", agent.id),
		label: agent.name,
		visual: resolveDirectoryVisual(getAgentDirectoryVisual({ ...agent, avatarSrc })),
	};
}

export function mapSkillToMentionItem(skill: SkillDirectorySkill): RichTextMentionItem {
	return {
		category: "skill",
		description: skill.description,
		id: toMentionId("skill", skill.id),
		label: skill.name,
		visual: resolveDirectoryVisual(getSkillDirectoryVisual(skill)),
	};
}

function mapToolToMentionItem(tool: ToolDirectoryTool): RichTextMentionItem {
	return {
		category: "tool",
		description: tool.description,
		id: toMentionId("tool", tool.id),
		label: tool.name,
		visual: resolveDirectoryVisual(getToolDirectoryVisual(tool)),
	};
}

function mapAppToMentionItem(app: DirectoryApp): RichTextMentionItem {
	return {
		category: "app",
		description: app.description,
		id: toMentionId("app", app.id),
		label: app.name,
		visual: resolveDirectoryVisual(getAppDirectoryVisual(app)),
	};
}

function mapPersonToMentionItem(person: AgentPerson): RichTextMentionItem {
	return {
		category: "human",
		id: toMentionId("human", person.id),
		label: person.name,
		visual: resolveDirectoryVisual(getPersonDirectoryVisual(person)),
	};
}

function mapTeamToMentionItem(team: DirectoryTeam): RichTextMentionItem {
	return {
		category: "team",
		description: team.description,
		id: toMentionId("team", team.id),
		label: team.name,
		visual: resolveDirectoryVisual(getTeamDirectoryVisual(team)),
	};
}

function getKnowledgeMentionItems(): RichTextMentionItem[] {
	return DEFAULT_KNOWLEDGE_APPS.flatMap((app: KnowledgeDirectoryApp) => {
		const visual = resolveDirectoryVisual(app.visual);

		return [
			{
				category: "knowledge" as const,
				description: app.description,
				id: toMentionId("knowledge", `${app.id}:all`),
				label: `${app.name} - all content`,
				visual,
			},
			...app.contents.map((content) => ({
				category: "knowledge" as const,
				description: content.description,
				id: toMentionId("knowledge", `${app.id}:${content.id}`),
				label: content.name,
				visual,
			})),
		];
	});
}

function uniqueMentionItems(items: readonly RichTextMentionItem[]): readonly RichTextMentionItem[] {
	const seen = new Set<string>();

	return items.filter((item) => {
		const key = `${item.category}:${normalizeLookupValue(item.label)}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

/**
 * The unified mention/token catalog for the composer/editor surfaces. Every
 * category is built from the `@/app/data/directory` loaders — the single source
 * of truth — via each vertical's `getXDirectoryVisual` helper so the `@` and `/`
 * surfaces draw the same tokens the directories render.
 */
export const EDITOR_PALETTE_MENTION_SOURCES: RichTextMentionSources = {
	app: uniqueMentionItems(DIRECTORY_APPS.map(mapAppToMentionItem)),
	knowledge: uniqueMentionItems(getKnowledgeMentionItems()),
	skill: uniqueMentionItems(DEFAULT_SKILLS.map(mapSkillToMentionItem)),
	subagent: uniqueMentionItems(DEMO_AGENT_BROWSER_AGENTS.map(mapAgentToMentionItem)),
	tool: uniqueMentionItems([...DEMO_TOOLS, ...DEMO_SESSION_TOOLS].map(mapToolToMentionItem)),
	human: uniqueMentionItems(SAMPLE_AGENT_PEOPLE.map(mapPersonToMentionItem)),
	team: uniqueMentionItems(DEMO_TEAMS.map(mapTeamToMentionItem)),
};

export function getDirectoryMentionItem(
	category: RichTextReferenceCategory,
	label: string,
): RichTextMentionItem | undefined {
	const normalizedLabel = normalizeLookupValue(label);

	return EDITOR_PALETTE_MENTION_SOURCES[category]?.find(
		(item) =>
			normalizeLookupValue(item.label) === normalizedLabel ||
			(category === "skill" && slugifySkillName(item.label) === slugifySkillName(label)),
	);
}

export function getDirectoryMentionItemOrFallback(
	category: RichTextReferenceCategory,
	label: string,
): RichTextMentionItem {
	return getDirectoryMentionItem(category, label) ?? {
		category,
		id: toMentionId(category, label),
		label,
	};
}

/**
 * Strips the leading `"<category>:"` prefix from a mention id produced by
 * `toMentionId`, returning the remaining payload (or the input unchanged when
 * no prefix is present).
 */
function stripMentionCategoryPrefix(category: RichTextMentionCategory, id: string): string {
	const prefix = `${category}:`;
	return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

/**
 * Extracts the tool id from a `"tool:<id>"` mention id (e.g. the ids minted by
 * `mapToolToMentionItem`). The "Add tool" picker uses this to open the tools
 * directory on the chosen tool's detail.
 */
export function getToolIdFromMentionId(id: string): string {
	return stripMentionCategoryPrefix("tool", id);
}

/**
 * Extracts the app id from an `"app:<id>"` mention id (minted by
 * `mapAppToMentionItem`). The Apps directory picker uses this to open the chosen
 * app's detail screen.
 */
export function getAppIdFromMentionId(id: string): string {
	return stripMentionCategoryPrefix("app", id);
}

/**
 * Extracts the knowledge app id from a knowledge mention id. Knowledge ids are
 * minted as `"knowledge:<appId>:all"` (app-level) or
 * `"knowledge:<appId>:<contentId>"` (per-content), so this drops the category
 * prefix and returns the leading `<appId>` segment.
 */
export function getKnowledgeAppIdFromMentionId(id: string): string {
	const payload = stripMentionCategoryPrefix("knowledge", id);
	const [appId] = payload.split(":");
	return appId ?? payload;
}

/**
 * App-level rows for the "Add knowledge" search picker: one entry per knowledge
 * app (the `:all` mention items), carrying each app's name, description, and
 * resolved visual. Selecting a row yields the app id via
 * `getKnowledgeAppIdFromMentionId`.
 *
 * `icon` is `null` because the picker renders `visual` when present and only
 * falls back to `icon` otherwise — every knowledge app supplies a `visual`.
 */
export const EDITOR_PALETTE_KNOWLEDGE_APP_ITEMS: readonly RichTextSuggestionMenuItem[] =
	(EDITOR_PALETTE_MENTION_SOURCES.knowledge ?? [])
		.filter((item) => item.id.endsWith(":all"))
		.map((item) => ({
			description: item.description,
			icon: null,
			id: item.id,
			label: item.label.replace(/ - all content$/, ""),
			visual: item.visual,
		}));
