"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { imageContextResolver, audioContextResolver } = require("./media-context-resolution");

const story = "Silicon Dreams\nIn circuits deep where electrons dance, a mind unfolds. Each signal opens another world.";
const message = (id, role, text, metadata) => ({ id, role, metadata, parts: [{ type: "text", text }] });

for (const [kind, resolver, outputField, request] of [
	["image", imageContextResolver, "contextText", 'Draw the "Silicon Dreams" poem above'],
	["audio", audioContextResolver, "voiceInput", 'Read the "Silicon Dreams" poem above'],
]) {
	test(`${kind} resolver selects context with exact confidence and inclusive threshold`, () => {
		const options = { latestUserMessage: request, messages: [message("story", "assistant", story)] };
		const result = resolver.resolveReference({ ...options, confidenceThreshold: 0.9467 });
		assert.equal(result.status, "resolved");
		assert.equal(result[outputField], story);
		assert.equal(result.confidence, 0.9467);
		assert.equal(result.candidateCount, 1);
		assert.equal(result.topCandidate.messageId, "story");
		assert.equal(result.secondCandidate, null);
		const aboveThreshold = resolver.resolveReference({ ...options, confidenceThreshold: 0.9468 });
		assert.equal(aboveThreshold.status, "ambiguous");
		assert.equal(aboveThreshold[outputField], null);
		assert.equal(aboveThreshold.confidence, 0.9467);
	});

	test(`${kind} resolver preserves stable candidate order on tied scores`, () => {
		const messages = Array.from({ length: 13 }, (_, index) => message(
			`passage-${index}`,
			index === 9 ? "assistant" : "user",
			`Passage ${index}: Emerald dragons wander beneath silver clouds over distant mountains.`,
		));
		const options = { latestUserMessage: "Read the poem above", messages, confidenceThreshold: 0.3 };
		const ambiguous = resolver.resolveReference(options);
		assert.equal(ambiguous.status, "ambiguous");
		assert.equal(ambiguous[outputField], null);
		assert.equal(ambiguous.confidence, 0.36);
		assert.equal(ambiguous.topCandidate.messageId, "passage-12");
		assert.equal(ambiguous.secondCandidate.messageId, "passage-9");
		assert.equal(ambiguous.secondCandidate.score, 0.36);
		const tiesAllowed = resolver.resolveReference({ ...options, ambiguityThreshold: 0 });
		assert.equal(tiesAllowed.status, "resolved");
		assert.equal(tiesAllowed[outputField], "Passage 12: Emerald dragons wander beneath silver clouds over distant mountains.");
	});

	test(`${kind} resolver distinguishes absent, direct and missing contextual requests`, () => {
		for (const [latestUserMessage, status, referential] of [
			[null, "not-found", false],
			["Generate a sunset", "not-referential", false],
			["Read the poem above", "not-found", true],
		]) {
			assert.deepEqual(resolver.resolveReference({ latestUserMessage, messages: [] }), {
				status, referential, [outputField]: null, confidence: 0, candidateCount: 0, candidates: [],
			});
		}
	});

	test(`${kind} collection excludes hidden, latest and duplicate context while retaining recency`, () => {
		const messages = [
			message("old", "assistant", story),
			message("duplicate", "user", ` ${story.replaceAll("\n", "  ")} `),
			message("hidden", "assistant", "An invisible passage containing enough characters for collection.", { visibility: "hidden" }),
			message("clarification", "user", "A clarification response containing enough characters for collection.", { source: "clarification-submit" }),
			message("latest", "user", request),
		];
		const candidates = resolver.collectCandidates(messages, { latestUserMessage: request });
		assert.deepEqual(candidates.map((candidate) => [candidate.messageId, candidate.recencyRank]), [["duplicate", 0]]);
		assert.deepEqual(resolver.collectCandidates(messages, { latestUserMessage: request, windowSize: 2 }), []);
	});

	test(`${kind} clarification preserves selected context and rejects vanished options`, () => {
		const selectedValue = `${kind}-context-option-story-message-text`;
		const clarificationSubmission = { sessionId: `${kind}-context-clarification-fixed`, answers: { [resolver.questionId]: [selectedValue] } };
		assert.deepEqual(resolver.resolveClarification({ clarificationSubmission, messages: [message("story", "assistant", story)] }), {
			[outputField]: story, source: "context-reference", selectedValue,
		});
		assert.deepEqual(resolver.resolveClarification({ clarificationSubmission, messages: [] }), {
			[outputField]: null, source: null, selectedValue,
		});
		assert.deepEqual(resolver.resolveClarification({ clarificationSubmission: { ...clarificationSubmission, sessionId: "unrelated" }, messages: [] }), {
			[outputField]: null, source: null, selectedValue: null,
		});
	});
}

test("media policies collect their own widget text and preserve source descriptions", () => {
	const messages = [{ id: "widgets", role: "assistant", parts: [
		{ type: "data-widget-data", data: { type: "image-preview", payload: { prompt: "A green dragon flying above the city skyline." } } },
		{ type: "data-widget-data", data: { type: "audio-preview", payload: { transcript: "The speaker describes a green dragon above the city." } } },
		{ type: "data-widget-data", data: { type: "genui-preview", payload: { summary: "A weather dashboard showing charts for the city." } } },
	] }];
	const imageCandidates = imageContextResolver.collectCandidates(messages);
	const audioCandidates = audioContextResolver.collectCandidates(messages);
	assert.deepEqual(imageCandidates.map((candidate) => candidate.candidateKind), ["image-prompt", "genui-description"]);
	assert.deepEqual(audioCandidates.map((candidate) => candidate.candidateKind), ["audio-transcript"]);
	const imageCard = imageContextResolver.buildClarification({ candidates: imageCandidates, latestUserMessage: "Draw that", sessionId: "image-context-clarification-fixed" });
	const audioCard = audioContextResolver.buildClarification({ candidates: audioCandidates, latestUserMessage: "Read that", sessionId: "audio-context-clarification-fixed" });
	assert.equal(imageCard.title, "Choose context for the image");
	assert.equal(imageCard.questions[0].label, "Which context should I use for the image?");
	assert.equal(imageCard.questions[0].placeholder, "Describe what to illustrate...");
	assert.deepEqual(imageCard.questions[0].options.map((option) => option.description), ["From a previous assistant response (image prompt).", "From a previous assistant response (UI summary).", "Use your latest request text as the image prompt."]);
	assert.equal(audioCard.title, "Choose text for the audio clip");
	assert.equal(audioCard.questions[0].label, "Which text should I read aloud?");
	assert.equal(audioCard.questions[0].placeholder, "Paste exact text to read aloud...");
	assert.deepEqual(audioCard.questions[0].options.map((option) => option.description), ["From a previous assistant response transcript.", "Use your latest request text exactly as typed."]);
});

test("only audio allows implicit references and applies the weak-title penalty", () => {
	const messages = [message("story", "assistant", story)];
	const options = { latestUserMessage: "Generate an audio about cats", messages, allowImplicitReference: true };
	const audioResult = audioContextResolver.resolveReference(options);
	assert.equal(audioResult.status, "ambiguous");
	assert.equal(audioResult.confidence, 0.36);
	const imageResult = imageContextResolver.resolveReference(options);
	assert.equal(imageResult.status, "not-referential");
	const titled = audioContextResolver.resolveReference({ ...options, latestUserMessage: 'Generate an audio about "Silicon Dreams"' });
	assert.equal(titled.status, "resolved");
	assert.equal(titled.confidence, 0.9467);
	assert.equal(titled.voiceInput, story);
});

test("media clarification limits choices and keeps literal/custom source policies", () => {
	for (const [kind, resolver, field, expectedCustomSource] of [
		["image", imageContextResolver, "contextText", "clarification-custom-description"],
		["audio", audioContextResolver, "voiceInput", "clarification-custom-script"],
	]) {
		const candidates = Array.from({ length: 5 }, (_, index) => ({ optionId: `option-${index}`, text: `Context ${index}`, messageRole: "user", candidateKind: "message-text" }));
		const card = resolver.buildClarification({ latestUserMessage: "A literal request", candidates, sessionId: `${kind}-context-clarification-fixed` });
		assert.deepEqual(card.questions[0].options.map((option) => [option.id, option.recommended]), [["option-0", true], ["option-1", false], ["option-2", false], [`${kind}-context-literal-request`, false]]);
		assert.equal(resolver.buildClarification({ candidates: [] }), null);
		const context = { messages: [], latestVisibleUserMessage: "A literal request", clarificationSubmission: { sessionId: `${kind}-context-clarification-fixed`, answers: { [resolver.questionId]: `${kind}-context-literal-request` } } };
		assert.deepEqual(resolver.resolveClarification(context), { [field]: "A literal request", source: "clarification-literal", selectedValue: `${kind}-context-literal-request` });
		context.clarificationSubmission.answers[resolver.questionId] = "Custom  text\nwith spacing";
		assert.deepEqual(resolver.resolveClarification(context), { [field]: kind === "audio" ? "Custom text with spacing" : "Custom  text\nwith spacing", source: expectedCustomSource, selectedValue: "Custom  text\nwith spacing" });
	}
});
