const assert = require("node:assert/strict");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require("../../../../scripts/lib/esbuild-cjs-loader.js");
const compiled = esbuild.buildSync({
	entryPoints: ["components/projects/shared/lib/process-assistant-message.ts"],
	bundle: true, platform: "node", format: "cjs", write: false,
});
const { readAssistantMessage, presentAssistantMessageText } = loadCjsModuleFromText(compiled.outputFiles[0].text);
const message = (parts) => ({ id: "assistant", role: "assistant", parts });
const data = (type, value) => ({ type: `data-${type}`, data: value });

test("reads latest events and ordered histories without losing streaming text", () => {
	const facts = readAssistantMessage(message([
		{ type: "text", text: "First", state: "done" },
		data("thinking-status", { label: "Working" }),
		data("thinking-event", { label: "One" }),
		{ type: "text", text: "Second", state: "streaming" },
		data("thinking-status", { label: "Done" }),
		data("thinking-event", { label: "Two" }),
		data("suggested-questions", { questions: ["Old"] }),
		data("suggested-questions", { questions: ["Latest"] }),
		data("turn-complete", {}),
	]));
	assert.equal(facts.rawMessageText, "First\n\nSecond");
	assert.equal(facts.isStreaming, true);
	assert.equal(facts.hasTurnComplete, true);
	assert.equal(facts.thinkingStatusPart.data.label, "Done");
	assert.deepEqual(facts.thinkingStatusParts.map((part) => part.data.label), ["Working", "Done"]);
	assert.deepEqual(facts.thinkingEventParts.map((part) => part.data.label), ["One", "Two"]);
	assert.deepEqual(facts.suggestedQuestions, ["Latest"]);
});

test("widget facts prefer valid payload types before loading and errors", () => {
	const facts = readAssistantMessage(message([
		data("widget-error", { type: "question-card" }),
		data("widget-loading", { type: "plan", loading: true }),
		data("widget-data", { type: " genui-preview ", payload: {} }),
		data("widget-data", { type: "", payload: {} }),
	]));
	assert.equal(facts.widgetType, "genui-preview");
	assert.equal(facts.widgetDataParts.length, 1);
	assert.equal(facts.isWidgetLoading, true);
	assert.equal(readAssistantMessage(message([data("widget-loading", { type: "plan" })])).widgetType, "plan");
	assert.equal(readAssistantMessage(message([data("widget-error", { type: "question-card" })])).widgetType, "question-card");
});

test("text presentation follows the surface's chosen widget while preserving raw facts", () => {
	const facts = readAssistantMessage(message([
		{ type: "text", text: "X\nSummary\n\nAction items\n- [ ] Do the thing", state: "done" },
		data("widget-data", { type: "genui-preview", payload: {} }),
	]));
	const plan = presentAssistantMessageText(facts, "plan");
	assert.equal(plan.messageText.includes("Action items"), false);
	assert.equal(plan.messageText.includes("Summary"), true);
	assert.equal(facts.rawMessageText.startsWith("X"), true);
	assert.equal(presentAssistantMessageText(facts).messageText.includes("Action items"), true);
});

test("empty messages produce usable absent facts and empty text", () => {
	const facts = readAssistantMessage(message([]));
	assert.equal(facts.widgetType, undefined);
	assert.equal(facts.widgetDataPart, null);
	assert.equal(facts.routeDecision, null);
	assert.equal(facts.isStreaming, false);
	assert.deepEqual(facts.sources, []);
	assert.equal(presentAssistantMessageText(facts).messageText, "");
});
