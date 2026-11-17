"use strict";

// A media block closes the same way whatever whitespace stands around its closing backticks: every
// character `.trim()` strips counts as whitespace, as it does for the generation body. For these
// bodies, which hold no backticks, every reader gives what it gave before the line-edge rule.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoTextOutputController } = require("./rovo-text-output");
const { handleDirectRovoMediaFences } = require("./media-generation-stream");
const { isClassifierIntentLeakCandidate, parseClassifierIntentPayload } = require("./classifier-intent");
const { splitDirectMediaTextForStreaming, stripDirectMediaFences } = require("../lib/direct-media-fence");
const { splitSpecFenceTextForStreaming } = require("../lib/tool-output-sanitizer");

const T = "```";
const JSON_BODY = '{"prompt":"x"}';
const PAYLOAD = '{"intent":"image","confidence":0.9}';
const CODE_AFTER = `\n${T}js\ncode\n${T}`;

/** Every character `.trim()` strips except the newline, and a mix of them with spaces and tabs. */
const WHITESPACE = [
	...Array.from({ length: 0x10000 }, (_, code) => String.fromCharCode(code)).filter((char) => char !== "\n" && char.trim() === ""),
	" \t\u00a0\t \u3000",
];

/**
 * The replies, each with what the user is shown of it, and the request its body makes. `R` adds a
 * code block after the reply, whose fence on its own line must not become the block's close.
 */
const SHAPES = {
	afterJson: (space) => ({ body: [["image", { prompt: "x" }]], shown: "Intro\n\nOutro", text: `Intro\n${T}image\n${JSON_BODY}${space}${T}Outro` }),
	beforeJson: (space) => ({ body: [["image", { prompt: "x" }]], shown: "Intro\n\nOutro", text: `Intro\n${T}image\n${space}${JSON_BODY}${space}${T}Outro` }),
	lineEnd: (space) => ({ body: [], shown: `Intro\n\n${space}\nOutro`, text: `Intro\n${T}image\nsunset${T}${space}\nOutro` }),
	lineStart: (space) => ({ body: [], shown: "Intro\n\nOutro", text: `Intro\n${T}image\nsunset\n${space}${T}Outro` }),
};

/**
 * Streams `events` through a controller wired as production wires it and ends the stream: a string
 * is a delta, `{ forced }` a forced delta, `{ notice }` a failure notice, and `{ rerun }` a rerun
 * reset ("keep" keeps the text shown).
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
		} else {
			controller.resetAssistantTextForRetryAttempt({ continuesShownText: event.rerun === "keep" });
		}
	}
	const beforeEnd = wire();
	const classifier = controller.finalizeBufferedAssistantText();
	return {
		beforeEnd,
		classifier: classifier?.intent ?? null,
		stored: controller.getAssistantText(),
		wire: wire(),
	};
}

/**
 * Each point that ends the text, the events for it after `chunks`, and what it gives for a reply
 * shown as `shown`. A chunk that opens like JSON or a fence is held as a possible classifier payload
 * with everything after it, and a rerun drops it with the attempt; a payload or a rerun after such
 * chunks shows nothing about where a block ends, so those endings are skipped for them.
 */
const ENDINGS = {
	end: { events: (chunks) => chunks, expected: (text, shown) => ({ classifier: null, stored: text, wire: shown }) },
	forced: { events: (chunks) => [...chunks.slice(0, -1), { forced: chunks.at(-1) }], expected: (text, shown) => ({ classifier: null, stored: text, wire: shown }) },
	notice: { events: (chunks) => [...chunks, { notice: "N" }], expected: (text, shown) => ({ classifier: null, stored: `${text}\n\nN`, wire: `${shown}\n\nN` }) },
	payload: { events: (chunks) => [...chunks, PAYLOAD], expected: (text, shown) => ({ classifier: "image", stored: `${text}${PAYLOAD}`, wire: shown }), whole: true },
	rerunFresh: { events: (chunks) => [...chunks, { rerun: "fresh" }, "Z"], expected: (_text, shown) => ({ classifier: null, stored: "Z", wire: `${shown}Z` }), whole: true },
	rerunKeep: { events: (chunks) => [...chunks, { rerun: "keep" }, "Z"], expected: (_text, shown) => ({ classifier: null, stored: "Z", wire: `${shown}\n\nZ` }), whole: true },
};

/** The generation requests the complete `text` makes. */
async function generatedBodies(text) {
	const calls = [];
	await handleDirectRovoMediaFences({
		assistantText: text,
		getEnvVars: () => ({}),
		latestUserMessage: "",
		logger: { error() {}, info() {}, warn() {} },
		resolveGoogleImageGatewayConfig: () => ({}),
		streamDirectAudioFenceWidgetGeneration: async ({ audioPayload }) => calls.push(["audio", audioPayload]),
		streamDirectImageFenceWidgetGeneration: async ({ imagePayload }) => calls.push(["image", imagePayload]),
		stripDirectMediaFences,
		widgetTypeAudio: "audio-preview",
		widgetTypeImage: "image-preview",
		writer: {},
	});
	return calls;
}

test("whitespace is every character trim strips, as the generation body reads it", () => {
	assert.equal(WHITESPACE.length, 25);
	for (const space of WHITESPACE) {
		assert.match(space, /^\s+$/u);
	}
});

test("a media block closes at backticks after whitespace of any kind around them, as before, for every chunking and ending", async () => {
	// Before: only spaces, tabs or a carriage return counted, so with a no-break space after the JSON
	// object the block ran on to the code block's fence: 'Intro\n\njs\ncode\n```' on the wire, and no
	// image was generated. Without the code block, 'Outro' was held until the stream ended.
	for (const space of WHITESPACE) {
		for (const [shape, make] of Object.entries(SHAPES)) {
			const reply = make(space);
			for (const [text, shown] of [[reply.text, reply.shown], [`${reply.text}${CODE_AFTER}`, `${reply.shown}${CODE_AFTER}`]]) {
				const label = `${shape} ${JSON.stringify(space)} ${JSON.stringify(text)}`;
				assert.deepEqual(await generatedBodies(text), reply.body, label);
				// The text after the block goes out as it arrives, not at the end of the stream; only
				// backticks at the very end, which may still open a fence, wait.
				assert.equal(stream([text]).beforeEnd, shown.replace(/`{1,3}$/u, ""), label);
				for (let cut = 0; cut < text.length; cut += 1) {
					const chunks = cut === 0 ? [text] : [text.slice(0, cut), text.slice(cut)];
					for (const [name, ending] of Object.entries(ENDINGS)) {
						if (ending.whole && chunks.some((chunk) => isClassifierIntentLeakCandidate(chunk))) {
							continue;
						}
						const { classifier, stored, wire } = stream(ending.events(chunks));
						assert.deepEqual({ classifier, stored, wire }, ending.expected(text, shown), `${name} ${label} cut ${cut}`);
					}
				}
			}
		}
	}
});
