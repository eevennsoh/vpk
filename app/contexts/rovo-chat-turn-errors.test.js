const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

function loadTurnErrors() {
	const result = esbuild.buildSync({
		entryPoints: [path.join(process.cwd(), "app/contexts/rovo-chat-turn-errors.ts")],
		bundle: true,
		format: "cjs",
		loader: { ".css": "empty" },
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});
	return loadCjsModuleFromText(result.outputFiles[0].text, "rovo-chat-turn-errors.cjs");
}

const { createTurnError, hasTurnCompleteForActivePrompt, insertTurnErrors, isIncompleteTurnFinish, pruneTurnErrorsFrom } = loadTurnErrors();

const message = (id, role = "user", text = id) => ({ id, role, parts: [{ type: "text", text }] });
const errorMessage = (id) => message(id, "assistant", `error ${id}`);
const ids = (messages) => messages.map((item) => item.id);

test("createTurnError anchors to the last transcript message, or null for an empty transcript", () => {
	assert.equal(createTurnError(errorMessage("e1"), [message("u1"), message("a1", "assistant")]).anchorMessageId, "a1");
	assert.equal(createTurnError(errorMessage("e1"), []).anchorMessageId, null);
});

test("insertTurnErrors returns the same array when there are no errors", () => {
	const messages = [message("u1")];
	assert.equal(insertTurnErrors(messages, []), messages);
});

test("insertTurnErrors places each error after its anchor, leads with unanchored ones, and drops orphans", () => {
	const messages = [message("u1"), message("u2"), message("a2", "assistant")];
	const result = insertTurnErrors(messages, [
		{ anchorMessageId: "u1", message: errorMessage("e1") },
		{ anchorMessageId: null, message: errorMessage("e0") },
		{ anchorMessageId: "deleted", message: errorMessage("gone") },
		{ anchorMessageId: "a2", message: errorMessage("e2") },
	]);
	assert.deepEqual(ids(result), ["e0", "u1", "e1", "u2", "a2", "e2"]);
});

test("pruneTurnErrorsFrom drops errors on the edited message and later ones only", () => {
	const messages = [message("u1"), message("u2"), message("a2", "assistant")];
	const errors = [
		{ anchorMessageId: "u1", message: errorMessage("e1") },
		{ anchorMessageId: "u2", message: errorMessage("e2") },
		{ anchorMessageId: "a2", message: errorMessage("e3") },
	];
	assert.deepEqual(pruneTurnErrorsFrom(errors, messages, "u2").map((item) => item.message.id), ["e1"]);
	assert.equal(pruneTurnErrorsFrom(errors, messages, "missing"), errors);
});

test("pruneTurnErrorsFrom keeps an unanchored error unless the first message is edited", () => {
	const messages = [message("u1"), message("u2")];
	const errors = [{ anchorMessageId: null, message: errorMessage("e0") }];
	assert.deepEqual(pruneTurnErrorsFrom(errors, messages, "u2").map((item) => item.message.id), ["e0"]);
	assert.deepEqual(pruneTurnErrorsFrom(errors, messages, "u1"), []);
});

const promptUser = (id, promptId, text = id) => ({ ...message(id, "user", text), metadata: { promptId } });

test("hasTurnCompleteForActivePrompt reads only the latest assistant message after the active prompt's user message", () => {
	const prompt = { id: "q", text: "Hello", files: [], createdAt: 1_000 };
	const complete = { type: "data-turn-complete", data: { timestamp: new Date(2_000).toISOString() } };
	const user = promptUser("u1", "q", "Hello");
	assert.equal(hasTurnCompleteForActivePrompt([user, { ...message("a1", "assistant"), parts: [complete] }], prompt), true);
	assert.equal(hasTurnCompleteForActivePrompt([user, message("a1", "assistant", "partial")], prompt), false);
	assert.equal(
		hasTurnCompleteForActivePrompt([user, { ...message("a1", "assistant"), parts: [complete] }, message("a2", "assistant", "later")], prompt),
		false,
	);
	// A turn-complete from an earlier turn does not complete this one, even for the same text.
	assert.equal(
		hasTurnCompleteForActivePrompt([promptUser("u0", "earlier", "Hello"), { ...message("a0", "assistant"), parts: [complete] }], prompt),
		false,
	);
	assert.equal(hasTurnCompleteForActivePrompt([user], prompt), false);
});

// Regression: the signal's server timestamp used to be compared with the
// client's prompt.createdAt with 1 s of tolerance, so a client clock more than
// 1 s ahead flagged complete replies as cut short.
test("hasTurnCompleteForActivePrompt ignores the clocks: a server timestamp well before the prompt still completes it", () => {
	const prompt = { id: "q", text: "Hello", files: [], createdAt: Date.parse("2026-07-07T00:00:05.000Z") };
	const complete = { type: "data-turn-complete", data: { timestamp: "2026-07-07T00:00:01.000Z" } };
	const messages = [promptUser("u1", "q", "Hello"), { ...message("a1", "assistant"), parts: [complete] }];
	assert.equal(hasTurnCompleteForActivePrompt(messages, prompt), true);
	assert.equal(isIncompleteTurnFinish({ messages, isAbort: false, isError: false, activePrompt: prompt }), false);
});

test("isIncompleteTurnFinish flags only a clean finish that lacks turn-complete for the active prompt", () => {
	const prompt = { id: "q", text: "Hello", files: [], createdAt: 1_000 };
	const complete = { type: "data-turn-complete", data: { timestamp: new Date(2_000).toISOString() } };
	const partial = [promptUser("u1", "q", "Hello"), message("a1", "assistant", "partial")];
	const finished = [promptUser("u1", "q", "Hello"), { ...message("a1", "assistant"), parts: [complete] }];
	const base = { isAbort: false, isError: false, activePrompt: prompt };
	assert.equal(isIncompleteTurnFinish({ ...base, messages: partial }), true);
	assert.equal(isIncompleteTurnFinish({ ...base, messages: finished }), false);
	assert.equal(isIncompleteTurnFinish({ ...base, messages: partial, isAbort: true }), false);
	assert.equal(isIncompleteTurnFinish({ ...base, messages: partial, isError: true }), false);
	assert.equal(isIncompleteTurnFinish({ ...base, messages: partial, activePrompt: null }), false);
});
