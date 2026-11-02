const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

const EDITOR_HARNESS = `import React from "react";
	import { ProjectButterSummary } from "@/components/blocks/jira-work-item/project-butter/project-butter-summary";
	import { ProjectButterDescription } from "@/components/blocks/jira-work-item/project-butter/project-butter-description";
	import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
	const item = { code: "VITA-1", title: "Original summary", description: "Original description" };
	export default function EditorProbe({ visible = true, description = false }) {
		const content = useProjectButterContent("filled", item);
		return <><button type="button">Outside editor</button>
			<output aria-label="Saved summary" role="status">{content.summary}</output>
			<output aria-label="Saved description" role="status">{content.description}</output>
			<output aria-label="Description draft" role="status">{content.descriptionDraft}</output>
			{visible ? description ? <ProjectButterDescription content={content} empty={false} /> : <ProjectButterSummary content={content} /> : null}
		</>;
	}`;

const SHELL_MOCKS = {
	"@/components/blocks/top-navigation/page": `export default function TopNavigation({children}) { return <div>{children}</div>; }`,
	"@/components/blocks/product-sidebar/page": `export default function ProductSidebar() { return null; }`,
	"@/components/blocks/jira-work-item/project-butter/project-butter-settings": `export function ProjectButterSettings() { return null; }`,
};

const SHELL_HARNESS = `import React, { useState } from "react";
	import { ProjectButterShell } from "@/components/blocks/jira-work-item/project-butter/project-butter-shell";
	import { ProjectButterSessionChat } from "@/components/blocks/jira-work-item/project-butter/project-butter-session-chat";
	export default function ShellProbe({ presentation = "side-panel", open = true }) {
		const [closed, setClosed] = useState(false);
		const [chat, setChat] = useState(false);
		const [actions, setActions] = useState(0);
		return <ProjectButterShell empty={false} onClose={() => setClosed(true)} onEmptyChange={() => {}} onPresentationChange={() => {}} open={open && !closed} presentation={presentation}>
			<button onClick={() => setActions(value => value + 1)}>Continue work {actions}</button>
			<button onClick={() => setChat(true)}>Open agent chat</button>
			<ProjectButterSessionChat open={chat} onClose={() => setChat(false)} title="Claude session chat">
				<input aria-label="Reply to Claude" />
				<button onClick={() => setChat(false)}>Close session</button>
			</ProjectButterSessionChat>
		</ProjectButterShell>;
	}`;

test("summary commits normalized text on blur and Enter and restores a blank edit", async () => {
	const view = await renderComponent({ source: EDITOR_HARNESS });
	const editor = view.getByRole("textbox", { name: "Work item summary" });
	await view.fill(editor, "   \n  ");
	await view.press(editor, "Enter");
	assert.equal(editor.textContent, "Original summary");
	await view.fill(editor, "  Revised\n onboarding   flow  ");
	assert.equal(view.getByRole("status", { name: "Saved summary" }).textContent, "Original summary");
	await view.click(view.getByRole("button", { name: "Outside editor" }));
	assert.equal(view.getByRole("status", { name: "Saved summary" }).textContent, "Revised onboarding flow");
	await view.fill(editor, "Ready for review");
	await view.press(editor, "Enter");
	assert.equal(view.getByRole("status", { name: "Saved summary" }).textContent, "Ready for review");
	assert.equal(view.isFocused(editor), false);
});

test("IME-confirming Enter keeps the summary draft focused and uncommitted", async () => {
	const view = await renderComponent({ source: EDITOR_HARNESS });
	const editor = view.getByRole("textbox", { name: "Work item summary" });
	await view.fill(editor, "入力中");
	for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
		await view.press(editor, "Enter", init);
		assert.equal(view.isFocused(editor), true);
		assert.equal(view.getByRole("status", { name: "Saved summary" }).textContent, "Original summary");
	}
	await view.press(editor, "Enter");
	assert.equal(view.getByRole("status", { name: "Saved summary" }).textContent, "入力中");
});

test("summary paste inserts plain normalized text at the selection", async () => {
	const view = await renderComponent({ source: EDITOR_HARNESS });
	const editor = view.getByRole("textbox", { name: "Work item summary" });
	await view.focus(editor);
	await act(() => {
		const range = document.createRange();
		range.selectNodeContents(editor);
		const selection = document.getSelection();
		selection.removeAllRanges();
		selection.addRange(range);
		const event = new Event("paste", { bubbles: true, cancelable: true });
		Object.defineProperty(event, "clipboardData", { value: { getData: () => "Pasted\n\t summary" } });
		editor.dispatchEvent(event);
	});
	assert.equal(editor.textContent, "Pasted summary");
	await view.click(view.getByRole("button", { name: "Outside editor" }));
	assert.equal(view.getByRole("status", { name: "Saved summary" }).textContent, "Pasted summary");
});

test("direct description editing preserves drafts through unmount and commits on blur and collapse", async () => {
	const view = await renderComponent({ source: EDITOR_HARNESS, props: { description: true } });
	assert.equal(view.queryByRole("button", { name: "Save" }), null);
	assert.equal(view.queryByRole("button", { name: "Cancel" }), null);
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "Keep this draft");
	assert.equal(view.getByRole("status", { name: "Saved description" }).textContent, "Original description");
	assert.equal(view.getByRole("status", { name: "Description draft" }).textContent, "Keep this draft");
	await view.rerender({ description: true, visible: false });
	await view.rerender({ description: true, visible: true });
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent, "Keep this draft");
	await view.focus(view.getByRole("textbox", { name: "Work item description" }));
	await view.click(view.getByRole("button", { name: "Outside editor" }));
	assert.equal(view.getByRole("status", { name: "Saved description" }).textContent, "Keep this draft");
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "Saved by collapse");
	await view.click(view.getByRole("button", { name: "Description" }));
	assert.equal(view.getByRole("status", { name: "Saved description" }).textContent, "Saved by collapse");
	assert.equal(view.queryByRole("textbox", { name: "Work item description" }), null);
	assert.equal(view.tabOrder().includes("Work item description"), false);
	await view.click(view.getByRole("button", { name: "Description" }));
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent, "Saved by collapse");
});

test("side panel keyboard resize stays bounded and survives presentation switches", async () => {
	const view = await renderComponent({ source: SHELL_HARNESS, mocks: SHELL_MOCKS });
	const handle = view.getByRole("separator", { name: "Resize work item side panel" });
	for (const [key, width] of [["ArrowRight", "440"], ["ArrowLeft", "460"], ["End", "620"], ["ArrowLeft", "620"], ["ArrowRight", "600"], ["Home", "440"], ["ArrowLeft", "460"]]) {
		await view.press(handle, key);
		assert.equal(handle.getAttribute("aria-valuenow"), width);
		assert.equal(handle.parentElement.style.width, `${width}px`);
	}
	await view.rerender({ presentation: "modal" });
	assert.equal(view.queryByRole("separator", { name: "Resize work item side panel" }), null);
	await view.rerender({ presentation: "side-panel" });
	assert.equal(view.getByRole("separator", { name: "Resize work item side panel" }).getAttribute("aria-valuenow"), "460");
});

test("side panel pointer resize coalesces moves, clamps bounds, and releases capture on cancellation and cleanup", async () => {
	const view = await renderComponent({ source: SHELL_HARNESS, mocks: SHELL_MOCKS });
	const handle = view.getByRole("separator", { name: "Resize work item side panel" });
	let captured = null;
	handle.setPointerCapture = (id) => { captured = id; };
	handle.hasPointerCapture = (id) => captured === id;
	handle.releasePointerCapture = () => { captured = null; };
	handle.parentElement.getBoundingClientRect = () => ({ right: 1000 });
	const pending = new Map();
	let frameId = 0;
	const originalRequest = globalThis.requestAnimationFrame;
	const originalCancel = globalThis.cancelAnimationFrame;
	globalThis.requestAnimationFrame = (callback) => { pending.set(++frameId, callback); return frameId; };
	globalThis.cancelAnimationFrame = (id) => pending.delete(id);
	async function pointer(type, clientX) {
		await act(() => handle.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, clientX, pointerId: 7 })));
	}
	try {
		await pointer("pointerdown", 560);
		assert.equal(captured, 7);
		await pointer("pointermove", 500);
		await pointer("pointermove", 100);
		assert.equal(pending.size, 1);
		assert.equal(handle.getAttribute("aria-valuenow"), "440");
		await act(() => {
			const [id, callback] = pending.entries().next().value;
			pending.delete(id);
			callback(0);
		});
		assert.equal(handle.getAttribute("aria-valuenow"), "620");
		await pointer("pointerup", 100);
		assert.equal(handle.getAttribute("aria-valuenow"), "620");
		assert.equal(captured, null);
		assert.equal(pending.size, 0);
		await pointer("pointerdown", 380);
		await pointer("pointermove", 950);
		await pointer("pointercancel", 950);
		assert.equal(handle.getAttribute("aria-valuenow"), "440");
		assert.equal(captured, null);
		await pointer("pointerdown", 560);
		await pointer("pointermove", 500);
		await pointer("lostpointercapture", 500);
		assert.equal(handle.getAttribute("aria-valuenow"), "500");
		await pointer("pointermove", 100);
		assert.equal(handle.getAttribute("aria-valuenow"), "500");
		await pointer("pointerdown", 500);
		await pointer("pointermove", 100);
		await view.rerender({ presentation: "modal" });
		assert.equal(captured, null);
		assert.equal(pending.size, 0);
		await view.rerender({ presentation: "side-panel" });
		assert.equal(view.getByRole("separator", { name: "Resize work item side panel" }).getAttribute("aria-valuenow"), "500");
	} finally {
		await view.unmount();
		globalThis.requestAnimationFrame = originalRequest;
		globalThis.cancelAnimationFrame = originalCancel;
	}
});

test("floating session chat keeps the work item interactive and closes independently on Escape", async () => {
	const view = await renderComponent({ source: SHELL_HARNESS, mocks: SHELL_MOCKS });
	await view.click(view.getByRole("button", { name: "Open agent chat" }));
	const chat = view.getByRole("dialog", { name: "Claude session chat" });
	assert.equal(chat.getAttribute("aria-modal"), null);
	assert.equal(document.querySelectorAll('[data-slot="dialog-overlay"]').length, 1);
	await view.click(view.getByRole("button", { name: "Continue work 0" }));
	assert.equal(view.queryByRole("button", { name: "Continue work 1" }) !== null, true);
	assert.equal(view.queryByRole("dialog", { name: "Claude session chat" }) !== null, true);
	await view.focus(view.getByRole("textbox", { name: "Reply to Claude" }));
	await view.press(null, "Escape");
	assert.equal(view.queryByRole("dialog", { name: "Claude session chat" }), null);
	assert.equal(view.queryByRole("dialog", { name: "Project butter" }) !== null, true);
});

test("Empty shortcuts reveal only their section and return after cancellation", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { ProjectButterEmptyActions } from "@/components/blocks/jira-work-item/project-butter/project-butter-empty-actions";
			import { ProjectButterRelatedWork } from "@/components/blocks/jira-work-item/project-butter/project-butter-related-work";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			export default function EmptyProbe() {
				const content = useProjectButterContent("empty");
				const active = content.attachmentComposerOpen || content.relatedEditor.children.composerOpen || content.relatedEditor.linked.composerOpen || content.attachments.length || content.relatedWork.children.length || content.relatedWork.linked.length;
				return <><button type="button">Outside related work</button><ProjectButterEmptyActions content={content} />{active ? <ProjectButterRelatedWork content={content} empty /> : null}</>;
			}`,
	});
	for (const [shortcut, input, section] of [["Add attachment", "Attachment name or URL", "Attachments"], ["Add child work item", "Create child work item", "Child work items"], ["Add linked work", "Add linked work", "Linked work"]]) {
		await view.click(view.getByRole("button", { name: shortcut }));
		assert.equal(view.getAllByRole("button", { name: shortcut }).length, 1);
		for (const candidate of ["Attachments", "Child work items", "Linked work"]) {
			assert.equal(document.querySelector(`section[aria-label="${candidate}"]`) !== null, candidate === section);
		}
		const editor = view.getByRole(input === "Attachment name or URL" ? "textbox" : "combobox", { name: input });
		await view.press(editor, "Escape");
		assert.equal(document.querySelector(`section[aria-label="${section}"]`) === null, true);
		assert.equal(view.isFocused(view.getByRole("button", { name: shortcut })), true);
	}
	for (const [shortcut, section] of [["Add attachment", "Attachments"], ["Add child work item", "Child work items"]]) {
		await view.click(view.getByRole("button", { name: shortcut }));
		await view.click(view.getByRole("button", { name: "Outside related work" }));
		assert.equal(document.querySelector(`section[aria-label="${section}"]`) === null, true);
		assert.equal(view.isFocused(view.getByRole("button", { name: "Outside related work" })), true);
		assert.equal(view.queryByRole("button", { name: shortcut }) !== null, true);
	}
	await view.click(view.getByRole("button", { name: "Add attachment" }));
	await view.fill(view.getByRole("textbox", { name: "Attachment name or URL" }), "Design review");
	await view.click(view.getByRole("button", { name: "Add", hidden: false }));
	assert.equal(view.queryByText("Design review") !== null, true);
	assert.equal(view.getAllByRole("button", { name: "Add attachment" }).length, 1);
});
