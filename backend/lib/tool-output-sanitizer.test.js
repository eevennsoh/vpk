const test = require("node:test");
const assert = require("node:assert/strict");

const {
	ASSISTANT_JSON_SUPPRESSION_TEXT,
	hasPendingSpecFence,
	sanitizeAssistantNarrative,
	splitSpecFenceTextForStreaming,
	stripSpecFences,
	toPreview,
} = require("./tool-output-sanitizer");

test("toPreview truncates long structured payloads and tracks byte size", () => {
	const payload = {
		calendarId: "team@example.com",
		events: Array.from({ length: 120 }, (_, index) => ({
			id: `event-${index}`,
			summary: `Event ${index}`,
			start: { dateTime: `2026-02-${String((index % 28) + 1).padStart(2, "0")}T10:00:00` },
			end: { dateTime: `2026-02-${String((index % 28) + 1).padStart(2, "0")}T11:00:00` },
			location: "Remote",
		})),
	};

	const preview = toPreview(payload, {
		maxChars: 320,
		maxLines: 8,
	});

	assert.equal(typeof preview.text, "string");
	assert.equal(preview.truncated, true);
	assert.ok(preview.text.length <= 320);
	assert.ok(preview.bytes > preview.text.length);
});

test("toPreview keeps short text untouched", () => {
	const preview = toPreview("Short output");
	assert.equal(preview.text, "Short output");
	assert.equal(preview.truncated, false);
	assert.equal(preview.bytes, "Short output".length);
});

test("sanitizeAssistantNarrative replaces large JSON-like dumps", () => {
	const rawJson = JSON.stringify(
		{
			calendarId: "esoh@atlassian.com",
			timeZone: "Australia/Sydney",
			events: Array.from({ length: 80 }, (_, index) => ({
				id: `evt-${index}`,
				summary: `Deep work ${index}`,
				htmlLink: `https://www.google.com/calendar/event?eid=${index}`,
			})),
		},
		null,
		2
	);
	const assistantText = `Let me fetch your Google Calendar events.\n${rawJson}`;

	const sanitized = sanitizeAssistantNarrative(assistantText, {
		maxChars: 600,
		replacement: ASSISTANT_JSON_SUPPRESSION_TEXT,
	});

	assert.equal(sanitized.replaced, true);
	assert.match(sanitized.text, /Tool results were large and are omitted/);
});

test("sanitizeAssistantNarrative does not replace long non-JSON prose", () => {
	const longProse = Array.from({ length: 300 }, () => "status update")
		.join(" ")
		.trim();
	const sanitized = sanitizeAssistantNarrative(longProse, { maxChars: 600 });

	assert.equal(sanitized.replaced, false);
	assert.equal(sanitized.text, longProse);
});

test("sanitizeAssistantNarrative does not suppress valid spec fences", () => {
	const specText = [
		"Here is the latest info.",
		"",
		"```spec",
		'{"op":"add","path":"/root","value":"main"}',
		'{"op":"add","path":"/elements/main","value":{"type":"Card","props":{"title":"Atlassian stock"},"children":["details"]}}',
		'{"op":"add","path":"/elements/details","value":{"type":"Text","props":{"content":"73.47 USD at close"},"children":[]}}',
		"```",
	].join("\n");

	const sanitized = sanitizeAssistantNarrative(specText, { maxChars: 200 });

	assert.equal(sanitized.replaced, false);
	assert.equal(sanitized.text, specText);
});

test("splitSpecFenceTextForStreaming hides complete spec fences from visible output", () => {
	const result = splitSpecFenceTextForStreaming(
		[
			"Intro paragraph.",
			"",
			"```spec",
			'{"op":"add","path":"/root","value":"main"}',
			"```",
			"",
			"Closing note.",
		].join("\n")
	);

	assert.equal(result.pendingText, "");
	assert.equal(result.visibleText, "Intro paragraph.\n\nClosing note.");
});

test("splitSpecFenceTextForStreaming buffers incomplete spec fences", () => {
	const text = [
		"Intro paragraph.",
		"",
		"```spec",
		'{"op":"add","path":"/root","value":"main"}',
	].join("\n");
	const result = splitSpecFenceTextForStreaming(text);

	assert.equal(result.visibleText, "Intro paragraph.\n\n");
	assert.equal(result.pendingText, '```spec\n{"op":"add","path":"/root","value":"main"}');
	assert.equal(hasPendingSpecFence(text), true);
	assert.equal(stripSpecFences(text), "Intro paragraph.");
});

test("stripSpecFences removes the captured partial spec failure tail", () => {
	const text = [
		"Good idea! Let me try that.",
		"",
		"```spec",
		'{"op":"add","path":"/root","value":"main"}',
		'{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"md"},"children":["header"]}}',
		'{"op":"add","path":"/',
		"",
		ASSISTANT_JSON_SUPPRESSION_TEXT,
	].join("\n");

	assert.equal(stripSpecFences(text), "Good idea! Let me try that.");
});

test("splitSpecFenceTextForStreaming strips unfenced JSONL spec patches from visible text", () => {
	const text = [
		"Here's the latest Atlassian share price data:",
		'{"op":"add","path":"/root","value":"main"}',
		'{"op":"add","path":"/elements/main","value":{"type":"Heading","props":{"text":"TEAM"},"children":[]}}',
		"Let me know if you need more.",
	].join("\n");

	const result = splitSpecFenceTextForStreaming(text);
	assert.equal(result.pendingText, "");
	assert.ok(
		result.visibleText.includes("share price"),
		"Visible text should include narrative"
	);
	assert.ok(
		result.visibleText.includes("more"),
		"Visible text should include closing"
	);
	assert.ok(
		!result.visibleText.includes('"op"'),
		"Visible text should NOT include JSONL patches"
	);
	assert.ok(
		!result.visibleText.includes("/elements/"),
		"Visible text should NOT include patch paths"
	);
});

test("hasPendingSpecFence detects trailing unfenced JSONL patch lines", () => {
	const text = [
		"Here is your data:",
		'{"op":"add","path":"/root","value":"main"}',
	].join("\n");

	assert.equal(
		hasPendingSpecFence(text),
		true,
		"Trailing unfenced patch line should be treated as pending spec content"
	);
});

test("hasPendingSpecFence returns false when no spec content is present", () => {
	assert.equal(hasPendingSpecFence("Just normal text"), false);
	assert.equal(hasPendingSpecFence(""), false);
});

test("stripSpecFences removes unfenced JSONL patches", () => {
	const text = [
		"Introduction.",
		'{"op":"add","path":"/root","value":"main"}',
		'{"op":"add","path":"/elements/main","value":{"type":"Card","props":{"title":"Test"}}}',
		"Conclusion.",
	].join("\n");

	const result = stripSpecFences(text);
	assert.ok(result.includes("Introduction"), "Should keep intro text");
	assert.ok(result.includes("Conclusion"), "Should keep closing text");
	assert.ok(!result.includes('"op"'), "Should strip JSONL patches");
});

test("splitSpecFenceTextForStreaming buffers a trailing partial unfenced patch line until it completes", () => {
	const firstChunk = [
		"You have 63 skills available.",
		'{"op":"add","path":"/elements/header","value":{"type":"Pag',
	].join("\n");
	const firstResult = splitSpecFenceTextForStreaming(firstChunk);

	assert.equal(
		firstResult.visibleText,
		"You have 63 skills available.\n",
		"Only the prose should be visible while the patch line is incomplete"
	);
	assert.equal(
		firstResult.pendingText,
		'{"op":"add","path":"/elements/header","value":{"type":"Pag',
		"The incomplete patch line should stay buffered"
	);

	const secondChunk = `${firstResult.pendingText}eHeader","props":{"title":"Available Skills"}}}\nAll set.`;
	const secondResult = splitSpecFenceTextForStreaming(secondChunk);

	assert.equal(secondResult.pendingText, "");
	assert.equal(
		secondResult.visibleText,
		"All set.",
		"The completed patch line should stay hidden once the chunk finishes"
	);
	assert.ok(
		!secondResult.visibleText.includes("PageHeader"),
		"Patch fragments must not leak into visible assistant text"
	);
});

test("a spec fence opens only where spec is the whole language", () => {
	// Before: every language starting with "spec" opened a pending spec fence and hid the rest.
	for (const text of ["A ```specs-not\nX\n```", "A ```specification\nY", "A ```spec-like tail", "A ```spec foo\nZ"]) {
		assert.deepEqual(splitSpecFenceTextForStreaming(text), { pendingText: "", visibleText: text }, text);
		assert.equal(hasPendingSpecFence(text), false, text);
		assert.equal(stripSpecFences(text), text, text);
	}
	// Whitespace after it, a newline, or the end of the text (still undecided) opens one.
	for (const opener of ["```spec", "```spec  ", "```SPEC\t", "```spec\n", "```spec \r\n"]) {
		assert.deepEqual(splitSpecFenceTextForStreaming(`A ${opener}`), { pendingText: opener, visibleText: "A " }, JSON.stringify(opener));
	}
});
