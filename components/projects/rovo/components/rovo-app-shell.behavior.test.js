// Characterization of the /rovo shell as a user meets it: the real page inside its layout's
// providers, against an in-memory backend. These pin behaviour before C-5 moves shell code
// into rovo-core, so each move can show it changed nothing a user sees or can do.
// Assertions compare booleans and strings, never elements: formatting a failed assertion on a
// happy-dom node walks the whole window graph and can hang (scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const {
	ARTIFACT_DOCUMENT,
	ARTIFACT_THREAD,
	createFakeRovoAppBackend,
	renderRovoAppPage,
	settle,
	sidebarState,
	waitFor,
} = require("../../rovo-core/test-utils/rovo-app-shell-harness.cjs");

const renderRovo = (options = {}) => renderRovoAppPage({
	pageSpecifier: "@/components/projects/rovo/page",
	queueProviderSpecifier: "@/app/rovo/rovo-queue-provider",
	...options,
});

const HOME_HEADING = "How can I help?";
const JQL_PROMPT = "Write a JQL query in Jira to find all unresolved bugs with priority Critical or Blocker assigned to my team in the current sprint.";

test("the home view greets, offers a composer and three starter prompts, and lists chats in the sidebar", async () => {
	const { view } = await renderRovo();

	assert.ok(view.queryByRole("heading", { name: HOME_HEADING }) !== null, "home greeting");
	assert.ok(view.queryByRole("textbox", { name: "Message" }) !== null, "message composer");
	assert.ok(view.queryByText("Describe what it should do") !== null, "Rovo's composer placeholder");
	for (const starter of ["Summarize this page", "Write a JQL query", "Draft release notes"]) {
		assert.ok(view.queryByRole("button", { name: starter }) !== null, `starter prompt ${starter}`);
	}
	assert.equal(view.queryByRole("button", { name: "Browse all agents" }) === null, true, "Studio's agent bento is not part of Rovo");
	assert.ok(view.getAllByRole("button", { name: "Chats" }).length > 0, "the sidebar's Chats section");
	assert.ok(view.queryByRole("button", { name: "New folder" }) !== null, "the sidebar's chat folder action");
	assert.equal(sidebarState(), "expanded");
});

test("the sidebar collapses and expands again from the header toggle", async () => {
	const { view } = await renderRovo();

	await view.click(view.getByRole("button", { name: "Collapse sidebar" }));
	await waitFor(() => sidebarState() === "collapsed", "the sidebar to collapse");
	assert.equal(sidebarState(), "collapsed");
	assert.ok(view.queryByRole("button", { name: "Expand sidebar" }) !== null, "the toggle now offers to expand");

	await view.click(view.getByRole("button", { name: "Expand sidebar" }));
	await waitFor(() => sidebarState() === "expanded", "the sidebar to expand");
	assert.equal(sidebarState(), "expanded");
	assert.ok(view.queryByRole("button", { name: "Collapse sidebar" }) !== null);
});

test("a starter prompt fills the composer; Enter sends it and the conversation replaces the home view", async () => {
	const backend = createFakeRovoAppBackend({ reply: "Here is the query." });
	const { view } = await renderRovo({ backend });

	await view.click(view.getByRole("button", { name: "Write a JQL query" }));
	const composer = view.getByRole("textbox", { name: "Message" });
	await waitFor(() => composer.textContent.length > 0, "the starter prompt to fill the composer");
	assert.equal(composer.textContent, JQL_PROMPT, "the starter's full prompt is in the composer");

	await view.press(composer, "Enter");
	await waitFor(() => view.queryByText("Here is the query.") !== null, "the streamed reply");
	assert.equal(view.queryByRole("heading", { name: HOME_HEADING }) === null, true, "home view is gone");
	assert.ok(view.queryByText("Here is the query.") !== null, "the streamed reply is shown");
	assert.equal(backend.state.chatRequests.length, 1, "one chat request");
	const [request] = backend.state.chatRequests;
	assert.equal(request.messages.at(-1).parts[0].text, JQL_PROMPT, "the prompt is the last user message sent");
	assert.equal(request.creationMode, undefined, "Rovo never sends Studio's agent-creation mode");
	assert.equal(request.chatSdkSource, undefined, "Rovo does not tag its requests as Studio's");
});

test("typing an app name lists directory matches in place of the starters; picking one inserts a mention", async () => {
	const { view } = await renderRovo();
	const composer = view.getByRole("textbox", { name: "Message" });

	await view.fill(composer, "Jira");
	await waitFor(() => view.queryByRole("button", { name: /^JiraPlans/u }) !== null, "directory matches");
	// The rows render one commit before the composer hands the shell its autocomplete controller;
	// a click in that gap does nothing, so let it land first.
	await settle(300);
	for (const match of [/^JiraPlans/u, /^Jira Service Management/u, /^Jira Product Discovery/u]) {
		assert.ok(view.queryByRole("button", { name: match }) !== null, `directory match ${match}`);
	}
	assert.equal(view.queryByRole("button", { name: "Write a JQL query" }) === null, true, "starter prompts are hidden while matches show");

	await view.click(view.getByRole("button", { name: /^JiraPlans/u }));
	await waitFor(() => composer.querySelector("[data-mention-category]") !== null, "the mention to be inserted");
	const mentions = [...composer.querySelectorAll("[data-mention-category]")].map((mention) => mention.textContent.trim());
	assert.deepEqual(mentions, ["Jira"], "the composer holds one Jira mention");
	assert.equal(view.queryByRole("button", { name: /^JiraPlans/u }) === null, true, "the match list closes");
	assert.ok(view.queryByRole("button", { name: "Write a JQL query" }) !== null, "starter prompts come back");
});

test("a saved thread with an artifact shows its card; opening it shows the artifact pane, closing hides it", async () => {
	const backend = createFakeRovoAppBackend({ documents: [ARTIFACT_DOCUMENT], threads: [ARTIFACT_THREAD] });
	const { view } = await renderRovo({ backend, props: { initialThreadId: ARTIFACT_THREAD.id } });
	await waitFor(() => view.queryByText("I drafted the notes.") !== null, "the saved thread to load");

	assert.ok(view.queryByText("I drafted the notes.") !== null, "the saved assistant turn is shown");
	assert.equal(view.queryByRole("button", { name: "Close artifact" }) === null, true, "no pane before opening");

	await view.click(view.getByRole("button", { name: "Open created document Release notes draft" }));
	await waitFor(() => view.queryByRole("button", { name: "Close artifact" }) !== null, "the artifact pane to open");
	for (const control of ["Close artifact", "Version history", "Edit artifact", "Copy artifact content", "Delete artifact"]) {
		assert.ok(view.queryByRole("button", { name: control }) !== null, `artifact pane control ${control}`);
	}

	await view.click(view.getByRole("button", { name: "Close artifact" }));
	await waitFor(() => view.queryByRole("button", { name: "Close artifact" }) === null, "the artifact pane to close");
	assert.equal(view.queryByRole("button", { name: "Close artifact" }) === null, true, "the pane closes");
	assert.ok(view.queryByText("I drafted the notes.") !== null, "the conversation stays");
});
