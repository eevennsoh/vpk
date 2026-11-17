"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoTextOutputController } = require("./rovo-text-output");

function createTextOutputController(options = {}) {
	const parts = [];
	const controller = createRovoTextOutputController({
		classifierJsonBufferMaxChars: 120,
		isClassifierIntentLeakCandidate: (text) => /^\s*\{/u.test(text),
		parseClassifierIntentPayload: (text) => {
			try {
				const parsed = JSON.parse(text);
				return parsed && typeof parsed.intent === "string" ? parsed : null;
			} catch {
				return null;
			}
		},
		splitDirectMediaTextForStreaming: (text) => ({
			pendingText: "",
			visibleText: text,
		}),
		splitSpecFenceTextForStreaming: (text) => ({
			pendingText: "",
			visibleText: text,
		}),
		textId: "text-test",
		writer: {
			write(part) {
				parts.push(part);
			},
		},
		...options,
	});
	return { controller, parts };
}

test("createRovoTextOutputController streams ordinary text and closes when started", () => {
	const { controller, parts } = createTextOutputController();

	controller.emitTextDelta("Hello");
	controller.emitTextDelta(" world");
	controller.writeTextEndIfStarted();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Hello" },
		{ type: "text-delta", id: "text-test", delta: " world" },
		{ type: "text-end", id: "text-test" },
	]);
	assert.equal(controller.getAssistantText(), "Hello world");
	assert.equal(controller.getUnsuppressedAssistantText(), "Hello world");
	assert.equal(controller.getTextStarted(), true);
});

test("createRovoTextOutputController buffers classifier-style JSON until finalization", () => {
	const { controller, parts } = createTextOutputController();

	controller.emitTextDelta('{"intent":"genui","confidence":0.9}');

	assert.deepEqual(parts, []);
	assert.equal(controller.getAssistantText(), '{"intent":"genui","confidence":0.9}');
	assert.deepEqual(controller.finalizeBufferedAssistantText(), {
		intent: "genui",
		confidence: 0.9,
	});
	assert.deepEqual(parts, []);
});

test("createRovoTextOutputController can replay suppressed card-first text", () => {
	const { controller, parts } = createTextOutputController({
		suppressStreamingTextForCardFirstGenui: true,
	});

	controller.emitTextDelta("Build the card");
	assert.deepEqual(parts, []);

	controller.emitBufferedAssistantTextForTextRoute();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Build the card" },
	]);
});

test("createRovoTextOutputController holds complete and pending spec fences", () => {
	const { controller, parts } = createTextOutputController({
		isClassifierIntentLeakCandidate: () => false,
		splitSpecFenceTextForStreaming: (text) => {
			if (text.includes("```spec")) {
				return { pendingText: text, visibleText: "" };
			}
			return { pendingText: "", visibleText: text };
		},
	});

	controller.emitTextDelta("Before ");
	controller.emitTextDelta("```spec\n{\"type\":\"card\"}\n```");
	controller.emitTextDelta(" After");
	controller.finalizeBufferedAssistantText();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Before " },
		{ type: "text-delta", id: "text-test", delta: " After" },
	]);
});

test("createRovoTextOutputController holds direct media fences", () => {
	const { controller, parts } = createTextOutputController({
		isClassifierIntentLeakCandidate: () => false,
		splitDirectMediaTextForStreaming: (text) => {
			if (text.includes("```image") || text.includes("```audio")) {
				return { pendingText: text, visibleText: "" };
			}
			return { pendingText: "", visibleText: text };
		},
	});

	controller.emitTextDelta("Intro ");
	controller.emitTextDelta("```image\nsunset\n```");
	controller.emitTextDelta(" Outro");
	controller.finalizeBufferedAssistantText();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Intro " },
		{ type: "text-delta", id: "text-test", delta: " Outro" },
	]);
});

test("createRovoTextOutputController defers and sanitizes tool-first fallback text", () => {
	const { controller, parts } = createTextOutputController({
		shouldDeferToolFirstText: true,
		stripToolFirstFailureNarrative: (text) => ({
			replaced: text.includes("could not use the tool"),
			text: text.replace("could not use the tool", "used the tool"),
		}),
		toolFirstFailureNarrativeEnabled: true,
	});

	controller.emitTextDelta("I could not use the tool.");
	assert.deepEqual(parts, []);

	controller.removeToolFirstFailureNarrative();
	controller.flushDeferredToolFirstText();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "I used the tool." },
	]);
	assert.equal(controller.getAssistantText(), "I used the tool.");
});

test("createRovoTextOutputController forced deltas still honor tool-first deferral", () => {
	const { controller, parts } = createTextOutputController({
		shouldDeferToolFirstText: true,
	});

	controller.emitForcedTextDelta("Forced fallback");
	assert.deepEqual(parts, []);

	controller.flushDeferredToolFirstText();

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "Forced fallback" },
	]);
	assert.equal(controller.getAssistantText(), "Forced fallback");
	assert.equal(controller.getUnsuppressedAssistantText(), "Forced fallback");
});

test("createRovoTextOutputController replacement setter leaves raw text unchanged", () => {
	const { controller, parts } = createTextOutputController();

	controller.emitTextDelta("router json");
	controller.setAssistantText("Repaired response");
	controller.emitTextDeltaRaw("Repaired response");

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "router json" },
		{ type: "text-delta", id: "text-test", delta: "Repaired response" },
	]);
	assert.equal(controller.getAssistantText(), "Repaired response");
	assert.equal(controller.getUnsuppressedAssistantText(), "router json");
});

test("createRovoTextOutputController reset preserves started stream state", () => {
	const { controller, parts } = createTextOutputController();

	controller.emitTextDelta("First");
	controller.resetAssistantTextForRetryAttempt();
	controller.emitTextDelta("Second");

	assert.deepEqual(parts, [
		{ type: "text-start", id: "text-test" },
		{ type: "text-delta", id: "text-test", delta: "First" },
		{ type: "text-delta", id: "text-test", delta: "Second" },
	]);
	assert.equal(controller.getAssistantText(), "Second");
	assert.equal(controller.getTextStarted(), true);
});

// Without a rerun the controller writes what origin/main wrote; each expected string was taken by
// running the same calls against origin/main's createRovoTextOutputController.
test("createRovoTextOutputController without a rerun writes the pre-rerun-break text", () => {
	for (const [name, steps, options, expected] of [
		["a notice after a whitespace line", [["emitTextDelta", "A\n \n"], ["emitNoticeParagraph", "N"]], {}, "A\n \n\nN"],
		// A pre-existing oddity, kept: a newline after a notice stands in for its paragraph break.
		["a newline then text after a notice", [["emitNoticeParagraph", "N"], ["emitTextDelta", "\n"], ["emitTextDelta", "B"]], {}, "N\nB"],
		["leading whitespace before the first visible text", [["emitTextDelta", "\n\n"], ["emitTextDelta", "  "], ["emitTextDelta", "B"]], {}, "\n\n  B"],
		["whitespace only", [["emitTextDelta", "\n\n"]], {}, "\n\n"],
		[
			"deferred tool-first text with a notice",
			[["emitTextDelta", "\n  A \n"], ["emitNoticeParagraph", "N"], ["flushDeferredToolFirstText"]],
			{ shouldDeferToolFirstText: true },
			"\n  A \n\nN",
		],
	]) {
		const { controller, parts } = createTextOutputController({ isClassifierIntentLeakCandidate: () => false, ...options });
		for (const [method, argument] of steps) {
			controller[method](argument);
		}

		assert.equal(parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join(""), expected, name);
		assert.equal(controller.getAssistantText(), expected, name);
		assert.equal(controller.getUnsuppressedAssistantText(), expected, name);
		assert.equal(controller.getTextStarted(), true, name);
	}
});
