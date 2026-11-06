/**
 * Studio agent-creation context builders.
 *
 * These produce the hidden `contextDescription` blocks that ride on top of a
 * `creationMode: "agent"` chat submission (and its clarification continuations).
 * They tell the model to (1) understand the user's brief and any template it
 * started from, (2) run a focused clarification round via the existing
 * `ask_user_questions`/question-card flow before generating, and (3) emit a
 * single `AGENT_RESULT` marker once it has enough to build a high-quality agent
 * whose tools/skills/knowledge/subagents are REAL catalog ids and whose
 * instructions reference those ids inline as `@[category:id]` mention tokens.
 *
 * The catalog projection (see {@link buildCatalogProjection}) gives the model
 * the exact, scoped menu of ids it is allowed to choose from; the output
 * contract forces it to pick from that menu rather than invent free-form names.
 *
 * Extracted from `rovo-app-shell.tsx` so the prompt copy is unit-testable in
 * isolation — the shell module pulls in React/`motion`, but the catalog data
 * layer this now imports is bundled to CJS in tests via the directory test
 * harness, so this module stays requireable under `node --test`.
 */

import {
	AGENT_TEMPLATE_CONFIGS,
	DEFAULT_KNOWLEDGE_APPS,
	DEFAULT_SKILLS,
	DEMO_SESSION_TOOLS,
	DEMO_TOOLS,
	DIRECTORY_SUBAGENTS,
	getAgentTemplateConfigById,
	type AgentTemplateConfig,
} from "@/app/data/directory";
import { REASONING_MODE_VALUES } from "@/app/data/directory/agent-modes";
import { extractInstructionTokens, resolveCatalogNames } from "@/app/data/directory/resolve-ids";
import type { RovoDataParts } from "@/lib/rovo-ui-messages";

/**
 * Allowed `reasoningMode` values come from the canonical data-layer source
 * (`@/app/data/directory/agent-modes`), kept in lockstep with the agent editor's
 * `REASONING_MODE_SECTIONS`. The prompt copy enumerates them below.
 */

/** Max items listed per catalog group, keeping the projection prompt-compact. */
const PROJECTION_GROUP_LIMIT = 24;

/** A label-bearing entry. Apps, skills, and capabilities all share this shape. */
interface LabelledEntry {
	label: string;
}

/**
 * Minimal structural shape of a Browse-all template agent we read for
 * provenance. The real `AgentTemplatesAgent` is structurally assignable to this.
 */
interface TemplateAgentLike {
	id?: string;
	name: string;
	description?: string;
	categoryId?: string;
	avatarSrc?: string;
	sources?: ReadonlyArray<LabelledEntry>;
	skills?: ReadonlyArray<LabelledEntry>;
	capabilities?: ReadonlyArray<LabelledEntry>;
}

/**
 * Minimal structural shape of a home-bento starter we read for provenance. The
 * real `HomeStarterTemplate` is structurally assignable to this.
 */
interface StarterTemplateLike {
	title: string;
	description?: string;
	hero?: {
		sources?: ReadonlyArray<LabelledEntry>;
		skills?: ReadonlyArray<LabelledEntry>;
	};
}

export interface TemplateAgentResultBuildOptions {
	appIds?: readonly string[];
}

/**
 * Distilled, transport-friendly snapshot of the template a user started from.
 * Carries just the provenance the model needs to ask template-aware questions
 * and pre-fill sensible defaults — not the full UI agent object.
 */
export interface StudioCreationTemplateContext {
	name: string;
	category?: string;
	description?: string;
	apps?: string[];
	skills?: string[];
	capabilities?: string[];
	/**
	 * Real catalog ids this template binds, surfaced as strong defaults so the
	 * model reuses them verbatim. Populated by the agent-templates data layer
	 * (task #3); referenced defensively here so this module compiles before that
	 * lands.
	 */
	toolIds?: readonly string[];
	skillIds?: readonly string[];
	knowledgeIds?: readonly string[];
	subagentIds?: readonly string[];
	/**
	 * Exact catalog display NAMES for the bound ids, surfaced so the backend
	 * thinking-trace can narrate the real setup verbatim (no backend→catalog
	 * coupling, no de-kebab guessing). Parallel to the *Ids fields above.
	 */
	toolNames?: readonly string[];
	skillNames?: readonly string[];
	knowledgeNames?: readonly string[];
	subagentNames?: readonly string[];
	/** The template's curated trigger event phrases, surfaced for trace narration. */
	triggers?: readonly string[];
	/** Behavior phrases describing reasoning/memory/knowledge modes, for trace narration. */
	modeNarration?: readonly string[];
	/**
	 * The template's instructions already tokenized with `@[category:id]` mention
	 * tokens — the model should adapt this body rather than rewrite from scratch.
	 */
	tokenizedBody?: string;
}

// Shared so the initial-brief and clarification-continuation contexts request
// the exact same agent shape (real catalog ids + tokenized instructions + the
// mode fields the agent editor persists).
const REQUIRED_AGENT_PROFILE_FIELDS: readonly string[] = [
	"- agentId: stable kebab-case slug",
	"- name: short display name",
	'- byline: one-line tagline (e.g. "Generated agent")',
	"- description: 1–2 sentence summary of what the agent does",
	"- instructions: structured Markdown beginning with ## Instructions; use paragraphs, bullet lists with bold labels, and optional ## Knowledge, ## Triggers, and ## Validation sections. Reference every chosen catalog item inline as an `@[category:id]` mention token. Use tool|skill|knowledge|subagent for new tokens; preserve existing template `@[app:id]` tokens when adapting a tokenized template body. Tool/skill/subagent token ids must appear in the matching array below. Knowledge token ids are two-segment catalog ids such as `confluence:all`, while the knowledge array stores the bare app id such as `confluence`.",
	'- tools: array of REAL tool ids drawn from the [Catalog] projection (e.g. ["jira", "confluence"]); use [] when none apply. Never invent ids or use display names.',
	"- skills: array of REAL skill ids drawn from the [Catalog] projection; use [] when none apply.",
	'- knowledge: array of REAL bare knowledge-app ids derived from the [Catalog] projection (e.g. ["confluence"], not ["confluence:all"]); use [] when none apply.',
	"- subagents: array of REAL subagent ids drawn from the [Catalog] projection; use [] when none apply.",
	"- conversationStarters: 3 starter prompts (strings)",
	"- conversationStarterIcons: optional array (aligned with conversationStarters) of short icon keywords; omit when unsure",
	"- triggers: 0 to 3 short lines describing when the agent should act automatically; use [] when it is purely on-demand",
	'- guardrail: one line describing what the agent must not do (omit when none apply)',
	'- memoryMode: "on" or "off" — whether the agent retains memory across sessions',
	`- reasoningMode: one of ${REASONING_MODE_VALUES.map((value) => `"${value}"`).join(", ")} — match the agent editor's reasoning options`,
	'- knowledgeMode: "all", "custom", or "none" — which knowledge the agent may read',
	"- avatarFallback: { initials: 2-letter shorthand derived from the name }",
	'- action: "create"',
];

const CATALOG_SELECTION_RULE =
	"Catalog rule: tools, skills, knowledge, and subagents MUST be selected from the [Catalog] projection below. Use exact projection ids for tools, skills, and subagents. For knowledge arrays, use the bare app id from the selected knowledge projection id by removing the `:all` or `:<content>` suffix; use the full two-segment projection id in `@[knowledge:...]` tokens. Do not invent ids, rename them, or use display names. Leave an array empty rather than guessing.";

const HONOR_NAMED_SOURCES_RULE =
	"Honor named sources: every app/tool/knowledge source the user explicitly names in their brief (e.g. Gmail, Salesforce, Slack, Jira, Google Calendar, Atlassian Projects) MUST be wired up — place each matching catalog id in the tools and/or knowledge array (knowledge arrays store the bare app id such as `confluence`, never the two-segment `confluence:all`) and reference it inline as a mention token (`@[knowledge:...]` tokens use the full two-segment id). Map each named source to its closest catalog id (e.g. a calendar → google-calendar, project tracking → projects/jira). Do not drop a source the user named.";

const CLARIFICATION_DIMENSIONS =
	"Dimensions to cover (ask about whichever the brief and template context leave unclear): purpose & scope; target users; knowledge/data sources; tone & persona; key tasks & workflows; triggers (when the agent should act); tools/integrations (which catalog tools, skills, knowledge, and subagents it connects to); guardrails (what it must not do).";

const FENCE_RULE =
	"Do not wrap the marker, its JSON, or the surrounding response inside ``` fences (no ```markdown, ```json, or other fences around the result). Keep assistant prose brief.";

/** One catalog item flattened to the fields the projection lists. */
interface ProjectionItem {
	id: string;
	name: string;
	descriptor: string;
	/** Present for tools/skills; absent (domain-neutral) for knowledge/subagents. */
	categoryId?: string;
}

/** Trim a free-form descriptor to at most `maxWords` words, single-spaced. */
function clampDescriptor(text: string | undefined, fallback: string, maxWords = 8): string {
	const source = text?.replace(/\s+/g, " ").trim();
	const words = (source && source.length > 0 ? source : fallback).split(" ");
	return words.length <= maxWords ? words.join(" ") : `${words.slice(0, maxWords).join(" ")}…`;
}

/**
 * Format one config group into stable `- <id>: <name> — <descriptor>` lines.
 * Items are filtered by `categoryIds` when provided (items without a
 * `categoryId` are treated as domain-neutral and always kept), de-duplicated by
 * id, sorted by id for deterministic output, and capped at
 * {@link PROJECTION_GROUP_LIMIT}.
 */
function formatProjectionGroup(
	heading: string,
	items: readonly ProjectionItem[],
	categoryIds: ReadonlySet<string> | undefined,
): string[] {
	const seen = new Set<string>();
	const kept: ProjectionItem[] = [];
	for (const item of items) {
		const id = item.id?.trim();
		if (!id || seen.has(id)) {
			continue;
		}
		if (categoryIds && item.categoryId && !categoryIds.has(item.categoryId)) {
			continue;
		}
		seen.add(id);
		kept.push(item);
	}

	kept.sort((a, b) => a.id.localeCompare(b.id));
	const bounded = kept.slice(0, PROJECTION_GROUP_LIMIT);

	const lines = [`${heading} (${bounded.length}${kept.length > bounded.length ? ` of ${kept.length}` : ""}):`];
	if (bounded.length === 0) {
		lines.push("- (none available)");
		return lines;
	}
	for (const item of bounded) {
		lines.push(`- ${item.id}: ${item.name} — ${item.descriptor}`);
	}
	return lines;
}

/**
 * The exact, deterministic menu of REAL catalog ids the model may choose from,
 * grouped by the four config categories (tools, skills, knowledge, subagents).
 *
 * When `categoryIds` is provided, tools and skills are scoped to those category
 * ids; knowledge apps and subagents carry no category in the data layer and are
 * treated as domain-neutral (always included). Output is stable (sorted by id)
 * and bounded per group, so it stays prompt-compact and diff-friendly.
 */
export function buildCatalogProjection(categoryIds?: readonly string[]): string {
	const scope =
		categoryIds && categoryIds.length > 0
			? new Set(categoryIds.map((id) => id.trim()).filter(Boolean))
			: undefined;

	const tools: ProjectionItem[] = [...DEMO_TOOLS, ...DEMO_SESSION_TOOLS].map((tool) => ({
		id: tool.id,
		name: tool.name,
		descriptor: clampDescriptor(tool.description ?? tool.byline, tool.name),
		categoryId: tool.categoryId,
	}));
	const skills: ProjectionItem[] = DEFAULT_SKILLS.map((skill) => ({
		id: skill.id,
		name: skill.name,
		descriptor: clampDescriptor(skill.description, skill.name),
		categoryId: skill.categoryId,
	}));
	const knowledge: ProjectionItem[] = DEFAULT_KNOWLEDGE_APPS.map((app) => ({
		// Knowledge is addressed two-segment (`<appId>:all`) to match the editor's
		// knowledge mention ids, so generated @[knowledge:<app>:all] tokens resolve
		// to lozenges and the unioned config entry round-trips with user-added ones.
		id: `${app.id}:all`,
		name: `${app.name} - all content`,
		descriptor: clampDescriptor(app.description, app.name),
	}));
	const subagents: ProjectionItem[] = DIRECTORY_SUBAGENTS.map((agent) => ({
		id: agent.id,
		name: agent.name,
		descriptor: clampDescriptor(agent.description ?? agent.byline, agent.name),
	}));

	return [
		"[Catalog]",
		scope
			? `Scoped to categories: ${[...scope].sort().join(", ")}. Choose ids ONLY from the lists below.`
			: "Full catalog. Choose ids ONLY from the lists below.",
		...formatProjectionGroup("tools", tools, scope),
		...formatProjectionGroup("skills", skills, scope),
		...formatProjectionGroup("knowledge", knowledge, scope),
		...formatProjectionGroup("subagents", subagents, scope),
		"[End Catalog]",
	].join("\n");
}

/**
 * Product knowledge for the on-screen assistants (the voice cursor and the Ask
 * Rovo sidebar) so they can configure the live agent draft the way a user would
 * through the builder UI. Unlike the generation contexts above — which drive a
 * one-shot `AGENT_RESULT` marker — this teaches the assistant the *editing*
 * surface: which draft fields exist, how to set each with `apply_agent_draft_patch`,
 * the screen-assistant target ids to point at, and the full catalog of real ids.
 *
 * It is the single source of truth reused by `use-clicky-voice` (Realtime voice)
 * and the Ask Rovo sidebar request context, so both assistants share one mental
 * model of the product.
 */
export function buildStudioAssistantKnowledgeContext(): string {
	return [
		"[Studio product knowledge]",
		"You are assisting inside the Rovo Studio agent builder. The user is configuring ONE agent draft.",
		"Read the draft via get_screen_state (screenContext.activeAgentDraft) and edit it via apply_agent_draft_patch.",
		"apply_agent_draft_patch REPLACES each field you include — for any list field, read the current values first and send the COMPLETE desired array (existing items + your additions), or you will erase what is already there.",
		"",
		"Draft fields you can set:",
		"- name, description, instructions, contextDescription, byline, guardrail — plain text. (instructions is a full Markdown replacement.)",
		"- skills, apps, knowledge, subagents — arrays chosen from the [Catalog] below; pass catalog ids or display names. Unknown items are dropped.",
		"- avatarSrc — an avatar option path like /avatar-agent-new/<color>/<name>.svg. The color is lime, purple, yellow, orange, or blue and also sets the accent color.",
		'- memoryMode ("on"|"off"); knowledgeMode ("all"|"custom"|"none"); reasoningMode (one of ' +
			REASONING_MODE_VALUES.map((value) => `"${value}"`).join(", ") +
			").",
		"- conversationStarters (up to 3 short prompts) and the parallel conversationStarterIcons.",
		'- triggers — natural-language phrases for when the agent runs automatically (e.g. "When a Jira work item is created", "Every weekday morning"); these set the trigger phrases. Existing automation rules are preserved — only send a full automationRules array when you intend to replace them.',
		"- subagentPrompts — [{ triggerName, condition, config: { instructions, skills, tools, knowledge } }] for specialist sub-agents.",
		"",
		"After applying a patch, point_at_target the changed field so the user sees it. Field target ids (prefix studio-agent-config):",
		"- name → studio-agent-config:name; description → :description; instructions → :instructions; apps → :apps; skills → :skills; subagents → :subagents; memory → :memory; reasoning → :reasoning; avatar → :avatar; conversation starters → :conversation-starters.",
		"",
		buildCatalogProjection(),
		"[End Studio product knowledge]",
	].join("\n");
}

function dedupeLabels(entries: ReadonlyArray<LabelledEntry> | undefined): string[] | undefined {
	if (!entries || entries.length === 0) {
		return undefined;
	}

	const seen = new Set<string>();
	const labels: string[] = [];
	for (const entry of entries) {
		const label = entry.label?.trim();
		if (label && !seen.has(label)) {
			seen.add(label);
			labels.push(label);
		}
	}

	return labels.length > 0 ? labels : undefined;
}

/**
 * Build the config-derived part of a template context from a real
 * `AgentTemplateConfig`: bound catalog ids (strong defaults), exact display names
 * + trigger phrases + mode behaviors (for backend trace narration), and the
 * tokenized (chipped) instructions body. Shared by both the Browse-all agent
 * path and the home-bento starter path so BOTH produce rich, chipped agents.
 */
function enrichContextFromConfig(
	config: AgentTemplateConfig | undefined,
): Partial<StudioCreationTemplateContext> {
	if (!config) {
		return {};
	}
	const tokenizedBody = config.instructionsBody?.trim();
	const toolNames = config.toolIds ? resolveCatalogNames(config.toolIds, "tool") : [];
	const skillNames = config.skillIds ? resolveCatalogNames(config.skillIds, "skill") : [];
	// Knowledge ids are single-segment app ids; resolve the `<id>:all` display name
	// and strip the " - all content" suffix down to the bare app name.
	const knowledgeNames = config.knowledgeIds
		? resolveCatalogNames(config.knowledgeIds.map((id) => `${id}:all`), "knowledge").map((n) =>
				n.replace(/\s*-\s*all content$/i, ""),
			)
		: [];
	const subagentNames = config.subagentIds ? resolveCatalogNames(config.subagentIds, "subagent") : [];
	const modeNarration: string[] = [];
	const reasoning = {
		"quick-auto": "quick reasoning",
		"deep-auto": "deep step-by-step reasoning",
		"gemini-flash-3": "the Gemini Flash 3 model",
		"gpt-5.4": "the GPT-5.4 model",
		"sonnet-5": "the Claude Sonnet 5 model",
		"opus-4.6": "the Claude Opus 4.6 model",
	}[config.reasoningMode];
	if (reasoning) modeNarration.push(reasoning);
	if (config.memoryMode === "on") modeNarration.push("memory across sessions");
	const knowledge = { all: "all connected knowledge", custom: "selected knowledge sources", none: "conversation-only knowledge" }[config.knowledgeMode];
	if (knowledge) modeNarration.push(knowledge);

	return {
		...(config.toolIds && config.toolIds.length > 0 ? { toolIds: config.toolIds } : {}),
		...(config.skillIds && config.skillIds.length > 0 ? { skillIds: config.skillIds } : {}),
		...(config.knowledgeIds && config.knowledgeIds.length > 0 ? { knowledgeIds: config.knowledgeIds } : {}),
		...(config.subagentIds && config.subagentIds.length > 0 ? { subagentIds: config.subagentIds } : {}),
		...(toolNames.length > 0 ? { toolNames } : {}),
		...(skillNames.length > 0 ? { skillNames } : {}),
		...(knowledgeNames.length > 0 ? { knowledgeNames } : {}),
		...(subagentNames.length > 0 ? { subagentNames } : {}),
		...(config.triggers && config.triggers.length > 0 ? { triggers: config.triggers } : {}),
		...(modeNarration.length > 0 ? { modeNarration } : {}),
		...(tokenizedBody ? { tokenizedBody } : {}),
	};
}

/** Resolve a template config from a display title (starter path has no id). */
function findTemplateConfigByTitle(title: string | undefined): AgentTemplateConfig | undefined {
	if (!title) {
		return undefined;
	}
	const trimmed = title.trim();
	const byName = AGENT_TEMPLATE_CONFIGS.find((config) => config.name === trimmed);
	if (byName) {
		return byName;
	}
	// Fall back to a kebab-cased id match (e.g. "Decision Director" -> "decision-director").
	const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	return getAgentTemplateConfigById(slug);
}

function slugifyTemplateAgentName(name: string): string {
	const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	return slug || "template-agent";
}

function fallbackConversationStarters(agent: TemplateAgentLike): readonly string[] {
	return [
		`Summarize what ${agent.name} can help with`,
		`Show the first setup checklist for ${agent.name}`,
		`Draft a plan using ${agent.name}`,
	];
}

function getSelectedTemplateAppIds(options: TemplateAgentResultBuildOptions | undefined): ReadonlySet<string> | undefined {
	if (!options?.appIds) {
		return undefined;
	}

	return new Set(options.appIds.map((id) => id.trim()).filter(Boolean));
}

function applySelectedTemplateApps(
	result: RovoDataParts["agent-result"],
	config: AgentTemplateConfig | undefined,
	selectedAppIds: ReadonlySet<string> | undefined,
): RovoDataParts["agent-result"] {
	if (!config || !selectedAppIds) {
		return result;
	}

	const selectedToolIds = config.toolIds.filter((id) => selectedAppIds.has(id));
	const selectedKnowledgeIds = config.knowledgeIds.filter((id) => selectedAppIds.has(id));

	return {
		...result,
		tools: resolveCatalogNames(selectedToolIds, "tool"),
		knowledge: resolveCatalogNames(selectedKnowledgeIds.map((id) => `${id}:all`), "knowledge"),
	};
}

export function buildTemplateAgentResultFromAgent(
	agent: TemplateAgentLike,
	options?: TemplateAgentResultBuildOptions,
): RovoDataParts["agent-result"] {
	const config = (agent.id ? getAgentTemplateConfigById(agent.id) : undefined) ?? findTemplateConfigByTitle(agent.name);
	const description = config?.description ?? agent.description ?? `Generated from the ${agent.name} template.`;
	const baseResult: RovoDataParts["agent-result"] = {
		action: "create",
		agentId: config?.id ?? agent.id ?? slugifyTemplateAgentName(agent.name),
		byline: "Custom agent by You",
		description,
		instructions: config?.instructionsBody ?? config?.instructions ?? description,
		name: config?.name ?? agent.name,
		summary: description,
		conversationStarters: config?.conversationStarters
			? [...config.conversationStarters]
			: [...fallbackConversationStarters(agent)],
		...(config?.conversationStarterIcons && config.conversationStarterIcons.length > 0
			? { conversationStarterIcons: [...config.conversationStarterIcons] }
			: {}),
		...(config?.triggers && config.triggers.length > 0 ? { triggers: [...config.triggers] } : {}),
		...(config?.avatarSrc || agent.avatarSrc ? { avatarSrc: config?.avatarSrc ?? agent.avatarSrc } : {}),
		...(config?.memoryMode ? { memoryMode: config.memoryMode } : {}),
		...(config?.reasoningMode ? { reasoningMode: config.reasoningMode } : {}),
		...(config?.knowledgeMode ? { knowledgeMode: config.knowledgeMode } : {}),
	};

	return applySelectedTemplateApps(
		applyTemplateDefaultsToResult(baseResult, config),
		config,
		getSelectedTemplateAppIds(options),
	);
}

/** Distil a Browse-all template agent into its creation-context provenance. */
export function buildCreationTemplateContextFromAgent(agent: TemplateAgentLike): StudioCreationTemplateContext {
	const description = agent.description?.trim();
	const apps = dedupeLabels(agent.sources);
	const skills = dedupeLabels(agent.skills);
	const capabilities = dedupeLabels(agent.capabilities);
	// Pull the real catalog bindings + tokenized body from the centralized
	// template catalog (demo records preserve the config id 1:1). These are the
	// strongest defaults: they drive deriveTemplateCategoryIds (catalog scope) and
	// the bound-ids / tokenized-instructions block in formatTemplateContextBlock.
	const config = agent.id ? getAgentTemplateConfigById(agent.id) : undefined;

	return {
		name: agent.name,
		...(agent.categoryId ? { category: agent.categoryId } : {}),
		...(description ? { description } : {}),
		...(apps ? { apps } : {}),
		...(skills ? { skills } : {}),
		...(capabilities ? { capabilities } : {}),
		...enrichContextFromConfig(config),
	};
}

/** Distil a home-bento starter into its creation-context provenance. */
export function buildCreationTemplateContextFromStarter(template: StarterTemplateLike): StudioCreationTemplateContext {
	const description = template.description?.trim();
	const apps = dedupeLabels(template.hero?.sources);
	const skills = dedupeLabels(template.hero?.skills);
	// Resolve the starter to its real template config (by title) so the landing
	// prompt-starters carry the SAME rich defaults as the Browse-all remix path:
	// bound ids + tokenized chipped body + names/triggers/modes. Without this the
	// LLM gets only hero labels and produces a thin, chip-less agent.
	const config = findTemplateConfigByTitle(template.title);

	return {
		name: template.title,
		...(description ? { description } : {}),
		...(apps ? { apps } : {}),
		...(skills ? { skills } : {}),
		...enrichContextFromConfig(config),
	};
}

/** Minimal shape of a generated agent-result the backfill reads/writes. */
interface AgentResultLike {
	agentId?: string;
	name?: string;
	instructions?: string;
	tools?: readonly string[];
	skills?: readonly string[];
	knowledge?: readonly string[];
	subagents?: readonly string[];
	triggers?: readonly string[];
	automationRules?: readonly unknown[];
	subagentPrompts?: readonly unknown[];
	description?: string;
	summary?: string;
	conversationStarters?: readonly string[];
	conversationStarterIcons?: readonly string[];
}

/** Resolve the originating template config for a generated result (by id, then name). */
export function resolveTemplateConfigForResult(
	result: AgentResultLike,
): AgentTemplateConfig | undefined {
	if (typeof result.agentId === "string") {
		const direct = getAgentTemplateConfigById(result.agentId);
		if (direct) {
			return direct;
		}
		// Generated ids often append a disambiguator, e.g. "decision-director-2".
		const stripped = result.agentId.replace(/-\d+$/, "");
		const byStripped = stripped !== result.agentId ? getAgentTemplateConfigById(stripped) : undefined;
		if (byStripped) {
			return byStripped;
		}
	}
	return findTemplateConfigByTitle(result.name);
}

/**
 * Deterministically enrich a generated agent-result from its originating template
 * so an agent created from a template ALWAYS looks rich, regardless of what the
 * model returned. Fill-when-empty semantics: a field the model populated is kept;
 * only genuinely empty capability arrays are backfilled from the template's bound
 * ids, and the instructions body is replaced with the template's tokenized
 * (chipped) body only when the model produced a body with no `@[category:id]`
 * chips. No-op when the result doesn't match any template (e.g. from-scratch).
 */
export function applyTemplateDefaultsToResult<T extends AgentResultLike>(
	result: T,
	config: AgentTemplateConfig | undefined = resolveTemplateConfigForResult(result),
): T {
	if (!config) {
		return result;
	}
	const out: AgentResultLike = { ...result };

	const isEmpty = (value: unknown): boolean => !Array.isArray(value) || value.length === 0;
	if (isEmpty(out.tools) && config.toolIds.length > 0) {
		out.tools = resolveCatalogNames(config.toolIds, "tool");
	}
	if (isEmpty(out.skills) && config.skillIds.length > 0) {
		out.skills = resolveCatalogNames(config.skillIds, "skill");
	}
	if (isEmpty(out.knowledge) && config.knowledgeIds.length > 0) {
		out.knowledge = resolveCatalogNames(config.knowledgeIds.map((id) => `${id}:all`), "knowledge");
	}
	if (isEmpty(out.subagents) && config.subagentIds.length > 0) {
		out.subagents = resolveCatalogNames(config.subagentIds, "subagent");
	}
	// Instantiate the template's nested subagent definitions as real subagents,
	// each with its OWN smaller config (a lighter subset of skills/apps/knowledge +
	// its own memory/reasoning). These become the parent's `@`-mentionable subagents
	// and get their own config page in the panel. Fill-when-empty so a model that
	// already emitted subagentPrompts is preserved.
	if (isEmpty(out.subagentPrompts) && config.subagentDefinitions && config.subagentDefinitions.length > 0) {
		out.subagentPrompts = config.subagentDefinitions.map((def) => ({
			id: def.id,
			triggerName: def.name,
			condition: def.description,
			config: {
				instructions: `You are ${def.name}, a focused subagent. ${def.description}`,
				contextDescription: "",
				triggers: [],
				skills: resolveCatalogNames(def.skillIds, "skill"),
				tools: resolveCatalogNames(def.toolIds, "tool"),
				knowledge: resolveCatalogNames(def.knowledgeIds.map((id) => `${id}:all`), "knowledge"),
				conversationStarters: [],
				memoryMode: def.memoryMode,
				reasoningMode: def.reasoningMode,
				action: "draft",
			},
		}));
	}
	// Body: replace only when the model's body carries no mention chips, so a rich
	// generated body is preserved but a plain one becomes the template's chipped body.
	const body = typeof out.instructions === "string" ? out.instructions : "";
	if (extractInstructionTokens(body).length === 0 && config.instructionsBody.trim().length > 0) {
		out.instructions = config.instructionsBody;
	}
	// Triggers: backfill the template's provider-named triggers when none exist.
	if (isEmpty(out.triggers) && isEmpty(out.automationRules) && config.triggers.length > 0) {
		out.triggers = [...config.triggers];
	}
	// Required profile fields: the /studio ingest's normalizeStudioAgentResult
	// returns null (so the agent never registers) without a description and at
	// least one conversation starter. Backfill these from the template too, so a
	// thin model result still produces a registerable, rich agent.
	const hasText = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;
	if (isEmpty(out.conversationStarters) && config.conversationStarters.length > 0) {
		out.conversationStarters = [...config.conversationStarters];
		if (config.conversationStarterIcons && config.conversationStarterIcons.length > 0) {
			out.conversationStarterIcons = [...config.conversationStarterIcons];
		}
	}
	if (!hasText(out.description) && !hasText(out.summary) && hasText(config.description)) {
		out.description = config.description;
	}
	return out as T;
}

function formatTemplateContextBlock(template: StudioCreationTemplateContext): string[] {
	const lines = [
		"[Template context]",
		`This brief came from the "${template.name}" template. Treat its connected apps, skills, and capabilities as strong defaults — ask questions that confirm or adjust them rather than re-asking from scratch.`,
		`- Template: ${template.name}`,
	];

	if (template.category) {
		lines.push(`- Category: ${template.category}`);
	}
	if (template.description) {
		lines.push(`- Summary: ${template.description}`);
	}
	if (template.apps && template.apps.length > 0) {
		lines.push(`- Connected apps: ${template.apps.join(", ")}`);
	}
	if (template.skills && template.skills.length > 0) {
		lines.push(`- Skills: ${template.skills.join(", ")}`);
	}
	if (template.capabilities && template.capabilities.length > 0) {
		lines.push(`- Capabilities: ${template.capabilities.join(", ")}`);
	}

	// Bound catalog ids + tokenized body are added by the agent-templates data
	// layer (task #3). Reference them defensively so this compiles before that
	// lands; when present they are the strongest defaults — reuse these exact ids.
	const boundIds: string[] = [];
	if (template.toolIds && template.toolIds.length > 0) {
		boundIds.push(`tools=[${template.toolIds.join(", ")}]`);
	}
	if (template.skillIds && template.skillIds.length > 0) {
		boundIds.push(`skills=[${template.skillIds.join(", ")}]`);
	}
	if (template.knowledgeIds && template.knowledgeIds.length > 0) {
		boundIds.push(`knowledge=[${template.knowledgeIds.join(", ")}]`);
	}
	if (template.subagentIds && template.subagentIds.length > 0) {
		boundIds.push(`subagents=[${template.subagentIds.join(", ")}]`);
	}
	if (boundIds.length > 0) {
		lines.push(
			`- Bound catalog ids (reuse these exact ids in the matching arrays; for knowledge mention tokens use @[knowledge:<id>:all] or preserve existing template @[app:<id>] tokens): ${boundIds.join("; ")}`,
		);
	}
	if (template.tokenizedBody && template.tokenizedBody.trim().length > 0) {
		lines.push(
			"- Template instructions (already tokenized with @[category:id] mentions — adapt this rather than rewriting from scratch):",
			template.tokenizedBody.trim(),
		);
	}

	// Display-name setup + trigger phrases for the backend thinking-trace to narrate
	// the real configuration verbatim. Parsed by parseTemplateSetupFromContext in
	// backend/lib/studio-agent-trace.js (kept on dedicated, stable-prefixed lines).
	const setupParts: string[] = [];
	if (template.toolNames && template.toolNames.length > 0) setupParts.push(`tools=[${template.toolNames.join(", ")}]`);
	if (template.skillNames && template.skillNames.length > 0) setupParts.push(`skills=[${template.skillNames.join(", ")}]`);
	if (template.knowledgeNames && template.knowledgeNames.length > 0) setupParts.push(`knowledge=[${template.knowledgeNames.join(", ")}]`);
	if (template.subagentNames && template.subagentNames.length > 0) setupParts.push(`subagents=[${template.subagentNames.join(", ")}]`);
	if (template.modeNarration && template.modeNarration.length > 0) setupParts.push(`modes=[${template.modeNarration.join(", ")}]`);
	if (setupParts.length > 0) {
		lines.push(`- Setup for narration (display names): ${setupParts.join("; ")}`);
	}
	if (template.triggers && template.triggers.length > 0) {
		lines.push(`- Trigger events for narration: ${template.triggers.join(" | ")}`);
	}

	lines.push("[End template context]");
	return lines;
}

export function buildStudioAgentCreationContext(
	originalBrief: string,
	template?: StudioCreationTemplateContext,
): string {
	return [
		"[Studio Agent Creation Request]",
		"Source: /studio prompt input.",
		"Surface: Studio home composer.",
		"Trigger: User submitted a free-form brief describing the agent they want to build.",
		"Original user brief:",
		originalBrief.trim(),
		...(template ? formatTemplateContextBlock(template) : []),
		// Full projection on the initial turn — no domain scope has been chosen yet.
		buildCatalogProjection(),
		"Clarification rule: ALWAYS run ONE focused clarification round FIRST using the existing ask_user_questions/question-card flow — 2 to 4 targeted questions, each offering a few recommended options. Tailor every question to this specific brief and template context; never use a generic questionnaire. Do not skip this round and do not build the agent yet on this turn.",
		CLARIFICATION_DIMENSIONS,
		"Required agent profile fields (gather via the clarification answers; do not finalize them yet):",
		...REQUIRED_AGENT_PROFILE_FIELDS,
		CATALOG_SELECTION_RULE,
		HONOR_NAMED_SOURCES_RULE,
		`Expected output for THIS turn: emit only the ask_user_questions question card. Do NOT emit an AGENT_RESULT marker before the user has answered — that happens on the next turn. ${FENCE_RULE}`,
		"[End Studio Agent Creation Request]",
	].join("\n");
}

export function buildStudioAgentCreationContinuationContext(
	template?: StudioCreationTemplateContext,
	opts?: { categoryIds?: readonly string[] },
): string {
	return [
		"[Studio Agent Creation Request]",
		"Source: /studio prompt input clarification answer.",
		"Surface: Studio home composer.",
		"Trigger: The user has answered the clarification questions for the agent they want to build.",
		...(template ? formatTemplateContextBlock(template) : []),
		// Scope the catalog to the categories surfaced by the clarification round
		// (when provided); otherwise fall back to the full catalog.
		buildCatalogProjection(opts?.categoryIds),
		"Required agent profile fields (fill from the brief, template context, and clarification answers):",
		...REQUIRED_AGENT_PROFILE_FIELDS,
		CATALOG_SELECTION_RULE,
		HONOR_NAMED_SOURCES_RULE,
		"Clarification rule: If essential profile details are still missing, you may ask ONE more concise question-card round using the existing ask_user_questions flow (never exceed 2 rounds total). Otherwise, do not ask again.",
		`Expected output: otherwise, create the reusable custom agent now and emit exactly one structured AGENT_RESULT marker on its own line OUTSIDE any code fence. ${FENCE_RULE}`,
		"[End Studio Agent Creation Request]",
	].join("\n");
}
