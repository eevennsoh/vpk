const assert = require("node:assert/strict");
const test = require("node:test");

const {
	SUMMARY_HEADER,
	buildConversationSummary,
	compressConversation,
	extractFilePaths,
} = require("./conversation-compression");

function makeMessages(count, charsPerMsg = 500) {
	const messages = [];
	for (let i = 0; i < count; i += 1) {
		messages.push({
			role: i % 2 === 0 ? "user" : "assistant",
			content: `Message ${i}: ${"x".repeat(charsPerMsg)}`,
		});
	}
	return messages;
}

test("below threshold returns messages unchanged", () => {
	const messages = makeMessages(2, 100);
	const result = compressConversation(messages, { thresholdChars: 100_000, tailCount: 2 });
	assert.equal(result.length, messages.length);
	assert.equal(result.compressed, false);
});

test("above threshold compresses older messages", () => {
	const messages = makeMessages(20, 500);
	const result = compressConversation(messages, { thresholdChars: 5000, tailCount: 4 });
	assert.ok(result.length < messages.length);
	assert.equal(result.compressed, true);
});

test("tail messages preserved verbatim", () => {
	const messages = makeMessages(20, 500);
	const tailCount = 4;
	const result = compressConversation(messages, { thresholdChars: 5000, tailCount });
	const originalTail = messages.slice(-tailCount);
	const resultTail = result.messages.slice(-tailCount);
	for (let i = 0; i < tailCount; i += 1) {
		assert.equal(resultTail[i].content, originalTail[i].content);
		assert.equal(resultTail[i].role, originalTail[i].role);
	}
});

test("summary message has expected header", () => {
	const messages = makeMessages(20, 500);
	const result = compressConversation(messages, { thresholdChars: 5000, tailCount: 4 });
	const summaryMsg = result.messages.find(
		(m) => m.role === "system" && m.content.includes(SUMMARY_HEADER),
	);
	assert.ok(summaryMsg, "No summary message found");
});

test("summary contains structured sections", () => {
	const messages = [
		{ role: "user", content: "Help me refactor the auth module in backend/auth.js" },
		{ role: "assistant", content: "I'll start by reading backend/auth.js and understanding the current structure." },
		{ role: "user", content: "Also check backend/middleware/session.js" },
		{ role: "assistant", content: "I've reviewed both files. The auth module uses JWT tokens stored in cookies." },
	];
	const summary = buildConversationSummary(messages);
	assert.ok(summary.includes("## Goal"), "Missing Goal section");
	assert.ok(summary.includes("## Progress"), "Missing Progress section");
	assert.ok(summary.includes("## Key Decisions"), "Missing Key Decisions section");
	assert.ok(summary.includes("## Files Referenced"), "Missing Files section");
	assert.ok(summary.includes("## Next Steps"), "Missing Next Steps section");
});

test("extractFilePaths finds file paths in text", () => {
	const text = "I edited backend/auth.js and components/ui/button.tsx";
	const paths = extractFilePaths(text);
	assert.ok(paths.has("backend/auth.js"));
	assert.ok(paths.has("components/ui/button.tsx"));
});

test("extractFilePaths ignores URLs", () => {
	const text = "Visit https://example.com/page.html for docs";
	const paths = extractFilePaths(text);
	assert.equal(paths.size, 0);
});

test("subsequent compression updates summary instead of duplicating", () => {
	const messages = makeMessages(20, 500);
	const first = compressConversation(messages, { thresholdChars: 5000, tailCount: 4 });
	// Add more messages to push over threshold again
	const extended = [...first.messages];
	for (let i = 0; i < 10; i += 1) {
		extended.push({ role: "user", content: `Follow-up ${i}: ${"z".repeat(500)}` });
		extended.push({ role: "assistant", content: `Response ${i}: ${"w".repeat(500)}` });
	}
	const second = compressConversation(extended, { thresholdChars: 5000, tailCount: 4 });
	const summaryCount = second.messages.filter(
		(m) => m.role === "system" && m.content.includes(SUMMARY_HEADER),
	).length;
	assert.equal(summaryCount, 1, `Expected 1 summary but found ${summaryCount}`);
});

test("empty messages returns empty", () => {
	const result = compressConversation([], { thresholdChars: 1000, tailCount: 2 });
	assert.equal(result.messages.length, 0);
	assert.equal(result.compressed, false);
});

test("fewer messages than tailCount returns unchanged", () => {
	const messages = makeMessages(3, 1000);
	const result = compressConversation(messages, { thresholdChars: 100, tailCount: 5 });
	assert.equal(result.messages.length, messages.length);
	assert.equal(result.compressed, false);
});
