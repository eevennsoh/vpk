// Characterization of the /studio main surface: which of the agents home, the chat, the agent
// config pane (configure or test view) and the agent directory a user sees, and how each user
// action moves between them. Pins today's transitions before SM-FE-14 gives the surface an
// explicit state machine. Rendered through the same harness as rovo-app-shell.behavior.test.js.
// Assertions compare booleans and strings, never elements (see scripts/lib/render-component.js).
const assert = require("node:assert/strict");
const test = require("node:test");
const { accessibleName } = require("../../../../scripts/lib/render-component.js");
const {
	createFakeRovoAppBackend,
	renderRovoAppPage,
	settle,
	waitFor,
} = require("../../rovo-core/test-utils/rovo-app-shell-harness.cjs");

// happy-dom keeps the URL between tests, and a leftover `?agent=` skips seeding the demo agent.
function renderStudio(options = {}) {
	window.history.replaceState(null, "", "/");
	return renderRovoAppPage({
		pageSpecifier: "@/components/projects/studio/page",
		queueProviderSpecifier: "@/app/studio/rovo-queue-provider",
		...options,
	});
}

const HOME_HEADING = "Move work forward with agents";
const RFP_AGENT_ID = "rfp-drafting-agent";
const GENERATED_AGENT_RESULT = {
	action: "create",
	agentId: "triage-helper",
	conversationStarters: ["Triage today's bugs"],
	description: "Triages incoming bugs.",
	name: "Triage Helper",
	summary: "Triages incoming bugs.",
};

const dialog = () => document.querySelector("[role=dialog]");
const dialogName = () => {
	const element = dialog();
	return element ? document.getElementById(element.getAttribute("aria-labelledby") ?? "")?.textContent ?? "" : "";
};
const buttonIn = (root, name) => [...root.querySelectorAll("button")].find((button) => accessibleName(button) === name) ?? null;
// The main chat header is the shell's <header>; Ask Rovo's sidebar chat has its own "New chat" button.
const chatHeaderShown = () => [...document.querySelectorAll("header")].some((header) => buttonIn(header, "New chat") !== null);
const menuItem = (name) => [...document.querySelectorAll("[role=menuitem]")].find((item) => accessibleName(item) === name) ?? null;

/** What the main surface shows, as one comparable record. */
function surface(view) {
	return {
		agentName: view.queryByRole("button", { name: "Edit agent name" })?.textContent.trim() ?? null,
		configPane: view.queryByRole("button", { name: "Toggle agent test view" }) !== null,
		dialog: dialogName(),
		home: view.queryByRole("heading", { name: HOME_HEADING }) !== null,
		testView: view.queryByRole("button", { name: "Switch test version" }) !== null,
		url: `${window.location.pathname}${window.location.search}`,
	};
}

const askRovoPressed = (view) => view.queryByRole("button", { name: "Ask Rovo" })?.getAttribute("aria-pressed") ?? null;

async function openRfpConfigFromSidebar(view) {
	await view.click(view.getAllByRole("button", { name: "RFP Drafter" })[0]);
	await waitFor(() => view.queryByRole("button", { name: "Toggle agent test view" }) !== null, "the RFP Drafter config pane");
}

// Closing the pane lands on the agents home only while the default agent is still the chat agent,
// so this proves opening an agent for editing never selected it for chat.
async function closePaneToAgentsHome(view) {
	await view.click(view.getByRole("button", { name: "View all agents" }));
	await waitFor(() => surface(view).home, "the agents home");
	assert.equal(surface(view).configPane, false);
}

async function openDirectoryAgentsTab(view) {
	await view.click(view.getByRole("button", { name: "Browse all agents" }));
	await waitFor(() => dialog() !== null, "the agent directory");
	await view.click(buttonIn(dialog(), "Agents"));
	await waitFor(() => buttonIn(dialog(), "Select RFP Drafter") !== null, "the directory's agents tab");
}

test("the agents home starts with no config pane, no directory and no chat header", async () => {
	const { view } = await renderStudio();

	assert.deepEqual(surface(view), { agentName: null, configPane: false, dialog: "", home: true, testView: false, url: "/" });
	assert.equal(chatHeaderShown(), false, "no chat header on the agents home");
	assert.equal(view.queryByRole("button", { name: "Ask Rovo" }) === null, true, "Ask Rovo belongs to the config pane");
});

test("a home submit replaces the agents home with the chat and shows the chat header", async () => {
	const backend = createFakeRovoAppBackend({ reply: "Hi there." });
	const { view } = await renderStudio({ backend });

	const composer = view.getByRole("textbox", { name: "Message" });
	await view.fill(composer, "Hello");
	await view.press(composer, "Enter");
	await waitFor(() => view.queryByText("Hi there.") !== null, "the streamed reply");

	assert.equal(surface(view).home, false, "home is gone");
	assert.equal(surface(view).configPane, false, "no config pane for a plain chat");
	assert.equal(chatHeaderShown(), true, "the chat header appears with the conversation");
	assert.match(surface(view).url, /^\/studio\/[\w-]+$/u, "the URL names the new thread");
});

test("the directory's Agents tab opens an editable session agent in the config pane and closes the directory", async () => {
	const { view } = await renderStudio();
	await openDirectoryAgentsTab(view);
	assert.equal(dialogName(), "Browse agents");

	await view.click(buttonIn(dialog(), "Select RFP Drafter"));
	await waitFor(() => surface(view).configPane, "the config pane");

	assert.deepEqual(surface(view), {
		agentName: "RFP Drafter",
		configPane: true,
		dialog: "",
		home: false,
		testView: false,
		url: `/?agent=${RFP_AGENT_ID}`,
	});
	assert.equal(askRovoPressed(view), "false", "Ask Rovo stays closed when an agent is opened for editing");

	await closePaneToAgentsHome(view);
});

test("a built-in directory agent becomes the chat agent: no config pane, and the agents home gives way to its landing", async () => {
	const { view } = await renderStudio();
	await openDirectoryAgentsTab(view);

	await view.click(buttonIn(dialog(), "Select Rovo Expert"));
	await waitFor(() => dialog() === null, "the directory to close");
	await waitFor(() => view.queryByRole("heading", { name: "Rovo Expert" }) !== null, "the built-in agent's landing");

	assert.deepEqual(surface(view), { agentName: null, configPane: false, dialog: "", home: false, testView: false, url: "/" });
});

test("the directory opened from an empty agent's instructions sits over the config pane, and Escape leaves the pane open", async () => {
	const { view } = await renderStudio();
	await view.click(view.getByRole("button", { name: "Create agent" }));
	await waitFor(() => surface(view).agentName === "Untitled agent", "the new agent's config pane");

	const templateLink = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "start with a template");
	assert.ok(templateLink !== undefined, "an empty agent offers to start from a template");
	await view.click(templateLink);
	await waitFor(() => dialog() !== null, "the agent directory");
	assert.equal(dialogName(), "Browse agents");

	await view.press(null, "Escape");
	await waitFor(() => dialog() === null, "the directory to close");
	assert.equal(surface(view).agentName, "Untitled agent", "the config pane is still on the new agent");
	assert.equal(surface(view).home, false);
});

test("the Test toggle switches the pane to the test view; reopening the agent from the sidebar returns to configure", async () => {
	const { view } = await renderStudio();
	await openRfpConfigFromSidebar(view);
	assert.equal(surface(view).testView, false, "an opened agent starts in the configure view");

	await view.click(view.getByRole("button", { name: "Toggle agent test view" }));
	await waitFor(() => surface(view).testView, "the test view");
	assert.equal(surface(view).configPane, true);

	await view.click(view.getAllByRole("button", { name: "RFP Drafter" })[0]);
	await waitFor(() => !surface(view).testView, "the configure view");
	assert.equal(surface(view).agentName, "RFP Drafter");
	assert.equal(surface(view).url, `/?agent=${RFP_AGENT_ID}`);

	// Re-selecting edits the agent; it must not swap the chat onto it.
	await closePaneToAgentsHome(view);
});

test("browser Back closes the config pane and Forward restores it in the configure view", async () => {
	const { view } = await renderStudio();
	await openRfpConfigFromSidebar(view);
	await view.click(view.getByRole("button", { name: "Toggle agent test view" }));
	await waitFor(() => surface(view).testView, "the test view");

	window.history.back();
	await waitFor(() => surface(view).home, "the agents home after Back");
	assert.deepEqual(surface(view), { agentName: null, configPane: false, dialog: "", home: true, testView: false, url: "/" });

	window.history.forward();
	await waitFor(() => surface(view).configPane, "the config pane after Forward");
	assert.deepEqual(surface(view), {
		agentName: "RFP Drafter",
		configPane: true,
		dialog: "",
		home: false,
		testView: false,
		url: `/?agent=${RFP_AGENT_ID}`,
	});
});

test("deleting the open agent from the sidebar closes its config pane and returns to the agents home", async () => {
	const { view } = await renderStudio();
	await openRfpConfigFromSidebar(view);

	await view.click(view.getAllByRole("button", { name: "More actions for RFP Drafter" })[0]);
	await waitFor(() => menuItem("Delete agent") !== null, "the agent's actions menu");
	await view.click(menuItem("Delete agent"));
	await waitFor(() => surface(view).home, "the agents home");

	assert.equal(surface(view).configPane, false, "the config pane closes with its agent");
	assert.equal(view.queryByRole("button", { name: "Edit RFP Drafter" }) === null, true, "the agent is gone from the agents table");
});

test("the empty agents table's Browse templates opens the template dialog, and picking a template fills the composer and closes it", async () => {
	const { view } = await renderStudio();
	await view.click(view.getAllByRole("button", { name: "More actions for RFP Drafter" })[0]);
	await waitFor(() => menuItem("Delete agent") !== null, "the agent's actions menu");
	await view.click(menuItem("Delete agent"));
	await waitFor(() => view.queryByRole("button", { name: "Browse templates" }) !== null, "the empty agents table");

	await view.click(view.getByRole("button", { name: "Browse templates" }));
	await waitFor(() => dialog() !== null, "the template dialog");
	assert.equal(dialogName(), "Turn rough ideas into plans,and choose the next step.", "the template dialog opens on its first category");
	assert.ok(buttonIn(dialog(), "Close agent templates") !== null, "this is the template dialog, not the agent directory");

	await view.click(buttonIn(dialog(), "Select Decision Director"));
	await waitFor(() => dialog() === null, "the template dialog to close");

	assert.deepEqual(surface(view), { agentName: null, configPane: false, dialog: "", home: true, testView: false, url: "/" });
	assert.match(view.getByRole("textbox", { name: "Message" }).textContent, /^Use the Decision Director template to create a Rovo agent\./u);
});

test("Reset demo closes the config pane, clears threads and restores the seeded agent on the agents home", async () => {
	const { backend, view } = await renderStudio();
	await openRfpConfigFromSidebar(view);

	await view.click(view.getByRole("button", { name: "Settings" }));
	await waitFor(() => menuItem("Reset demo") !== null, "the settings menu");
	await view.click(menuItem("Reset demo"));
	await waitFor(() => surface(view).home, "the agents home");
	await settle(100);

	assert.deepEqual(surface(view), { agentName: null, configPane: false, dialog: "", home: true, testView: false, url: "/studio" });
	assert.ok(view.queryByRole("button", { name: "Edit RFP Drafter" }) !== null, "the seeded RFP Drafter is back");
	const writes = backend.state.requests.filter((request) => !request.startsWith("GET "));
	assert.ok(writes.includes("POST /api/agents/rfp-demo/reset"), "the backend demo state is reset");
	assert.ok(writes.includes("DELETE /api/rovo/threads"), "threads are cleared");
});

test("a generated agent result opens its config pane in the test view with Ask Rovo open", async () => {
	const backend = createFakeRovoAppBackend({
		reply: "Built it.",
		replyDataParts: [
			{ data: GENERATED_AGENT_RESULT, type: "data-agent-result" },
			{ data: {}, type: "data-turn-complete" },
		],
	});
	const { view } = await renderStudio({ backend });

	const composer = view.getByRole("textbox", { name: "Message" });
	await view.fill(composer, "Build a bug triage agent");
	await view.press(composer, "Enter");
	await waitFor(() => surface(view).testView, "the generated agent's test view");
	assert.equal(chatHeaderShown(), false, "the config pane hides the chat header even with messages");

	assert.equal(backend.state.chatRequests[0].creationMode, "agent", "the home submit was an agent-creation turn");
	assert.equal(surface(view).home, false);
	assert.equal(surface(view).configPane, true);
	assert.ok(view.getAllByRole("heading", { name: "Triage Helper" }).length > 0, "the pane is on the generated agent");
	assert.equal(askRovoPressed(view), "true", "Ask Rovo opens with the generated agent");

	// One click leaves the test view: the completed result must not pull the pane back into it.
	await view.click(view.getByRole("button", { name: "Toggle agent test view" }));
	await waitFor(() => !surface(view).testView, "the configure view");
	await settle(300);
	assert.equal(surface(view).testView, false, "the pane stays in the configure view");

	await view.click(view.getByRole("button", { name: "View all agents" }));
	await waitFor(() => surface(view).home, "the agents home");
	assert.equal(surface(view).configPane, false);
});
