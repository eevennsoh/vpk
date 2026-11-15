const assert = require("node:assert/strict");
const test = require("node:test");

const {
	STUDIO_MAIN_SURFACE_INITIAL_STATE: INITIAL,
	deriveStudioMainSurface: derive,
	studioMainSurfaceReducer: reduce,
} = require("./studio-main-surface-machine.ts");

const run = (events, state = INITIAL) => events.reduce(reduce, state);
const editing = (profileId, view = "configure") => run([{ type: "edit-agent", profileId }, { type: "set-agent-config-view", view }]);

test("the surface starts with no config pane, configure view, and both dialogs closed on the default tab", () => {
	assert.deepEqual(INITIAL, {
		agentConfig: null,
		agentConfigView: "configure",
		directory: { initialCategory: "brainstorm", open: false },
		templateDialog: { initialCategory: "brainstorm", open: false },
	});
});

test("a generated agent result opens its pane in the test view, remembering its message", () => {
	const state = reduce(editing("other", "insights"), { type: "agent-result-registered", profileId: "triage", sourceMessageId: "msg-1" });
	assert.deepEqual(state.agentConfig, { profileId: "triage", sourceMessageId: "msg-1" });
	assert.equal(state.agentConfigView, "test");
});

test("editing an agent opens it in the configure view, even from the test view of the same agent", () => {
	const state = reduce(editing("rfp", "test"), { type: "edit-agent", profileId: "rfp" });
	assert.deepEqual(state.agentConfig, { profileId: "rfp", sourceMessageId: null });
	assert.equal(state.agentConfigView, "configure");
});

test("opening a pane always makes a new target, so effects keyed on it re-run as before", () => {
	const first = reduce(INITIAL, { type: "edit-agent", profileId: "rfp" });
	const second = reduce(first, { type: "edit-agent", profileId: "rfp" });
	assert.notEqual(second.agentConfig, first.agentConfig);
	assert.deepEqual(second.agentConfig, first.agentConfig);
});

test("a directory pick opens an editable agent, or closes the pane for a built-in one, and closes the directory", () => {
	const browsing = run([{ type: "edit-agent", profileId: "rfp" }, { type: "set-agent-config-view", view: "test" }, { type: "open-directory", category: "summarize" }]);

	const editable = reduce(browsing, { type: "directory-agent-picked", profileId: "decision-director" });
	assert.deepEqual(editable.agentConfig, { profileId: "decision-director", sourceMessageId: null });
	assert.equal(editable.agentConfigView, "configure");
	assert.deepEqual(editable.directory, { initialCategory: "summarize", open: false }, "the tab is kept while the dialog animates out");

	const builtIn = reduce(browsing, { type: "directory-agent-picked", profileId: null });
	assert.equal(builtIn.agentConfig, null);
	assert.equal(builtIn.agentConfigView, "configure");
	assert.equal(builtIn.directory.open, false);
});

test("the directory and the template dialog open on their tab independently of the config pane", () => {
	const state = run([{ type: "edit-agent", profileId: "untitled" }, { type: "open-directory", category: "summarize" }]);
	assert.deepEqual(state.agentConfig, { profileId: "untitled", sourceMessageId: null }, "the directory opens over the pane");
	assert.deepEqual(state.directory, { initialCategory: "summarize", open: true });

	const both = reduce(state, { type: "open-template-dialog", category: "review" });
	assert.deepEqual(both.templateDialog, { initialCategory: "review", open: true });
	assert.equal(both.directory.open, true, "nothing makes the two dialogs exclusive today");

	const closed = run([{ type: "set-directory-open", open: false }, { type: "set-template-dialog-open", open: false }], both);
	assert.deepEqual([closed.directory, closed.templateDialog], [
		{ initialCategory: "summarize", open: false },
		{ initialCategory: "review", open: false },
	]);
	assert.deepEqual(closed.agentConfig, { profileId: "untitled", sourceMessageId: null });
});

test("picking a template prompt closes both dialogs and leaves the pane alone", () => {
	const state = run([
		{ type: "edit-agent", profileId: "untitled" },
		{ type: "open-directory", category: "analyze" },
		{ type: "open-template-dialog", category: "create" },
		{ type: "template-agent-picked" },
	]);
	assert.equal(state.directory.open, false);
	assert.equal(state.templateDialog.open, false);
	assert.deepEqual(state.agentConfig, { profileId: "untitled", sourceMessageId: null });
});

test("deleting the open agent closes its pane but keeps the view; deleting another agent changes nothing", () => {
	const open = editing("rfp", "test");
	assert.equal(reduce(open, { type: "agent-deleted", profileId: "other" }), open);
	const deleted = reduce(open, { type: "agent-deleted", profileId: "rfp" });
	assert.equal(deleted.agentConfig, null);
	assert.equal(deleted.agentConfigView, "test", "every path that opens a pane sets the view again");
});

test("closing the pane resets the view to configure, and is a no-op when already closed", () => {
	const closed = reduce(editing("rfp", "test"), { type: "close-agent-config" });
	assert.equal(closed.agentConfig, null);
	assert.equal(closed.agentConfigView, "configure");
	assert.equal(reduce(closed, { type: "close-agent-config" }), closed);
});

test("a URL restore keeps the view for the agent already open and opens a different one in configure", () => {
	const testing = editing("rfp", "test");

	const same = reduce(testing, { type: "agent-restored-from-url", profileId: "rfp" });
	assert.equal(same.agentConfigView, "test");
	assert.deepEqual(same.agentConfig, { profileId: "rfp", sourceMessageId: null });

	const other = reduce(testing, { type: "agent-restored-from-url", profileId: "triage" });
	assert.equal(other.agentConfigView, "configure");
	assert.deepEqual(other.agentConfig, { profileId: "triage", sourceMessageId: null });

	const none = reduce(testing, { type: "agent-restored-from-url", profileId: null });
	assert.equal(none.agentConfig, null);
	assert.equal(none.agentConfigView, "configure");

	const stale = reduce(INITIAL, { type: "set-agent-config-view", view: "test" });
	const restored = reduce(stale, { type: "agent-restored-from-url", profileId: null });
	assert.equal(restored.agentConfig, null);
	assert.equal(restored.agentConfigView, "configure", "with no pane open, a restore to no agent still resets the view");
});

test("unchanged events return the same state, so the shell skips a re-render", () => {
	assert.equal(reduce(INITIAL, { type: "set-agent-config-view", view: "configure" }), INITIAL);
	assert.equal(reduce(INITIAL, { type: "set-directory-open", open: false }), INITIAL);
	assert.equal(reduce(INITIAL, { type: "set-template-dialog-open", open: false }), INITIAL);
	assert.equal(reduce(INITIAL, { type: "template-agent-picked" }), INITIAL);
	const open = reduce(INITIAL, { type: "open-directory", category: "review" });
	assert.equal(reduce(open, { type: "open-directory", category: "review" }), open);
});

test("Reset demo returns to the initial state from anywhere", () => {
	const busy = run([
		{ type: "agent-result-registered", profileId: "triage", sourceMessageId: "msg-1" },
		{ type: "open-directory", category: "review" },
		{ type: "open-template-dialog", category: "create" },
	]);
	assert.equal(reduce(busy, { type: "reset" }), INITIAL);
});

const FACTS = {
	hasActiveThreadRun: false,
	hasAgentConfigPane: false,
	isArtifactOpen: false,
	isCustomAgentSelected: false,
	isLoadingThread: false,
	isStreaming: false,
	visibleMessageCount: 0,
};

test("an empty thread with the default agent is the agents home, without a chat header", () => {
	assert.deepEqual(derive(FACTS), { isDefaultAgentHomeState: true, shouldShowChatHeader: false, showHomeState: true });
});

test("an empty thread with a picked agent is that agent's landing, not the agents home", () => {
	assert.deepEqual(derive({ ...FACTS, isCustomAgentSelected: true }), { isDefaultAgentHomeState: false, shouldShowChatHeader: false, showHomeState: true });
});

test("the config pane wins over everything and hides the chat header, even with messages", () => {
	assert.deepEqual(derive({ ...FACTS, hasAgentConfigPane: true }), { isDefaultAgentHomeState: false, shouldShowChatHeader: false, showHomeState: true });
	assert.deepEqual(derive({ ...FACTS, hasAgentConfigPane: true, isStreaming: true, visibleMessageCount: 3 }), { isDefaultAgentHomeState: false, shouldShowChatHeader: false, showHomeState: false });
});

test("messages, a background run, an open artifact or a loading thread leave the home state", () => {
	assert.deepEqual(derive({ ...FACTS, visibleMessageCount: 2 }), { isDefaultAgentHomeState: false, shouldShowChatHeader: true, showHomeState: false });
	assert.deepEqual(derive({ ...FACTS, hasActiveThreadRun: true }), { isDefaultAgentHomeState: false, shouldShowChatHeader: true, showHomeState: false });
	assert.deepEqual(derive({ ...FACTS, isArtifactOpen: true }), { isDefaultAgentHomeState: false, shouldShowChatHeader: false, showHomeState: false });
	assert.deepEqual(derive({ ...FACTS, isLoadingThread: true }), { isDefaultAgentHomeState: false, shouldShowChatHeader: false, showHomeState: false });
});

test("streaming into an empty thread shows the chat header while the home is still up", () => {
	assert.deepEqual(derive({ ...FACTS, isStreaming: true }), { isDefaultAgentHomeState: true, shouldShowChatHeader: true, showHomeState: true });
});
