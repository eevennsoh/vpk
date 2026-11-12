const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const WORKSPACES_KEY = "butter-local-agent-workspaces";

function stubClipboard(t, writeText) {
	const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
	t.after(() => {
		window.localStorage.removeItem(WORKSPACES_KEY);
		if (original) Object.defineProperty(navigator, "clipboard", original);
		else delete navigator.clipboard;
	});
}

function selectWorkspace(path) {
	window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify(JSON.stringify({ paths: [path], selected: path })));
}

const renderMenu = () => renderComponent({
	entry: "components/blocks/jira-issue/project-butter-local-agent-menu.tsx",
	exportName: "ProjectButterLocalAgentMenu",
	props: {},
});

test("Open in Rovo CLI copies the launch command for the selected workspace before saying so", async (t) => {
	const copied = [];
	stubClipboard(t, async (value) => { copied.push(value); });
	selectWorkspace("~/dev/it's here");
	const view = await renderMenu();
	await view.click(view.getByRole("button", { name: "Open in Rovo CLI" }));
	assert.deepEqual(copied, ["cd ~/'dev/it'\\''s here' && rovo"]);
	assert.equal(view.getByRole("status").textContent, "Command copied");
	assert.equal(view.getByRole("button", { name: "Command copied" }) !== null, true);
	await view.unmount();
});

test("Open in Rovo CLI does not claim success when the clipboard write fails", async (t) => {
	stubClipboard(t, async () => { throw new Error("denied"); });
	const view = await renderMenu();
	await view.click(view.getByRole("button", { name: "Open in Rovo CLI" }));
	assert.equal(view.getByRole("status").textContent, "");
	assert.equal(view.queryByRole("button", { name: "Command copied" }), null);
	await view.unmount();
});

test("the Rovo CLI row in the local agent submenu copies the launch command", async (t) => {
	const copied = [];
	stubClipboard(t, async (value) => { copied.push(value); });
	t.after(() => window.localStorage.removeItem("jira-local-agent-last-used"));
	const view = await renderComponent({
		entry: "components/blocks/jira-local-agent/index.tsx",
		exportName: "JiraLocalAgent",
		props: { workItem: { code: "PAY-118", summary: "Billing", description: "" } },
	});
	await view.click(view.getByRole("button", { name: "Open local agent" }));
	await view.click(view.getByRole("button", { name: "Rovo CLI" }));
	assert.deepEqual(copied, ["rovo"]);
	assert.equal([...document.querySelectorAll('[role="status"]')].some((status) => status.textContent === "Command copied"), true);
	await view.unmount();
});
