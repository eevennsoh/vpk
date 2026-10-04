/**
 * Domain-scoping for Studio agent creation.
 *
 * Free-text agent creation injects ONE deterministic clarification question — a
 * multi-select over the 10 shared category ids (the same taxonomy used by
 * tools/skills) — so the user's pick scopes which catalog slices get injected
 * into the generation continuation (see `buildCatalogProjection`). Templates
 * skip the question: their scope is derived from the catalog categories of the
 * ids they already bind.
 *
 * The injected question is rendered into the model's clarification card but is
 * NOT sent back through the model's `ask_user_questions` tool contract — the
 * shell strips its answer and uses it purely client-side to compute the scope.
 */
import {
	DEFAULT_SKILLS,
	DEMO_SESSION_TOOLS,
	DEMO_TOOLS,
} from "@/app/data/directory";
import type {
	ClarificationAnswers,
	ParsedQuestionCardPayload,
	ParsedQuestionCardQuestion,
} from "@/components/projects/shared/lib/question-card-widget";
import type { StudioCreationTemplateContext } from "@/components/projects/rovo-core/lib/agent-records/agent-creation-context";

export const DOMAIN_SCOPE_QUESTION_ID = "domain-scope";

/**
 * The 10 shared category ids and their human labels. Mirrors the `ToolCategory`
 * / `SkillCategory` union; option ids ARE the category ids so a selection maps
 * straight to `categoryIds` with no extra lookup.
 */
export const AGENT_DOMAIN_CATEGORIES = [
	{ id: "project-management", label: "Project management" },
	{ id: "administrative-tools", label: "Administrative tools" },
	{ id: "content-and-communication", label: "Content & communication" },
	{ id: "data-and-analytics", label: "Data & analytics" },
	{ id: "software-development", label: "Software development" },
	{ id: "it-support-and-service", label: "IT support & service" },
	{ id: "design-and-diagramming", label: "Design & diagramming" },
	{ id: "security-and-compliance", label: "Security & compliance" },
	{ id: "hr-and-team-building", label: "HR & team building" },
	{ id: "sales-and-customer-relations", label: "Sales & customer relations" },
] as const;

const VALID_CATEGORY_IDS: ReadonlySet<string> = new Set(
	AGENT_DOMAIN_CATEGORIES.map((category) => category.id),
);

/** The deterministic domain-scope clarification question. */
export function buildDomainScopeQuestion(): ParsedQuestionCardQuestion {
	return {
		id: DOMAIN_SCOPE_QUESTION_ID,
		label: "Which areas should this agent work across?",
		description:
			"Pick the domains so we can surface the most relevant tools, skills, and knowledge.",
		required: true,
		kind: "multi-select",
		options: AGENT_DOMAIN_CATEGORIES.map((category) => ({
			id: category.id,
			label: category.label,
		})),
	};
}

/**
 * Prepend the domain-scope question to a model-authored card (free-text creation
 * only). Keeps EVERY model question so the submitted base card's answers stay
 * complete (the model's ask_user_questions tool contract expects an answer for
 * each question it asked); only the domain question is extra and is stripped from
 * the submission. Recomputes `requiredCount` from the final set. Idempotent.
 */
export function withDomainScopeQuestion(
	card: ParsedQuestionCardPayload,
): ParsedQuestionCardPayload {
	if (card.questions.some((question) => question.id === DOMAIN_SCOPE_QUESTION_ID)) {
		return card;
	}
	const questions = [buildDomainScopeQuestion(), ...card.questions];
	return {
		...card,
		questions,
		requiredCount: questions.filter((question) => question.required).length,
	};
}

/**
 * Read the selected category ids from a clarification answer set. Returns
 * undefined when the domain question was not answered (or only with unknown
 * ids), so the caller falls back to the full catalog.
 */
export function readDomainCategoryIds(
	answers: ClarificationAnswers,
): readonly string[] | undefined {
	const raw = answers[DOMAIN_SCOPE_QUESTION_ID];
	if (raw === undefined) {
		return undefined;
	}
	const values = Array.isArray(raw) ? raw : [raw];
	const ids = values.filter((value) => VALID_CATEGORY_IDS.has(value));
	return ids.length > 0 ? ids : undefined;
}

/** Strip the injected domain question's answer before the model tool contract. */
export function omitDomainScopeAnswer(
	answers: ClarificationAnswers,
): ClarificationAnswers {
	if (answers[DOMAIN_SCOPE_QUESTION_ID] === undefined) {
		return answers;
	}
	const { [DOMAIN_SCOPE_QUESTION_ID]: _omitted, ...rest } = answers;
	return rest;
}

let toolCategoryIndex: Map<string, string | undefined> | null = null;
let skillCategoryIndex: Map<string, string | undefined> | null = null;

function getToolCategoryIndex(): Map<string, string | undefined> {
	if (!toolCategoryIndex) {
		toolCategoryIndex = new Map();
		for (const tool of [...DEMO_TOOLS, ...DEMO_SESSION_TOOLS]) {
			toolCategoryIndex.set(tool.id, tool.categoryId);
		}
	}
	return toolCategoryIndex;
}

function getSkillCategoryIndex(): Map<string, string | undefined> {
	if (!skillCategoryIndex) {
		skillCategoryIndex = new Map();
		for (const skill of DEFAULT_SKILLS) {
			skillCategoryIndex.set(skill.id, skill.categoryId);
		}
	}
	return skillCategoryIndex;
}

/**
 * Derive scope category ids for a template from the catalog categories of the
 * tool + skill ids it binds (knowledge/subagents are domain-neutral). Returns
 * undefined when the template binds nothing categorizable, so the caller falls
 * back to the full catalog.
 */
export function deriveTemplateCategoryIds(
	template: StudioCreationTemplateContext | null | undefined,
): readonly string[] | undefined {
	if (!template) {
		return undefined;
	}
	const tools = getToolCategoryIndex();
	const skills = getSkillCategoryIndex();
	const ids = new Set<string>();
	for (const id of template.toolIds ?? []) {
		const categoryId = tools.get(id);
		if (categoryId && VALID_CATEGORY_IDS.has(categoryId)) {
			ids.add(categoryId);
		}
	}
	for (const id of template.skillIds ?? []) {
		const categoryId = skills.get(id);
		if (categoryId && VALID_CATEGORY_IDS.has(categoryId)) {
			ids.add(categoryId);
		}
	}
	return ids.size > 0 ? [...ids] : undefined;
}
