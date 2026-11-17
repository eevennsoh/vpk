"use strict";

// Streamed text through the composed turn runner on ordinary turns: spec and media fence text stays
// off the wire however Rovo chunks it, and a loading marker split across chunks reads its whole type.

const assert = require("node:assert/strict");
const { before, test } = require("node:test");
const { loadAiSdk } = require("../lib/ai-sdk-runtime");
const { isClassifierIntentLeakCandidate, parseClassifierIntentPayload } = require("./classifier-intent");
const { splitDirectMediaTextForStreaming } = require("../lib/direct-media-fence");
const { splitSpecFenceTextForStreaming } = require("../lib/tool-output-sanitizer");
const {
	BUSY_NOTICE,
	endsWithTurnComplete,
	failingAfterChunks,
	runTurn,
	visibleText,
	widgetParts,
} = require("./rovo-chat-turn.fixture");

before(async () => { await loadAiSdk(); });

// The fixture passes text through; these are the production splitters and classifier checks.
const PRODUCTION_TEXT_FILTERS = {
	isClassifierIntentLeakCandidate,
	parseClassifierIntentPayload,
	splitDirectMediaTextForStreaming,
	splitSpecFenceTextForStreaming,
};

function streamingChunks(chunks) {
	return {
		...PRODUCTION_TEXT_FILTERS,
		streamViaRovo: async ({ onPortAcquired, onTextDelta }) => {
			onPortAcquired(43123);
			for (const chunk of chunks) {
				onTextDelta(chunk);
			}
		},
	};
}

test("a fence that opens after text keeps its later chunks off the wire on a successful turn", async () => {
	// The marker stream holds back a possible marker start, so the controller sees the opener split
	// ("Intro\n``", then "`spec…"). Before: the wire got 'Intro\n```spec\n{"root":"card"'.
	for (const chunks of [
		['Intro\n```spec\n{"root":', '"card"'],
		['Intro\n```image\n{"prompt":', '"A lighthouse"'],
	]) {
		const turn = await runTurn(streamingChunks(chunks));

		assert.equal(visibleText(turn.parts), "Intro\n", JSON.stringify(chunks));
		assert.equal(turn.endOfTurnFacts.assistantText, chunks.join(""), JSON.stringify(chunks));
		assert.equal(endsWithTurnComplete(turn.parts), true);
	}
});

test("a complete fence between paragraphs leaves the paragraphs on the wire, however Rovo chunks it", async () => {
	const reply = 'First.\n\n```spec\n{"root":"card"}\n```\n\nSecond.';
	for (const chunks of [[reply], [...reply], [reply.slice(0, 10), reply.slice(10, 20), reply.slice(20)]]) {
		const turn = await runTurn(streamingChunks(chunks));

		assert.equal(visibleText(turn.parts), "First.\n\nSecond.", JSON.stringify(chunks));
		assert.equal(turn.endOfTurnFacts.assistantText, reply, JSON.stringify(chunks));
	}
});

test("a failure notice after a fence that followed text drops the whole fence", async () => {
	// Before: the fence's later chunks went out and the turn's text kept the open fence:
	// 'Intro\n```spec\n{"root":"card"\n\n⚠️ Rovo is busy.'.
	for (const chunks of [
		['Intro\n```spec\n{"root":', '"card"'],
		['Intro\n```image\n{"prompt":', '"A lighthouse"'],
	]) {
		const turn = await runTurn(failingAfterChunks(chunks, PRODUCTION_TEXT_FILTERS));

		assert.equal(visibleText(turn.parts), `Intro\n\n${BUSY_NOTICE}`, JSON.stringify(chunks));
		assert.equal(turn.endOfTurnFacts.assistantText, `Intro\n\n${BUSY_NOTICE}`, JSON.stringify(chunks));
		assert.equal(endsWithTurnComplete(turn.parts), true);
	}
});

test("a loading marker split inside its type starts loading the whole type", async () => {
	// The same turn as one unsplit "WIDGET_LOADING:plan\n". Before: the turn started loading a "pl"
	// widget and showed "an\nPlanning text".
	const turn = await runTurn(streamingChunks(["WIDGET_LOADING:pl", "an\n", "Planning text"]));

	assert.deepEqual(widgetParts(turn.parts, "plan"), ["loading:true", "loading:false", "error"]);
	assert.deepEqual(widgetParts(turn.parts, "pl"), []);
	assert.equal(visibleText(turn.parts), "Planning text");
	assert.equal(turn.endOfTurnFacts.assistantText, "Planning text");
	assert.equal(endsWithTurnComplete(turn.parts), true);
});
