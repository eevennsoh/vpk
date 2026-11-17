"use strict";

// Backticks inside a direct media block's body: the block stays hidden however the reply is chunked,
// backticks at the end of the text so far wait for the next delta, and every block shape without
// them streams as it did before.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoTextOutputController } = require("./rovo-text-output");
const { isClassifierIntentLeakCandidate, parseClassifierIntentPayload } = require("./classifier-intent");
const { splitDirectMediaTextForStreaming } = require("../lib/direct-media-fence");
const { splitSpecFenceTextForStreaming } = require("../lib/tool-output-sanitizer");

const T = "```";

/**
 * Streams `events` through a controller wired as production wires it and ends the stream: a string
 * is a delta, `{ notice }` a failure notice, `{ rerun }` a rerun that keeps the text shown.
 */
function stream(events, options = {}) {
	const parts = [];
	const controller = createRovoTextOutputController({
		classifierJsonBufferMaxChars: 320,
		isClassifierIntentLeakCandidate,
		parseClassifierIntentPayload,
		splitDirectMediaTextForStreaming,
		splitSpecFenceTextForStreaming,
		textId: "text-test",
		writer: { write: (part) => parts.push(part) },
		...options,
	});
	for (const event of events) {
		if (typeof event === "string") {
			controller.emitTextDelta(event);
		} else if (event.notice) {
			controller.emitNoticeParagraph(event.notice);
		} else if (event.rerun) {
			controller.resetAssistantTextForRetryAttempt({ continuesShownText: true });
		}
	}
	controller.finalizeBufferedAssistantText();
	if (options.shouldDeferToolFirstText) {
		controller.flushDeferredToolFirstText();
	}
	return {
		stored: controller.getAssistantText(),
		unsuppressed: controller.getUnsuppressedAssistantText(),
		wire: parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join(""),
	};
}

/** `reply` whole, a character at a time, and split in two at every point. */
function chunkingsOf(reply) {
	const chunkings = [[reply], [...reply]];
	for (let cut = 1; cut < reply.length; cut += 1) {
		chunkings.push([reply.slice(0, cut), reply.slice(cut)]);
	}
	return chunkings;
}

const BLOCKS_WITH_INNER_BACKTICKS = [
	`${T}image\n{"prompt":"${T}js"}\n${T}`,
	`${T}audio\n{"text":"say ${T} twice"}\n${T}`,
	`${T}image\na plain ${T}js body\n${T}`,
	`${T}audio\nread \`this\` and ${T}that${T} aloud\n${T}`,
	`${T}image\n{\n  "prompt": "use ${T}js here"\n}\n${T}`,
	`${T}IMAGE \n{"prompt":"draw ${T}"}${T}`,
];

test("a media block with backticks inside its body stays off the wire however it is chunked", () => {
	// Before: the block ended at the first backticks inside the body and the rest went out as text,
	// for example 'A\n\njs"}\n```\nB' for the first block.
	for (const block of BLOCKS_WITH_INNER_BACKTICKS) {
		const reply = `A\n${block}\nB`;
		for (const chunks of chunkingsOf(reply)) {
			for (const shouldDeferToolFirstText of [false, true]) {
				const result = stream(chunks, { shouldDeferToolFirstText });
				assert.equal(result.wire, "A\n\nB", JSON.stringify(chunks));
				assert.equal(result.stored, reply, JSON.stringify(chunks));
				assert.equal(result.unsuppressed, reply, JSON.stringify(chunks));
			}
		}
	}
});

test("a failure notice inside a media body with backticks drops the whole block", () => {
	// Before: 'A\n\njs"}\n\nN' on the wire, and the stored text kept the block's start.
	for (const [start, rest] of [[`${T}image\n{"prompt":"`, `${T}js"}`], [`${T}audio\nplain `, `${T}js more`]]) {
		for (const chunks of [[`A\n${start}`, rest], [`A\n${start}${rest}`], [`A\n${start}${rest.slice(0, 2)}`, rest.slice(2)]]) {
			const result = stream([...chunks, { notice: "N" }]);
			assert.equal(result.wire, "A\n\nN", JSON.stringify(chunks));
			assert.equal(result.stored, "A\n\nN", JSON.stringify(chunks));
		}
	}
	// After the block closes, the notice follows the text after it.
	const closed = stream([`A\n${T}image\n{"prompt":"${T}`, `js"}\n${T}\nB`, { notice: "N" }]);
	assert.equal(closed.wire, "A\n\nB\n\nN");
	assert.equal(closed.stored, `A\n${T}image\n{"prompt":"${T}js"}\n${T}\nB\n\nN`);
});

test("backticks that end the text so far in a media body wait for the next delta", () => {
	// Before: they closed the block, so the next delta went out as text: 'A\n\njs more\n```\nB'.
	for (const [first, second] of [
		[`A\n${T}image\nplain ${T}`, `js more\n${T}\nB`],
		[`A\n${T}image\nplain ${T} `, `js more\n${T}\nB`],
		[`A\n${T}image\nplain ${T}\``, `js more\n${T}\nB`],
		[`A\n${T}image\n{"prompt":"${T}`, `js"}\n${T}\nB`],
	]) {
		const result = stream([first, second]);
		assert.equal(result.wire, "A\n\nB", first);
		assert.equal(result.stored, `${first}${second}`, first);
	}
	// A newline after them decides that they close it, and the end of the stream does too, as before.
	assert.equal(stream([`A\n${T}image\nsunset${T}`, "\nB"]).wire, "A\n\nB");
	assert.equal(stream([`A\n${T}image\nsunset${T} `, "\nB"]).wire, "A\n\n \nB");
	assert.equal(stream([`A\n${T}image\nsunset${T}`]).wire, "A\n\n");
});

test("a rerun after undecided backticks and spaces in a media body shows the spaces, as before", () => {
	// The end of the attempt's text closes the block, as the end of a stream does.
	for (const end of [" ", "\t"]) {
		const result = stream([`A ${T}image\nsunset${T}${end}`, { rerun: true }, "B"]);
		assert.equal(result.wire, `A \n\n${end}\n\nB`, JSON.stringify(end));
		assert.equal(result.stored, "B");
	}
});

test("backticks and spaces after a media body's JSON object close it at once, as before", () => {
	// Held for the next delta, they joined a patch line in it to the block's line, which hid it no more.
	const chunks = [`A\n${T}image\n{"prompt":"x"}${T} `, '{"op":"add","path":"/root","value":1}\nB'];
	const result = stream(chunks);
	assert.equal(result.wire, "A\n\n B");
	assert.equal(result.stored, chunks.join(""));
});

test("a media block that never closes stays off the wire to the end of the stream", () => {
	for (const chunks of [[`A\n${T}image\n{"prompt":"${T}js`, " more"], [`A\n${T}audio\nplain ${T}js${T}more`]]) {
		const result = stream(chunks);
		assert.equal(result.wire, "A\n", JSON.stringify(chunks));
		assert.equal(result.stored, chunks.join(""), JSON.stringify(chunks));
	}
});
