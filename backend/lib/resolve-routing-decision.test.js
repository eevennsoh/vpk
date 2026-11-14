const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
	ROUTING_CLASSIFIER_TIMEOUT_MS,
	resolveRoutingDecision,
	resolveRoutingDecisionFastPath,
	parseClassifierResponse,
	presentationForIntent,
} = require("./resolve-routing-decision");

function makeMockClassify(response) {
	return async () => JSON.stringify(response);
}

function makeSlowClassify(delayMs, response) {
	return async () => {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
		return JSON.stringify(response);
	};
}

function makeFailingClassify(error) {
	return async () => {
		throw error || new Error("classify_failed");
	};
}

describe("presentationForIntent", () => {
	it("maps chat → text", () => {
		assert.equal(presentationForIntent("chat"), "text");
	});

	it("maps artifact_create → artifact_preview", () => {
		assert.equal(presentationForIntent("artifact_create"), "artifact_preview");
	});

	it("maps artifact_update → artifact_preview", () => {
		assert.equal(presentationForIntent("artifact_update"), "artifact_preview");
	});

	it("maps genui → genui_card", () => {
		assert.equal(presentationForIntent("genui"), "genui_card");
	});
});

describe("parseClassifierResponse", () => {
	it("parses valid JSON", () => {
		const result = parseClassifierResponse('{"intent":"genui","confidence":0.9,"reason":"chart request"}');
		assert.equal(result.intent, "genui");
		assert.equal(result.confidence, 0.9);
		assert.equal(result.reason, "chart request");
	});

	it("extracts JSON from surrounding text", () => {
		const result = parseClassifierResponse('Here is my answer: {"intent":"chat","confidence":0.8,"reason":"conversational"}');
		assert.equal(result.intent, "chat");
	});

	it("returns null for invalid JSON", () => {
		assert.equal(parseClassifierResponse("not json at all"), null);
	});
});

describe("resolveRoutingDecisionFastPath", () => {
	it("returns chat for empty prompt", () => {
		const result = resolveRoutingDecisionFastPath({ prompt: "" });
		assert.equal(result.intent, "chat");
		assert.equal(result.reason, "empty_prompt");
	});

	it("returns chat for whitespace-only prompt", () => {
		const result = resolveRoutingDecisionFastPath({ prompt: "   " });
		assert.equal(result.intent, "chat");
	});

	it("preserves deterministic active artifact routing", () => {
		const result = resolveRoutingDecisionFastPath({
			prompt: "hello",
			activeArtifact: { id: "doc_1", title: "Login", kind: "code" },
		});
		assert.equal(result.intent, "artifact_update");
		assert.equal(result.reason, "active_artifact");
	});

	it("keeps Studio agent creation prompts out of artifact routing", () => {
		const result = resolveRoutingDecisionFastPath({
			prompt: "Build a code review agent that checks diffs for regressions",
			creationMode: "agent",
		});
		assert.equal(result.intent, "chat");
		assert.equal(result.presentation, "text");
		assert.equal(result.reason, "agent_creation_mode");
	});

	it("returns artifact_create for document verb + noun match", () => {
		const result = resolveRoutingDecisionFastPath({ prompt: "create a product brief about Watermelon" });
		assert.equal(result.intent, "artifact_create");
		assert.equal(result.reason, "document_verb_noun_match");
	});

	it("returns artifact_create for various verb + noun combinations", () => {
		const prompts = [
			"write a spec for the login flow",
			"draft a proposal for the new feature",
			"generate a summary of the meeting",
			"build a login page",
			"create a memo about the incident",
		];
		for (const prompt of prompts) {
			const result = resolveRoutingDecisionFastPath({ prompt });
			assert.equal(result.intent, "artifact_create", `Expected artifact_create for: "${prompt}"`);
		}
	});

	it("returns genui for explicit visualization requests without a verb", () => {
		const prompts = [
			"a small bar chart",
			"Make me a pie chart of fruit sales",
			"show a dashboard of open incidents",
			"plot revenue as a line graph",
			"visualize sign-ups by week",
			"can you draw a heatmap of commits?",
		];
		for (const prompt of prompts) {
			const result = resolveRoutingDecisionFastPath({ prompt });
			assert.equal(result?.intent, "genui", `Expected genui for: "${prompt}"`);
			assert.equal(result.presentation, "genui_card");
			assert.equal(result.reason, "visualization_noun_match");
		}
	});

	it("leaves visualization questions and ambiguous graph/plot wording to the classifier", () => {
		const prompts = [
			"what is a bar chart?",
			"Explain the difference between a histogram and a bar chart",
			"how do I read this dashboard",
			"tell me the plot of Hamlet",
			"teach me graph theory",
		];
		for (const prompt of prompts) {
			assert.equal(resolveRoutingDecisionFastPath({ prompt }), null, `Expected null for: "${prompt}"`);
		}
	});

	it("keeps document requests that mention a chart on the artifact path", () => {
		const result = resolveRoutingDecisionFastPath({ prompt: "write a report with a bar chart of Q3 sales" });
		assert.equal(result.intent, "artifact_create");
	});

	it("keeps active-artifact chart edits as artifact updates", () => {
		const result = resolveRoutingDecisionFastPath({
			prompt: "add a bar chart",
			activeArtifact: { id: "doc_1", title: "Report", kind: "text" },
		});
		assert.equal(result.intent, "artifact_update");
	});

	it("returns null for prompts without document verb + noun pattern", () => {
		assert.equal(resolveRoutingDecisionFastPath({ prompt: "hello" }), null);
		assert.equal(resolveRoutingDecisionFastPath({ prompt: "show Q3 revenue" }), null);
		assert.equal(resolveRoutingDecisionFastPath({ prompt: "what is the weather" }), null);
	});
});

describe("resolveRoutingDecision", () => {
	it("uses fast path for empty prompts", async () => {
		const result = await resolveRoutingDecision({ prompt: "" });
		assert.equal(result.intent, "chat");
		assert.equal(result.presentation, "text");
	});

	it("uses fast path for activeArtifact", async () => {
		const result = await resolveRoutingDecision({
			prompt: "make the button red",
			activeArtifact: { id: "doc_1", title: "Login", kind: "code" },
		});
		assert.equal(result.intent, "artifact_update");
		assert.equal(result.presentation, "artifact_preview");
	});

	it("uses fast path for document verb + noun prompts without needing classifier", async () => {
		const result = await resolveRoutingDecision({ prompt: "build a login page" });
		assert.equal(result.intent, "artifact_create");
		assert.equal(result.reason, "document_verb_noun_match");
	});

	it("accepts LLM chat classifications", async () => {
		const result = await resolveRoutingDecision(
			{ prompt: "hello" },
			{ classify: makeMockClassify({ intent: "chat", confidence: 0.95, reason: "conversational" }) },
		);
		assert.equal(result.intent, "chat");
		assert.equal(result.presentation, "text");
	});

	it("accepts LLM artifact classifications for ambiguous prompts", async () => {
		const result = await resolveRoutingDecision(
			{ prompt: "I need a new landing experience for onboarding" },
			{ classify: makeMockClassify({ intent: "artifact_create", confidence: 0.9, reason: "wants_to_build" }) },
		);
		assert.equal(result.intent, "artifact_create");
		assert.equal(result.presentation, "artifact_preview");
		assert.equal(result.confidence, 0.9);
	});

	it("accepts LLM genui classifications", async () => {
		const result = await resolveRoutingDecision(
			{ prompt: "show Q3 revenue" },
			{ classify: makeMockClassify({ intent: "genui", confidence: 0.9, reason: "visualization" }) },
		);
		assert.equal(result.intent, "genui");
		assert.equal(result.presentation, "genui_card");
	});

	it("falls back to chat when LLM confidence is below threshold", async () => {
		const result = await resolveRoutingDecision(
			{ prompt: "I need something for tracking tasks" },
			{ classify: makeMockClassify({ intent: "artifact_create", confidence: 0.5, reason: "uncertain" }) },
		);
		assert.equal(result.intent, "chat");
		assert.ok(result.reason.startsWith("below_threshold"));
	});

	it("uses higher threshold for voice origin", async () => {
		const result = await resolveRoutingDecision(
			{ prompt: "I need something for tracking tasks", origin: "voice" },
			{ classify: makeMockClassify({ intent: "artifact_create", confidence: 0.75, reason: "might_build" }) },
		);
		assert.equal(result.intent, "chat");
		assert.equal(result.origin, "voice");
	});

	it("accepts voice classification above voice threshold", async () => {
		const result = await resolveRoutingDecision(
			{ prompt: "I need something for tracking tasks", origin: "voice" },
			{ classify: makeMockClassify({ intent: "artifact_create", confidence: 0.85, reason: "build_request" }) },
		);
		assert.equal(result.intent, "artifact_create");
		assert.equal(result.origin, "voice");
	});

	it("falls back to chat on LLM timeout", async () => {
		const result = await resolveRoutingDecision(
			{ prompt: "something ambiguous" },
			{ classify: makeSlowClassify(200, { intent: "genui", confidence: 0.9 }), timeoutMs: 50 },
		);
		assert.equal(result.intent, "chat");
		assert.equal(result.reason, "classifier_error");
	});

	it("waits long enough by default for a classifier that answers in about 3 seconds", async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const pending = resolveRoutingDecision(
			{ prompt: "show me revenue by quarter" },
			{ classify: makeSlowClassify(3000, { intent: "genui", confidence: 0.95, reason: "visualization" }) },
		);
		for (let elapsed = 0; elapsed < 3000; elapsed += 100) {
			await Promise.resolve();
			t.mock.timers.tick(100);
		}
		const result = await pending;
		assert.ok(ROUTING_CLASSIFIER_TIMEOUT_MS > 3000);
		assert.equal(result.intent, "genui");
		assert.equal(result.reason, "visualization");
	});

	it("falls back to chat on LLM error", async () => {
		const result = await resolveRoutingDecision(
			{ prompt: "something ambiguous" },
			{ classify: makeFailingClassify(new Error("API down")) },
		);
		assert.equal(result.intent, "chat");
		assert.equal(result.reason, "classifier_error");
	});

	it("falls back to chat on unparseable LLM response", async () => {
		const result = await resolveRoutingDecision(
			{ prompt: "something ambiguous" },
			{ classify: async () => "I don't understand the question" },
		);
		assert.equal(result.intent, "chat");
		assert.equal(result.reason, "unparseable_response");
	});
});
