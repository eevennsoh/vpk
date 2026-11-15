const test = require("node:test");
const assert = require("node:assert/strict");

const {
	buildRovoAppArtifactIntentPrompt,
	fallbackRovoAppArtifactIntent,
	normalizeArtifactKind,
	parseRovoAppArtifactIntent,
	resolveFastRovoAppArtifactIntent,
} = require("./rovo-app-artifact-intent");

test("parseRovoAppArtifactIntent normalizes createDocument payload", () => {
	const parsed = parseRovoAppArtifactIntent(
		JSON.stringify({
			action: "createDocument",
			title: "Robot Gardening Memo",
			kind: "text",
		}),
	);

	assert.deepEqual(parsed, {
		action: "createDocument",
		title: "Robot Gardening Memo",
		kind: "text",
		cancelStreaming: null,
	});
});

test("parseRovoAppArtifactIntent falls back to chat when update lacks active artifact", () => {
	const parsed = parseRovoAppArtifactIntent(
		JSON.stringify({
			action: "updateDocument",
			title: "New title",
			kind: "code",
		}),
	);

	assert.deepEqual(parsed, {
		action: "chat",
		title: null,
		kind: null,
		cancelStreaming: null,
	});
});

test("fallbackRovoAppArtifactIntent handles explicit artifact follow-up", () => {
	const parsed = fallbackRovoAppArtifactIntent({
		activeArtifact: {
			id: "doc-1",
			title: "Robot Gardening Memo",
			kind: "text",
		},
		latestUserMessage: "create an artifact about it",
	});

	assert.equal(parsed.action, "updateDocument");
	assert.equal(parsed.title, "Robot Gardening Memo");
	assert.equal(parsed.kind, "text");
	assert.equal(parsed.cancelStreaming, null);
});

test("fallbackRovoAppArtifactIntent biases voice steering toward updating the current artifact", () => {
	const parsed = fallbackRovoAppArtifactIntent({
		activeArtifact: {
			id: "doc-1",
			title: "Robot Gardening Memo",
			kind: "text",
		},
		artifactSteering: {
			source: "voice",
			preferCurrentArtifact: true,
		},
		latestUserMessage: "make this more concise and energetic",
	});

	assert.equal(parsed.action, "updateDocument");
	assert.equal(parsed.title, "Robot Gardening Memo");
	assert.equal(parsed.kind, "text");
});

test("fallbackRovoAppArtifactIntent still allows explicit new artifacts during voice steering", () => {
	const parsed = fallbackRovoAppArtifactIntent({
		activeArtifact: {
			id: "doc-1",
			title: "Robot Gardening Memo",
			kind: "text",
		},
		artifactSteering: {
			source: "voice",
			preferCurrentArtifact: true,
		},
		latestUserMessage: "create a new artifact with three alternate headlines",
	});

	assert.equal(parsed.action, "createDocument");
	assert.equal(parsed.kind, "text");
});

test("fallbackRovoAppArtifactIntent keeps same-artifact transformations as updates", () => {
	const parsed = fallbackRovoAppArtifactIntent({
		activeArtifact: {
			id: "doc-1",
			title: "About Orange",
			kind: "text",
		},
		latestUserMessage: "Can you turn it into a report?",
	});

	assert.equal(parsed.action, "updateDocument");
	assert.equal(parsed.title, "About Orange");
	assert.equal(parsed.kind, "text");
});

test("fallbackRovoAppArtifactIntent keeps title-addition follow-ups on the same artifact", () => {
	const parsed = fallbackRovoAppArtifactIntent({
		activeArtifact: {
			id: "doc-1",
			title: "Apple",
			kind: "text",
		},
		latestUserMessage: "Can you add the title about this page?",
	});

	assert.equal(parsed.action, "updateDocument");
	assert.equal(parsed.title, "Apple");
	assert.equal(parsed.kind, "text");
});

test("fallbackRovoAppArtifactIntent carries rename targets into updateDocument titles", () => {
	const parsed = fallbackRovoAppArtifactIntent({
		activeArtifact: {
			id: "doc-1",
			title: "Apple",
			kind: "text",
		},
		latestUserMessage: "Change the title to Apple Future",
	});

	assert.equal(parsed.action, "updateDocument");
	assert.equal(parsed.title, "Apple Future");
	assert.equal(parsed.kind, "text");
});

test("fallbackRovoAppArtifactIntent does not reuse the current artifact title for new artifacts", () => {
	const parsed = fallbackRovoAppArtifactIntent({
		activeArtifact: {
			id: "doc-1",
			title: "orange big orange",
			kind: "text",
		},
		latestUserMessage: "Create a page about Apple",
	});

	assert.equal(parsed.action, "createDocument");
	assert.equal(parsed.title, null);
	assert.equal(parsed.kind, "code");
});

test("fallbackRovoAppArtifactIntent classifies page requests as code artifacts", () => {
	const parsed = fallbackRovoAppArtifactIntent({
		activeArtifact: {
			id: "doc-1",
			title: "orange juice",
			kind: "text",
		},
		latestUserMessage: "Create me a page about Apple",
	});

	assert.equal(parsed.action, "createDocument");
	assert.equal(parsed.kind, "code");
});

test("resolveFastRovoAppArtifactIntent no longer performs local artifact routing", () => {
	const parsed = resolveFastRovoAppArtifactIntent({
		activeArtifact: null,
		artifactSteering: null,
		latestUserMessage: "Create a product brief about Watermelon",
	});

	assert.equal(parsed, null);
});

test("resolveFastRovoAppArtifactIntent leaves ambiguous questions for model classification", () => {
	const parsed = resolveFastRovoAppArtifactIntent({
		activeArtifact: {
			id: "doc-1",
			title: "Watermelon",
			kind: "text",
		},
		artifactSteering: null,
		latestUserMessage: "Should this be shorter?",
	});

	assert.equal(parsed, null);
});

test("resolveFastRovoAppArtifactIntent does not bypass model classification for how-to questions", () => {
	const parsed = resolveFastRovoAppArtifactIntent({
		activeArtifact: null,
		artifactSteering: null,
		latestUserMessage: "How do I create a page about Watermelon?",
	});

	assert.equal(parsed, null);
});

test("normalizeArtifactKind maps spreadsheet aliases", () => {
	assert.equal(normalizeArtifactKind("spreadsheet"), "sheet");
	assert.equal(normalizeArtifactKind("table"), "sheet");
	assert.equal(normalizeArtifactKind("excalidraw"), "excalidraw");
	assert.equal(normalizeArtifactKind("html"), "html");
});

test("buildRovoAppArtifactIntentPrompt includes current artifact context", () => {
	const prompt = buildRovoAppArtifactIntentPrompt({
		activeArtifact: { id: "doc-1", title: "Memo", kind: "text" },
		artifactSteering: { source: "voice", preferCurrentArtifact: true },
		conversationHistory: [{ type: "user", content: "Write a memo." }],
		latestUserMessage: "Make it shorter.",
	});

	assert.match(prompt, /Current open artifact:/);
	assert.match(prompt, /Voice steering context:/);
	assert.match(prompt, /Latest user request:/);
});

test("buildRovoAppArtifactIntentPrompt includes streaming artifact context", () => {
	const prompt = buildRovoAppArtifactIntentPrompt({
		activeArtifact: null,
		conversationHistory: [],
		latestUserMessage: "Write a doc about Tesla",
		streamingArtifact: { id: "doc-2", title: "Apple Overview", kind: "text" },
	});

	assert.match(prompt, /An artifact is currently being generated:/);
	assert.match(prompt, /Apple Overview/);
	assert.match(prompt, /cancelStreaming/);
});

test("resolveFastRovoAppArtifactIntent defers streaming artifact edits to model classification", () => {
	const parsed = resolveFastRovoAppArtifactIntent({
		activeArtifact: null,
		artifactSteering: null,
		latestUserMessage: "Make it shorter",
		streamingArtifact: { id: "doc-1", title: "Apple Overview", kind: "text" },
	});

	assert.equal(parsed, null);
});

test("resolveFastRovoAppArtifactIntent defers new streaming artifact requests to model classification", () => {
	const parsed = resolveFastRovoAppArtifactIntent({
		activeArtifact: null,
		artifactSteering: null,
		latestUserMessage: "Write a document about Tesla",
		streamingArtifact: { id: "doc-1", title: "Apple Overview", kind: "text" },
	});

	assert.equal(parsed, null);
});

test("parseRovoAppArtifactIntent extracts cancelStreaming from LLM response when streaming artifact is present", () => {
	const parsed = parseRovoAppArtifactIntent(
		JSON.stringify({
			action: "updateDocument",
			title: "Apple Overview",
			kind: "text",
			cancelStreaming: true,
		}),
		{
			activeArtifact: null,
			streamingArtifact: { id: "doc-1", title: "Apple Overview", kind: "text" },
		},
	);

	assert.deepEqual(parsed, {
		action: "updateDocument",
		title: "Apple Overview",
		kind: "text",
		cancelStreaming: true,
	});
});

test("parseRovoAppArtifactIntent ignores cancelStreaming when no streaming artifact", () => {
	const parsed = parseRovoAppArtifactIntent(
		JSON.stringify({
			action: "updateDocument",
			title: "Apple Overview",
			kind: "text",
			cancelStreaming: true,
		}),
		{
			activeArtifact: { id: "doc-1", title: "Apple Overview", kind: "text" },
		},
	);

	assert.deepEqual(parsed, {
		action: "updateDocument",
		title: "Apple Overview",
		kind: "text",
		cancelStreaming: null,
	});
});

test("resolveFastRovoAppArtifactIntent returns null for conversational messages", () => {
	for (const message of ["hi", "hello", "hey there", "thanks", "ok", "sure", "good morning"]) {
		const parsed = resolveFastRovoAppArtifactIntent({
			activeArtifact: null,
			artifactSteering: null,
			latestUserMessage: message,
			streamingArtifact: null,
		});

		assert.equal(parsed, null, `Expected null for "${message}"`);
	}
});

test("fallbackRovoAppArtifactIntent keeps a document that mentions a table as text", () => {
	const parsed = fallbackRovoAppArtifactIntent({
		latestUserMessage:
			"Write a one-page document: Q3 launch brief with a short timeline table and a risks section",
	});
	assert.equal(parsed.action, "createDocument");
	assert.equal(parsed.kind, "text");
});
