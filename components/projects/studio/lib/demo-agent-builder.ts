/**
 * Deterministic, scripted agent-builder for the `/studio` demo.
 *
 * The studio chat normally streams from a real model, which has no awareness of
 * the fake directory catalogs and so returns prose instead of a structured agent
 * for "add a trigger…" / "give it Jira" style prompts. This module replaces that
 * with a reliable, model-free responder: it classifies the prompt against the
 * existing catalogs and produces either a `Partial<agent-result>` patch (to merge
 * into the open agent) or a fresh `agent-result` (to create one). Every run is
 * identical — ideal for storytelling.
 *
 * Pure (no React/DOM). Reuses the real catalog machinery instead of duplicating
 * it: `resolveCatalogNames` (fuzzy id resolver), `repairGeneratedAgentCatalog`
 * (apps↔tools/knowledge facet reconciliation), and the trigger inference helpers.
 *
 * Two hard-won constraints shape the extraction:
 *  1. The fuzzy resolver false-positives on common words ("every"→Sentry,
 *     "friday"→Workday), so candidates are clause-scoped and intent-gated — never
 *     raw prompt words.
 *  2. In "send a Slack message every Friday 9am", "Slack" is the trigger's action
 *     destination, not a request to add the Slack app. Because a clause that IS a
 *     trigger never runs app extraction, the destination stays inside the trigger.
 */
import { DIRECTORY_APPS } from "@/app/data/directory/apps";
import { repairGeneratedAgentCatalog } from "@/app/data/directory/repair-agent-result";
import { convertBareMentionsToTokens, resolveCatalogNames } from "@/app/data/directory/resolve-ids";
import { AGENT_AVATAR_OPTION_GROUPS } from "@/components/blocks/agent/data/agent-avatar-options";
import {
	AGENT_EDIT_SUMMARY_WIDGET_TYPE,
	type AgentEditSummaryChange,
	type AgentEditSummaryPayload,
} from "@/components/projects/shared/lib/agent-edit-summary";
import {
	createAgentAutomationRule,
	createAgentTriggerValue,
	getAgentAutomationRuleLabel,
	inferScheduledEventId,
	inferTriggerDefinitions,
	type AgentAutomationRule,
	type AgentTriggerValue,
} from "@/components/blocks/trigger/data/trigger-catalog";
import type { RovoDataParts, RovoUIMessage } from "@/lib/rovo-ui-messages";

type AgentResult = RovoDataParts["agent-result"];
type TriggerProviderId = Parameters<typeof createAgentTriggerValue>[0];

export type AgentBuildIntentKind =
	| "trigger"
	| "app"
	| "skill"
	| "subagent"
	| "starter"
	| "instructions"
	| "name"
	| "avatar"
	| "mode";

interface TriggerSpec {
	providerId: TriggerProviderId;
	eventId: string;
	/** Fake automation instruction shown in the trigger rule builder. */
	prompt: string;
	/** Fake automation name shown in the trigger rule builder. */
	automationName: string;
	/** Short summary shown under the automation name in the rule builder. */
	description: string;
}

export interface AgentBuildIntent {
	kinds: AgentBuildIntentKind[];
	isBuildIntent: boolean;
	triggerSpecs: TriggerSpec[];
	/** Canonical app names (the tools + knowledge umbrella). */
	appNames: string[];
	skillNames: string[];
	subagentNames: string[];
	/** Number of conversation starters to add (0 = none requested). */
	starterCount: number;
	/** Freeform behaviour/persona directive to append to instructions. */
	instructionText: string | null;
	/** New agent name when a rename was requested. */
	nameHint: string | null;
	/** Avatar option src when an avatar change was requested. */
	avatarSrc: string | null;
	/** Memory/reasoning/knowledge mode changes, when requested. */
	modeChanges: Partial<Pick<AgentResult, "memoryMode" | "reasoningMode" | "knowledgeMode">>;
}

// ---------------------------------------------------------------------------
// Lexicon
// ---------------------------------------------------------------------------

/** A clause is a trigger when it names a trigger, an event, or a cadence. */
const TRIGGER_MARKER_RE =
	/\b(trigger|automation|when|whenever|every|each|daily|weekly|monthly|hourly|quarterly|annually|schedule|scheduled|cadence|remind|on (?:a )?(?:new |updated )?(?:jira|slack|github|gitlab|pull request|pr|push|incident|page|comment|issue))\b/i;

/** Recurring-cadence cue (drives the "scheduled" provider bias). */
const CADENCE_RE =
	/\b(?:every|each|daily|weekly|monthly|hourly|quarterly|annually|nightly)\b|\bat \d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\bon (?:mon|tue|wed|thu|fri|sat|sun)/i;

/** Delivery verbs — "do X on a cadence" reads as a schedule, not an X-event. */
const DELIVERY_VERB_RE =
	/\b(send|post|share|deliver|notify|summari[sz]e|report|recap|remind|generate|compile|email|message|update)\b/i;

const APP_INTENT_RE =
	/\b(tool|tools|app|apps|integration|integrate|connect|connector|knowledge|source|sources|access|enable|hook up|give it|grant|provide|use|read from|pull from)\b/i;

const SKILL_MARKER_RE = /\bskills?\b/i;
const SUBAGENT_MARKER_RE = /\b(sub-?agents?|delegates?|helper agents?|child agents?)\b/i;
const STARTER_MARKER_RE =
	/\b(conversation starters?|starter prompts?|suggested prompts?|example questions?|starters?)\b/i;
const INSTRUCTION_MARKER_RE =
	/\b(instructions?|system prompt|persona|guidelines?|behave|act as|always|never|make sure|ensure)\b/i;

/**
 * Provider keywords that wouldn't match an app by its `name`/`id` alone:
 * abbreviations and alternate spellings. Each maps to a seed the fuzzy resolver
 * canonicalizes to the real app name. The bulk of the keyword table is derived
 * from {@link DIRECTORY_APPS} below — this is only for the gaps.
 */
const APP_KEYWORD_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
	[/\bgdrive\b/i, "google drive"],
	[/\bgoogle docs\b/i, "google drive"],
	[/\bms teams\b/i, "microsoft teams"],
	[/\bms office\b/i, "microsoft teams"],
	[/\bsharepoint\b/i, "microsoft sharepoint"],
	[/\bonedrive\b/i, "microsoft onedrive"],
	[/\bo365\b|\boffice 365\b/i, "microsoft outlook"],
	[/\bado\b/i, "azure devops"],
	[/\bso\b/i, "stack overflow"],
];

/**
 * Common English / ambiguous words that happen to equal (or fuzzy-match) a short
 * app name. Deriving keywords blindly from the catalog would make "box", "focus",
 * "guard", "goals", … trigger app additions inside ordinary sentences, so these
 * names are excluded from the derived table. (They can still be added explicitly
 * through the connector phrases or an alias.)
 */
const AMBIGUOUS_APP_NAMES = new Set([
	"atlassian", "atlassian home", "atlassian teams", "box", "focus", "guard",
	"goals", "projects", "analytics", "assets", "talent", "compass", "loom",
	"mural", "lucid", "aha", "dx", "monday.com", "outreach", "canva", "webex",
	"zoom",
]);

/** Shortest catalog name length allowed into the derived keyword table. */
const MIN_DERIVED_KEYWORD_LENGTH = 3;

/** Escapes a literal string for safe inclusion in a RegExp source. */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary, case-insensitive keyword regexes derived from the live app
 * catalog, paired with the canonical app name (the seed the resolver echoes back).
 * Built once from {@link DIRECTORY_APPS} so apps added/renamed in the directory
 * are picked up automatically instead of silently drifting from a hardcoded list.
 * Ambiguous/short names are skipped to avoid false positives in plain prose.
 */
const DERIVED_APP_KEYWORDS: ReadonlyArray<readonly [RegExp, string]> = (() => {
	const out: Array<readonly [RegExp, string]> = [];
	const seenPhrases = new Set<string>();
	for (const app of DIRECTORY_APPS) {
		const phrases = [app.name, app.id.replace(/-+/g, " ")];
		for (const rawPhrase of phrases) {
			const phrase = rawPhrase.trim().toLowerCase();
			if (
				phrase.length < MIN_DERIVED_KEYWORD_LENGTH ||
				AMBIGUOUS_APP_NAMES.has(phrase) ||
				seenPhrases.has(phrase)
			) {
				continue;
			}
			seenPhrases.add(phrase);
			out.push([new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i"), app.name]);
		}
	}
	return out;
})();

/**
 * Curated + derived provider keywords → a seed the fuzzy resolver canonicalizes
 * to a real app name. Only consulted when a clause already shows app intent, so a
 * bare provider mention inside a trigger clause never leaks in.
 */
const KNOWN_APP_KEYWORDS: ReadonlyArray<readonly [RegExp, string]> = [
	...APP_KEYWORD_ALIASES,
	...DERIVED_APP_KEYWORDS,
];

/** Connector phrases whose captured object is an app/tool/knowledge name. */
const APP_CONNECTOR_RES: readonly RegExp[] = [
	/\b(?:give (?:it|the agent)|grant|provide)\s+(?:access to\s+)?(?:the\s+)?([a-z0-9][a-z0-9 ]*?)\s+(?:tool|app|integration|connector|access|knowledge|capabilit)/i,
	/\b(?:connect|integrate|integrate with|connect to|add|enable|hook up)\s+(?:the\s+)?([a-z0-9][a-z0-9 ]*?)\s+(?:tool|app|integration|connector|knowledge|source)/i,
	/\b(?:connect|integrate with|connect to)\s+(?:the\s+)?([a-z0-9][a-z0-9 ]+)$/i,
	/\b(?:use|access|read from|pull from|knowledge from|docs from|source from)\s+(?:the\s+)?([a-z0-9][a-z0-9 ]+)$/i,
];

const STOP_WORDS = new Set([
	"a", "an", "the", "to", "of", "for", "and", "or", "with", "about", "that",
	"this", "it", "its", "agent", "please", "can", "you", "me", "my", "our",
	"add", "set", "up", "give", "make", "create", "new", "some", "every",
	"trigger", "automation", "schedule", "scheduled",
]);

const NUMBER_WORDS: Readonly<Record<string, number>> = {
	one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function unique(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		const trimmed = value.trim();
		if (trimmed && !seen.has(trimmed)) {
			seen.add(trimmed);
			out.push(trimmed);
		}
	}
	return out;
}

function splitClauses(prompt: string): string[] {
	return prompt
		.split(/\band\b|\bthen\b|[,.;\n]/i)
		.map((clause) => clause.trim())
		.filter(Boolean);
}

function titleCase(value: string): string {
	return value
		.split(/\s+/)
		.filter(Boolean)
		.map((word) =>
			/^[a-z]/.test(word) ? word[0].toUpperCase() + word.slice(1) : word,
		)
		.join(" ");
}

function capitalizeSentence(value: string): string {
	const trimmed = value.trim().replace(/\s+/g, " ");
	if (!trimmed) {
		return "";
	}
	const sentence = trimmed[0].toUpperCase() + trimmed.slice(1);
	return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function significantWords(value: string, limit: number): string[] {
	return value
		.replace(/[^a-zA-Z0-9 ]/g, " ")
		.split(/\s+/)
		.filter((word) => word.length > 1 && !STOP_WORDS.has(word.toLowerCase()))
		.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Trigger derivation
// ---------------------------------------------------------------------------

/** Strips trigger scaffolding + trailing cadence to leave a believable instruction. */
function deriveTriggerInstruction(clause: string): string {
	let text = clause
		.replace(
			/^(?:add|create|set up|setup|configure|make|build)\s+(?:a|an)?\s*(?:scheduled\s+|recurring\s+|new\s+)?(?:trigger|automation|schedule)\s+(?:to|that|which|for|so it)?\s*/i,
			"",
		)
		.replace(/^(?:trigger|automation)\s*:?\s*/i, "")
		.replace(/^(?:when|whenever|every time)\s+/i, "")
		.replace(
			/\s*(?:,\s*)?(?:every|each)\b[\s\w]*?(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|morning|week|day|month|hour|quarter|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\.?$/i,
			"",
		)
		.replace(/\s*(?:,\s*)?at \d{1,2}(?::\d{2})?\s*(?:am|pm)\.?$/i, "")
		.trim();
	if (!text) {
		text = clause.trim();
	}
	return capitalizeSentence(text);
}

function deriveAutomationName(instruction: string): string {
	const words = significantWords(instruction, 4);
	return words.length > 0 ? titleCase(words.join(" ")) : "Scheduled automation";
}

/** First sentence of the instruction, capped, for the automation's short description subtitle. */
function deriveAutomationDescription(instruction: string): string {
	const firstSentence = instruction.split(/(?<=[.!?])\s/u)[0]?.trim() ?? instruction.trim();
	if (firstSentence.length <= 96) {
		return firstSentence;
	}
	return `${firstSentence.slice(0, 95).trimEnd()}…`;
}

// Hand-authored content for the canonical RFP Drafter demo flow — a weekly
// Friday 9am Slack summary of lost / no-bid RFPs. The generic derivation would
// produce a terse "Friday At 9am" name and a one-line prompt; this curates a
// nicer title, description, the "Every Friday, 9am" schedule (via the
// `weekly-friday-9am` catalog event), and a richer multi-line instruction body.
const WEEKLY_RFP_SUMMARY_SPEC: TriggerSpec = {
	providerId: "scheduled",
	eventId: "weekly-friday-9am",
	automationName: "Weekly RFP loss review for sales leadership",
	description:
		"Every Friday at 9 AM, summarize the RFP work items that moved to Lost or No Bid this week and post the rollup to #sales-leadership in Slack.",
	prompt: [
		"Every Friday at 9:00 AM, review the Enterprise RFP Response project in Jira and compile a summary of every RFP work item that moved to a **Lost** or **No Bid** status in the past 7 days.",
		"",
		"For each item, capture:",
		"- the RFP name and Jira key,",
		"- the account or customer,",
		"- the outcome (Lost or No Bid),",
		"- the deal size or contract value when known, and",
		"- the recorded reason for the loss or no-bid decision.",
		"",
		"Then post the summary as a Slack message to **#sales-leadership**:",
		"- lead with the total count and combined value of the week's losses,",
		"- group the items by outcome (Lost vs No Bid),",
		"- call out any recurring loss reasons or at-risk accounts, and",
		"- keep it skimmable so leadership can review the week's results at a glance.",
		"",
		"If no RFPs moved to Lost or No Bid this week, post a short note confirming a clean week instead.",
	].join("\n"),
};

// Detects the demo's signature weekly Friday-9am schedule so it maps to the
// curated RFP summary spec above instead of the terse generic derivation. The
// clause that reaches here is just the trigger cadence ("every Friday at 9am") —
// the RFP/Slack intent lives in sibling clauses — so we key off the cadence.
function isWeeklyRfpSummaryClause(clause: string): boolean {
	return (
		/\bfriday\b/i.test(clause) &&
		/\b9\s*(?::00)?\s*(?:am|a\.m\.)\b|\b9:00\b/i.test(clause)
	);
}

function deriveTriggerSpec(clause: string): TriggerSpec | null {
	// Canonical RFP demo flow gets hand-authored title/description/prompt + the
	// "Every Friday, 9am" schedule, rather than the terse generic derivation.
	if (isWeeklyRfpSummaryClause(clause)) {
		return WEEKLY_RFP_SUMMARY_SPEC;
	}

	// Name + description come from the plain instruction (token markup would
	// corrupt the title/summary); the stored prompt gets `@name`/`/name`
	// references rewritten into `@[app:id]` chips for the rule-builder editor.
	const plainInstruction = deriveTriggerInstruction(clause);
	const automationName = deriveAutomationName(plainInstruction);
	const description = deriveAutomationDescription(plainInstruction);
	const prompt = convertBareMentionsToTokens(plainInstruction);

	const isScheduled =
		CADENCE_RE.test(clause) &&
		(DELIVERY_VERB_RE.test(clause) || /\b(schedule|scheduled|cadence|every|daily|weekly|monthly|hourly)\b/.test(clause));

	if (isScheduled) {
		const eventId = inferScheduledEventId(clause) ?? "custom-schedule";
		return { providerId: "scheduled", eventId, prompt, automationName, description };
	}

	const inferred = inferTriggerDefinitions([clause]);
	const first = inferred?.[0];
	if (!first) {
		return null;
	}
	return {
		providerId: first.providerId,
		eventId: first.eventId,
		prompt,
		automationName,
		description,
	};
}

// ---------------------------------------------------------------------------
// Component extraction (clause-scoped, intent-gated)
// ---------------------------------------------------------------------------

function extractAppNames(clause: string): string[] {
	if (!APP_INTENT_RE.test(clause)) {
		return [];
	}
	const seeds: string[] = [];
	for (const re of APP_CONNECTOR_RES) {
		const match = clause.match(re);
		if (match?.[1]) {
			seeds.push(match[1].trim());
		}
	}
	for (const [re, seed] of KNOWN_APP_KEYWORDS) {
		if (re.test(clause)) {
			seeds.push(seed);
		}
	}
	return seeds.length > 0 ? resolveCatalogNames(seeds, "app") : [];
}

/** Resolves a captured phrase to a catalog name, else keeps a title-cased literal. */
function resolveOrLiteral(phrases: readonly string[], category: "skill" | "subagent"): string[] {
	const out: string[] = [];
	for (const phrase of phrases) {
		const resolved = resolveCatalogNames([phrase], category);
		if (resolved.length > 0) {
			out.push(...resolved);
		} else {
			const literal = titleCase(phrase.trim());
			if (literal) {
				out.push(literal);
			}
		}
	}
	return out;
}

/**
 * Shared "<noun> before / after a marker" phrase extractor for skills and
 * subagents. Both categories follow the identical shape — a marker word with a
 * candidate phrase on either side — and differ only by their regexes and the
 * resolver category, so they share one implementation.
 */
function extractCatalogPhrases(
	clause: string,
	markerRe: RegExp,
	beforeRe: RegExp,
	afterRe: RegExp,
	category: "skill" | "subagent",
): string[] {
	if (!markerRe.test(clause)) {
		return [];
	}
	const phrases: string[] = [];
	const before = clause.match(beforeRe);
	if (before?.[1]) {
		phrases.push(before[1].trim());
	}
	const after = clause.match(afterRe);
	if (after?.[1]) {
		phrases.push(after[1].trim());
	}
	return phrases.length > 0 ? resolveOrLiteral(phrases, category) : [];
}

function extractSkillNames(clause: string): string[] {
	return extractCatalogPhrases(
		clause,
		SKILL_MARKER_RE,
		/(?:the\s+)?([a-z0-9][a-z0-9 ]*?)\s+skills?\b/i,
		/\bskills?\s+(?:to|for|called|named|that|like)?\s*([a-z0-9][a-z0-9 ]+)/i,
		"skill",
	);
}

function extractSubagentNames(clause: string): string[] {
	return extractCatalogPhrases(
		clause,
		SUBAGENT_MARKER_RE,
		/(?:the\s+)?([a-z0-9][a-z0-9 ]*?)\s+(?:sub-?agent|delegate|helper agent|child agent)/i,
		/(?:sub-?agent|delegate)\s+(?:to|for|called|named|that)?\s*([a-z0-9][a-z0-9 ]+)/i,
		"subagent",
	);
}

function extractStarterCount(clause: string): number {
	if (!STARTER_MARKER_RE.test(clause)) {
		return 0;
	}
	const digits = clause.match(/\b(\d+)\b/);
	if (digits) {
		return Math.min(6, Math.max(1, Number(digits[1])));
	}
	for (const [word, value] of Object.entries(NUMBER_WORDS)) {
		if (new RegExp(`\\b${word}\\b`, "i").test(clause)) {
			return value;
		}
	}
	return 3;
}

function extractNameHint(clause: string): string | null {
	const match = clause.match(
		/(?:rename(?: it)?(?: to)?|call it|name it|named|title it)\s+["']?([a-z0-9][a-z0-9 ]*?)["']?$/i,
	);
	return match?.[1] ? titleCase(match[1].trim()) : null;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Detects an avatar change: a named option ("auto review avatar") or a color
 *  family ("make it blue"). Returns the chosen option src, or null. */
function extractAvatarSrc(prompt: string): string | null {
	// Scope to the clause(s) that actually mention the avatar, so an option label
	// that collides with a skill/app phrase in another clause ("add a code reviewer
	// skill and set the avatar to blue") can't hijack an explicit color request.
	const avatarClauses = splitClauses(prompt).filter((clause) =>
		/\b(avatar|glyph|icon|profile (?:picture|image|icon))\b/i.test(clause),
	);
	if (avatarClauses.length === 0) {
		return null;
	}
	const lower = avatarClauses.join(" ").toLowerCase();
	// 1) An explicit option label (longest first so "code reviewer" beats "code").
	const labelled = AGENT_AVATAR_OPTION_GROUPS.flatMap((group) =>
		group.options.map((option) => ({ label: option.label.toLowerCase(), src: option.src })),
	).sort((a, b) => b.label.length - a.label.length);
	for (const { label, src } of labelled) {
		if (label.length >= 4 && lower.includes(label)) {
			return src;
		}
	}
	// 2) A color family — each group's label IS its color name (Lime/Purple/...).
	for (const group of AGENT_AVATAR_OPTION_GROUPS) {
		if (new RegExp(`\\b${group.label.toLowerCase()}\\b`).test(lower)) {
			return group.options[0]?.src ?? null;
		}
	}
	return null;
}

/** Detects memory/reasoning/knowledge mode changes from explicit phrasing. */
function extractModeChanges(
	prompt: string,
): Partial<Pick<AgentResult, "memoryMode" | "reasoningMode" | "knowledgeMode">> {
	const lower = prompt.toLowerCase();
	const changes: Partial<Pick<AgentResult, "memoryMode" | "reasoningMode" | "knowledgeMode">> = {};

	if (/\b(memory|remember)\b/.test(lower)) {
		if (/\b(turn off|disable|without|stop|no longer|don'?t)\b[^.!?]*\b(memory|remember)/.test(lower)) {
			changes.memoryMode = "off";
		} else if (
			/\b(turn on|enable|keep|use|with|add|retain|persist)\b[^.!?]*\b(memory|remember)/.test(lower) ||
			/\bremember (?:across|between|things|context|me)/.test(lower)
		) {
			changes.memoryMode = "on";
		}
	}

	const wantsReasoning =
		/\b(reasoning|reason|model|think|thinking)\b/.test(lower) ||
		/\b(use|switch to|run on|run it on)\b[^.!?]*\b(opus|sonnet|gpt|gemini)\b/.test(lower);
	if (wantsReasoning) {
		if (/\bopus\b/.test(lower)) changes.reasoningMode = "opus-4.6";
		else if (/\bsonnet\b/.test(lower)) changes.reasoningMode = "sonnet-5";
		else if (/\bgpt\b/.test(lower)) changes.reasoningMode = "gpt-5.4";
		else if (/\bgemini\b/.test(lower)) changes.reasoningMode = "gemini-flash-3";
		else if (/\bdeep\b/.test(lower)) changes.reasoningMode = "deep-auto";
		else if (/\b(quick|fast)\b/.test(lower)) changes.reasoningMode = "quick-auto";
	}

	if (/\bknowledge mode\b/.test(lower) || /\bset knowledge to\b/.test(lower)) {
		if (/\ball\b/.test(lower)) changes.knowledgeMode = "all";
		else if (/\bcustom\b/.test(lower)) changes.knowledgeMode = "custom";
		else if (/\bnone\b|\bno knowledge\b/.test(lower)) changes.knowledgeMode = "none";
	}

	return changes;
}

function hasModeChanges(
	changes: Partial<Pick<AgentResult, "memoryMode" | "reasoningMode" | "knowledgeMode">>,
): boolean {
	return (
		changes.memoryMode !== undefined ||
		changes.reasoningMode !== undefined ||
		changes.knowledgeMode !== undefined
	);
}

export function classifyAgentBuildIntent(prompt: string): AgentBuildIntent {
	const triggerSpecs: TriggerSpec[] = [];
	const appNames: string[] = [];
	const skillNames: string[] = [];
	const subagentNames: string[] = [];
	let starterCount = 0;
	let instructionText: string | null = null;
	let nameHint: string | null = null;

	for (const clause of splitClauses(prompt)) {
		// A trigger clause owns its whole sentence — its action destination (e.g.
		// "Slack") must NOT also be extracted as an app.
		if (TRIGGER_MARKER_RE.test(clause)) {
			const spec = deriveTriggerSpec(clause);
			if (spec) {
				triggerSpecs.push(spec);
				continue;
			}
		}

		appNames.push(...extractAppNames(clause));
		skillNames.push(...extractSkillNames(clause));
		subagentNames.push(...extractSubagentNames(clause));

		const clauseStarters = extractStarterCount(clause);
		if (clauseStarters > 0) {
			starterCount += clauseStarters;
		}

		if (!nameHint) {
			nameHint = extractNameHint(clause);
		}

		if (!instructionText && INSTRUCTION_MARKER_RE.test(clause)) {
			instructionText = capitalizeSentence(clause);
		}
	}

	const dedupedApps = unique(appNames);
	const dedupedSkills = unique(skillNames);
	const dedupedSubagents = unique(subagentNames);
	const avatarSrc = extractAvatarSrc(prompt);
	const modeChanges = extractModeChanges(prompt);

	const kinds: AgentBuildIntentKind[] = [];
	if (triggerSpecs.length > 0) kinds.push("trigger");
	if (dedupedApps.length > 0) kinds.push("app");
	if (dedupedSkills.length > 0) kinds.push("skill");
	if (dedupedSubagents.length > 0) kinds.push("subagent");
	if (starterCount > 0) kinds.push("starter");
	if (instructionText) kinds.push("instructions");
	if (nameHint) kinds.push("name");
	if (avatarSrc) kinds.push("avatar");
	if (hasModeChanges(modeChanges)) kinds.push("mode");

	return {
		kinds,
		isBuildIntent: kinds.length > 0,
		triggerSpecs,
		appNames: dedupedApps,
		skillNames: dedupedSkills,
		subagentNames: dedupedSubagents,
		starterCount,
		instructionText,
		nameHint,
		avatarSrc,
		modeChanges,
	};
}

// ---------------------------------------------------------------------------
// Patch + result builders
// ---------------------------------------------------------------------------

function generateStarters(prompt: string, count: number): string[] {
	const topic = significantWords(prompt, 3).map(titleCase).join(" ").trim();
	const pool = [
		topic ? `Help me with ${topic.toLowerCase()}` : "What can you help me with?",
		"Summarize the latest updates",
		"Draft an update for my team",
		"What should I focus on today?",
		"Show me what changed this week",
		"Create a quick report",
	];
	return pool.slice(0, Math.min(pool.length, Math.max(1, count)));
}

/**
 * Starting index for a new trigger of `providerId`+`eventId`: one past the
 * highest numeric suffix already used by existing triggers of that same
 * provider+event. createAgentTriggerValue stamps ids as
 * `${providerId}-${eventId}-${index}`, so deriving from the live max (rather than
 * `length + i`) keeps ids unique even after a middle trigger was removed.
 */
function nextTriggerIndex(
	existing: readonly AgentTriggerValue[],
	providerId: string,
	eventId: string,
): number {
	const prefix = `${providerId}-${eventId}-`;
	let maxIndex = 0;
	for (const def of existing) {
		if (typeof def.id === "string" && def.id.startsWith(prefix)) {
			const suffix = Number(def.id.slice(prefix.length));
			if (Number.isInteger(suffix) && suffix > maxIndex) {
				maxIndex = suffix;
			}
		}
	}
	return maxIndex + 1;
}

function nextAutomationRuleIndex(existing: readonly AgentAutomationRule[]): number {
	let maxIndex = 0;
	for (const rule of existing) {
		const match = /^automation-(\d+)$/u.exec(rule.id);
		const suffix = match ? Number(match[1]) : 0;
		if (Number.isInteger(suffix) && suffix > maxIndex) {
			maxIndex = suffix;
		}
	}
	return maxIndex + 1;
}

function serializeAutomationRuleLabels(rules: readonly AgentAutomationRule[]): string[] {
	return rules
		.map((rule, index) => getAgentAutomationRuleLabel(rule, index).trim())
		.filter(Boolean);
}

/**
 * Builds a `Partial<agent-result>` that MERGES the requested changes into the
 * open agent. Arrays are pre-unioned here because `updateSessionAgentDraft`
 * shallow-merges (it would otherwise replace them). Only keys for intents that
 * actually fired are included, so unrelated fields stay untouched.
 *
 * Pass a precomputed `intent` to reuse a single classification (the shared plan
 * path does this); when omitted it classifies the prompt itself so direct callers
 * and tests keep working unchanged.
 */
export function buildAgentUpdatePatch(
	prompt: string,
	currentDraft: Partial<AgentResult>,
	intent: AgentBuildIntent = classifyAgentBuildIntent(prompt),
): Partial<AgentResult> {
	const patch: Partial<AgentResult> = {};

	if (intent.triggerSpecs.length > 0) {
		const existingRules = currentDraft.automationRules ?? [];
		const existingTriggers = existingRules.flatMap((rule) => rule.triggers);
		// Ids must stay unique across the merged set even after middle triggers
		// were removed, so seed the counter past the highest existing suffix for
		// each provider+event and bump again on any residual collision.
		const usedIds = new Set(existingTriggers.map((def) => def.id));
		const addedRules: AgentAutomationRule[] = [];
		let automationRuleIndex = nextAutomationRuleIndex(existingRules);
		for (const spec of intent.triggerSpecs) {
			let index = nextTriggerIndex(existingTriggers, spec.providerId, spec.eventId);
			let value = createAgentTriggerValue(spec.providerId, spec.eventId, index);
			// createAgentTriggerValue can return null; skip those (preserves prior behavior).
			while (value && usedIds.has(value.id)) {
				index += 1;
				value = createAgentTriggerValue(spec.providerId, spec.eventId, index);
			}
			if (value) {
				usedIds.add(value.id);
				addedRules.push(
					createAgentAutomationRule({
						id: `automation-${automationRuleIndex}`,
						name: spec.automationName,
						description: spec.description,
						prompt: spec.prompt,
						triggers: [value],
					}),
				);
				automationRuleIndex += 1;
			}
		}
		const merged = [...existingRules, ...addedRules];
		const labels = serializeAutomationRuleLabels(merged);
		patch.automationRules = merged;
		patch.triggers = labels;
		patch.trigger = labels[0] ?? "";
	}

	if (intent.appNames.length > 0) {
		const mergedApps = unique([...(currentDraft.apps ?? []), ...intent.appNames]);
		// reconcileApps rebuilds the tool + knowledge facets from app membership.
		const facets = repairGeneratedAgentCatalog({
			apps: mergedApps,
			tools: currentDraft.tools,
			knowledge: currentDraft.knowledge,
		});
		if (facets.apps) patch.apps = facets.apps;
		if (facets.tools) patch.tools = facets.tools;
		if (facets.knowledge) patch.knowledge = facets.knowledge;
	}

	if (intent.skillNames.length > 0) {
		patch.skills = unique([...(currentDraft.skills ?? []), ...intent.skillNames]);
	}

	if (intent.subagentNames.length > 0) {
		patch.subagents = unique([...(currentDraft.subagents ?? []), ...intent.subagentNames]);
	}

	if (intent.starterCount > 0) {
		patch.conversationStarters = unique([
			...(currentDraft.conversationStarters ?? []),
			...generateStarters(prompt, intent.starterCount),
		]);
	}

	if (intent.instructionText) {
		patch.instructions = [currentDraft.instructions, convertBareMentionsToTokens(intent.instructionText)]
			.map((part) => (part ?? "").trim())
			.filter(Boolean)
			.join("\n");
	}

	if (intent.nameHint) {
		patch.name = intent.nameHint;
	}

	if (intent.avatarSrc) {
		patch.avatarSrc = intent.avatarSrc;
	}

	// Mode changes are scalar fields; assign whichever the prompt requested.
	Object.assign(patch, intent.modeChanges);

	return patch;
}

/**
 * Additively merge natural-language trigger phrases into a draft's automation
 * rules, preserving existing rules (names/prompts/params) and assigning unique
 * trigger/rule ids. This is the stateful counterpart the screen-assistant shell
 * calls: the stateless patch normalizer can only set phrase-only `triggers`
 * (never rebuild `automationRules`, which would clobber on shallow-merge), so the
 * shell hydrates them here where the current draft is available — the same merge
 * `buildAgentUpdatePatch` performs for the deterministic planner. Returns the
 * merged `automationRules` + derived `triggers` labels, or null when no phrase
 * resolves to a real provider/event.
 */
export function mergeTriggerPhrasesIntoDraft(
	currentDraft: Partial<AgentResult>,
	triggerPhrases: readonly string[],
): { automationRules: AgentAutomationRule[]; triggers: string[] } | null {
	const definitions = inferTriggerDefinitions(triggerPhrases);
	if (!definitions || definitions.length === 0) {
		return null;
	}
	const existingRules = currentDraft.automationRules ?? [];
	const existingTriggers = existingRules.flatMap((rule) => rule.triggers);
	const usedIds = new Set(existingTriggers.map((definition) => definition.id));
	const addedRules: AgentAutomationRule[] = [];
	let automationRuleIndex = nextAutomationRuleIndex(existingRules);
	for (const definition of definitions) {
		const seenTriggers = [...existingTriggers, ...addedRules.flatMap((rule) => rule.triggers)];
		let index = nextTriggerIndex(seenTriggers, definition.providerId, definition.eventId);
		let value = createAgentTriggerValue(definition.providerId, definition.eventId, index);
		while (value && usedIds.has(value.id)) {
			index += 1;
			value = createAgentTriggerValue(definition.providerId, definition.eventId, index);
		}
		if (value) {
			usedIds.add(value.id);
			addedRules.push(createAgentAutomationRule({ id: `automation-${automationRuleIndex}`, triggers: [value] }));
			automationRuleIndex += 1;
		}
	}
	if (addedRules.length === 0) {
		return null;
	}
	const merged = [...existingRules, ...addedRules];
	return { automationRules: merged, triggers: serializeAutomationRuleLabels(merged) };
}

function deriveAgentName(prompt: string): string {
	const words = significantWords(prompt, 3).map(titleCase);
	return words.length > 0 ? `${words.join(" ")} agent` : "Untitled agent";
}

/**
 * Builds a believable fresh agent (`action: "create"`) from the prompt, including
 * any components it named. The shell's existing create path repairs/hydrates and
 * opens the config panel.
 *
 * Pass a precomputed `intent` to reuse a single classification; when omitted it
 * classifies the prompt itself (back-compat for direct callers and tests).
 */
export function buildAgentCreateResult(
	prompt: string,
	intent: AgentBuildIntent = classifyAgentBuildIntent(prompt),
): AgentResult {
	const name = intent.nameHint ?? deriveAgentName(prompt);
	const summary = capitalizeSentence(prompt) || `${name} for your team.`;

	const base: AgentResult = {
		action: "create",
		agentId: `demo-agent-${Date.now()}`,
		name,
		summary,
		description: summary,
		instructions:
			intent.instructionText ??
			capitalizeSentence(`You are ${name}. ${prompt}`),
		conversationStarters: generateStarters(prompt, 3),
	};

	// Reuse the merge logic over an empty draft so a create populates the same
	// components an update would (triggers, apps, skills, …). Reuse the same intent
	// so the catalogs are only classified once for the whole create.
	const patch = buildAgentUpdatePatch(prompt, base, intent);
	const conversationStarters =
		patch.conversationStarters && patch.conversationStarters.length >= 3
			? patch.conversationStarters
			: base.conversationStarters;

	return { ...base, ...patch, conversationStarters, action: "create" };
}

// ---------------------------------------------------------------------------
// Shared decision helper
// ---------------------------------------------------------------------------

export interface DeterministicAgentBuildOutcome {
	/** True when the prompt is a build intent the deterministic responder owns. */
	handled: boolean;
	mode: "update" | "none";
	/** Present when mode === "update": merge into the open agent's draft. */
	patch?: Partial<AgentResult>;
	/** Believable transcript reply (absent when not handled). */
	assistantReply?: string;
	/** Automation names when the deterministic edit includes trigger work. */
	triggerAutomationNames?: readonly string[];
	/**
	 * Collapsed change-card part rendered in the transcript instead of the plain
	 * `assistantReply` text. Null when the edit produced nothing displayable.
	 */
	summaryWidgetPart?: RovoUIMessage["parts"][number] | null;
}

const REASONING_MODE_LABELS: Record<string, string> = {
	"quick-auto": "Quick",
	"deep-auto": "Deep reasoning",
	"gemini-flash-3": "Gemini Flash 3",
	"gpt-5.4": "GPT-5.4",
	"sonnet-5": "Claude Sonnet 5",
	"opus-4.6": "Claude Opus 4.6",
};

/** Friendly "Color · Option" label for a chosen avatar src. */
function describeAvatar(avatarSrc: string): string {
	for (const group of AGENT_AVATAR_OPTION_GROUPS) {
		const option = group.options.find((candidate) => candidate.src === avatarSrc);
		if (option) {
			return `${group.label} · ${option.label}`;
		}
	}
	return "Updated";
}

/**
 * Structured, per-field summary of a deterministic edit — the data behind the
 * collapsed change card the sidebar shows instead of a plain text reply. Mirrors
 * what {@link buildAssistantReplyText} narrates, but as label → value rows.
 * Returns null when nothing displayable changed.
 */
export function buildAgentEditSummaryPayload(
	intent: AgentBuildIntent,
	agentName?: string,
): AgentEditSummaryPayload | null {
	const changes: AgentEditSummaryChange[] = [];

	if (intent.triggerSpecs.length > 0) {
		changes.push({
			label: intent.triggerSpecs.length > 1 ? "Flows" : "Flow",
			value: intent.triggerSpecs.map((spec) => spec.automationName).join(", "),
		});
	}
	if (intent.appNames.length > 0) {
		changes.push({ label: intent.appNames.length > 1 ? "Apps" : "App", value: intent.appNames.join(", ") });
	}
	if (intent.skillNames.length > 0) {
		changes.push({ label: intent.skillNames.length > 1 ? "Skills" : "Skill", value: intent.skillNames.join(", ") });
	}
	if (intent.subagentNames.length > 0) {
		changes.push({
			label: intent.subagentNames.length > 1 ? "Subagents" : "Subagent",
			value: intent.subagentNames.join(", "),
		});
	}
	if (intent.avatarSrc) {
		changes.push({ label: "Avatar", value: describeAvatar(intent.avatarSrc) });
	}
	if (intent.modeChanges.memoryMode) {
		changes.push({ label: "Memory", value: intent.modeChanges.memoryMode === "on" ? "On" : "Off" });
	}
	if (intent.modeChanges.reasoningMode) {
		changes.push({
			label: "Reasoning",
			value: REASONING_MODE_LABELS[intent.modeChanges.reasoningMode] ?? intent.modeChanges.reasoningMode,
		});
	}
	if (intent.modeChanges.knowledgeMode) {
		const knowledgeLabel = { all: "All", custom: "Custom", none: "None" }[intent.modeChanges.knowledgeMode];
		changes.push({ label: "Knowledge", value: knowledgeLabel ?? intent.modeChanges.knowledgeMode });
	}
	if (intent.starterCount > 0) {
		changes.push({ label: "Conversation starters", value: `+${intent.starterCount}` });
	}
	if (intent.instructionText) {
		changes.push({ label: "Instructions", value: "Updated" });
	}
	if (intent.nameHint) {
		changes.push({ label: "Name", value: intent.nameHint });
	}

	if (changes.length === 0) {
		return null;
	}

	const summary =
		changes.length === 1
			? `${changes[0].label}: ${changes[0].value}`
			: `${changes.length} changes · ${changes.map((change) => change.label).join(", ")}`;

	return {
		...(agentName ? { agentName } : {}),
		headline: agentName ? `Updated ${agentName}` : "Agent updated",
		summary,
		changes,
	};
}

/**
 * The data-widget-data part that renders the collapsed change card in the
 * transcript. Null when the intent produced no displayable change (callers fall
 * back to the plain assistant reply).
 */
export function buildAgentEditSummaryWidgetPart(
	intent: AgentBuildIntent,
	agentName?: string,
): RovoUIMessage["parts"][number] | null {
	const payload = buildAgentEditSummaryPayload(intent, agentName);
	if (!payload) {
		return null;
	}
	return {
		type: "data-widget-data",
		data: { type: AGENT_EDIT_SUMMARY_WIDGET_TYPE, payload },
	};
}

export const DETERMINISTIC_TRIGGER_TRACE_INITIAL_DELAY_MS = 3200;
export const DETERMINISTIC_TRIGGER_TRACE_STAGE_DELAYS_MS = [1200, 1400, 1500, 1300] as const;

/**
 * Single decision point shared by every agent-edit interception seam. Classifies
 * the prompt once and returns what to do: update the open agent or fall through
 * to the model. New-agent creation must stay on the model-backed Studio flow so
 * the first turn can ask clarification questions before emitting an agent.
 */
export function planDeterministicAgentBuild(
	prompt: string,
	currentAgent: Partial<AgentResult> | null,
): DeterministicAgentBuildOutcome {
	const intent = classifyAgentBuildIntent(prompt);
	if (!intent.isBuildIntent || !currentAgent) {
		return { handled: false, mode: "none" };
	}

	const assistantReply = buildAssistantReplyText(intent, Boolean(currentAgent));
	return {
		handled: true,
		mode: "update",
		patch: buildAgentUpdatePatch(prompt, currentAgent, intent),
		assistantReply,
		triggerAutomationNames: intent.triggerSpecs.map((spec) => spec.automationName),
		summaryWidgetPart: buildAgentEditSummaryWidgetPart(intent, currentAgent.name ?? undefined),
	};
}

export function buildDeterministicTriggerThinkingParts({
	assistantReply,
	now = new Date(),
	prompt,
	startedAt = now,
	state,
	summaryWidgetPart,
	triggerAutomationNames,
}: Readonly<{
	assistantReply?: string;
	now?: Date;
	prompt: string;
	startedAt?: Date;
	state: "thinking" | "review" | "schedule" | "delivery" | "save" | "complete";
	/** Collapsed change card to emit at completion instead of plain text. */
	summaryWidgetPart?: RovoUIMessage["parts"][number] | null;
	triggerAutomationNames: readonly string[];
}>): RovoUIMessage["parts"] {
	if (triggerAutomationNames.length === 0) {
		if (summaryWidgetPart) {
			return [summaryWidgetPart];
		}
		return assistantReply
			? [{ type: "text", text: assistantReply, state: "done" }]
			: [];
	}

	const startedTimestamp = startedAt.toISOString();
	const timestamp = now.toISOString();
	const automationName = triggerAutomationNames[0] ?? "Scheduled trigger";
	if (state === "thinking") {
		return [
			{
				type: "data-thinking-status",
				data: {
					label: "Thinking",
					content: "Preparing to configure the scheduled RFP summary automation.",
					activity: "data",
					source: "fallback",
					timestamp: startedTimestamp,
				},
			},
		];
	}

	const reviewToolCallId = `deterministic-trigger-review-${startedAt.getTime()}`;
	const scheduleToolCallId = `deterministic-trigger-schedule-${startedAt.getTime()}`;
	const deliveryToolCallId = `deterministic-trigger-delivery-${startedAt.getTime()}`;
	const saveToolCallId = `deterministic-trigger-save-${startedAt.getTime()}`;
	const reviewLabel = "Reviewing existing automations";
	const scheduleLabel = "Configuring Friday schedule";
	const deliveryLabel = "Setting Slack delivery";
	const saveLabel = "Saving automation trigger";
	const parts: RovoUIMessage["parts"] = [
		{
			type: "data-thinking-status",
			data: {
				label: reviewLabel,
				content: `Checking whether "${automationName}" conflicts with the existing Jira drafting automation.`,
				toolCallId: reviewToolCallId,
				input: {
					agent: "RFP Drafter",
					existingAutomation: "Draft RFP response package",
					request: prompt,
				},
				activity: "data",
				source: "fallback",
				timestamp: startedTimestamp,
			},
		},
		{
			type: "data-thinking-event",
			id: `${reviewToolCallId}-start`,
			data: {
				eventId: `${reviewToolCallId}-start`,
				phase: "start",
				toolName: "agent.define_trigger",
				label: reviewLabel,
				toolCallId: reviewToolCallId,
				input: {
					existingTriggers: ["Draft RFP response package"],
					request: prompt,
					automationName,
				},
				timestamp: startedTimestamp,
			},
		},
	];

	if (state === "review") {
		return parts;
	}

	parts.push(
		{
			type: "data-thinking-event",
			id: `${reviewToolCallId}-result`,
			data: {
				eventId: `${reviewToolCallId}-result`,
				phase: "result",
				toolName: "agent.define_trigger",
				label: reviewLabel,
				toolCallId: reviewToolCallId,
				output: {
					decision: "append",
					kept: "Draft RFP response package",
					nextAction: "Create a scheduled Slack summary trigger",
				},
				outputPreview: "Existing Jira drafting trigger kept unchanged.",
				timestamp,
			},
		},
		{
			type: "data-thinking-status",
			data: {
				label: reviewLabel,
				content: "Existing Jira drafting trigger stays in place; the Slack summary will be added as a separate scheduled automation.",
				toolCallId: reviewToolCallId,
				output: {
					kept: "Draft RFP response package",
					change: "Append one new scheduled trigger",
				},
				activity: "data",
				source: "fallback",
				timestamp,
			},
		},
		{
			type: "data-thinking-status",
			data: {
				label: scheduleLabel,
				content: "Setting the recurring cadence for the leadership RFP outcome summary.",
				toolCallId: scheduleToolCallId,
				input: {
					automationName,
					cadence: "Weekly",
					day: "Friday",
					time: "9:00 AM",
					scope: "All RFP outcomes",
				},
				activity: "data",
				source: "fallback",
				timestamp: startedTimestamp,
			},
		},
		{
			type: "data-thinking-event",
			id: `${scheduleToolCallId}-start`,
			data: {
				eventId: `${scheduleToolCallId}-start`,
				phase: "start",
				toolName: "agent.define_trigger",
				label: scheduleLabel,
				toolCallId: scheduleToolCallId,
				input: {
					automationName,
					triggerType: "scheduled",
					schedule: "Every Friday at 9:00 AM",
				},
				timestamp: startedTimestamp,
			},
		},
	);

	if (state === "schedule") {
		return parts;
	}

	parts.push(
		{
			type: "data-thinking-event",
			id: `${scheduleToolCallId}-result`,
			data: {
				eventId: `${scheduleToolCallId}-result`,
				phase: "result",
				toolName: "agent.define_trigger",
				label: scheduleLabel,
				toolCallId: scheduleToolCallId,
				output: {
					schedule: "Every Friday at 9:00 AM",
					status: "configured",
				},
				outputPreview: "Weekly Friday 9:00 AM schedule configured.",
				timestamp,
			},
		},
		{
			type: "data-thinking-status",
			data: {
				label: scheduleLabel,
				content: "The trigger will run every Friday at 9:00 AM.",
				toolCallId: scheduleToolCallId,
				output: {
					cadence: "Weekly",
					time: "Friday 9:00 AM",
				},
				activity: "data",
				source: "fallback",
				timestamp,
			},
		},
		{
			type: "data-thinking-status",
			data: {
				label: deliveryLabel,
				content: "Mapping the weekly summary to the leadership Slack destination.",
				toolCallId: deliveryToolCallId,
				input: {
					channel: "Leadership Slack channel",
					message: "Weekly RFP outcome summary",
					includes: ["bid/no-bid recommendations", "blockers", "owner follow-ups"],
				},
				activity: "data",
				source: "fallback",
				timestamp: startedTimestamp,
			},
		},
		{
			type: "data-thinking-event",
			id: `${deliveryToolCallId}-start`,
			data: {
				eventId: `${deliveryToolCallId}-start`,
				phase: "start",
				toolName: "agent.configure_tools",
				label: deliveryLabel,
				toolCallId: deliveryToolCallId,
				input: {
					destination: "Slack",
					audience: "Leadership team",
					summary: "All RFP outcomes",
				},
				timestamp: startedTimestamp,
			},
		},
	);

	if (state === "delivery") {
		return parts;
	}

	parts.push(
		{
			type: "data-thinking-event",
			id: `${deliveryToolCallId}-result`,
			data: {
				eventId: `${deliveryToolCallId}-result`,
				phase: "result",
				toolName: "agent.configure_tools",
				label: deliveryLabel,
				toolCallId: deliveryToolCallId,
				output: {
					destination: "Slack",
					audience: "Leadership team",
					content: "Weekly RFP outcome summary",
				},
				outputPreview: "Slack delivery configured for the leadership team.",
				timestamp,
			},
		},
		{
			type: "data-thinking-status",
			data: {
				label: deliveryLabel,
				content: "Slack delivery is configured for the leadership team's weekly RFP outcome summary.",
				toolCallId: deliveryToolCallId,
				output: {
					channel: "Leadership Slack channel",
					summaryCadence: "Weekly",
				},
				activity: "data",
				source: "fallback",
				timestamp,
			},
		},
		{
			type: "data-thinking-status",
			data: {
				label: saveLabel,
				content: "Saving the new scheduled trigger into the RFP Drafter automation list.",
				toolCallId: saveToolCallId,
				input: {
					automationName,
					triggerType: "scheduled",
					destination: "Slack",
				},
				activity: "data",
				source: "fallback",
				timestamp: startedTimestamp,
			},
		},
		{
			type: "data-thinking-event",
			id: `${saveToolCallId}-start`,
			data: {
				eventId: `${saveToolCallId}-start`,
				phase: "start",
				toolName: "studio.save_profile",
				label: saveLabel,
				toolCallId: saveToolCallId,
				input: {
					automationName,
					triggerType: "scheduled",
					destination: "Slack",
				},
				timestamp: startedTimestamp,
			},
		},
	);

	if (state === "save") {
		return parts;
	}

	parts.push(
		{
			type: "data-thinking-event",
			id: `${saveToolCallId}-result`,
			data: {
				eventId: `${saveToolCallId}-result`,
				phase: "result",
				toolName: "studio.save_profile",
				label: saveLabel,
				toolCallId: saveToolCallId,
				output: {
					automationName,
					triggerType: "scheduled",
					status: "ready",
				},
				outputPreview: `${automationName} is ready to review in the config panel.`,
				timestamp,
			},
		},
		{
			type: "data-thinking-status",
			data: {
				label: saveLabel,
				content: "The scheduled Slack summary trigger is saved and ready to review.",
				toolCallId: saveToolCallId,
				output: {
					automationName,
					status: "ready",
				},
				activity: "data",
				source: "fallback",
				timestamp,
			},
		},
		...(summaryWidgetPart
			? [summaryWidgetPart]
			: assistantReply
				? [{ type: "text" as const, text: assistantReply, state: "done" as const }]
				: []),
		{
			type: "data-turn-complete",
			data: {
				timestamp,
			},
		},
	);

	return parts;
}

const KIND_PHRASES: Record<AgentBuildIntentKind, string> = {
	trigger: "a trigger",
	app: "the connected apps",
	skill: "a skill",
	subagent: "a subagent",
	starter: "conversation starters",
	instructions: "the instructions",
	name: "the name",
	avatar: "the avatar",
	mode: "the agent settings",
};

/** Believable assistant reply for the transcript after applying a build intent. */
export function buildAssistantReplyText(intent: AgentBuildIntent, agentIsOpen: boolean): string {
	const parts: string[] = [];

	if (intent.triggerSpecs.length > 0) {
		const names = intent.triggerSpecs.map((spec) => spec.automationName);
		parts.push(`a "${names[0]}" trigger`);
	}
	if (intent.appNames.length > 0) {
		parts.push(`${intent.appNames.join(", ")} (tools + knowledge)`);
	}
	if (intent.skillNames.length > 0) {
		parts.push(`the ${intent.skillNames.join(", ")} skill${intent.skillNames.length > 1 ? "s" : ""}`);
	}
	if (intent.subagentNames.length > 0) {
		parts.push(`the ${intent.subagentNames.join(", ")} subagent${intent.subagentNames.length > 1 ? "s" : ""}`);
	}
	if (intent.starterCount > 0) {
		parts.push("new conversation starters");
	}
	if (intent.instructionText) {
		parts.push("updated instructions");
	}
	if (intent.nameHint) {
		parts.push(`renamed it to ${intent.nameHint}`);
	}
	if (intent.avatarSrc) {
		parts.push("a new avatar");
	}
	if (hasModeChanges(intent.modeChanges)) {
		parts.push("updated settings");
	}

	const summary =
		parts.length > 0
			? parts.length === 1
				? parts[0]
				: `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
			: intent.kinds.map((kind) => KIND_PHRASES[kind]).join(", ");

	return agentIsOpen
		? `Done — I added ${summary} to your agent. Review the changes in the config panel on the right, then publish when it looks right.`
		: `I've created a new agent with ${summary}. Open the config panel on the right to fine-tune and test it before publishing.`;
}
