const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderAttachments(props = {}) {
	return renderComponent({
		source: `import React, { useRef } from "react";
			import { MotionConfig } from "motion/react";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
			import { AttachmentDropZone } from "@/components/blocks/jira-work-item/project-butter/attachment-drop-overlay";
			export default function AttachmentsProbe({ preset = "filled" }) {
				const content = useProjectButterContent(preset);
				const column = useRef(null);
				return <MotionConfig reducedMotion="always">
					<div className="relative" data-testid="column" ref={column}>
						<AttachmentDropZone content={content} targetRef={column} />
						<p contentEditable suppressContentEditableWarning data-testid="editor">Description</p>
						<ProjectButterRelatedWork active content={content} empty={preset === "empty"} />
						<output data-testid="audit">{content.activityEntries.length}</output>
					</div>
				</MotionConfig>;
			}`,
		props,
	});
}

const rowNames = () => [...document.querySelectorAll("[data-attachment-row]")].map((row) => row.querySelector('[data-component="AttachmentNameCell"]').textContent);
const manageButton = () => document.querySelector('#section-attachments [aria-label="More actions"]');
const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const act = (run) => React.act(async () => { run(); });

async function switchToList(view) {
	await view.click(manageButton());
	await view.click(view.getByRole("menuitem", { name: "Switch to list view" }));
}

/** Enter in a single-input form submits it (implicit submission, which happy-dom's press does not model). */
function submit(input) {
	return act(() => input.form.requestSubmit());
}

function paste(element, text) {
	return act(() => {
		const event = new Event("paste", { bubbles: true, cancelable: true });
		Object.defineProperty(event, "clipboardData", { value: { getData: () => text } });
		element.dispatchEvent(event);
	});
}

function drag(type, target, files) {
	return act(() => {
		const event = new Event(type, { bubbles: true, cancelable: true });
		Object.defineProperty(event, "dataTransfer", { value: { types: ["Files"], files, dropEffect: "none" } });
		Object.defineProperty(event, "clientX", { value: 40 });
		Object.defineProperty(event, "clientY", { value: 40 });
		target.dispatchEvent(event);
	});
}

test("the grid shows reference piles and the manage menu, with no preview anywhere", async () => {
	const view = await renderAttachments();
	assert.equal(view.queryByRole("button", { name: "Documents, 4 attachments" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Videos, 2 attachments" }) !== null, true);
	assert.equal(document.querySelector('[data-attachment-card="team-offsite-recap"]') !== null, true, "att-16 Team Offsite Recap replaces the invented recording");
	assert.equal(view.queryByRole("tablist", { name: "Filter attachments" }), null, "filters are list-view only");
	await view.click(manageButton());
	assert.deepEqual(view.getAllByRole("menuitem").map((item) => item.textContent), ["Switch to list view", "Download all", "Delete all"]);
	assert.equal(view.getByRole("menuitem", { name: "Download all" }).getAttribute("aria-disabled"), "true", "nothing file-backed to download");
	await view.press(null, "Escape");
	assert.equal(document.body.textContent.includes("Preview"), false);
	assert.equal(view.queryByRole("menuitem", { name: "Upload files" }), null);
	assert.equal(view.queryByRole("textbox", { name: "Attachment name or URL" }), null);
});

test("list view sorts by updatedAt, paginates, and filters by type", async () => {
	const view = await renderAttachments();
	await switchToList(view);
	assert.equal(view.getByRole("list", { name: "Attachments" }) !== null, true);
	assert.deepEqual(rowNames(), ["Q1 Marketing Strategy & Goals", "Social Media Campaign Draft.pdf", "Brand Asset Guidelines 2026", "Feature Walkthrough - New UI", "Hero Image - Summer Launch.png"]);
	assert.equal(document.querySelector("[data-attachment-row]").textContent.includes("Mar 1"), true, "rows show the added date");
	assert.equal(view.getByRole("button", { name: "Show 3 more attachments" }).textContent, "Show 3 more");
	await view.click(view.getByRole("button", { name: "Show 3 more attachments" }));
	assert.equal(rowNames().includes("Team Offsite Recap"), true);
	assert.deepEqual(view.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label") ?? tab.textContent), ["All", "Documents", "Images", "Videos", "Links"]);
	await view.click(view.getByRole("tab", { name: "Documents" }));
	assert.equal(rowNames().length, 4);
	assert.equal(view.getByRole("button", { name: "Collapse Attachments Documents" }).getAttribute("aria-expanded"), "true");
	await view.click(manageButton());
	await view.click(view.getByRole("menuitem", { name: "Switch to grid view" }));
	assert.equal(view.queryByRole("button", { name: "Documents, 4 attachments" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Collapse Attachments" }) !== null, true, "the filter label only shows in list view");
});

test("the composer searches the catalog, creates, adds links, and keeps editor state out of the audit", async () => {
	const view = await renderAttachments();
	await switchToList(view);
	const audit = byTestId("audit").textContent;
	await view.click(view.getByRole("button", { name: "Add attachment" }));
	const input = view.getByRole("combobox", { name: "Add attachment" });
	assert.equal(view.isFocused(input), true);
	assert.equal(input.getAttribute("placeholder"), "Create new, search or paste existing");
	assert.equal(byTestId("audit").textContent, audit, "opening the composer is not audited");
	await view.fill(input, "Brand");
	assert.deepEqual(view.getAllByRole("option").map((option) => option.textContent), ["Brand Campaign Brief 2026", 'Create "Brand"']);
	assert.equal(view.getByRole("listbox", { name: "Matching attachments" }) !== null, true);
	assert.equal(document.querySelector("[data-related-composer] [aria-live=polite]").textContent, "2 matching attachments");
	await submit(input);
	assert.equal(view.queryByRole("combobox", { name: "Add attachment" }), null, "the composer closes on commit");
	assert.equal(rowNames()[0], "Brand Campaign Brief 2026");
	assert.equal(view.isFocused(view.getByRole("button", { name: "Add attachment" })), true);
	await view.click(view.getByRole("button", { name: "Add attachment" }));
	const again = view.getByRole("combobox", { name: "Add attachment" });
	await paste(again, " https://acme.com/wiki/spaces/X/pages/1/Launch-plan ");
	assert.equal(again.value, "https://acme.com/wiki/spaces/X/pages/1/Launch-plan", "a pasted link stays in the field");
	assert.deepEqual(view.getAllByRole("option").map((option) => option.textContent), ['Add link "Launch plan"']);
	await view.press(again, "Escape");
	assert.equal(again.value, "", "Escape with text clears it");
	await view.press(again, "Escape");
	assert.equal(view.queryByRole("combobox", { name: "Add attachment" }), null);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Add attachment" })), true, "Escape when empty returns focus to the trigger");
});

test("grid + opens a standalone composer above the piles and a new card is announced", async () => {
	const view = await renderAttachments();
	await view.click(view.getByRole("button", { name: "Add attachment" }));
	assert.equal(view.getByRole("list", { name: "Add attachment" }) !== null, true);
	await view.fill(view.getByRole("combobox", { name: "Add attachment" }), "Kickoff notes");
	await submit(view.getByRole("combobox", { name: "Add attachment" }));
	assert.equal(view.queryByRole("button", { name: "Documents, 5 attachments" }) !== null, true, "the created page joins the Documents pile");
	assert.equal(view.getAllByRole("status").some((status) => status.textContent === "Kickoff notes added"), true);
});

test("Delete all and per-item confirmations use the reference copy", async () => {
	const view = await renderAttachments();
	await view.click(view.getByRole("button", { name: "More actions for http://insight-metrics.io/analysis-q1" }));
	assert.deepEqual(view.getAllByRole("menuitem").map((item) => item.textContent), ["Remove"], "links only offer Remove");
	await view.click(view.getByRole("menuitem", { name: "Remove" }));
	const dialog = view.getByRole("dialog", { name: "Remove content?" });
	assert.equal(dialog.textContent.includes("Once removed, it'll no longer appear in this work item."), true);
	await view.click(view.getByRole("button", { name: "Cancel" }));
	assert.equal(document.querySelector('[data-attachment-card="analysis-link"]') !== null, true);
	await view.click(view.getByRole("button", { name: "More actions for Hero Image - Summer Launch.png" }));
	assert.deepEqual(view.getAllByRole("menuitem").map((item) => item.textContent), ["Download", "Delete"]);
	await view.click(view.getByRole("menuitem", { name: "Delete" }));
	assert.equal(view.getByRole("dialog", { name: "Permanently delete this attachment?" }).textContent.includes("Once you delete, it's gone for good."), true);
	await view.click(view.getByRole("button", { name: "Delete" }));
	assert.equal(document.querySelector('[data-attachment-card="hero-image"]'), null);
	await view.click(manageButton());
	await view.click(view.getByRole("menuitem", { name: "Delete all" }));
	const all = view.getByRole("dialog", { name: "Delete all attachments?" });
	assert.equal(all.textContent.includes("All attachments will be permanently deleted."), true);
	await view.click(view.getByRole("button", { name: "Delete" }));
	assert.equal(document.querySelector('[data-related-type="attachments"]'), null, "an emptied group hides while other groups have content");
});

test("Escape closes the most recently opened pile and refocuses its toggle", async () => {
	const view = await renderAttachments();
	await view.click(view.getByRole("button", { name: "Documents, 4 attachments" }));
	await view.click(view.getByRole("button", { name: "Videos, 2 attachments" }));
	assert.equal(document.querySelector("[data-attachment-piles]").getAttribute("aria-label"), "Attachments", "two open piles keep the generic grid name");
	await view.press(view.getByRole("button", { name: "More actions for Hero Image - Summer Launch.png" }), "Escape");
	assert.equal(view.queryByRole("button", { name: "Close videos" }), null);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Videos, 2 attachments" })), true);
	assert.equal(document.querySelector('[data-attachment-piles]').getAttribute("aria-label"), "Documents, 4 attachments", "one open pile names the grid");
});

test("dropping files anywhere on the column adds them once, announces, and skips editors", async () => {
	const view = await renderAttachments();
	const column = byTestId("column");
	const pdf = new File(["x"], "Signed contract.pdf", { type: "application/pdf" });
	await drag("dragenter", column, [pdf]);
	await drag("dragover", column, [pdf]);
	assert.equal(document.querySelector("[data-attachment-drop-wash]") !== null, true);
	assert.equal(view.queryByText("Drop to upload") !== null, true);
	await drag("drop", column, [pdf]);
	assert.equal(document.querySelector("[data-attachment-drop-wash]"), null);
	assert.equal(view.getAllByRole("status").some((status) => status.textContent === "Added 1 attachment"), true);
	assert.equal(view.queryByRole("button", { name: "Documents, 5 attachments" }) !== null, true);
	await drag("drop", column, [pdf]);
	assert.equal(view.getAllByRole("status").some((status) => status.textContent === "No attachments were added"), true, "the same file twice lands once");
	assert.equal(view.queryByRole("button", { name: "Documents, 5 attachments" }) !== null, true);
	const other = new File(["y"], "Notes.pdf", { type: "application/pdf" });
	await drag("drop", byTestId("editor"), [other]);
	assert.equal(view.queryByRole("button", { name: "Documents, 5 attachments" }) !== null, true, "drops inside a rich-text editor are left to it");
});

test("the Empty preset composer opens as a list, click-away un-requests it, and tabs track present types", async () => {
	const view = await renderAttachments({ preset: "empty" });
	assert.equal(document.querySelector('[data-related-type="attachments"]'), null);
	await view.press(document.body, "A", { shiftKey: true });
	assert.equal(view.getByRole("list", { name: "Attachments" }).querySelector("[data-related-composer]") !== null, true, "with nothing attached the composer renders as a list");
	await view.click(byTestId("editor"));
	assert.equal(document.querySelector('[data-related-type="attachments"]'), null, "click-away closes the composer and hides the empty group");
	await drag("drop", byTestId("column"), [new File(["x"], "Brief.pdf", { type: "application/pdf" })]);
	assert.equal(document.querySelectorAll("[data-attachment-card]").length, 1, "the dropped file shows as a single grid card");
	await switchToList(view);
	assert.equal(view.queryByRole("tablist", { name: "Filter attachments" }), null, "a single type shows no filter tabs");
	await view.click(view.getByRole("button", { name: "Add attachment" }));
	await view.fill(view.getByRole("combobox", { name: "Add attachment" }), "https://acme.com/wiki/spaces/X/pages/1/Launch-plan");
	await submit(view.getByRole("combobox", { name: "Add attachment" }));
	assert.deepEqual(rowNames(), ["Launch plan", "Brief.pdf"]);
	assert.deepEqual(view.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label") ?? tab.textContent), ["All", "Documents", "Links"]);
});
