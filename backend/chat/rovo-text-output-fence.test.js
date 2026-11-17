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

/**
 * `reply` as one chunk, one character at a time, every 2-way split and 20 pseudo-random chunkings
 * from a fixed seed, so the chunkings are the same on every run.
 */
function chunkingsOf(reply) {
	let seed = 7;
	const nextChunkLength = () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return 1 + (seed % 9);
	};
	const chunkings = [[reply], [...reply]];
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
	return chunkings;
}

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

test("however a reply with a hidden fence is chunked, the wire text is the same and the stored text is the reply", () => {
	const replies = [
		`Intro\n${SPEC_FENCE}\nOutro`,
		`Intro\n\n${SPEC_FENCE}\n\nOutro`,
		`${SPEC_FENCE}\nAfter`,
		`First.\n\n${SPEC_FENCE}\n\nMiddle.\n\n${IMAGE_FENCE}\n\nLast.`,
		"Mixed ```IMAGE\nsunset\n``` case",
		"Code:\n```js\nconst a = `x`;\n```\nDone",
		"Open at the end:\n```spec\n{\"root\":\"card\"",
	];
	for (const reply of replies) {
		const expectedWire = streamChunks([reply]).wire;
		for (const chunks of chunkingsOf(reply)) {
			assertStream(JSON.stringify(chunks), chunks, expectedWire);
		}
	}
});

const T = "```";

/**
 * The wire text `36f992247` wrote for a reply with no hidden fence: each delta split on its own, so
 * the joined chunks, with a run of three or more newlines inside one chunk collapsed to two (runs
 * split across chunks were not joined). A reply that opens with a backtick fence was held whole as a
 * possible classifier payload and split once; the ones below that do have no such runs, so the rule
 * holds for them too.
 */
const baseWireFor = (chunks) => chunks.map((chunk) => chunk.replace(/\n{3,}/gu, "\n\n")).join("");

test("a reply with no hidden fence goes on the wire as it did before, however it is chunked", () => {
	// The "spec…" languages are the exception: before, a chunk holding "```spec" hid it and the rest of
	// that chunk ("```specification" in one chunk showed nothing). They are ordinary code fences now,
	// shown like any other, so their expected wire is the rule above.
	const replies = [
		"Plain text, with punctuation.",
		"Inline `code` and ``double`` ticks, ending in ``",
		"Code:\n```js\nconst a = `x`;\n```\nDone",
		"```python\nprint(1)\n```\nAfter",
		"Shell:\n```sh\nls\n```\n\n```json\n{\"a\":1}\n```",
		"Runs\n\n\nof newlines\n\n\n\nhere\n\n\n",
		"CRLF\r\n\r\n\r\nlines\r\nend",
		`A ${T}specs-not\nX\n${T} tail`,
		`${T}specification\nY\n${T}`,
		"Tildes ~~~spec\nnot a backtick fence\n~~~",
	];
	for (const reply of replies) {
		for (const chunks of chunkingsOf(reply)) {
			assertStream(JSON.stringify(chunks), chunks, baseWireFor(chunks));
		}
	}
});

test("newlines split across chunks go out as each chunk had them", () => {
	// Before: the controller split them as one run and wrote "A\n\nB".
	assertStream("split run", ["A\n", "\n", "\nB"], "A\n\n\nB");
	assertStream("one chunk", ["A\n\n\nB"], "A\n\nB");
});

test("a fence whose language only starts with spec is an ordinary code fence", () => {
	// Before: everything after "```sp" was hidden: wire "A ".
	const chunks = [`A ${T}sp`, `ecs-not\nX\n${T} tail`];
	assertStream("specs-not", chunks, chunks.join(""));
	assertStream("spec, then s", [`A ${T}spec`, `s-not\nX\n${T}`], `A ${T}specs-not\nX\n${T}`);
	// "spec" as the whole language still hides, with whitespace after it or split anywhere.
	assertStream("spec and spaces", [`A ${T}spec `, ' \n{"a":1}\n', `${T}\nB`], "A \n\nB");
	// Still undecided at the end of the stream, it is held and dropped, as an open fence is.
	assertStream("spec at the end", [`A ${T}spec`], "A ");
});

test("a classifier payload after a partial patch line stays held, as it did before", () => {
	const patchLine = '{"op":"add","path":"/root","value":1}';
	const payload = '{"intent":"normal"}';
	const chunks = [`A\n${patchLine}`, `\n${payload}`];
	// Before: the payload went out and the end of the stream returned null: wire 'A\n{"intent":"normal"}'.
	const result = streamChunks(chunks);
	assert.equal(result.wire, "A\n");
	assert.deepEqual(result.classifierPayload, { confidence: null, intent: "normal", reason: null });
	assert.equal(result.stored, chunks.join(""));

	result.controller.emitNoticeParagraph("N");
	assert.equal(result.controller.getAssistantText(), "A\n\nN");
	assert.equal(result.controller.getUnsuppressedAssistantText(), "A\n\nN");

	// The same before a notice, and through the card-first replay.
	for (const suppressStreamingTextForCardFirstGenui of [false, true]) {
		const parts = [];
		const controller = createRovoTextOutputController({
			classifierJsonBufferMaxChars: 320,
			isClassifierIntentLeakCandidate,
			parseClassifierIntentPayload,
			splitDirectMediaTextForStreaming,
			splitSpecFenceTextForStreaming,
			suppressStreamingTextForCardFirstGenui,
			textId: "text-test",
			writer: { write: (part) => parts.push(part) },
		});
		for (const chunk of chunks) {
			controller.emitTextDelta(chunk);
		}
		controller.emitNoticeParagraph("N");
		const wire = parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join("");
		assert.equal(wire, "A\n\nN", `card-first ${suppressStreamingTextForCardFirstGenui}`);
		assert.equal(controller.getAssistantText(), "A\n\nN", `card-first ${suppressStreamingTextForCardFirstGenui}`);
	}
});

test("a patch line split across chunks stays off the wire and keeps the line break after it", () => {
	const patchLine = '{"op":"add","path":"/root","value":1}';
	// Each delta split on its own wrote "A\n" + "\nB" before; the line's rest, cut anywhere, stays hidden.
	assertStream("whole line", [`A\n${patchLine}`, "\nB"], "A\n\nB");
	assertStream("cut line", [`A\n${patchLine.slice(0, 30)}`, `${patchLine.slice(30)}\nB`], "A\n\nB");
});

test("a rerun writes held backticks that opened no hidden fence and drops what may have", () => {
	// Each is the first attempt, then the rerun's "B". Before: the held "`" was dropped: "a\n\nB".
	for (const [firstAttempt, expectedWire] of [
		["a`", "a`\n\nB"],
		[`a${T}`, `a${T}\n\nB`],
		// A partial hidden opener the dropped attempt can no longer complete is dropped with it.
		[`a${T}sp`, "a\n\nB"],
		[`a${T}image`, "a\n\nB"],
		[`a${T}spec\n{"root":`, "a\n\nB"],
	]) {
		const parts = [];
		const controller = createRovoTextOutputController({
			isClassifierIntentLeakCandidate,
			parseClassifierIntentPayload,
			splitDirectMediaTextForStreaming,
			splitSpecFenceTextForStreaming,
			textId: "text-test",
			writer: { write: (part) => parts.push(part) },
		});
		controller.emitTextDelta(firstAttempt);
		controller.resetAssistantTextForRetryAttempt({ continuesShownText: true });
		controller.emitTextDelta("B");
		controller.finalizeBufferedAssistantText();
		const wire = parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join("");
		assert.equal(wire, expectedWire, firstAttempt);
		assert.equal(controller.getAssistantText(), "B", firstAttempt);
	}
});

test("the text handed to the splitters grows linearly with a long reply without fences", () => {
	// Before: text ending in a newline was split again from the start on every delta, so ten
	// thousand "x\n" deltas passed about 100 million characters through the spec splitter.
	const charactersSplitFor = (chunks) => {
		let characters = 0;
		const counted = (split) => (text) => {
			characters += text.length;
			return split(text);
		};
		streamChunks(chunks, {
			splitDirectMediaTextForStreaming: counted(splitDirectMediaTextForStreaming),
			splitSpecFenceTextForStreaming: counted(splitSpecFenceTextForStreaming),
		});
		return characters;
	};
	for (const unit of [["x\n"], ["Line with `code`", "\n", "\n"], ["a ``", "b\n\n\n"]]) {
		const short = charactersSplitFor(Array.from({ length: 500 }, () => unit).flat());
		const long = charactersSplitFor(Array.from({ length: 2000 }, () => unit).flat());
		assert.ok(long <= short * 4 * 1.05, `${JSON.stringify(unit)}: ${short} then ${long} characters`);
	}
});

const b = "`";
const PATCH_LINE = '{"op":"add","path":"/root","value":1}';
// A patch line, then a media fence still open, long enough that a chunk holding it passes the
// production classifier buffer (320) and reaches the splitters.
const PATCH_THEN_OPEN_MEDIA = `${PATCH_LINE}\n${T}image\n${"x".repeat(280)}`;

/** Streams `chunks`, then a notice, through a controller wired as production wires it. */
function noticeAfterChunks(chunks, options = {}) {
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
	controller.emitNoticeParagraph("N");
	controller.flushDeferredToolFirstText();
	controller.finalizeBufferedAssistantText();
	return {
		stored: controller.getAssistantText(),
		unsuppressed: controller.getUnsuppressedAssistantText(),
		wire: parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join(""),
	};
}

test("a media fence held after a hidden patch line is held as a fence, and a notice drops it", () => {
	// The patch line the splitters dropped opens the held text. Before: it was held as a patch line,
	// the stored text kept the open fence with the notice after it ("A\n" + fence + "\n\nN"), and text
	// after the fence went on the wire ("A\nSECRET").
	for (const [name, options] of [
		["plain", {}],
		["deferred tool-first", { shouldDeferToolFirstText: true }],
		["card-first", { suppressStreamingTextForCardFirstGenui: true }],
	]) {
		const result = noticeAfterChunks(["A\n", PATCH_THEN_OPEN_MEDIA], options);
		assert.equal(result.wire, "A\n\nN", name);
		assert.equal(result.stored, "A\n\nN", name);
		assert.equal(result.unsuppressed, "A\n\nN", name);
	}
	assertStream("text after the open fence", ["A\n", PATCH_THEN_OPEN_MEDIA, "SECRET"], "A\n");
});

test("held backticks do not change what a delta's patch filtering hides", () => {
	// On 36f992247 the second delta, split on its own, hid its patch line and the backtick after it.
	// Before: the held backtick joined the patch line, which then no longer started its line: wire = J.
	assertStream("inline code", [`Example: ${b}`, `${PATCH_LINE}${b}\nDone.`], `Example: ${b}Done.`);
	assertStream("double backticks", [`Example: ${b}${b}`, `${PATCH_LINE}\nDone.`], `Example: ${b}${b}Done.`);
	// Backticks that do open a hidden fence with the delta still hide it.
	assertStream("hidden opener", [`A ${b}${b}`, `${b}spec\n${PATCH_LINE}\n${T}\nB`], "A \n\nB");
});

/**
 * The wire text `36f992247` wrote for a reply with no hidden fence, patch lines included: text that
 * may be a classifier payload held until it is not one (or passes 320 characters), and each released
 * delta split on its own. The one change: a patch line split across deltas stays hidden to its line
 * end, where 36f992247 dropped its start and showed the rest.
 */
function baseWireWithPatchLines(chunks) {
	let wire = "";
	let buffer = "";
	let inPatchLine = false;
	const release = () => {
		let text = buffer;
		buffer = "";
		if (inPatchLine) {
			const lineEnd = text.indexOf("\n");
			if (lineEnd < 0) {
				return;
			}
			text = text.slice(lineEnd);
			inPatchLine = false;
		}
		const spec = splitSpecFenceTextForStreaming(text);
		wire += splitDirectMediaTextForStreaming(spec.visibleText).visibleText;
		inPatchLine = spec.pendingText.length > 0;
	};
	for (const chunk of chunks) {
		buffer += chunk;
		if (!isClassifierIntentLeakCandidate(buffer) || (buffer.length > 320 && !parseClassifierIntentPayload(buffer))) {
			release();
		}
	}
	if (buffer && !parseClassifierIntentPayload(buffer)) {
		release();
	}
	return wire;
}

test("a reply with an unfenced patch line next to inline code or a code fence goes out as before", () => {
	const replies = [
		`Example: ${b}${PATCH_LINE}${b}\nDone.`,
		`Use ${b}x${b} here\n${PATCH_LINE}\nDone ${b}${b}y${b}${b}`,
		`Code:\n${T}json\n${PATCH_LINE}\n${T}\nAfter`,
		`${T}js\nx\n${T}\n${PATCH_LINE}\nDone`,
		`Before ${T}\n${PATCH_LINE}\n${T} after`,
	];
	for (const reply of replies) {
		for (const chunks of chunkingsOf(reply)) {
			assertStream(JSON.stringify(chunks), chunks, baseWireWithPatchLines(chunks));
		}
	}
});
