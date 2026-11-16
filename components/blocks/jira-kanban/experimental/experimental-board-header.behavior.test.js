const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

test("the settings panel clears the visible tab separator by one pixel", async () => {
	const view = await renderComponent({ source: `
		import { useBoardViewConfigurationHost } from "@/components/blocks/jira-kanban/experimental/hooks/use-board-view-configuration-host";
		export default function Probe() {
			const { headerRef, tabStripRef, hostRef } = useBoardViewConfigurationHost(true);
			return <div ref={node => {
				if (node) node.getBoundingClientRect = () => ({ top: 104, bottom: 1000 });
			}}>
				<header ref={headerRef}>
					<div ref={node => {
						tabStripRef.current = node;
						if (node) node.getBoundingClientRect = () => ({ bottom: 209 });
					}}>
						<div role="tablist" ref={node => {
							if (node) node.getBoundingClientRect = () => ({ bottom: 210 });
						}} />
					</div>
					<div data-testid="panel-host" ref={node => {
						hostRef.current = node;
						if (node) Object.defineProperty(node, "offsetParent", { get: () => node.parentElement.parentElement });
					}} />
				</header>
			</div>;
		}
	` });
	assert.equal(view.container.querySelector('[data-testid="panel-host"]').style.top, "107px");
	await view.unmount();
});

test("Customize opens shared settings, retains choices, and restores focus after closing", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-kanban/experimental/experimental-board-header.tsx",
		exportName: "ExperimentalJiraKanbanBoardHeader",
		props: { showCustomizeControl: true },
	});
	const customize = view.getByRole("button", { name: "Customize" });
	assert.equal(customize.hasAttribute("aria-disabled"), false);
	await view.click(customize);
	const settings = view.getByRole("dialog", { name: "View settings" });
	assert.equal(settings.getAttribute("data-slot"), "sheet-content");
	assert.equal(settings.getAttribute("data-side"), "right");
	const host = settings.closest('[data-slot="board-view-configuration-host"]');
	assert.equal(host !== null, true);
	assert.equal(view.container.ownerDocument.querySelector('[data-slot="sheet-overlay"]') === null, true);
	await view.click(view.getByRole("button", { name: "Fixed" }));
	await view.focus(view.getByRole("textbox", { name: "Search board" }));
	assert.equal(customize.getAttribute("aria-expanded"), "true");
	await view.click(view.getByRole("button", { name: "Close view settings" }));
	assert.equal(customize.getAttribute("aria-expanded"), "false");
	assert.equal(view.isFocused(customize), true);
	await view.click(customize);
	assert.equal(view.getByRole("button", { name: "Fixed" }).getAttribute("aria-pressed"), "true");
	await view.press(view.getByRole("button", { name: "Fixed" }), "Escape");
	assert.equal(customize.getAttribute("aria-expanded"), "false");
	await view.unmount();
});

test("the default header keeps Group and Needs input inline", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-kanban/experimental/experimental-board-header.tsx",
		exportName: "ExperimentalJiraKanbanBoardHeader",
		props: { needsInputCount: 4, showCustomizeControl: true },
	});
	const needsInput = view.getByRole("button", { name: "Needs input: 4 agents" });
	const group = view.getByRole("button", { name: "Group" });
	const customize = view.getByRole("button", { name: "Customize" });
	assert.equal(group.nextElementSibling === needsInput, true);
	assert.equal(needsInput.parentElement === customize.parentElement, false);
});

for (const activeView of ["board", "list"]) {
	test(`${activeView} keeps Needs input as a separate text button in the trailing controls`, async () => {
		const selections = [];
		const view = await renderComponent({
			entry: "components/blocks/jira-kanban/experimental/experimental-board-header.tsx",
			exportName: "ExperimentalJiraKanbanBoardHeader",
			props: {
				activeView,
				headerControlsLayout: "trailing-icons",
				needsInputCount: 4,
				onAgentFilterIdChange: (id) => selections.push(id),
				showCustomizeControl: true,
			},
		});
		const needsInput = view.getByRole("button", { name: "Needs input: 4 agents" });
		const group = view.getByRole("button", { name: "Group" });
		const customize = view.getByRole("button", { name: "Customize" });
		assert.equal(needsInput.textContent, "Needs input");
		assert.equal(needsInput.parentElement === group.parentElement, true);
		assert.equal(needsInput.parentElement === customize.parentElement, true);
		assert.equal(needsInput.nextElementSibling === group, true);
		assert.equal(group.textContent, "");
		await view.press(needsInput, "Enter");
		assert.deepEqual(selections, ["needs-input"]);
	});
}
