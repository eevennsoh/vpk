const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

function loadModule(fileName) {
	const result = esbuild.buildSync({
		entryPoints: [path.join(__dirname, fileName)],
		bundle: true,
		format: "cjs",
		loader: { ".css": "empty", ".png": "empty", ".svg": "empty" },
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});
	return loadCjsModuleFromText(result.outputFiles[0].text, `${fileName}.cjs`);
}

const layout = loadModule("chat-panel-layout.ts");
const localConversation = loadModule("chat-panel-local-conversation.ts");
const chatMessages = loadModule("chat-panel-messages.ts");

const BASE_LAYOUT_INPUT = {
	composerReservesContextBarSpace: false,
	containerStyle: undefined,
	emptyGreetingPlacement: "near-composer",
	greeting: undefined,
	hasMessages: false,
	isEditContextBarCollapsed: false,
	showAgentTestControls: false,
};

test("smart width classes split at the compact and regular chat widths", () => {
	assert.equal(layout.getSmartWidthClass(520), "compact");
	assert.equal(layout.getSmartWidthClass(521), "regular");
	assert.equal(layout.getSmartWidthClass(900), "regular");
	assert.equal(layout.getSmartWidthClass(901), "wide");
});

test("an empty default chat bottom-aligns its greeting at full height", () => {
	const result = layout.resolveChatPanelLayout(BASE_LAYOUT_INPUT);

	assert.equal(result.isAgentTestEmptyState, false);
	assert.equal(result.messagesContainerStyle.justifyContent, "flex-end");
	assert.equal(result.messagesContainerStyle.minHeight, "100%");
	assert.equal(result.messagesContainerStyle.paddingBottom, undefined);
});

test("a chat with messages starts at the top and stops growing", () => {
	const result = layout.resolveChatPanelLayout({ ...BASE_LAYOUT_INPUT, hasMessages: true });

	assert.equal(result.messagesContainerStyle.justifyContent, "flex-start");
	assert.equal(result.messagesContainerStyle.flex, "0 0 auto");
	assert.equal(result.messagesContainerStyle.minHeight, "100%");
});

test("third-party agents center the empty greeting", () => {
	const result = layout.resolveChatPanelLayout({ ...BASE_LAYOUT_INPUT, emptyGreetingPlacement: "centered" });

	assert.equal(result.messagesContainerStyle.justifyContent, "center");
});

test("agent Test bottom-aligns starters and reserves the sibling context-bar footprint", () => {
	const greeting = { suggestions: [{ label: "Draft a reply" }] };
	const withoutReserve = layout.resolveChatPanelLayout({
		...BASE_LAYOUT_INPUT,
		greeting,
		showAgentTestControls: true,
	});
	const withReserve = layout.resolveChatPanelLayout({
		...BASE_LAYOUT_INPUT,
		composerReservesContextBarSpace: true,
		greeting,
		showAgentTestControls: true,
	});

	assert.equal(withoutReserve.isAgentTestEmptyState, true);
	assert.equal(withoutReserve.messagesContainerStyle.justifyContent, "flex-end");
	assert.equal(withoutReserve.messagesContainerStyle.flex, "1 1 auto");
	assert.equal(withoutReserve.messagesContainerStyle.paddingBottom, undefined);
	// 24px content padding + 48px context bar - 12px Test composer gap.
	assert.equal(withReserve.messagesContainerStyle.paddingBottom, "60px");
});

test("agent Test without starters centers the greeting", () => {
	const result = layout.resolveChatPanelLayout({
		...BASE_LAYOUT_INPUT,
		composerReservesContextBarSpace: true,
		greeting: { suggestions: [] },
		showAgentTestControls: true,
	});

	assert.equal(result.messagesContainerStyle.justifyContent, "center");
	assert.equal(result.messagesContainerStyle.paddingBottom, undefined);
});

test("a collapsed edit context bar hides the greeting", () => {
	const greeting = { heading: "Hi" };

	assert.equal(layout.resolveChatPanelLayout({ ...BASE_LAYOUT_INPUT, greeting }).resolvedGreeting, greeting);
	assert.equal(
		layout.resolveChatPanelLayout({ ...BASE_LAYOUT_INPUT, greeting, isEditContextBarCollapsed: true }).resolvedGreeting,
		undefined,
	);
});

test("a hugging greeting in a grid host switches the host to auto rows", () => {
	const containerStyle = { display: "grid", gap: 8 };
	const hugging = layout.resolveChatPanelLayout({
		...BASE_LAYOUT_INPUT,
		containerStyle,
		greeting: { showHero: false },
	});
	const regular = layout.resolveChatPanelLayout({ ...BASE_LAYOUT_INPUT, containerStyle });

	assert.deepEqual(hugging.resolvedContainerStyle, { display: "grid", gap: 8, gridTemplateRows: "auto auto" });
	assert.equal(hugging.messagesContainerStyle.minHeight, "auto");
	assert.equal(regular.resolvedContainerStyle, containerStyle);
});

test("custom agent tabs appear only for custom-agent bylines", () => {
	assert.equal(layout.isCustomAgentTabsProfile({ byline: "Custom agent by Ada" }), true);
	assert.equal(layout.isCustomAgentTabsProfile({ byline: "Rovo agent" }), false);
	assert.equal(layout.isCustomAgentTabsProfile({}), false);
});

test("local conversation results count as handled unless they opt out", () => {
	assert.equal(localConversation.isLocalConversationSubmitHandled(undefined), true);
	assert.equal(localConversation.isLocalConversationSubmitHandled(true), true);
	assert.equal(localConversation.isLocalConversationSubmitHandled({ voiceText: "Hi" }), true);
	assert.equal(localConversation.isLocalConversationSubmitHandled(false), false);
	assert.equal(localConversation.isLocalConversationSubmitHandled({ handled: false }), false);
});

test("local conversation voice text is trimmed and only read from detail objects", () => {
	assert.equal(localConversation.getLocalConversationVoiceText({ voiceText: "  Hello there  " }), "Hello there");
	assert.equal(localConversation.getLocalConversationVoiceText(true), "");
	assert.equal(localConversation.getLocalConversationVoiceText({ handled: true }), "");
});

test("local conversation voice suppression scales with words inside its bounds", () => {
	assert.equal(localConversation.getLocalConversationVoiceSuppressionMs("Hi"), 2200);
	// 10 words * 280ms + 900ms buffer.
	assert.equal(localConversation.getLocalConversationVoiceSuppressionMs("one two three four five six seven eight nine ten"), 3700);
	assert.equal(localConversation.getLocalConversationVoiceSuppressionMs("word ".repeat(100)), 12000);
});

function message(id, role, parts = []) {
	return { id, role, parts };
}

const CREATED_AGENT = { agentId: "agent-1", name: "Helper", action: "create" };
const TURN_COMPLETE = { type: "data-turn-complete", data: {} };

test("the last assistant message id skips trailing user messages", () => {
	assert.equal(chatMessages.getLastAssistantMessageId([]), null);
	assert.equal(
		chatMessages.getLastAssistantMessageId([message("u1", "user"), message("a1", "assistant"), message("u2", "user")]),
		"a1",
	);
});

test("answered traces are assistant messages followed by a later user message, when enabled", () => {
	const messages = [message("a1", "assistant"), message("u1", "user"), message("a2", "assistant")];

	assert.deepEqual([...chatMessages.getAnsweredTraceMessageIds(messages, true)], ["a1"]);
	assert.deepEqual([...chatMessages.getAnsweredTraceMessageIds(messages, false)], []);
});

test("the generated agent fallback card hides once a completed turn carries the same agent", () => {
	const pending = [message("a1", "assistant", [{ type: "data-agent-result", data: CREATED_AGENT }])];
	const completed = [message("a1", "assistant", [{ type: "data-agent-result", data: CREATED_AGENT }, TURN_COMPLETE])];
	const otherAgent = [message("a1", "assistant", [{ type: "data-agent-result", data: { ...CREATED_AGENT, agentId: "agent-2" } }, TURN_COMPLETE])];

	assert.equal(chatMessages.shouldRenderGeneratedAgentFallbackCard(CREATED_AGENT, pending), true);
	assert.equal(chatMessages.shouldRenderGeneratedAgentFallbackCard(CREATED_AGENT, completed), false);
	assert.equal(chatMessages.shouldRenderGeneratedAgentFallbackCard(CREATED_AGENT, otherAgent), true);
	assert.equal(chatMessages.shouldRenderGeneratedAgentFallbackCard({ ...CREATED_AGENT, action: "update" }, pending), false);
	assert.equal(chatMessages.shouldRenderGeneratedAgentFallbackCard(null, pending), false);
});

test("turn results prefer a completed generated agent over the same message's artifact", () => {
	const artifact = { documentId: "doc-1", title: "Doc", kind: "text", action: "create" };
	const turn = [
		message("a1", "assistant", [{ type: "data-artifact-result", data: artifact }]),
		message("a2", "assistant", [
			{ type: "data-artifact-result", data: artifact },
			{ type: "data-agent-result", data: CREATED_AGENT },
			TURN_COMPLETE,
		]),
		message("a3", "assistant", [{ type: "data-agent-result", data: CREATED_AGENT }]),
	];

	assert.deepEqual(chatMessages.getTurnGeneratedResults(turn, undefined), [
		{ type: "artifact", result: artifact },
		{ type: "agent", result: CREATED_AGENT },
		// a3's agent is not complete yet, so it renders nothing.
	]);
});

test("a host can veto a generated agent card, which lets the artifact show instead", () => {
	const artifact = { documentId: "doc-1", title: "Doc", kind: "text", action: "create" };
	const turn = [
		message("a1", "assistant", [
			{ type: "data-artifact-result", data: artifact },
			{ type: "data-agent-result", data: CREATED_AGENT },
			TURN_COMPLETE,
		]),
	];
	const seen = [];
	const results = chatMessages.getTurnGeneratedResults(turn, (input) => {
		seen.push(input.message.id);
		return false;
	});

	assert.deepEqual(seen, ["a1"]);
	assert.deepEqual(results, [{ type: "artifact", result: artifact }]);
});
