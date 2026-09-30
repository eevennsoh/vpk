// Behavioral contract for the uncaptured-work chin, rendered for real (Base UI
// Button + Tooltip, ADS icons) in happy-dom. The sibling source-regex suite
// only proves the attributes are spelled in the file; this one proves what a
// keyboard or pointer user can actually reach and trigger.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

async function renderChin(props) {
	const calls = [];
	const baseProps = {
		captured: false,
		createUnavailable: false,
		linkUnavailable: false,
		onCreateWorkItem: () => calls.push(["create"]),
		onLinkWorkItem: (key) => calls.push(["link", key]),
		onSubtasks: () => calls.push(["subtasks"]),
		summary: "Fix login",
	};
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/uncaptured-work-chin.tsx",
		exportName: "UncapturedWorkChin",
		props: { ...baseProps, ...props },
	});
	return { calls, rerender: (nextProps) => view.rerender({ ...baseProps, ...nextProps }), view };
}

test("captured work is removed from the keyboard action sequence", async () => {
	const { calls, view } = await renderChin({ captured: true, suggestedWorkItemKey: "ABC-1" });
	const captured = view.getByRole("button", { name: "Fix login captured" });

	// Natively disabled (not aria-disabled): unreachable by Tab, unfocusable, and inert.
	assert.deepEqual(view.tabOrder(), []);
	await view.focus(captured);
	assert.ok(!view.isFocused(captured));
	await view.click(captured);

	// Capturing replaces the link/create/subtasks choice instead of disabling it.
	assert.deepEqual(view.getAllByRole("button").map(accessibleName), ["Fix login captured"]);
	assert.deepEqual(calls, []);
});

test("an unavailable create action stays focusable but ignores pointer and keyboard activation", async () => {
	const { calls, rerender, view } = await renderChin({ createUnavailable: true, suggestedWorkItemKey: "ABC-1" });
	const create = view.getByRole("button", { name: "Create work item for Fix login unavailable" });

	assert.deepEqual(view.tabOrder(), [
		"Link Fix login to ABC-1",
		"Create work item for Fix login unavailable",
		"Subtasks for Fix login",
	], "keyboard users can still reach the unavailable action to hear why");
	await view.focus(create);
	assert.ok(view.isFocused(create));
	await view.press(create, "Enter");
	await view.press(create, " ");
	await view.click(create);
	assert.deepEqual(calls, []);

	// The sibling action is unaffected, and the same control activates once available.
	await view.click(view.getByRole("button", { name: "Subtasks for Fix login" }));
	await rerender({ createUnavailable: false, suggestedWorkItemKey: "ABC-1" });
	await view.press(view.getByRole("button", { name: "Create work item for Fix login" }), "Enter");
	assert.deepEqual(calls, [["subtasks"], ["create"]]);
});

test("each suggestion row offers its own link plus the create/subtasks pair, in Tab order", async () => {
	const { calls, view } = await renderChin({ suggestedWorkItemKeys: ["ABC-1", "ABC-2"] });

	assert.deepEqual(view.tabOrder(), [
		"Link Fix login to ABC-1",
		"Create work item for Fix login",
		"Subtasks for Fix login",
		"Link Fix login to ABC-2",
		"Create work item for Fix login",
		"Subtasks for Fix login",
	]);

	await view.focus(view.getByRole("button", { name: "Link Fix login to ABC-1" }));
	await view.press(null, "Tab");
	await view.press(null, "Tab");
	await view.press(null, "Tab");
	await view.press(null, "Enter");
	await view.click(view.getByRole("button", { name: "Link Fix login to ABC-1" }));
	assert.deepEqual(calls, [["link", "ABC-2"], ["link", "ABC-1"]]);
});

test("with no suggestion the chin still offers one generic link control", async () => {
	const { calls, view } = await renderChin({ suggestedWorkItemKeys: [] });

	await view.click(view.getByRole("button", { name: "Link Fix login to a work item" }));

	assert.equal(view.getByRole("button", { name: "Link Fix login to a work item" }).textContent, "Link work item");
	assert.deepEqual(calls, [["link", undefined]]);
});
