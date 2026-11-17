const test = require("node:test");
const assert = require("node:assert/strict");

const {
	findDirectMediaFenceBody,
	splitDirectMediaTextForStreaming,
	stripDirectMediaFences,
} = require("./direct-media-fence");

test("splitDirectMediaTextForStreaming keeps narrative and buffers an incomplete media fence", () => {
	const result = splitDirectMediaTextForStreaming(
		"Here you go.\n```image\n{\"prompt\":\"Draw a cat\"}"
	);

	assert.equal(result.visibleText, "Here you go.\n");
	assert.equal(result.pendingText, "```image\n{\"prompt\":\"Draw a cat\"}");
});

test("splitDirectMediaTextForStreaming removes completed direct-media fences from streamed text", () => {
	const result = splitDirectMediaTextForStreaming(
		"Before\n```audio\n{\"text\":\"Hello\"}\n```\nAfter"
	);

	assert.equal(result.pendingText, "");
	assert.equal(result.visibleText, "Before\n\nAfter");
});

test("stripDirectMediaFences removes image and audio fences while preserving surrounding narrative", () => {
	const result = stripDirectMediaFences(
		[
			"Intro",
			"```image",
			"{\"prompt\":\"Sunset\"}",
			"```",
			"Middle",
			"```audio",
			"{\"text\":\"Narration\"}",
			"```",
			"Outro",
		].join("\n")
	);

	assert.equal(result, "Intro\n\nMiddle\n\nOutro");
});

const T = "```";

test("backticks inside a media body do not close the block", () => {
	// Before: the block ended at the first backticks, so the rest of the body went out as text:
	// visible '\n\njs"}\n```' and stripped 'js"}\n```'.
	for (const text of [
		`${T}image\n{"prompt":"${T}js"}\n${T}`,
		`${T}audio\n{"text":"say ${T} twice"}\n${T}`,
		`${T}image\na plain ${T}js body\n${T}`,
		`${T}image\n{\n  "prompt": "use ${T}js"\n}\n${T}`,
	]) {
		assert.deepEqual(splitDirectMediaTextForStreaming(`A\n${text}\nB`), { pendingText: "", visibleText: "A\n\n\nB".replace(/\n{3,}/gu, "\n\n") }, text);
		assert.equal(stripDirectMediaFences(`A\n${text}\nB`), "A\n\nB", text);
	}
});

test("a media block closes at backticks that start or end their line, or follow its JSON object", () => {
	for (const [text, visibleText] of [
		// The closing fence on its own line, as the model is told to write it.
		[`A\n${T}image\n{"prompt":"sunset"}\n${T}\nB`, "A\n\n\nB"],
		// At the start of its line, with text after it.
		[`A ${T}image\nsunset\n${T} Outro`, "A \n\n Outro"],
		// At the end of the line of the body's last text, or of the text.
		[`A ${T}image\nsunset${T}\nB`, "A \n\n\nB"],
		[`A ${T}audio\nhello${T}  \r\nB`, "A \n\n  \r\nB"],
		[`A ${T}image\nsunset${T}`, "A \n\n"],
		// Right after the JSON object that opens the body, whatever follows on the line.
		[`A ${T}image\n{"prompt":"x"}${T}Outro`, "A \n\nOutro"],
		[`A ${T}image\n{"prompt":"x"} ${T} and more`, "A \n\n and more"],
		// A longer run closes at its first three backticks, as before.
		[`A ${T}image\nsunset${T}\`\nB`, "A \n\n`\nB"],
	]) {
		assert.equal(splitDirectMediaTextForStreaming(text).visibleText, visibleText.replace(/\n{3,}/gu, "\n\n"), text);
		assert.equal(splitDirectMediaTextForStreaming(text).pendingText, "", text);
	}
});

test("backticks with text on both sides of them on their line keep the block open", () => {
	// The same text as backticks inside a body: the block stays open to the end of the text.
	for (const text of [`A ${T}image\nsunset${T}Outro`, `A ${T}image\nsunset ${T} more`, `A ${T}image\n{"prompt":"x"} done${T}x`]) {
		assert.deepEqual(splitDirectMediaTextForStreaming(text), { pendingText: text.slice(2), visibleText: "A " }, text);
		assert.equal(stripDirectMediaFences(text), "A", text);
	}
});

test("findDirectMediaFenceBody reads the whole body of the first closed block of each kind", () => {
	const text = `Intro\n${T}image\n{"prompt":"draw ${T}js"}\n${T}\n${T}audio\n{"text":"say ${T}"}${T}\nOutro`;
	assert.equal(findDirectMediaFenceBody(text, "image"), `{"prompt":"draw ${T}js"}\n`);
	assert.equal(findDirectMediaFenceBody(text, "audio"), `{"text":"say ${T}"}`);
	assert.equal(findDirectMediaFenceBody(`${T}image\n{"prompt":"open ${T}js"}`, "image"), null);
	assert.equal(findDirectMediaFenceBody("no blocks", "audio"), null);
});

test("finding a media block's end is linear in the text", () => {
	// Many backtick runs that close nothing, and long runs of spaces between them.
	const body = `{"prompt":"${`x${T}y ${" ".repeat(50)}`.repeat(4000)}`;
	const started = process.hrtime.bigint();
	const result = splitDirectMediaTextForStreaming(`A\n${T}image\n${body}`);
	const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
	assert.equal(result.visibleText, "A\n");
	assert.ok(elapsedMs < 500, `${elapsedMs} ms`);
});
