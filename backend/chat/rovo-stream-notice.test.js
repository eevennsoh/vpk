"use strict";

// A failure notice in the text output layer: held text the user was meant to see goes out first,
// what the layer held back on purpose is dropped, and the notice is its own paragraph outside it.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoTextOutputController } = require("./rovo-stream");
const { splitDirectMediaTextForStreaming } = require("../lib/direct-media-fence");
const { splitSpecFenceTextForStreaming } = require("../lib/tool-output-sanitizer");

function createTextOutputController(options = {}) {
	const parts = [];
	const controller = createRovoTextOutputController({
		classifierJsonBufferMaxChars: 120,
		// Held text that opens like JSON or a fence is a classifier-leak candidate, as in production.
		isClassifierIntentLeakCandidate: (text) => /^\s*(?:\{|```)/u.test(text),
		parseClassifierIntentPayload: (text) => {
			try {
				const parsed = JSON.parse(text);
				return parsed && typeof parsed.intent === "string" ? parsed : null;
			} catch {
				return null;
			}
		},
		splitDirectMediaTextForStreaming,
		splitSpecFenceTextForStreaming,
		textId: "text-test",
		writer: { write: (part) => parts.push(part) },
		...options,
	});
	return { controller, parts };
}

function shownText(parts) {
	return parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join("");
}

test("a notice drops an open spec or media fence and is written outside it", () => {
	for (const [name, held, options, expected] of [
		// Before: the notice went into the held fence and was dropped with it ("").
		["an open spec fence", '```spec\n{"root":"card"', {}, "N"],
		["an open media fence", '```image\n{"prompt":"A lighthouse', {}, "N"],
		["an open spec fence on a deferred tool-first turn", '```spec\n{"root":"card"', { shouldDeferToolFirstText: true }, "N"],
		// Before: the wire got "Intro\n\n\nN" and the turn's text kept the open fence with the notice inside it.
		["text, then an open spec fence", 'Intro\n```spec\n{"root":"card"', {}, "Intro\n\nN"],
	]) {
		const { controller, parts } = createTextOutputController(options);
		controller.emitTextDelta(held);
		controller.emitNoticeParagraph("N");
		controller.flushDeferredToolFirstText();
		// The end-of-stream flush finds nothing more to write.
		controller.finalizeBufferedAssistantText();

		assert.equal(shownText(parts), expected, name);
		assert.equal(controller.getAssistantText(), expected, name);
		assert.equal(controller.getUnsuppressedAssistantText(), expected, name);
	}
});

test("a notice drops a held classifier payload and shows other held text", () => {
	// Before: the payload went out in front of the notice.
	const dropped = createTextOutputController();
	dropped.controller.emitTextDelta('{"intent":"chat","confidence":0.9}');
	dropped.controller.emitNoticeParagraph("N");
	assert.equal(shownText(dropped.parts), "N");
	assert.equal(dropped.controller.getAssistantText(), "N");

	// Held only because it opens like JSON: the user was meant to see it.
	const shown = createTextOutputController();
	shown.controller.emitTextDelta('{"example": true');
	shown.controller.emitNoticeParagraph("N");
	assert.equal(shownText(shown.parts), '{"example": true\n\nN');
	assert.equal(shown.controller.getAssistantText(), '{"example": true\n\nN');
});

test("a notice after a rerun drops the rerun's held whitespace", () => {
	// Before: "A\n\n  N".
	const { controller, parts } = createTextOutputController({ isClassifierIntentLeakCandidate: () => false });

	controller.emitTextDelta("A");
	controller.resetAssistantTextForRetryAttempt({ continuesShownText: true });
	controller.emitTextDelta("\n  ");
	controller.emitNoticeParagraph("N");

	assert.equal(shownText(parts), "A\n\nN");
});
