// Characterization of the /studio shell as a user meets it: the real page inside its layout's
// providers, against an in-memory backend. These pin behaviour before C-5 moves shell code
// into rovo-core and before SM-FE-14 models the Studio main surface.
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

const renderStudio = (options = {}) => renderRovoAppPage({
	pageSpecifier: "@/components/projects/studio/page",
	queueProviderSpecifier: "@/app/studio/rovo-queue-provider",
	...options,
});

const HOME_HEADING = "Move work forward with agents";
const DECISION_DIRECTOR_PROMPT = "Build a Rovo agent named Decision Director that reviews DACI decision documents in Confluence, suggests improvements, identifies missing context, and points to useful Jira Product Discovery resources.";
const dialogNames = () => [...document.querySelectorAll("[role=dialog]")].map((dialog) => dialog.getAttribute("aria-label") ?? document.getElementById(dialog.getAttribute("aria-labelledby") ?? "")?.textContent ?? "").join(",");

test("the agents home shows the starter bento, a composer and the agents table, with the seeded demo agent", async () => {
	const { view } = await renderStudio();

	assert.ok(view.queryByRole("heading", { name: HOME_HEADING }), "agents home heading");
	assert.ok(view.queryByRole("textbox", { name: "Message" }), "message composer");
	assert.ok(view.queryByRole("button", { name: "Use prompt starter: Decision Director" }), "bento prompt starter");
	assert.ok(view.queryByRole("button", { name: "Browse all agents" }), "bento browse action");
	for (const tab of ["My agents", "By teams", "By companies"]) {
		assert.ok(view.queryByRole("button", { name: tab }), `agents table tab ${tab}`);
	}
	assert.ok(view.queryByRole("button", { name: "Edit RFP Drafter" }), "the seeded RFP demo agent is listed");
	assert.ok(view.queryByRole("button", { name: "Create agent" }), "sidebar create action");
	assert.ok(view.queryByRole("button", { name: "View all agents" }), "sidebar agents link");
	assert.equal(view.queryByRole("button", { name: "Write a JQL query" }), null, "Rovo's prompt gallery is not part of Studio");
	assert.equal(sidebarState(), "expanded");
});

test("the sidebar collapses and expands again from the header toggle", async () => {
	const { view } = await renderStudio();

	await view.click(view.getByRole("button", { name: "Collapse sidebar" }));
	await waitFor(() => sidebarState() === "collapsed", "the sidebar to collapse");
	assert.equal(sidebarState(), "collapsed");
	assert.ok(view.queryByRole("button", { name: "Expand sidebar" }), "the toggle now offers to expand");

	await view.click(view.getByRole("button", { name: "Expand sidebar" }));
	await waitFor(() => sidebarState() === "expanded", "the sidebar to expand");
	assert.equal(sidebarState(), "expanded");
});

test("Browse all agents opens the agent directory and Escape closes it", async () => {
	const { view } = await renderStudio();

	assert.equal(dialogNames(), "");
	await view.click(view.getByRole("button", { name: "Browse all agents" }));
	await waitFor(() => dialogNames() !== "", "the directory dialog to open");
	assert.equal(dialogNames(), "Browse agents");

	await view.press(null, "Escape");
	await waitFor(() => dialogNames() === "", "the directory dialog to close");
	assert.equal(dialogNames(), "");
	assert.ok(view.queryByRole("heading", { name: HOME_HEADING }), "back on the agents home");
});

test("a sidebar agent opens its config pane; Ask Rovo opens the docked chat; View all agents returns home", async () => {
	const { view } = await renderStudio();

	await view.click(view.getAllByRole("button", { name: "RFP Drafter" })[0]);
	await waitFor(() => view.queryByRole("button", { name: "Publish" }) !== null, "the config pane to open");
	// Give any automatic Ask Rovo opening the same chance it gets in the Create agent test.
	await settle(300);
	assert.equal(view.queryByRole("heading", { name: HOME_HEADING }), null, "home is replaced by the config pane");
	for (const control of ["Publish", "Edit agent name", "Toggle agent test view"]) {
		assert.ok(view.queryByRole("button", { name: control }), `config pane control ${control}`);
	}
	assert.ok(view.queryByRole("textbox", { name: "Agent instructions" }), "instructions editor");
	assert.equal(view.queryByRole("heading", { name: "Improve your agent?" }), null, "the docked Ask Rovo chat starts closed (inert)");

	await view.click(view.getByRole("button", { name: "Ask Rovo" }));
	await waitFor(() => view.queryByRole("heading", { name: "Improve your agent?" }) !== null, "the docked Ask Rovo chat to open");
	assert.ok(view.queryByRole("heading", { name: "Improve your agent?" }), "Ask Rovo greeting in the docked chat");
	assert.ok(view.queryByRole("textbox", { name: "Chat message input" }), "Ask Rovo composer");

	await view.click(view.getByRole("button", { name: "View all agents" }));
	await waitFor(() => view.queryByRole("heading", { name: HOME_HEADING }) !== null, "the agents home");
	assert.ok(view.queryByRole("heading", { name: HOME_HEADING }), "back on the agents home");
	assert.equal(view.queryByRole("button", { name: "Publish" }), null, "config pane is closed");
});

test("Create agent opens a blank Untitled agent with the Ask Rovo chat already open", async () => {
	const { view } = await renderStudio();

	await view.click(view.getByRole("button", { name: "Create agent" }));
	await waitFor(() => view.queryByRole("heading", { name: "Improve your agent?" }) !== null, "the new agent with Ask Rovo open");
	assert.equal(view.queryByRole("heading", { name: HOME_HEADING }), null, "home is replaced by the new agent's config");
	assert.equal(view.getByRole("button", { name: "Edit agent name" }).textContent.trim(), "Untitled agent");
	assert.ok(view.queryByRole("heading", { name: "Improve your agent?" }), "Ask Rovo opens with the new agent");
	assert.ok(view.queryByRole("textbox", { name: "Chat message input" }), "Ask Rovo composer");
});

test("a bento starter fills the composer; Enter starts agent creation and the conversation replaces home", async () => {
	const backend = createFakeRovoAppBackend({ reply: "Let's build it." });
	const { view } = await renderStudio({ backend });

	await view.click(view.getByRole("button", { name: "Use prompt starter: Decision Director" }));
	const composer = view.getByRole("textbox", { name: "Message" });
	await waitFor(() => composer.textContent.length > 0, "the starter prompt to fill the composer");
	assert.equal(composer.textContent, DECISION_DIRECTOR_PROMPT, "the starter's prompt is in the composer");

	await view.press(composer, "Enter");
	await waitFor(() => view.queryByText("Let's build it.") !== null, "the streamed reply");
	assert.equal(view.queryByRole("heading", { name: HOME_HEADING }), null, "home view is gone");
	assert.ok(view.queryByText("Let's build it."), "the streamed reply is shown");
	assert.equal(backend.state.chatRequests.length, 1, "one chat request");
	const [request] = backend.state.chatRequests;
	assert.equal(request.messages.at(-1).parts[0].text, DECISION_DIRECTOR_PROMPT, "the prompt is the last user message sent");
	assert.equal(request.creationMode, "agent", "a home submit is an agent-creation turn");
	assert.equal(request.chatSdkSource, "studio", "Studio tags its chat requests");
	assert.match(request.contextDescription ?? "", /\S/u, "agent-creation context goes with the turn");
});

test("a saved thread with an artifact shows its card; opening it shows the artifact pane, closing hides it", async () => {
	const backend = createFakeRovoAppBackend({ documents: [ARTIFACT_DOCUMENT], threads: [ARTIFACT_THREAD] });
	const { view } = await renderStudio({ backend, props: { initialThreadId: ARTIFACT_THREAD.id } });
	await waitFor(() => view.queryByText("I drafted the notes.") !== null, "the saved thread to load");

	assert.ok(view.queryByText("I drafted the notes."), "the saved assistant turn is shown");
	assert.equal(view.queryByRole("button", { name: "Close artifact" }), null, "no pane before opening");

	await view.click(view.getByRole("button", { name: "Open created document Release notes draft" }));
	await waitFor(() => view.queryByRole("button", { name: "Close artifact" }) !== null, "the artifact pane to open");
	for (const control of ["Close artifact", "Version history", "Edit artifact", "Copy artifact content", "Delete artifact"]) {
		assert.ok(view.queryByRole("button", { name: control }), `artifact pane control ${control}`);
	}

	await view.click(view.getByRole("button", { name: "Close artifact" }));
	await waitFor(() => view.queryByRole("button", { name: "Close artifact" }) === null, "the artifact pane to close");
	assert.equal(view.queryByRole("button", { name: "Close artifact" }), null, "the pane closes");
	assert.ok(view.queryByText("I drafted the notes."), "the conversation stays");
});
