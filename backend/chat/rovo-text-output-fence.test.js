"use strict";

// Spec and direct media fences in streamed text: what the splitters hide stays off the wire however
// the reply is chunked, ordinary text and code fences go out as before, and the turn's stored text
// keeps every fence for the post-stream pipeline.

const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoTextOutputController } = require("./rovo-text-output");
const { isClassifierIntentLeakCandidate, parseClassifierIntentPayload } = require("./classifier-intent");
const { splitDirectMediaTextForStreaming } = require("../lib/direct-media-fence");
const { splitSpecFenceTextForStreaming } = require("../lib/tool-output-sanitizer");

/** Streams `chunks` through a controller wired as production wires it and ends the stream. */
function streamChunks(chunks, options = {}) {
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
	for (const chunk of chunks) {
		controller.emitTextDelta(chunk);
	}
	const classifierPayload = controller.finalizeBufferedAssistantText();
	return {
		classifierPayload,
		controller,
		stored: controller.getAssistantText(),
		unsuppressed: controller.getUnsuppressedAssistantText(),
		wire: parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join(""),
	};
}

function assertStream(name, chunks, expectedWire, options) {
	const result = streamChunks(chunks, options);
	assert.equal(result.wire, expectedWire, name);
	// The stored text is the reply as streamed: the post-stream pipeline reads its fences.
	assert.equal(result.stored, chunks.join(""), name);
	assert.equal(result.unsuppressed, chunks.join(""), name);
}

const SPEC_FENCE = '```spec\n{"root":"card","elements":{"card":{"type":"Card","props":{"title":"Hi"}}}}\n```';
const IMAGE_FENCE = '```image\n{"prompt":"A lighthouse at dusk"}\n```';

test("a spec fence that opens after text keeps hiding its later chunks", () => {
	// Before: the second chunk went out as text: wire 'Intro\n"card"'.
	assertStream("spec", ['Intro\n```spec\n{"root":', '"card"'], "Intro\n");
	assertStream("media", ['Intro\n```image\n{"prompt":', '"A lighthouse"'], "Intro\n");
});

test("a spec fence that opens the reply keeps hiding its chunks past the classifier buffer", () => {
	// Over the test's 120-character classifier buffer, the first chunk was flushed and the fence
	// forgotten. Before: wire '"card":1'.
	const opener = `\`\`\`spec\n{"root":"card","elements":{"card":{"type":"Card","props":{"title":"${"x".repeat(100)}",`;
	assertStream("spec", [opener, '"card":1'], "", { classifierJsonBufferMaxChars: 120 });
});

test("a fence after text in one chunk is hidden and the text after it shown", () => {
	assertStream("spec", [`Intro\n${SPEC_FENCE}\nOutro`], "Intro\n\nOutro");
	assertStream("media", [`Here it is:\n${IMAGE_FENCE}\nDone`], "Here it is:\n\nDone");
	assertStream("audio", ['Listen:\n```audio\n{"text":"hello"}\n```\nDone'], "Listen:\n\nDone");
});

test("a fence opener split across chunks at every position is hidden", () => {
	// Before: a chunk ending in "``" or "```sp" went out, and the fence after it with it.
	for (const opener of ["```spec\n", "```image\n", "```AUDIO \n"]) {
		const fence = `${opener}{"a":1}\n\`\`\``;
		for (let cut = 1; cut <= opener.length; cut += 1) {
			const head = `Intro\n${fence.slice(0, cut)}`;
			assertStream(`${JSON.stringify(opener)} cut ${cut}`, [head, `${fence.slice(cut)}\nOutro`], "Intro\n\nOutro");
		}
	}
});

test("a complete fence between two paragraphs leaves one paragraph break", () => {
	const reply = `First paragraph.\n\n${SPEC_FENCE}\n\nSecond paragraph.`;
	for (const cut of [reply.indexOf("```"), reply.indexOf("```") + 3, reply.lastIndexOf("```") + 3, reply.lastIndexOf("Second")]) {
		assertStream(`cut ${cut}`, [reply.slice(0, cut), reply.slice(cut)], "First paragraph.\n\nSecond paragraph.");
	}
});

test("two fences in one reply are both hidden", () => {
	const reply = `A\n${SPEC_FENCE}\nB\n${IMAGE_FENCE}\nC`;
	assertStream("one chunk", [reply], "A\n\nB\n\nC");
	assertStream("one character at a time", [...reply], "A\n\nB\n\nC");
});

test("an ordinary code fence streams as it did before", () => {
	// Only spec, image and audio fences are hidden: every chunking shows the reply as it is.
	for (const reply of ["Code:\n```js\nconst a = `x`;\n```\nDone", "```js\nconst a = 1;\n```\nDone ``inline``", "```\nplain\n```"]) {
		assertStream("one chunk", [reply], reply);
		assertStream("one character at a time", [...reply], reply);
		for (let cut = 1; cut < reply.length; cut += 1) {
			assertStream(`cut ${cut}`, [reply.slice(0, cut), reply.slice(cut)], reply);
		}
	}
});

test("a fence still open at the end of the stream stays off the wire and in the stored text", () => {
	// The pipeline reads it from the stored text (extractDirectSpec falls back to its patch lines); a
	// notice after the stream would drop it, as it drops any text held back at the end.
	const chunks = ["Intro\n", '```spec\n{"op":"add","path":"/root","value":"card"}\n'];
	const result = streamChunks(chunks);
	assert.equal(result.classifierPayload, null);
	assert.equal(result.wire, "Intro\n");
	assert.equal(result.stored, chunks.join(""));

	result.controller.emitNoticeParagraph("N");
	assert.equal(result.controller.getAssistantText(), "Intro\n\nN");
});

test("however a reply is chunked, the wire text is the same and the stored text is the reply", () => {
	const replies = [
		`Intro\n${SPEC_FENCE}\nOutro`,
		`Intro\n\n${SPEC_FENCE}\n\nOutro`,
		`${SPEC_FENCE}\nAfter`,
		`First.\n\n${SPEC_FENCE}\n\nMiddle.\n\n${IMAGE_FENCE}\n\nLast.`,
		"Mixed ```IMAGE\nsunset\n``` case",
		"Code:\n```js\nconst a = `x`;\n```\nDone",
		"Open at the end:\n```spec\n{\"root\":\"card\"",
		"Runs\n\n\nof newlines\n\n\n\nhere",
	];
	// A fixed pseudo-random sequence, so the chunkings are the same on every run.
	let seed = 7;
	const nextChunkLength = () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return 1 + (seed % 9);
	};
	for (const reply of replies) {
		const expectedWire = streamChunks([reply]).wire;
		const chunkings = [[...reply]];
		for (let cut = 1; cut < reply.length; cut += 1) {
			chunkings.push([reply.slice(0, cut), reply.slice(cut)]);
		}
		for (let run = 0; run < 20; run += 1) {
			const chunks = [];
			for (let start = 0; start < reply.length; ) {
				const end = start + nextChunkLength();
				chunks.push(reply.slice(start, end));
				start = end;
			}
			chunkings.push(chunks);
		}
		for (const chunks of chunkings) {
			assertStream(JSON.stringify(chunks), chunks, expectedWire);
		}
	}
});
