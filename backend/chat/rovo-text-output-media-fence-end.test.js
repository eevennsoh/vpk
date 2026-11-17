"use strict";

// Where a streamed media block ends: a run of backticks of any length at the end of the text so far
// waits for the text after it however the run is split, and a block whose only backticks have text on
// both sides of them closes at them once the text ends, as it did before the line-edge rule.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoTextOutputController } = require("./rovo-text-output");
const { isClassifierIntentLeakCandidate, parseClassifierIntentPayload } = require("./classifier-intent");
const { splitDirectMediaTextForStreaming } = require("../lib/direct-media-fence");
const { splitSpecFenceTextForStreaming } = require("../lib/tool-output-sanitizer");

const T = "```";
const PAYLOAD = '{"intent":"image","confidence":0.9}';

const collapseBlankLines = (text) => text.replace(/\n{3,}/gu, "\n\n");

/**
 * Streams `events` through a controller wired as production wires it and ends the stream: a string
 * is a delta, `{ forced }` a forced delta, `{ notice }` a failure notice, and `{ rerun }` a rerun
 * reset ("keep" keeps the text shown). Returns the wire and stored text, the wire before the end of
 * the stream, and the classifier payload the end of the stream returned.
 */
function stream(events) {
	const parts = [];
	const controller = createRovoTextOutputController({
		classifierJsonBufferMaxChars: 320,
		isClassifierIntentLeakCandidate,
		parseClassifierIntentPayload,
		splitDirectMediaTextForStreaming,
		splitSpecFenceTextForStreaming,
		textId: "text-test",
		writer: { write: (part) => parts.push(part) },
	});
	const wire = () => parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join("");
	for (const event of events) {
		if (typeof event === "string") {
			controller.emitTextDelta(event);
		} else if (event.forced) {
			controller.emitForcedTextDelta(event.forced);
		} else if (event.notice) {
			controller.emitNoticeParagraph(event.notice);
		} else if (event.rerun) {
			controller.resetAssistantTextForRetryAttempt({ continuesShownText: event.rerun === "keep" });
		}
	}
	const beforeEnd = wire();
	const classifier = controller.finalizeBufferedAssistantText();
	return { beforeEnd, classifier, stored: controller.getAssistantText(), wire: wire() };
}

/** `text` whole, and cut in two and in three at every point from `from` to `to`. */
function splitsOf(text, from, to) {
	const splits = [[text]];
	for (let first = from; first <= to; first += 1) {
		splits.push([text.slice(0, first), text.slice(first)]);
		for (let second = first + 1; second <= to; second += 1) {
			splits.push([text.slice(0, first), text.slice(first, second), text.slice(second)]);
		}
	}
	return splits.map((chunks) => chunks.filter(Boolean));
}

/**
 * What comes after the chunks: the end of the stream, or one of the points that end the text. A
 * chunk that opens like JSON or a fence is held as a possible classifier payload with everything
 * after it, whatever the fences, and a rerun drops it with the attempt; a payload or a rerun after
 * such chunks shows nothing about where a block ends, so those endings are skipped for them.
 */
const holdsPossiblePayload = (chunks) => chunks.some((chunk) => isClassifierIntentLeakCandidate(chunk));
const ENDINGS = {
	end: (chunks) => chunks,
	forced: (chunks) => [...chunks.slice(0, -1), { forced: chunks.at(-1) }],
	notice: (chunks) => [...chunks, { notice: "N" }],
	payload: (chunks) => (holdsPossiblePayload(chunks) ? null : [...chunks, PAYLOAD]),
	rerunFresh: (chunks) => (holdsPossiblePayload(chunks) ? null : [...chunks, { rerun: "fresh" }, "Z"]),
	rerunKeep: (chunks) => (holdsPossiblePayload(chunks) ? null : [...chunks, { rerun: "keep" }, "Z"]),
};

test("a run of three to nine backticks inside a media body waits for the text after it however it is split", () => {
	// Before: a run longer than three at the end of a delta closed the block at its first three
	// backticks, so the rest of the body went out: 'A\n\n```js"}\n```\nB' for six.
	for (let length = 3; length <= 9; length += 1) {
		const run = "`".repeat(length);
		const rest = "`".repeat(length - 3);
		const replies = [
			// Closed later by a fence on its own line: the whole block stays hidden.
			{ end: "A\n\nB", text: `A\n${T}image\n{"prompt":"x ${run}js"}\n${T}\nB` },
			{ end: "A\n\nB", text: `A\n${T}audio\nplain ${run}js more\n${T}\nB` },
			// Never closed, the run last: it ends its line, so it closes the block at its first three.
			{ end: `A\n\n${rest}`, text: `A\n${T}image\n{"prompt":"x ${run}` },
			// Never closed, text after the run: it closes at the run's first three when the text ends.
			{ end: `A\n\n${rest}js"}`, text: `A\n${T}image\n{"prompt":"x ${run}js"}` },
		];
		for (const { end, text } of replies) {
			const runStart = text.indexOf(run, text.indexOf("\n", 2) + 1);
			const expected = Object.fromEntries(Object.entries(ENDINGS).map(([name, ending]) => [name, stream(ending([text]))]));
			assert.equal(collapseBlankLines(expected.end.wire), end, text);
			for (const chunks of splitsOf(text, runStart, Math.min(text.length - 1, runStart + length + 3))) {
				for (const [name, ending] of Object.entries(ENDINGS)) {
					const events = ending(chunks);
					if (!events) {
						continue;
					}
					const result = stream(events);
					const label = `${name} ${JSON.stringify(chunks)}`;
					// How many newlines join the text on each side of a hidden block depends on the
					// chunking, as it always has; where the block ends does not.
					assert.equal(collapseBlankLines(result.wire), collapseBlankLines(expected[name].wire), label);
					assert.equal(result.stored, expected[name].stored, label);
					assert.deepEqual(result.classifier, expected[name].classifier, label);
				}
			}
		}
		// What the points that end the text show, for the first reply.
		const closed = replies[0].text;
		assert.deepEqual(stream(ENDINGS.notice([closed])).wire, "A\n\nB\n\nN");
		assert.deepEqual(stream(ENDINGS.payload([closed])).classifier?.intent, "image");
		assert.deepEqual(stream(ENDINGS.rerunKeep([closed])).wire, "A\n\nB\n\nZ");
	}
});

test("a long run of backticks at the end of the text so far is not shown before the text decides", () => {
	for (let length = 4; length <= 9; length += 1) {
		const run = "`".repeat(length);
		for (const cut of [1, 2, 3, length - 1]) {
			const result = stream([`A\n${T}image\n{"prompt":"x ${run.slice(0, cut)}`, `${run.slice(cut)}`, 'js"}', `\n${T}\nB`]);
			assert.equal(result.wire, "A\n\nB", `${length} ${cut}`);
		}
	}
});

test("a media block whose only backticks have text on both sides of them closes at them when the text ends, as before", () => {
	// Before: the block stayed open, and everything after it was hidden for good: 'Intro\n'.
	const text = `Intro\n${T}image\nsunset${T}Outro`;
	for (let cut = 1; cut < text.length; cut += 1) {
		const chunks = [text.slice(0, cut), text.slice(cut)];
		const label = JSON.stringify(chunks);
		const ended = stream(chunks);
		assert.equal(ended.wire, "Intro\n\nOutro", label);
		assert.equal(ended.stored, text, label);
		assert.equal(stream(ENDINGS.notice(chunks)).wire, "Intro\n\nOutro\n\nN", label);
		assert.equal(stream(ENDINGS.notice(chunks)).stored, `${text}\n\nN`, label);
		assert.equal(stream(ENDINGS.forced(chunks)).wire, "Intro\n\nOutro", label);
		if (!holdsPossiblePayload(chunks)) {
			assert.equal(stream(ENDINGS.rerunKeep(chunks)).wire, "Intro\n\nOutro\n\nZ", label);
			assert.equal(stream(ENDINGS.rerunFresh(chunks)).wire, "Intro\n\nOutroZ", label);
			assert.equal(stream(ENDINGS.rerunKeep(chunks)).stored, "Z", label);
		}
	}
	// A classifier payload held after it stays off the wire and out of nothing else.
	const payload = stream([`${text} `, PAYLOAD]);
	assert.equal(payload.wire, "Intro\n\nOutro ");
	assert.equal(payload.classifier?.intent, "image");
	assert.equal(payload.stored, `${text} ${PAYLOAD}`);
});

test("text after backticks with text on both sides of them stays held until the text decides", () => {
	// Until the stream ends the backticks are undecided: nothing after them is shown.
	assert.equal(stream([`Intro\n${T}image\nsunset${T}Outro`, " more"]).beforeEnd, "Intro\n");
	// A later fence on its own line closes the block, and the text between stays hidden.
	const closed = stream([`Intro\n${T}image\nsunset${T}Outro`, `\nmore\n${T}\nB`]);
	assert.equal(closed.beforeEnd, "Intro\n\nB");
	assert.equal(closed.wire, "Intro\n\nB");
	// A spec opener's start after them at a rerun is dropped with the attempt, as before.
	assert.equal(stream([`Intro\n${T}image\nx${T}sp`, { rerun: "keep" }, "B"]).wire, "Intro\n\nB");
	assert.equal(stream([`Intro\n${T}image\nsunset${T}Outro${T}sp`, { rerun: "keep" }, "B"]).wire, "Intro\n\nOutro\n\nB");
	// A block with no backticks in its body stays hidden to the end.
	assert.equal(stream([`Intro\n${T}image\nsunset`, " Outro"]).wire, "Intro\n");
});

test("a partial media opener right before an undecided media block waits for it, as when the block closed at once", () => {
	// When the block closes, the partial opener and the paragraph break that replaces the block read as
	// an opener, which hides the rest. Before, the partial opener went out while the block was undecided:
	// 'Hello ```image ' on the wire.
	const start = `Hello ${T}image ${T}audio\n{"prompt": "open`;
	assert.equal(stream([`${start}${T}js`]).wire, "Hello ");
	assert.equal(stream([`${start}${T}`, "js"]).wire, "Hello ");
	// A partial opener shown while the block had no backticks yet stays shown.
	assert.equal(stream([start, `${T}js`]).wire, `Hello ${T}image \n\njs`);
});
