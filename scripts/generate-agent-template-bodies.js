#!/usr/bin/env node
/**
 * Generate the tokenized `instructionsBody` for every agent template from its
 * bound catalog ids + curated `bodyIntro`.
 *
 * Why this exists: the instruction body shown in the agent's tiptap editor should
 * ALWAYS fill with skill/app/knowledge/subagent chips so a generated agent looks
 * complete and robust. Chips are rendered from `@[category:id]` tokens, so the
 * invariant is simply "every bound id appears as a token in the body." This
 * generator guarantees that deterministically.
 *
 * Contract:
 *   - `bodyIntro` (authored, per template) is preserved verbatim as the lead line.
 *   - Generated sections reference EVERY bound id exactly once:
 *       apps      -> @[app:<id>]              (## Apps; unifies tool + knowledge
 *                                              facets — knowledgeIds ∪ toolIds,
 *                                              each app once)
 *       skills    -> @[skill:<id>]            (one numbered step each)
 *       subagents -> @[subagent:<id>]         (## Escalation; omitted when none)
 *   - A mode line describes reasoning/memory/knowledge behavior (not raw values).
 *   - Section lead-ins vary by categoryId so bodies don't read identically.
 *
 * Re-runnable (one-shot scaffold): committed JSON is the source of truth and may
 * be hand-tuned afterward; the binding test enforces coverage, not exact output.
 * Fails loudly if a bound id cannot be placed.
 *
 * Usage: `pnpm run gen:agent-bodies`
 */
const fs = require("node:fs");
const path = require("node:path");

const FILE = path.join(__dirname, "..", "app", "data", "directory", "agent-template.json");

const CATEGORY_COPY = {
	brainstorm: {
		context: "Ground your thinking in",
		how: "Work the problem in order:",
		output: "A set of ranked options with rationale and clear next steps.",
	},
	analyze: {
		context: "Ground your analysis in",
		how: "Work through the signal in order:",
		output: "A decision-ready readout of findings, risks, and recommended actions.",
	},
	review: {
		context: "Ground your review in",
		how: "Work the queue in order:",
		output: "A review-ready result with clear recommendations you can edit before sharing.",
	},
	summarize: {
		context: "Ground your summary in",
		how: "Shape the narrative in order:",
		output: "A clear, audience-ready summary you can edit before sharing.",
	},
	create: {
		context: "Ground your work in",
		how: "Build it out in order:",
		output: "Structured, well-owned output ready to drop into delivery.",
	},
};

const REASONING_BEHAVIOR = {
	"quick-auto": "Move quickly and keep responses tight.",
	"deep-auto": "Reason step-by-step before you commit to an answer.",
	"gemini-flash-3": "Use the Gemini Flash 3 reasoning model for this work.",
	"gpt-5.4": "Use the GPT-5.4 reasoning model for this work.",
	"sonnet-5": "Use the Claude Sonnet 5 reasoning model for this work.",
	"opus-4.6": "Use the Claude Opus 4.6 reasoning model for this work.",
};

const KNOWLEDGE_BEHAVIOR = {
	all: "Draw on all connected organizational knowledge",
	custom: "Stay within the selected knowledge sources",
	none: "Rely only on what is in the conversation",
};

const SKILL_STEP_LEAD = ["Lead with", "Then bring in", "Next, apply", "Round it out with", "Finish with"];

/** Join a list into "a, b, and c" prose. */
function joinList(items) {
	if (items.length === 0) return "";
	if (items.length === 1) return items[0];
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildBody(t) {
	const copy = CATEGORY_COPY[t.categoryId];
	if (!copy) throw new Error(`${t.id}: unknown categoryId "${t.categoryId}"`);

	const intro = String(t.bodyIntro || "").trim();
	if (!intro) throw new Error(`${t.id}: missing bodyIntro`);

	const knowledgeIds = t.knowledgeIds ?? [];
	const skillIds = t.skillIds ?? [];
	const toolIds = t.toolIds ?? [];
	const subagentIds = t.subagentIds ?? [];

	const sections = [intro];

	// ## Apps — tool + knowledge facets unify into one @[app:id] chip each.
	// Knowledge ids lead (they set the grounding) then tool-only ids, deduped so
	// an app carrying both facets (e.g. jira) is referenced exactly once.
	const appIds = [];
	const seenApp = new Set();
	for (const id of [...knowledgeIds, ...toolIds]) {
		if (!seenApp.has(id)) {
			seenApp.add(id);
			appIds.push(id);
		}
	}
	if (appIds.length > 0) {
		const tokens = appIds.map((id) => `@[app:${id}]`);
		const memory = t.memoryMode === "on" ? " Remember context across turns so each answer builds on the last." : "";
		const knowledgeBehavior = KNOWLEDGE_BEHAVIOR[t.knowledgeMode] ?? KNOWLEDGE_BEHAVIOR.all;
		sections.push(
			`## Apps\n${copy.context} ${joinList(tokens)}. ${knowledgeBehavior}.${memory}`,
		);
	}

	// ## How you work — one numbered step per skill.
	if (skillIds.length > 0) {
		const steps = skillIds.map((id, i) => {
			const lead = SKILL_STEP_LEAD[Math.min(i, SKILL_STEP_LEAD.length - 1)];
			return `${i + 1}. ${lead} @[skill:${id}].`;
		});
		const reasoning = REASONING_BEHAVIOR[t.reasoningMode] ?? REASONING_BEHAVIOR["deep-auto"];
		sections.push(`## How you work\n${copy.how}\n${steps.join("\n")}\n\n${reasoning}`);
	}

	// ## Escalation — every bound subagent (omitted when none).
	if (subagentIds.length > 0) {
		const tokens = subagentIds.map((id) => `@[subagent:${id}]`);
		sections.push(`## Escalation\nHand specialized or ambiguous work to ${joinList(tokens)}.`);
	}

	// ## Output — curated outro or category default.
	const outro = String(t.bodyOutro || "").trim() || copy.output;
	sections.push(`## Output\n${outro}`);

	return sections.join("\n\n");
}

/** Expected token set the body must cover (tool + knowledge unify to `app:<id>`). */
function expectedTokens(t) {
	const set = new Set();
	for (const id of t.knowledgeIds ?? []) set.add(`app:${id}`);
	for (const id of t.toolIds ?? []) set.add(`app:${id}`);
	for (const id of t.skillIds ?? []) set.add(`skill:${id}`);
	for (const id of t.subagentIds ?? []) set.add(`subagent:${id}`);
	return set;
}

const TOKEN_RE = /@\[(app|skill|subagent):([^\]]+)\]/g;
function tokensIn(body) {
	const set = new Set();
	for (const m of body.matchAll(TOKEN_RE)) set.add(`${m[1]}:${m[2]}`);
	return set;
}

function main() {
	const templates = JSON.parse(fs.readFileSync(FILE, "utf8"));
	const failures = [];
	for (const t of templates) {
		const body = buildBody(t);
		const have = tokensIn(body);
		for (const want of expectedTokens(t)) {
			if (!have.has(want)) failures.push(`${t.id}: bound id not placed in body -> @[${want}]`);
		}
		t.instructionsBody = body;
	}
	if (failures.length > 0) {
		console.error("Generation failed — bound ids unplaceable:\n" + failures.join("\n"));
		process.exit(1);
	}
	fs.writeFileSync(FILE, JSON.stringify(templates, null, "\t") + "\n", "utf8");
	console.log(`Generated instructionsBody for ${templates.length} templates (full tag coverage).`);
}

main();
