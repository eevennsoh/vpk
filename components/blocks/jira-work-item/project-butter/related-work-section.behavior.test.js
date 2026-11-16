const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderSection(props = {}) {
	return renderComponent({
		source: `import React from "react";
			import { MotionConfig } from "motion/react";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
			const BOARD_ITEM = { code: "PAY-9999", title: "Board item without placeholder" };
			export default function SectionProbe({ preset = "filled", board = false, active = true, single = false }) {
				const state = useProjectButterContent(preset, board ? BOARD_ITEM : undefined);
				const content = single ? { ...state, relatedWork: { children: [], linked: [] } } : state;
				return <MotionConfig reducedMotion="always">
					<button type="button" onClick={() => content.openRelatedAdd("attachments")}>Request attachment</button>
					<button type="button" onClick={() => content.openRelatedAdd("children")}>Request child</button>
					<button type="button" onClick={() => content.openRelatedAdd("linked")}>Request linked</button>
					<ProjectButterRelatedWork active={active} content={content} empty={preset === "empty"} />
				</MotionConfig>;
			}`,
		props,
	});
}

test("count toggles start off without a Related work heading, including a single section", async () => {
	for (const single of [false, true]) {
		const view = await renderSection({ single });
		assert.equal(view.queryByRole("heading", { name: "Related work" }), null);
		const toggle = view.getByRole("button", { name: "8 attachments" });
		assert.equal(toggle.getAttribute("aria-pressed"), "false");
		assert.equal(toggle.getAttribute("aria-expanded"), "false");
		assert.equal(toggle.textContent, "8");
		assert.equal(view.tabOrder().includes("Add attachment"), false);
		await view.click(toggle);
		assert.equal(toggle.getAttribute("aria-pressed"), "true");
		assert.equal(toggle.textContent, "8 attachments");
		assert.equal(view.queryByRole("button", { name: "Documents, 4 attachments" }) !== null, true);
		await view.click(toggle);
		assert.equal(toggle.textContent, "8");
		assert.equal(view.queryByRole("button", { name: "Documents, 4 attachments" }), null);
		await view.unmount();
	}
});

test("all three sections open together and closing one preserves the others and their previews", async () => {
	const view = await renderSection();
	const attachment = view.getByRole("button", { name: "8 attachments" });
	const children = view.getByRole("button", { name: "15 child work items" });
	const linked = view.getByRole("button", { name: "8 linked work items" });
	await view.click(attachment);
	await view.click(children);
	await view.click(linked);
	assert.deepEqual([attachment, children, linked].map((toggle) => toggle.textContent), ["8 attachments", "15 child work items", "8 linked work items"]);
	const childTable = view.getByRole("table", { name: "Child work items" });
	const linkedTable = view.getByRole("table", { name: "Linked work" });
	assert.equal(childTable.getAttribute("data-jira-list-variant"), "project-butter");
	const scrollRegion = view.getByRole("region", { name: "Child work items columns" });
	assert.equal(scrollRegion.tabIndex, 0);
	await view.focus(scrollRegion);
	assert.equal(view.isFocused(scrollRegion), true);
	assert.deepEqual([...childTable.querySelectorAll("th")].map((header) => header.textContent), ["Work", "Status", "Assignee", "Priority", "Actions"]);
	assert.deepEqual([...linkedTable.querySelectorAll("th")].map((header) => header.textContent), ["Relationship", "Work", "Status", "Assignee", "Priority"]);
	assert.equal([...linkedTable.querySelectorAll("th")].every((header) => header.getAttribute("scope") === "col"), true);
	assert.equal(linkedTable.querySelector('tbody tr').textContent.includes("Zoe Loft"), true);
	for (const toggle of [attachment, children, linked]) {
		assert.equal(toggle.getAttribute("aria-pressed"), "true");
		assert.equal(document.getElementById(toggle.getAttribute("aria-controls")) !== null, true);
	}
	assert.equal(view.getByRole("table", { name: "Child work items" }).querySelector("tbody").children.length, 5);
	await view.click(view.getByRole("button", { name: "Show 10 more child work items" }));
	assert.equal(view.getByRole("table", { name: "Child work items" }).querySelector("tbody").children.length, 15);
	assert.equal(view.getByRole("table", { name: "Linked work" }).querySelector("tbody").children.length, 5);
	await view.click(children);
	assert.equal(view.queryByRole("table", { name: "Child work items" }), null);
	assert.equal(view.tabOrder().includes("Add child work item"), false);
	assert.equal(attachment.getAttribute("aria-pressed"), "true");
	assert.equal(linked.getAttribute("aria-pressed"), "true");
	await view.click(children);
	assert.equal(view.getByRole("table", { name: "Child work items" }).querySelector("tbody").children.length, 15);
	await view.click(view.getByRole("button", { name: "Show less child work items" }));
	assert.equal(view.getByRole("table", { name: "Child work items" }).querySelector("tbody").children.length, 5);
});

test("add shortcuts reveal only their section and repeated requests refocus the composer", async () => {
	const view = await renderSection();
	await view.press(document.body, "K", { shiftKey: true });
	assert.equal(view.getByRole("button", { name: "8 linked work items" }).getAttribute("aria-pressed"), "true");
	assert.equal(view.getByRole("button", { name: "8 attachments" }).getAttribute("aria-pressed"), "false");
	const composer = view.getByRole("combobox", { name: "Add linked work" });
	assert.equal(view.isFocused(composer), true);
	await view.click(view.getByRole("button", { name: "Request child" }));
	await view.click(view.getByRole("button", { name: "Add linked work" }));
	assert.equal(view.isFocused(view.getByRole("combobox", { name: "Add linked work" })), true);
	await view.press(view.getByRole("combobox", { name: "Add linked work" }), "C", { shiftKey: true });
	assert.equal(view.isFocused(view.getByRole("combobox", { name: "Add linked work" })), true);
});

test("empty sections remain available through add actions and dismissals", async () => {
	const view = await renderSection({ board: true });
	assert.equal(view.queryByRole("button", { name: "Create subitems" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Link work items" }) !== null, true);
	await view.click(document.querySelector('[data-related-empty="attachments"] button[data-related-add]'));
	assert.equal(view.isFocused(view.getByRole("combobox", { name: "Add attachment" })), true);
	await view.click(document.querySelector('[data-related-empty="linked"] button[aria-label="Dismiss"]'));
	assert.equal(document.querySelector("#section-linked-items"), null);
	await view.click(view.getByRole("button", { name: "Request linked" }));
	assert.equal(view.queryByRole("combobox", { name: "Add linked work" }) !== null, true);
});

test("empty preset adds sections individually without an outer grouping", async () => {
	const view = await renderSection({ preset: "empty" });
	assert.equal(document.querySelector("#section-linked-content"), null);
	await view.click(view.getByRole("button", { name: "Request child" }));
	assert.equal(view.isFocused(view.getByRole("combobox", { name: "Create child work item" })), true);
	await view.press(document.body, "K", { shiftKey: true });
	assert.equal(view.queryByRole("combobox", { name: "Create child work item" }) !== null, true);
	assert.equal(view.isFocused(view.getByRole("combobox", { name: "Add linked work" })), true);
	assert.equal(view.queryByRole("heading", { name: "Related work" }), null);
});

test("the composer floats matches in a row-width listbox and announces the match count", async () => {
	const view = await renderSection();
	await view.click(view.getByRole("button", { name: "Request child" }));
	await view.fill(view.getByRole("combobox", { name: "Create child work item" }), "analytics");
	const listbox = view.getByRole("listbox", { name: "Matching work items" });
	assert.equal(listbox.closest("[data-related-composer-listbox]")?.parentElement === document.body, true);
	assert.equal(document.querySelector("[data-related-composer] [aria-live=polite]").textContent, "1 matching work item");
});
