const { getNonEmptyString } = require("./shared-utils");

// ---------------------------------------------------------------------------
// Presentation mapping
// ---------------------------------------------------------------------------

const INTENT_TO_PRESENTATION = {
	chat: "text",
	artifact_create: "artifact_preview",
	artifact_update: "artifact_preview",
	genui: "genui_card",
};

function presentationForIntent(intent) {
	return INTENT_TO_PRESENTATION[intent] || "text";
}

// ---------------------------------------------------------------------------
// Layer 1 — Deterministic fast path (< 10ms)
// ---------------------------------------------------------------------------

const DOCUMENT_VERB_PATTERN =
	/\b(write|draft|create|build|generate|make|compose|outline|summari[sz]e|plan|design|implement|refactor|turn|convert)\b/;
const DOCUMENT_NOUN_PATTERN =
	/\b(document|doc|plan|brief|proposal|spec|summary|memo|outline|report|email|copy|article|blog|code|component|app|page|ui|table|spreadsheet|sheet|artifact)\b/;

// Explicit requests to make a visualization ("a small bar chart", "make me a
// pie chart of fruit sales", "plot revenue as a line graph"). These skip the
// classifier, so they must read as a request to draw something and nothing
// else. Bare "graph" and "plot" stay with the classifier ("the plot of Hamlet",
// "graph theory"), and so does anything that needs tools or is a discussion.
const VISUALIZATION_NOUN_SOURCE = String.raw`(?:charts?|dashboards?|heat\s?maps?|histograms?|treemaps?|sparklines?|infographics?|visuali[sz]ations?|(?:bar|line|pie|area|radar|donut|doughnut|scatter|bubble|column|stacked)\s+(?:graphs?|plots?))`;
const REQUEST_PREFIX_SOURCE = String.raw`^(?:(?:hey|hi|ok|okay)[,!.]?\s+)?(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?`;
// "<verb> ... <noun>": the noun must follow the verb, so "chart a course" and
// "chart my issues" (verb, no visualization noun) do not match.
const VISUALIZATION_VERB_REQUEST_PATTERN = new RegExp(
	`${REQUEST_PREFIX_SOURCE}(?:make|draw|plot|create|build|generate|render|sketch|design|show|give\\s+me|graph|chart|visuali[sz]e)\\b.*?\\b${VISUALIZATION_NOUN_SOURCE}\\b`,
);
// "<a> <descriptor>* <noun> [of|for|...]": a bare noun phrase such as "a small
// bar chart" or "pie chart of fruit sales". No leading "the" ("the chart is
// wrong") and only known descriptors ("org chart" stays with the classifier).
const VISUALIZATION_NOUN_PHRASE_PATTERN = new RegExp(
	`^(?:an?\\s+)?(?:(?:small|simple|quick|basic|sample|interactive|nice|clean|grouped|horizontal|vertical|bar|line|pie|area|radar|donut|doughnut|scatter|bubble|column|stacked|gantt|funnel|waterfall|kpi)\\s+){0,3}${VISUALIZATION_NOUN_SOURCE}(?:\\s+(?:of|for|showing|comparing|with|by|that)\\b.*|\\s*[:,-].*|[\\s.!]*)$`,
);
// Discussion, troubleshooting, navigation and product-data turns. These need
// tools or a conversation, not a GenUI card with made-up data.
const VISUALIZATION_EXCLUSION_PATTERN =
	/\b(?:explain|why|what|how|tell\s+me\s+about|bug|broken|fix|error|wrong|debug|not\s+(?:rendering|working|loading|showing)|won'?t|wont|doesn'?t|isn'?t|can'?t|vs\.?|versus|recharts|chart\.?js|d3|library|component|jira|confluence|bitbucket|issues?|incidents?|tickets?|navigate|open|go\s+to|log\s*in|org\s+chart|course)\b/;
const POLITE_QUESTION_PATTERN = /^(?:(?:hey|hi|ok|okay)[,!.]?\s+)?(?:please\s+)?(?:can|could|would|will)\s+you\b/;

function matchesVisualizationRequest(lowerPrompt) {
	const trimmedPrompt = lowerPrompt.trim();
	if (VISUALIZATION_EXCLUSION_PATTERN.test(trimmedPrompt)) {
		return false;
	}
	// A question is a question unless it is a polite request ("can you ...?").
	if (trimmedPrompt.includes("?") && !POLITE_QUESTION_PATTERN.test(trimmedPrompt)) {
		return false;
	}
	return VISUALIZATION_VERB_REQUEST_PATTERN.test(trimmedPrompt) || VISUALIZATION_NOUN_PHRASE_PATTERN.test(trimmedPrompt);
}

// Greetings and acknowledgements ("hello", "thanks!", "sounds good") and
// concept questions ("what is a monad?", "explain closures") are chat. The
// classifier answers chat for these too, so skipping it only saves its latency.
const CONVERSATIONAL_ACK_PATTERN =
	/^(?:hi|hello|hey|yo|thanks|thank\s+you|thx|ty|ok|okay|cool|great|nice|awesome|perfect|sounds\s+good|got\s+it|yes|yep|yeah|no|nope|sure|bye|goodbye|good\s+(?:morning|afternoon|evening|night))(?:\s+(?:there|rovo|so\s+much|again|all))?[\s!.,]*$/;
const CONCEPT_QUESTION_PATTERN =
	/^(?:(?:hey|hi)[,!.]?\s+)?(?:what(?:'s|\s+is|\s+are)\s+(?:an?\s+)|whats\s+an?\s+|explain\b|define\b|tell\s+me\s+about\b|who\s+(?:is|was)\b|why\b)/;

function matchesConversationalChat(lowerPrompt) {
	const trimmedPrompt = lowerPrompt.trim();
	return CONVERSATIONAL_ACK_PATTERN.test(trimmedPrompt) || CONCEPT_QUESTION_PATTERN.test(trimmedPrompt);
}

/**
 * Attempts to classify a routing decision without calling the LLM.
 * Returns a full RoutingDecision when confident, or `null` when the
 * prompt is ambiguous and should be escalated to Layer 2.
 *
 * @param {RoutingContext} context
 * @returns {RoutingDecision | null}
 */
function resolveRoutingDecisionFastPath(context) {
	const prompt = getNonEmptyString(context?.prompt) || "";
	const origin = context?.origin === "voice" ? "voice" : "text";
	const activeArtifact = context?.activeArtifact;

	if (context?.creationMode === "agent") {
		return {
			intent: "chat",
			presentation: "text",
			confidence: 1,
			reason: "agent_creation_mode",
			origin,
		};
	}

	// Empty / whitespace-only → chat
	if (!prompt.trim()) {
		return {
			intent: "chat",
			presentation: "text",
			confidence: 1,
			reason: "empty_prompt",
			origin,
		};
	}

	if (activeArtifact?.id) {
		return {
			intent: "artifact_update",
			presentation: "artifact_preview",
			confidence: 1,
			reason: "active_artifact",
			origin,
		};
	}

	// Document verb + noun → artifact_create
	const lowerPrompt = prompt.toLowerCase();
	if (DOCUMENT_VERB_PATTERN.test(lowerPrompt) && DOCUMENT_NOUN_PATTERN.test(lowerPrompt)) {
		return {
			intent: "artifact_create",
			presentation: "artifact_preview",
			confidence: 1,
			reason: "document_verb_noun_match",
			origin,
		};
	}

	// Greetings, acknowledgements and concept questions → chat
	if (matchesConversationalChat(lowerPrompt)) {
		return {
			intent: "chat",
			presentation: "text",
			confidence: 1,
			reason: "conversational_match",
			origin,
		};
	}

	// Explicit chart/dashboard request → genui, without waiting on the classifier
	if (matchesVisualizationRequest(lowerPrompt)) {
		return {
			intent: "genui",
			presentation: "genui_card",
			confidence: 1,
			reason: "visualization_noun_match",
			origin,
		};
	}

	// Ambiguous — fall through to Layer 2
	return null;
}

// ---------------------------------------------------------------------------
// Layer 2 — LLM classifier
// ---------------------------------------------------------------------------

// Sized to the measured latency of the default AI Gateway chat model on this
// one short JSON classification (about 2-4 s). A budget below that latency
// always times out, so every ambiguous turn paid the wait and still fell back
// to chat. Clear intents, greetings and concept questions never reach this
// layer (see the fast path above), and route_decision_resolved traces record
// the stage time of each decision.
const ROUTING_CLASSIFIER_TIMEOUT_MS = 4500;
// Voice turns keep the earlier, shorter budget: first-token delay matters most
// there, and a voice turn that times out still answers as chat.
const VOICE_ROUTING_CLASSIFIER_TIMEOUT_MS = 1500;

function resolveRoutingClassifierTimeoutMs(origin) {
	return origin === "voice" ? VOICE_ROUTING_CLASSIFIER_TIMEOUT_MS : ROUTING_CLASSIFIER_TIMEOUT_MS;
}

const CLASSIFIER_SYSTEM_PROMPT = `You are a routing classifier for a chat application with multiple surfaces.
Classify the user's latest message into exactly one intent:

- chat: normal conversation, Q&A, greetings, explanations, opinions, or anything that should stay in the chat transcript
- artifact_create: user wants to create a new code artifact, document, or durable content (app, page, component, doc, spec, memo, etc.)
- genui: user wants a dynamic data visualization, dashboard, chart, graph, infographic, diagram, flowchart, or interactive UI widget

Rules:
- Choose artifact_create only when the user explicitly asks to build/create/generate a durable artifact.
- Choose genui when the user asks for data visualization, dashboards, charts, analytics, or interactive widgets.
- Choose chat for everything else — when in doubt, choose chat.
- Ignore assistant capabilities; classify only user intent.

Return strict JSON only:
{"intent":"chat|artifact_create|genui","confidence":0.0,"reason":"short reason"}`;

function buildClassifierPrompt({ prompt, recentHistory }) {
	const historyLines = Array.isArray(recentHistory)
		? recentHistory
				.slice(-6)
				.map((msg) => {
					const role = msg?.role === "assistant" ? "Assistant" : "User";
					const content = getNonEmptyString(msg?.content);
					return content ? `${role}: ${content}` : null;
				})
				.filter(Boolean)
		: [];

	return [
		"Conversation context:",
		historyLines.length > 0 ? historyLines.join("\n") : "(none)",
		"",
		`Latest user request: ${prompt}`,
		"",
		"Return JSON only.",
	].join("\n");
}

const VALID_INTENTS = new Set(["chat", "artifact_create", "genui"]);

function parseClassifierResponse(rawText) {
	const text = getNonEmptyString(rawText);
	if (!text) {
		return null;
	}

	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return null;
		}
		try {
			parsed = JSON.parse(jsonMatch[0]);
		} catch {
			return null;
		}
	}

	if (!parsed || typeof parsed !== "object") {
		return null;
	}

	const rawIntent = getNonEmptyString(parsed.intent)?.toLowerCase();
	const intent = VALID_INTENTS.has(rawIntent) ? rawIntent : null;
	if (!intent) {
		return null;
	}

	const confidence =
		typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
			? Math.max(0, Math.min(1, parsed.confidence))
			: null;
	const reason = getNonEmptyString(parsed.reason);

	return { intent, confidence, reason };
}

function createTimeoutError() {
	const err = new Error("routing-classifier-timeout");
	err.code = "ROUTING_CLASSIFIER_TIMEOUT";
	return err;
}

function withTimeout(operation, timeoutMs) {
	const effective =
		typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
			? timeoutMs
			: ROUTING_CLASSIFIER_TIMEOUT_MS;

	return new Promise((resolve, reject) => {
		const abortController = new AbortController();
		let settled = false;

		const settle = (cb, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			cb(value);
		};

		const timer = setTimeout(() => {
			abortController.abort();
			settle(reject, createTimeoutError());
		}, effective);

		Promise.resolve()
			.then(() => operation({ signal: abortController.signal }))
			.then((value) => settle(resolve, value))
			.catch((error) => settle(reject, error));
	});
}

/**
 * Main entry point — two-layer routing classifier.
 *
 * Layer 1 (fast path) runs deterministic regex checks synchronously.
 * Layer 2 (LLM) is invoked only when the fast path returns null.
 *
 * @param {RoutingContext} context
 * @param {Object} [options]
 * @param {Function} [options.classify] — async function({ system, prompt, signal }) => string
 * @param {number}   [options.timeoutMs] — LLM call timeout in ms (default by origin, see resolveRoutingClassifierTimeoutMs)
 * @returns {Promise<RoutingDecision>}
 */
async function resolveRoutingDecision(context, { classify, timeoutMs } = {}) {
	const origin = context?.origin === "voice" ? "voice" : "text";
	const effectiveTimeoutMs = timeoutMs ?? resolveRoutingClassifierTimeoutMs(origin);
	const confidenceThreshold = origin === "voice" ? 0.8 : 0.7;

	// Layer 1 — deterministic fast path
	const fastResult = resolveRoutingDecisionFastPath(context);
	if (fastResult) {
		return fastResult;
	}

	// Layer 2 — LLM classifier
	if (typeof classify !== "function") {
		// No LLM available — safe fallback to chat
		return {
			intent: "chat",
			presentation: "text",
			confidence: 0,
			reason: "no_classifier",
			origin,
		};
	}

	const prompt = getNonEmptyString(context?.prompt) || "";

	try {
		const rawOutput = await withTimeout(
			({ signal }) =>
				classify({
					system: CLASSIFIER_SYSTEM_PROMPT,
					prompt: buildClassifierPrompt({
						prompt,
						recentHistory: context?.recentHistory,
					}),
					signal,
				}),
			effectiveTimeoutMs,
		);

		const parsed = parseClassifierResponse(rawOutput);
		if (!parsed) {
			return {
				intent: "chat",
				presentation: "text",
				confidence: 0,
				reason: "unparseable_response",
				origin,
			};
		}

		// Apply confidence threshold — below threshold defaults to chat
		const confidence = parsed.confidence ?? 0;
		if (confidence < confidenceThreshold && parsed.intent !== "chat") {
			return {
				intent: "chat",
				presentation: "text",
				confidence,
				reason: `below_threshold:${parsed.reason || "low_confidence"}`,
				origin,
			};
		}

		return {
			intent: parsed.intent,
			presentation: presentationForIntent(parsed.intent),
			confidence,
			reason: parsed.reason || "llm_classification",
			origin,
		};
	} catch {
		// D3 / D19: never throw — fallback to chat on any error
		return {
			intent: "chat",
			presentation: "text",
			confidence: 0,
			reason: "classifier_error",
			origin,
		};
	}
}

module.exports = {
	ROUTING_CLASSIFIER_TIMEOUT_MS,
	VOICE_ROUTING_CLASSIFIER_TIMEOUT_MS,
	resolveRoutingClassifierTimeoutMs,
	resolveRoutingDecision,
	resolveRoutingDecisionFastPath,
	// Exported for testing
	CLASSIFIER_SYSTEM_PROMPT,
	parseClassifierResponse,
	presentationForIntent,
};
