const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderRelated(props = {}) {
	return renderComponent({
		source: `import React from "react";
			import { MotionConfig } from "motion/react";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
			export default function RelatedRowsProbe({ preset = "filled", empty = false, openKeys = [], onOpen, workItemKey }) {
				const content = useProjectButterContent(preset);
				const openRelatedItem = onOpen ? (key) => openKeys.includes(key) ? () => onOpen(key) : undefined : undefined;
				return <MotionConfig reducedMotion="always"><button type="button">Outside related work</button>
					<button type="button" onClick={() => content.openRelatedAdd("children")}>Request child</button>
					<ProjectButterRelatedWork content={content} empty={empty} openRelatedItem={openRelatedItem} workItemKey={workItemKey} /></MotionConfig>;
			}`,
		mocks: {
			"@/components/blocks/jira-work-item/project-butter/project-butter-attachments": `export function ProjectButterAttachments() { return null; }`,
		},
		props,
	});
}

const summaries = (key) => [...document.querySelectorAll(`[role="textbox"][aria-label="Edit summary for ${key}"]`)];
const group = (type) => document.querySelector(`[data-related-type="${type}"]`);
const rowsOf = (view, label) => [...view.getByRole("list", { name: label }).children].filter((row) => row.querySelector('[aria-label^="Edit summary for "]'));
const childTrigger = (view) => view.getByRole("button", { name: /^(Collapse|Expand) Child work items/u });

test("the status menu offers three statuses with icons and updates the row and header counts", async () => {
	const view = await renderRelated();
	const progress = childTrigger(view).querySelector('[data-slot="progress-circle"]');
	assert.equal(progress?.getAttribute("aria-valuenow"), "10");
	assert.equal(progress?.getAttribute("aria-valuemax"), "15");
	assert.equal(progress?.querySelectorAll("circle").length, 2);
	const trigger = view.getAllByRole("button", { name: "Edit status for VITA-4, In progress" })[0];
	assert.equal(trigger.querySelector('[data-slot="progress-circle"]')?.getAttribute("aria-valuenow"), "50", "the row circle matches the status");
	await view.click(trigger);
	const items = view.getAllByRole("menuitem").map((item) => item.textContent);
	assert.deepEqual(items, ["To do", "In progress", "Done"]);
	assert.equal(view.getByRole("menuitem", { name: "In progress" }).getAttribute("data-selected"), "true");
	assert.equal(view.queryByText("In review"), null);
	await view.click(view.getByRole("menuitem", { name: "Done" }));
	assert.equal(view.getAllByRole("button", { name: "Edit status for VITA-4, Done" }).length, 1);
	assert.equal(childTrigger(view).getAttribute("aria-label"), "Collapse Child work items 11 of 15 done, 4 in progress, 0 to do");
	assert.equal(childTrigger(view).querySelector('[data-slot="progress-circle"]')?.getAttribute("aria-valuenow"), "11");
	assert.equal(view.queryByText("11/15") !== null, true);
});

test("the live summary edit commits on Enter, reverts on Escape or when empty, and settles in place", async () => {
	let escaped = 0;
	const view = await renderRelated();
	document.body.addEventListener("keydown", (event) => { if (event.key === "Escape") escaped++; });
	const summary = summaries("VITA-5")[0];
	assert.equal(summary.getAttribute("contenteditable"), "true");
	await view.fill(summary, "  Design   the progress ring  ");
	assert.equal(view.queryByRole("button", { name: "Save summary for VITA-5" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Edit priority for VITA-5: High. Edit" }), null, "Confirm and Cancel replace the fields");
	assert.equal(view.tabOrder().includes("Edit summary for VITA-6"), false, "other rows are inert while editing");
	await view.press(summary, "Enter");
	assert.equal(summaries("VITA-5")[0].textContent, "Design the progress ring");
	assert.equal(view.isFocused(summary), true);
	assert.equal(summary.getAttribute("data-summary-settled"), "true");
	await view.press(summary, "ArrowRight");
	assert.equal(view.queryByRole("button", { name: "Save summary for VITA-5" }), null, "arrows do not re-enter editing");
	await view.press(summary, "x");
	assert.equal(view.queryByRole("button", { name: "Save summary for VITA-5" }) !== null, true, "a printable key re-enters editing");
	await view.fill(summary, "Throwaway");
	await view.press(summary, "Escape");
	assert.equal(summary.textContent, "Design the progress ring");
	await view.fill(summary, "   ");
	await view.press(summary, "Enter");
	assert.equal(summary.textContent, "Design the progress ring", "an empty summary reverts");
	assert.equal(escaped, 0, "Escape never reaches the host dialog");
	await view.fill(summary, "Committed by leaving");
	await view.click(view.getByRole("button", { name: "Outside related work" }));
	assert.equal(summary.textContent, "Committed by leaving");
	assert.equal(view.queryByRole("button", { name: "Save summary for VITA-5" }), null);
});

test("child rows offer the reference actions; Clone copies with a new key and Delete removes", async () => {
	const view = await renderRelated();
	const action = view.getAllByRole("button", { name: "More actions for VITA-5" })[0];
	const row = action.closest("li");
	const priority = row.querySelector('button[aria-label^="Edit priority for VITA-5"]');
	const assignee = row.querySelector('button[aria-label^="Edit assignee for VITA-5"]');
	assert.equal(Boolean(action.compareDocumentPosition(priority) & Node.DOCUMENT_POSITION_FOLLOWING), true);
	assert.equal(Boolean(priority.compareDocumentPosition(assignee) & Node.DOCUMENT_POSITION_FOLLOWING), true);
	await view.click(action);
	assert.equal(view.getByRole("menu", { name: "Actions for VITA-5" }) !== null, true);
	assert.deepEqual(view.getAllByRole("menuitem").map((item) => item.textContent), ["Change parent", "Clone", "Move", "Archive", "Delete"]);
	await view.click(view.getByRole("menuitem", { name: "Clone" }));
	const keys = rowsOf(view, "Child work items").map((row) => row.querySelector('[aria-label^="Edit summary for "]').getAttribute("aria-label").replace("Edit summary for ", ""));
	assert.equal(keys[1], "VITA-5");
	assert.match(keys[2], /^VITA-\d{4}$/u);
	assert.equal(rowsOf(view, "Child work items")[2].textContent.includes("Design progress indicator component"), true);
	await view.click(view.getAllByRole("button", { name: `More actions for ${keys[2]}` })[0]);
	await view.click(view.getByRole("menuitem", { name: "Delete" }));
	assert.equal(summaries(keys[2]).length, 0);
	assert.equal(document.querySelectorAll('[data-related-type="linked"] button[aria-label^="More actions for "]').length, 0, "linked rows have no row menu");
});

test("created children default to Annie Cook with a parent-prefix key; matches keep their own fields", async () => {
	const view = await renderRelated({ workItemKey: "PAY-12" });
	await view.click(view.getByRole("button", { name: "Add child work item" }));
	const composer = view.getByRole("combobox", { name: "Create child work item" });
	await view.fill(composer, "analytics");
	assert.equal(document.querySelector('[aria-live="polite"]')?.textContent, "1 matching work item");
	await view.fill(composer, "Write rollout notes");
	assert.equal(document.querySelector('[aria-live="polite"]')?.textContent, "0 matching work items");
	await view.click(view.getByRole("option", { name: "Create “Write rollout notes”" }));
	const created = rowsOf(view, "Child work items")[0];
	const key = created.querySelector('[aria-label^="Edit summary for "]').getAttribute("aria-label").replace("Edit summary for ", "");
	assert.match(key, /^PAY-\d{4}$/u);
	assert.equal(created.querySelector('button[aria-label$=": Annie Cook. Edit"]') !== null, true);
	assert.equal(view.getByRole("button", { name: `Edit status for ${key}, To do` }) !== null, true);
	assert.equal(view.getByRole("button", { name: `Edit priority for ${key}: Medium. Edit` }) !== null, true);
	await view.click(view.getByRole("button", { name: "Add child work item" }));
	await view.fill(view.getByRole("combobox", { name: "Create child work item" }), "VITA-31");
	assert.equal(view.getAllByRole("option")[0].textContent.startsWith("VITA-31"), true, "the exact key is the first choice");
	await view.click(view.getAllByRole("option")[0]);
	assert.equal(view.getByRole("button", { name: "Edit assignee for VITA-31: Unassigned. Edit" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Add linked work" }));
	await view.fill(view.getByRole("combobox", { name: "Add linked work" }), "VITA-12");
	await view.click(view.getAllByRole("option")[0]);
	assert.equal(view.getByRole("button", { name: "Edit assignee for VITA-12: Hiroshi Tanaka. Edit" }) !== null, true);
	assert.equal(view.getByRole("button", { name: "Edit relationship for VITA-12: Clones. Edit" }) !== null, true);
});

test("the composer never offers the open work item and drops its query when dismissed outside", async () => {
	const view = await renderRelated({ workItemKey: "VITA-12" });
	await view.click(view.getByRole("button", { name: "Add linked work" }));
	await view.fill(view.getByRole("combobox", { name: "Add linked work" }), "analytics events");
	assert.equal(view.queryByRole("option", { name: /VITA-12/u }), null);
	await view.click(view.getByRole("button", { name: "Outside related work" }));
	assert.equal(view.queryByRole("combobox", { name: "Add linked work" }), null);
	await view.click(view.getByRole("button", { name: "Add linked work" }));
	assert.equal(view.getByRole("combobox", { name: "Add linked work" }).value, "");
});

test("header actions use the reference copy and the display popover is named per list", async () => {
	const view = await renderRelated();
	const childMore = group("subitems").querySelector('button[aria-label="More actions"]');
	await view.click(childMore);
	assert.equal(view.getByRole("dialog", { name: "Child work item display options" }) !== null, true);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Ordering, Rank" })), true, "the popover opens on Ordering");
	assert.equal(childMore.getAttribute("aria-expanded"), "true");
	await view.press(view.getByRole("button", { name: "Ordering, Rank" }), "Escape");
	await view.click(group("linked").querySelector('button[aria-label="More actions"]'));
	assert.equal(view.getByRole("dialog", { name: "Linked work display options" }) !== null, true);
	assert.equal(view.getByRole("button", { name: "Collapse Linked work" }) !== null, true);
});

test("keys open board items when the host resolves them and stay plain text otherwise", async () => {
	const opened = [];
	const view = await renderRelated({ onOpen: (key) => opened.push(key), openKeys: ["VITA-9"] });
	await view.click(view.getByRole("button", { name: "VITA-9" }));
	assert.deepEqual(opened, ["VITA-9"]);
	assert.equal(view.queryByRole("button", { name: "VITA-10" }), null);
	assert.equal(view.queryByText("VITA-10") !== null, true);
	await view.unmount();
	const plain = await renderRelated();
	assert.equal(plain.queryByRole("button", { name: "VITA-9" }), null, "no opener means no dead link");
});

test("an empty child list has no progress indicator or spoken counts", async () => {
	const view = await renderRelated({ empty: true, preset: "empty" });
	await view.click(view.getByRole("button", { name: "Request child" }));
	assert.equal(childTrigger(view).getAttribute("aria-label"), "Collapse Child work items");
	assert.equal(document.querySelector('[data-component="SubItemsProgress"]'), null);
	await React.act(async () => {});
});
