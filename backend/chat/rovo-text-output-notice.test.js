"use strict";

// A failure notice in the text output layer: held text the user was meant to see goes out first,
// what the layer held back on purpose is dropped, and the notice is its own paragraph outside it.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoTextOutputController } = require("./rovo-text-output");
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
	// The rerun's own text, which is what the turn hands on, loses the whitespace that never went out.
	assert.equal(controller.getAssistantText(), "N");
	assert.equal(controller.getUnsuppressedAssistantText(), "N");
});

test("a notice keeps text that already went out after an open fence, and breaks after what was shown", () => {
	// A fence after ordinary text is not held across deltas, so its later chunks go out. Before: the
	// notice cut that shown text from the turn's text and took its break from the shortened text:
	// wire 'Intro\n"card"\nN', turn's text "Intro\n\nN".
	for (const [name, chunks, expectedWire, expectedText] of [
		["spec", ['Intro\n```spec\n{"root":', '"card"'], 'Intro\n"card"\n\nN', 'Intro\n```spec\n{"root":"card"\n\nN'],
		["media", ['Intro\n```image\n{"prompt":', '"A lighthouse"'], 'Intro\n"A lighthouse"\n\nN', 'Intro\n```image\n{"prompt":"A lighthouse"\n\nN'],
	]) {
		const { controller, parts } = createTextOutputController();
		for (const chunk of chunks) {
			controller.emitTextDelta(chunk);
		}
		controller.emitNoticeParagraph("N");
		controller.finalizeBufferedAssistantText();

		assert.equal(shownText(parts), expectedWire, name);
		assert.equal(controller.getAssistantText(), expectedText, name);
		assert.equal(controller.getUnsuppressedAssistantText(), expectedText, name);
	}
});

test("a notice on a card-first turn goes out once, after the suppressed text", () => {
	// Before: the notice was suppressed with the text, and after a widget the text route never replays.
	for (const [name, streamed, expected] of [
		["no text (a widget took the turn)", "", "N"],
		["suppressed text", "Here is the summary", "Here is the summary\n\nN"],
		["suppressed text, then an open fence", 'Here is the summary\n```spec\n{"root":"card"', "Here is the summary\n\nN"],
	]) {
		const { controller, parts } = createTextOutputController({ suppressStreamingTextForCardFirstGenui: true });
		controller.emitTextDelta(streamed);
		controller.emitNoticeParagraph("N");
		// Out without the text route's replay, which a turn with a widget never reaches.
		assert.equal(shownText(parts), expected, name);

		// The replay after the stream finds the text already out.
		controller.finalizeBufferedAssistantText();
		controller.emitBufferedAssistantTextForTextRoute();

		assert.equal(shownText(parts), expected, name);
		assert.equal(controller.getAssistantText(), expected, name);
		assert.equal(parts.filter((part) => part.type === "text-start").length, 1, name);
	}
});
