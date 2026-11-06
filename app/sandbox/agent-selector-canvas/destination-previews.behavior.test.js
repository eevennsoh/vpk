const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

test("inline preview runs a sole cloud option directly and expands multiple options", async () => {
	const view = await renderComponent({
		entry: "app/sandbox/agent-selector-canvas/destination-previews.tsx",
		exportName: "InlineActionsPreview",
		mocks: { "@/components/utils/theme-wrapper": "export const useTheme = () => ({ theme: 'light', actualTheme: 'light', setTheme: () => {} });" },
	});
	await view.click(view.getByRole("button", { name: "Claude" }));
	assert.equal(view.getByRole("button", { name: "Claude" }).getAttribute("aria-expanded"), "true");
	assert.equal(view.queryByRole("button", { name: "Open in Claude" }) !== null, true);

	await view.fill(view.getByRole("textbox", { name: "Search agents" }), "Code Planner");
	const singleOption = view.getByRole("button", { name: "Code Planner" });
	assert.equal(singleOption.hasAttribute("aria-expanded"), false);
	await view.click(singleOption);
	assert.equal(view.queryByRole("button", { name: "Start a new session" }), null);
	assert.equal(view.getByRole("status").textContent, "Start on Cloud · Code Planner (preview)");

	await view.fill(view.getByRole("textbox", { name: "Search agents" }), "Cursor");
	await view.click(view.getByRole("button", { name: "Cursor" }));
	assert.equal(view.queryByRole("button", { name: "Continue with last session" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Start a new session" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Open in Cursor" }) !== null, true);
});

test("inline selector invokes supplied actions and disables agents without actions", async () => {
	const calls = [];
	const view = await renderComponent({
		entry: "components/blocks/agent-selector/components/inline-agent-selector.tsx",
		exportName: "InlineAgentSelector",
		mocks: { "@/components/utils/theme-wrapper": "export const useTheme = () => ({ theme: 'light', actualTheme: 'light', setTheme: () => {} });" },
		props: {
			agents: [{ id: "single", name: "Single", byline: "" }, { id: "multiple", name: "Multiple", byline: "" }, { id: "unavailable", name: "Unavailable", byline: "" }],
			softwareAgentIds: ["single", "multiple", "unavailable"],
			getActions: (agent) => agent.id === "unavailable" ? [] : [
				{ id: "cloud", label: "Run on cloud", icon: null, onSelect: () => calls.push(`${agent.id}:cloud`) },
				...(agent.id === "multiple" ? [{ id: "local", label: "Open locally", icon: null, onSelect: () => calls.push(`${agent.id}:local`) }] : []),
			],
		},
	});
	await view.click(view.getByRole("button", { name: "Single" }));
	assert.deepEqual(calls, ["single:cloud"]);
	assert.equal(view.getByRole("button", { name: "Unavailable" }).disabled, true);
	await view.click(view.getByRole("button", { name: "Multiple" }));
	await view.click(view.getByRole("button", { name: "Open locally" }));
	assert.deepEqual(calls, ["single:cloud", "multiple:local"]);
});

test("inline selector reports controlled favorite changes", async () => {
	const changes = [];
	const props = {
		agents: [{ id: "agent", name: "Agent", byline: "" }],
		softwareAgentIds: ["agent"],
		getActions: () => [{ id: "run", label: "Run", icon: null, onSelect: () => changes.push("run") }],
		favoriteAgentIds: [],
		onFavoriteAgentIdsChange: (ids) => changes.push(ids),
	};
	const view = await renderComponent({
		entry: "components/blocks/agent-selector/components/inline-agent-selector.tsx",
		exportName: "InlineAgentSelector",
		mocks: { "@/components/utils/theme-wrapper": "export const useTheme = () => ({ theme: 'light', actualTheme: 'light', setTheme: () => {} });" },
		props,
	});
	await view.click(view.getByRole("button", { name: "Add Agent to favorites" }));
	assert.deepEqual(changes, [["agent"]]);
	await view.rerender({ ...props, favoriteAgentIds: ["agent"] });
	assert.equal(view.getByRole("button", { name: "Remove Agent from favorites" }).getAttribute("aria-pressed"), "true");
});
