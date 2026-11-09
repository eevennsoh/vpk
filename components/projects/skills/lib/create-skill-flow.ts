/**
 * Deterministic engine for the `create-skill` demo flow.
 *
 * The Skills project's `ChatPanel` routes composer submits through
 * `onInterceptSubmit`, which supports timed `assistantPartStages` (see
 * `use-chat-submit.ts`). This module builds those stages so the create-skill flow
 * runs entirely client-side, model-free, and identically every time:
 *
 *   submit 1 (composer has the `/create-skill` mention)
 *     → animate a chain-of-thought trace, then show a 1-round question card
 *       (the trace header reads "Awaiting user response" while it's docked)
 *   answer (routed back through the interceptor by ChatPanel)
 *     → first trace flips to "Questions answered", a second trace animates,
 *       then the generated-skill result card appears
 *
 * The trace is rendered by the canonical `ChainOfThought` component (via
 * `SkillCreationTraceCard`) so the styling, per-step icons, bylines, and the
 * embedded `/create-skill` skill tag are fully under our control. This module
 * stays free of React/JSX so it can be unit tested through the esbuild CJS
 * harness (see `create-skill-flow.test.js`); it emits JSON-serializable payloads
 * the sibling `components/` cards render.
 */

import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { SkillDirectorySkill } from "@/app/data/directory/skills";

/**
 * Local copy of `slugifySkillName` from `app/data/directory/skills.ts`. Inlined so
 * this pure-logic module stays free of the catalog's React/icon imports (which
 * can't be bundled by the esbuild unit-test harness). Kept identical to the
 * source so derived ids match the skill-tag lookup (`getSkillMentionTagProps`).
 */
function slugifySkillName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-|-$/gu, "");
}

/** Catalog id + display name of the meta "create-skill" skill (skills.json). */
export const CREATE_SKILL_ID = "create-skill";
export const CREATE_SKILL_NAME = "Create skill";

/**
 * The composer serializes a skill mention as `"/<Skill name>"` (sigil + label),
 * NOT a markdown token — see lib/composer-serialize.ts (`serializeComposerDoc`).
 * The external-value sync re-tags that same `/<label>` form back into a chip via
 * visual-trace auto-tagging. So prefill still uses the `/<label>` form.
 *
 * Detection also accepts leading plain-text `create skill …`, `create a skill …`,
 * and `create-skill …` commands. That keeps natural typed commands and editor
 * auto-tagging on the same create-skill path as the slash mention, while prose
 * like "I want to create a skill someday" still does not match.
 */
const CREATE_SKILL_MENTION_RE = /(?:^|\s)\/create[ -]skill\b|^\s*create(?:\s+a)?[ -]skill\b/iu;
const CREATE_SKILL_MENTION_STRIP_RE = /^\s*\/?create(?:\s+a)?[ -]skill\b[\s:]*/iu;

/** Builds the composer text that hydrates a skill's mention chip (prefill). */
export function buildSkillMentionText(skillName: string): string {
	return `/${skillName} `;
}

/** Widget type discriminators shared by the engine and the renderers. */
export const SKILL_CREATION_TRACE_WIDGET_TYPE = "skill-creation-trace";
export const SKILL_CREATION_RESULT_WIDGET_TYPE = "skill-creation-result";

/**
 * Question-card title — also the recognition key for the answer turn. ChatPanel
 * builds the clarification summary prompt from this title, so the interceptor can
 * detect the continuation by matching it.
 */
export const CREATE_SKILL_QUESTION_TITLE = "Create a new skill";

const CLARIFY_TOOL_CALL_ID = "create-skill-clarify";

// Studio-exact deterministic-trace pacing (mirrors demo-agent-builder.ts) so the
// chain-of-thought feels like a real run: a long initial "think", then steadier
// per-step beats.
const TRACE_INITIAL_DELAY_MS = 3200;
const TRACE_STEP_DELAYS_MS = [1200, 1400, 1500, 1300] as const;
const RESULT_CARD_DELAY_MS = 220;

type TraceStepStatus = "complete" | "active" | "pending";

export interface SkillCreationTraceStep {
	id: string;
	/** Step title text (ignored when `skillMention` is set). */
	label: string;
	/** Canonical byline shown under the step. */
	byline: string;
	/** Optional active-step narration cycled by the renderer while the step runs. */
	bylines?: readonly string[];
	status: TraceStepStatus;
	/** Icon key mapped to an icon component by the card. */
	iconKey: string;
	/** When set, the card renders "Invoking <skill tag>" using this skill id. */
	skillMention?: string;
}

export interface SkillCreationTracePayload {
	/** Parent/header label (general; e.g. "Designing your skill"). Omit on the
	 *  build-complete frame so the header shows "Thought for Xs" from `duration`. */
	headerLabel?: string;
	headerState: "thinking" | "completed";
	durationSeconds?: number;
	/** Stage-1 final frame: header reads "Awaiting user response" until answered,
	 *  then the card flips it to "Questions answered". */
	awaiting?: boolean;
	/** Identifies the create-skill flow instance so the card can track answered
	 *  state per flow (multiple create-skill flows can share one transcript). */
	flowId?: string;
	steps: readonly SkillCreationTraceStep[];
}

export interface SkillCreationResultPayload {
	skillId: string;
	name: string;
	description: string;
	iconKey: string;
	collectionId: string;
	showSuccessSummary?: boolean;
}

export interface DeriveSkillFromPromptOptions {
	/** Skill ids already owned by the static catalog. Generated runtime ids must not collide with them. */
	reservedSkillIds?: readonly string[];
}

type AssistantParts = RovoUIMessage["parts"];

interface InterceptStage {
	delayMs: number;
	getAssistantParts: (context: { startedAt: Date }) => AssistantParts;
	onApply?: () => Promise<void> | void;
	startsNewAssistantMessage?: boolean;
}

export interface CreateSkillStageOutcome {
	getPendingAssistantParts: (context: { startedAt: Date }) => AssistantParts;
	assistantPartStages: InterceptStage[];
}

function normalize(text: string): string {
	return text.trim().toLowerCase();
}

/** True when the composer text contains the create-skill mention or command. */
export function hasCreateSkillMention(text: string): boolean {
	return CREATE_SKILL_MENTION_RE.test(text);
}

/**
 * Finds a runtime-created skill referenced as a `/<Skill name>` mention in the
 * composer text (e.g. the auto-prefilled tag after creation). Lets SkillsPanel
 * handle invocation of a created skill locally instead of letting it fall through
 * to the static keyword matcher (which could mis-fire a built-in skill).
 */
export function matchCreatedSkillMention<T extends { name: string }>(
	text: string,
	createdSkills: readonly T[],
): T | undefined {
	for (const skill of createdSkills) {
		const escaped = skill.name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
		if (new RegExp(`(?:^|\\s)\\/${escaped}\\b`, "iu").test(text)) {
			return skill;
		}
	}
	return undefined;
}

/**
 * True when `text` is the clarification summary ChatPanel builds for the
 * create-skill question card (used to recognize the answer turn).
 */
export function isCreateSkillClarification(text: string): boolean {
	return normalize(text).includes(
		normalize(`clarification answers for "${CREATE_SKILL_QUESTION_TITLE}"`),
	);
}

// ---------------------------------------------------------------------------
// Part builders
// ---------------------------------------------------------------------------

function traceWidgetPart(payload: SkillCreationTracePayload): AssistantParts[number] {
	return {
		type: "data-widget-data",
		data: { type: SKILL_CREATION_TRACE_WIDGET_TYPE, payload },
	} as AssistantParts[number];
}

function resultWidgetPart(payload: SkillCreationResultPayload): AssistantParts[number] {
	return {
		type: "data-widget-data",
		data: { type: SKILL_CREATION_RESULT_WIDGET_TYPE, payload },
	} as AssistantParts[number];
}

function buildQuestionCardPart(): AssistantParts[number] {
	return {
		type: "data-widget-data",
		data: {
			type: "question-card",
			payload: {
				type: "question-card",
				sessionId: "create-skill-session",
				round: 1,
				// maxRounds > round so the shared summary builder omits the
				// "final clarification round" model directive — there's no model
				// here, and that text would otherwise leak into the user's bubble.
				maxRounds: 2,
				creationMode: "skill",
				toolCallId: CLARIFY_TOOL_CALL_ID,
				deferredToolCallId: CLARIFY_TOOL_CALL_ID,
				title: CREATE_SKILL_QUESTION_TITLE,
				description: "A couple of quick questions so I can build the right skill.",
				questions: [
					{
						id: "goal",
						label: "What's the primary job of this skill?",
						required: true,
						kind: "single-select",
						options: [
							{ id: "summarize", label: "Summarize information", recommended: true },
							{ id: "draft", label: "Draft content" },
							{ id: "automate", label: "Automate a workflow" },
						],
					},
					{
						id: "trigger",
						label: "When should it run?",
						required: true,
						kind: "single-select",
						options: [
							{ id: "on-demand", label: "On demand", recommended: true },
							{ id: "schedule", label: "On a schedule" },
							{ id: "event", label: "When something happens" },
						],
					},
					{
						id: "tools",
						label: "Which apps should it use?",
						required: false,
						kind: "multi-select",
						options: [
							{ id: "jira", label: "Jira" },
							{ id: "confluence", label: "Confluence" },
							{ id: "slack", label: "Slack" },
						],
					},
				],
			},
		},
	} as AssistantParts[number];
}

// ---------------------------------------------------------------------------
// Stage 1: prompt → chain-of-thought → question card (ends "Awaiting user response")
// ---------------------------------------------------------------------------

const STAGE_1_HEADER = "Designing your skill";

// Distinct icon per step (the card maps these keys to icon components).
const STAGE_1_STEP_DEFS = [
	{
		id: "read",
		label: "Reading your request",
		byline: "Identifying what the skill should do, its inputs, and the outcome you want.",
		bylines: [
			"Identifying what the skill should do, its inputs, and the outcome you want.",
			"Parsing your request for task, audience, and success criteria.",
			"Checking for constraints that should shape the generated skill.",
		],
		iconKey: "search",
	},
	{
		id: "invoke",
		label: "Invoking",
		byline: "Running the create-skill assistant to scaffold the skill.",
		bylines: [
			"Running the create-skill assistant to scaffold the skill.",
			"Translating the brief into a reusable skill shape.",
			"Preparing the generated instructions and metadata.",
		],
		iconKey: "skill",
		skillMention: CREATE_SKILL_ID,
	},
	{
		id: "questions",
		label: "Preparing clarification questions",
		byline: "Asking a few targeted questions to shape the skill before drafting.",
		bylines: [
			"Asking a few targeted questions to shape the skill before drafting.",
			"Spotting the choices that would change the skill design.",
			"Keeping the question round short and actionable.",
		],
		iconKey: "question",
	},
] as const;

function stage1Steps(activeIndex: number, allComplete = false): SkillCreationTraceStep[] {
	const visibleSteps = allComplete
		? STAGE_1_STEP_DEFS
		: STAGE_1_STEP_DEFS.slice(0, activeIndex + 1);

	return visibleSteps.map((step, index) => ({
		...step,
		status: allComplete || index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending",
	}));
}

export function buildCreateSkillStage1(flowId: string): CreateSkillStageOutcome {
	return {
		getPendingAssistantParts: () =>
			[traceWidgetPart({ headerLabel: STAGE_1_HEADER, headerState: "thinking", steps: stage1Steps(0) })],
		assistantPartStages: [
			{
				delayMs: TRACE_INITIAL_DELAY_MS,
				getAssistantParts: () =>
					[traceWidgetPart({ headerLabel: STAGE_1_HEADER, headerState: "thinking", steps: stage1Steps(1) })],
			},
			{
				delayMs: TRACE_STEP_DELAYS_MS[0],
				getAssistantParts: () =>
					[traceWidgetPart({ headerLabel: STAGE_1_HEADER, headerState: "thinking", steps: stage1Steps(2) })],
			},
			{
				delayMs: TRACE_STEP_DELAYS_MS[1],
				// All steps complete; header reads "Awaiting user response" (card flips
				// it to "Questions answered" once this flow is answered) and the
				// question card docks.
				getAssistantParts: () => [
					traceWidgetPart({ headerState: "thinking", awaiting: true, flowId, steps: stage1Steps(0, true) }),
					buildQuestionCardPart(),
				],
			},
		],
	};
}

// ---------------------------------------------------------------------------
// Skill derivation
// ---------------------------------------------------------------------------

const FILLER_PREFIX =
	/^(please\s+)?(can you\s+)?(help me\s+)?(create|build|make|generate|scaffold|author|write|design)\s+(me\s+)?(a|an|the)?\s*(new\s+)?(skill|rovo skill)?\s*(that|which|to|for|:)?\s*/iu;

// Leading words that make a poor skill name when kept (e.g. "to summarize…").
const NAME_LEADING_STRIP_RE = /^(to|that|which|for|a|an|the|please)\s+/iu;

function titleCaseFirst(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Picks an ADS-icon key from keywords in the prompt. */
function pickIconKey(text: string): string {
	const normalized = normalize(text);
	if (/summ|digest|report|recap/u.test(normalized)) return "chart-trend-up";
	if (/schedul|calendar|standup|meeting|daily|weekly/u.test(normalized)) return "calendar";
	if (/draft|write|content|blog|email|message/u.test(normalized)) return "edit";
	if (/review|pr|pull request|code/u.test(normalized)) return "angle-brackets";
	if (/search|find|lookup/u.test(normalized)) return "search";
	return "page";
}

const NAME_STOP_WORDS = new Set([
	"into", "to", "for", "a", "an", "the", "my", "our", "of", "and", "with", "on", "in", "that", "from", "all",
]);

function uniquifySkillId(baseId: string, reservedSkillIds: readonly string[]): string {
	const reservedIds = new Set(reservedSkillIds.map((id) => slugifySkillName(id)));
	if (!reservedIds.has(baseId)) {
		return baseId;
	}

	let suffix = 2;
	let candidate = `${baseId}-${suffix}`;
	while (reservedIds.has(candidate)) {
		suffix += 1;
		candidate = `${baseId}-${suffix}`;
	}
	return candidate;
}

/**
 * Derives a believable `SkillDirectorySkill` from the user's free-form prompt
 * (and, optionally, the clarification summary text). Deterministic.
 */
export function deriveSkillFromPrompt(
	prompt: string,
	clarificationText?: string,
	options: DeriveSkillFromPromptOptions = {},
): SkillDirectorySkill {
	// Strip the leading "/Create skill" mention, then any "create a skill that…"
	// filler and leading stop-words, leaving the user's actual intent.
	const cleaned = prompt.replace(CREATE_SKILL_MENTION_STRIP_RE, "").trim();
	const intent = cleaned.replace(FILLER_PREFIX, "").trim() || cleaned || "New skill";
	const nameIntent = intent.replace(NAME_LEADING_STRIP_RE, "").trim() || intent;

	// Build a clean name: first few words, dropping trailing stop-words so we
	// don't cut mid-phrase (e.g. "...standups into" -> "...standups").
	const nameWords = nameIntent.split(/\s+/u).filter(Boolean).slice(0, 4);
	while (nameWords.length > 1 && NAME_STOP_WORDS.has(nameWords[nameWords.length - 1].toLowerCase())) {
		nameWords.pop();
	}
	const name = titleCaseFirst(nameWords.join(" ")).replace(/[.?!,]+$/u, "") || "New skill";
	const baseId = slugifySkillName(name) || "new-skill";
	const id = uniquifySkillId(baseId, options.reservedSkillIds ?? []);
	const description = `${titleCaseFirst(intent.replace(/[.?!]+$/u, ""))}. Use when the user asks to ${intent.toLowerCase()}.`;
	const iconKey = pickIconKey(`${prompt} ${clarificationText ?? ""}`);

	const skillMd = [
		"---",
		`name: ${id}`,
		`description: ${description}`,
		"license: MIT",
		"version: 1.0.0",
		"---",
		"",
		description,
		"",
		"## When to use",
		"",
		`Use this skill when the user needs to ${intent.toLowerCase()}.`,
		"",
		"## Instructions",
		"",
		"1. Read the request and gather any missing context.",
		"2. Do the work, leading with the outcome the user cares about.",
		"3. Return a result the user can review and refine.",
		"",
		"## Output",
		"",
		"A ready-to-use result tailored to the request.",
		"",
	].join("\n");

	return {
		id,
		name,
		description,
		icon: iconKey as SkillDirectorySkill["icon"],
		publisherName: "Venn",
		publisherAvatarSrc: "/avatar-user/venn/venn.png",
		companyId: "you",
		categoryId: "content-and-communication",
		starCount: 0,
		favorite: false,
		tools: [
			{ id: "tool-1", name: "Editor", icon: "edit" },
			{ id: "tool-2", name: "Knowledge", icon: "page" },
		],
		instructions: skillMd,
		source: "custom",
		collectionId: "custom",
		collectionDescription:
			"User-authored skills tailored to local workflows, teams, and project-specific operating patterns.",
		collectionProducts: ["Custom"],
		teammateCount: 1,
		verified: false,
		skillMd,
		createdBy: "Venn",
		addedBy: "You",
		lastUpdatedAt: "2026-06-01T00:00:00.000Z",
	};
}

// ---------------------------------------------------------------------------
// Stage 2: answers → chain-of-thought → result card
// ---------------------------------------------------------------------------

const STAGE_2_HEADER = "Building your skill";

const STAGE_2_STEP_DEFS = [
	{
		id: "review",
		label: "Reviewing your answers",
		byline: "Merging your answers into the skill design.",
		bylines: [
			"Merging your answers into the skill design.",
			"Reconciling the clarification answers with the original request.",
			"Locking in the confirmed goal, inputs, and output.",
		],
		iconKey: "review",
	},
	{
		id: "draft",
		label: "Drafting the skill",
		byline: "Writing the name, description, and instructions.",
		bylines: [
			"Writing the name, description, and instructions.",
			"Structuring when to use the skill and how it should respond.",
			"Drafting reusable instructions for future runs.",
		],
		iconKey: "draft",
	},
	{
		id: "wire",
		label: "Wiring tools and triggers",
		byline: "Connecting the tools and trigger you chose.",
		bylines: [
			"Connecting the tools and trigger you chose.",
			"Mapping selected apps to the generated workflow.",
			"Checking that the skill has the right execution context.",
		],
		iconKey: "wire",
	},
	{
		id: "save",
		label: "Saving skill",
		byline: "Saving the skill so it's ready to use.",
		bylines: [
			"Saving the skill so it's ready to use.",
			"Preparing the skill card and editor draft.",
			"Finishing the generated skill setup.",
		],
		iconKey: "save",
	},
] as const;

function stage2Steps(activeIndex: number, allComplete = false): SkillCreationTraceStep[] {
	const visibleSteps = allComplete
		? STAGE_2_STEP_DEFS
		: STAGE_2_STEP_DEFS.slice(0, activeIndex + 1);

	return visibleSteps.map((step, index) => ({
		...step,
		status: allComplete || index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending",
	}));
}

export function buildCreateSkillStage2(
	skill: SkillDirectorySkill,
	onComplete?: () => void,
): CreateSkillStageOutcome {
	const resultPayload: SkillCreationResultPayload = {
		skillId: skill.id,
		name: skill.name,
		description: skill.description,
		iconKey: (skill.icon as string | undefined) ?? "page",
		collectionId: skill.collectionId ?? skill.source ?? "custom",
	};
	const elapsedSeconds = (startedAt: Date) =>
		Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
	const buildCompletedTraceParts = (startedAt: Date): AssistantParts => [
		traceWidgetPart({ headerState: "completed", durationSeconds: elapsedSeconds(startedAt), steps: stage2Steps(0, true) }),
	];
	const buildResultParts = (): AssistantParts => [resultWidgetPart({ ...resultPayload, showSuccessSummary: true })];

	return {
		getPendingAssistantParts: () =>
			[traceWidgetPart({ headerLabel: STAGE_2_HEADER, headerState: "thinking", steps: stage2Steps(0) })],
		assistantPartStages: [
			{
				delayMs: TRACE_INITIAL_DELAY_MS,
				getAssistantParts: () =>
					[traceWidgetPart({ headerLabel: STAGE_2_HEADER, headerState: "thinking", steps: stage2Steps(1) })],
			},
			{
				delayMs: TRACE_STEP_DELAYS_MS[0],
				getAssistantParts: () =>
					[traceWidgetPart({ headerLabel: STAGE_2_HEADER, headerState: "thinking", steps: stage2Steps(2) })],
			},
			{
				delayMs: TRACE_STEP_DELAYS_MS[1],
				getAssistantParts: () =>
					[traceWidgetPart({ headerLabel: STAGE_2_HEADER, headerState: "thinking", steps: stage2Steps(3) })],
			},
			{
				delayMs: TRACE_STEP_DELAYS_MS[2],
				// All steps complete -> header settles to "Thought for Xs". The result
				// card is emitted in its own assistant message because ThreadMessageRoot
				// intentionally renders only one widget per message.
				getAssistantParts: ({ startedAt }) =>
					buildCompletedTraceParts(startedAt),
			},
			{
				delayMs: RESULT_CARD_DELAY_MS,
				getAssistantParts: () =>
					buildResultParts(),
				onApply: onComplete,
				startsNewAssistantMessage: true,
			},
		],
	};
}
