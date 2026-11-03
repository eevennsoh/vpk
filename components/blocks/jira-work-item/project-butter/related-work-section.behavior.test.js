const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderSection(props = {}) {
	return renderComponent({
		source: `import React from "react";
			import { MotionConfig } from "motion/react";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
			const BOARD_ITEM = { code: "PAY-9999", title: "Board item without placeholder" };
			export default function SectionProbe({ preset = "filled", board = false, active = true }) {
				const content = useProjectButterContent(preset, board ? BOARD_ITEM : undefined);
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

const group = (type) => document.querySelector(`[data-component="ContextTableGroup"][data-related-type="${type}"]`);
const wait = (ms) => React.act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });

test("a single visible group hides the Related work heading but keeps the section named", async () => {
	const view = await renderSection({ preset: "empty" });
	assert.equal(document.querySelector("#section-linked-content"), null, "nothing related and nothing requested renders no section");
	await view.click(view.getByRole("button", { name: "Request child" }));
	assert.equal(view.queryByRole("button", { name: "Collapse Related work" }), null);
	assert.equal(view.queryByRole("heading", { name: "Related work" }), null);
	assert.equal(document.querySelector('section[aria-label="Related work"]')?.id, "section-linked-content");
	assert.equal(group("subitems").hasAttribute("data-section-header"), true);
	assert.equal(group("attachments"), null);
	await view.press(document.body, "K", { shiftKey: true });
	assert.equal(view.queryByRole("button", { name: "Collapse Related work" }), null, "the heading waits before appearing");
	await wait(200);
	assert.equal(view.queryByRole("button", { name: "Collapse Related work" }) !== null, true, "a second group reveals the heading after the 160ms delay");
	assert.equal(document.querySelector('section[aria-label="Related work"]'), null);
	assert.equal(group("subitems").hasAttribute("data-section-header"), false);
	assert.equal(view.isFocused(view.getByRole("combobox", { name: "Add linked work" })), true);
	assert.equal(view.queryByRole("combobox", { name: "Create child work item" }) !== null, true);
});

test("an item with nothing related shows every group's empty state and its add buttons", async () => {
	const view = await renderSection({ board: true });
	assert.equal(view.queryByRole("button", { name: "Create subitems" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Link work items" }) !== null, true);
	assert.equal(view.queryByText("No attachments yet."), null);
	await view.click(document.querySelector('[data-related-empty="attachments"] button[data-related-add]'));
	assert.equal(view.isFocused(view.getByRole("textbox", { name: "Attachment name or URL" })), true);
	await view.click(document.querySelector('[data-related-empty="linked"] button[aria-label="Dismiss"]'));
	assert.equal(group("linked"), null, "Dismiss hides the group for the session");
	await view.click(view.getByRole("button", { name: "Request linked" }));
	assert.equal(group("linked") !== null, true, "an add request brings a dismissed group back");
	assert.equal(view.queryByRole("combobox", { name: "Add linked work" }) !== null, true);
});

test("add requests reopen a collapsed Related work and group, and repeat presses refocus", async () => {
	const view = await renderSection();
	await view.click(view.getByRole("button", { name: "Collapse Linked work" }));
	assert.equal(view.tabOrder().includes("Add linked work"), false, "header actions leave the tab order while their group is collapsed");
	await view.click(view.getByRole("button", { name: "Collapse Related work" }));
	assert.equal(view.getByRole("list", { name: "8 attachments, 15 subitems, 8 linked work items" }).getAttribute("data-component"), "RelatedWorkCollapsedSummary");
	await view.press(document.body, "K", { shiftKey: true });
	assert.equal(view.getByRole("button", { name: "Collapse Related work" }).getAttribute("aria-expanded"), "true");
	assert.equal(view.getByRole("button", { name: "Collapse Linked work" }).getAttribute("aria-expanded"), "true");
	const composer = view.getByRole("combobox", { name: "Add linked work" });
	assert.equal(view.isFocused(composer), true);
	await view.click(view.getByRole("button", { name: "Request child" }));
	await view.click(view.getByRole("button", { name: "Add linked work" }));
	assert.equal(view.isFocused(view.getByRole("combobox", { name: "Add linked work" })), true, "the + button refocuses instead of toggling closed");
	await view.press(view.getByRole("combobox", { name: "Add linked work" }), "C", { shiftKey: true });
	assert.equal(view.isFocused(view.getByRole("combobox", { name: "Add linked work" })), true, "typing in a composer never triggers shortcuts");
});

test("the composer floats matches in a row-width listbox and announces the match count", async () => {
	const view = await renderSection();
	await view.click(view.getByRole("button", { name: "Add child work item" }));
	await view.fill(view.getByRole("combobox", { name: "Create child work item" }), "analytics");
	const listbox = view.getByRole("listbox", { name: "Matching work items" });
	assert.equal(listbox.closest("[data-related-composer-listbox]")?.parentElement === document.body, true);
	assert.equal(document.querySelector("[data-related-composer] [aria-live=polite]").textContent, "1 matching work item");
	assert.equal(view.getByRole("combobox", { name: "Create child work item" }).getAttribute("aria-expanded"), "true");
});
