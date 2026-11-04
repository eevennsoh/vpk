const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");

const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderWorkItem(props = {}) {
	return renderComponent({
		source: `import React from "react";
			import { SidebarProvider } from "@/app/contexts/context-sidebar";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
			export default function TestWorkItem(props) { return <ThemeWrapper><SidebarProvider><ProjectButterJiraWorkItem {...props} /></SidebarProvider></ThemeWrapper>; }`,
		mocks: {
			"@/app/contexts": `const controls = { chatSurface: null, openChat() {}, toggleChat() {} };
				export const useRovoChatControls = () => controls;
				export const useOptionalRovoChatControls = () => controls;
				export const useOptionalRovoChat = () => null;`,
		},
		props: { initialPreset: "filled", onClose() {}, open: true, ...props },
	});
}

test("a suggested description reveals once, stays editable, and yields immediately to focus", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Accept description" }));
	const editor = view.getByRole("textbox", { name: "Work item description" });
	const reveal = document.querySelector("[data-description-reveal]");
	assert.notEqual(reveal, null);
	assert.equal(reveal?.getAttribute("aria-hidden"), "true");
	const animatedText = reveal?.querySelector("[data-suggestion-text-reveal]");
	assert.notEqual(animatedText, null);
	assert.equal(animatedText?.querySelectorAll('[style*="transform"]').length, 0);
	const coloredWords = [...animatedText.querySelectorAll("[data-description-color]")];
	assert.equal(coloredWords.length > 0, true);
	assert.equal(coloredWords.every((word) => word.textContent === word.previousElementSibling?.textContent && word.children.length === 0), true);
	assert.equal(new Set(coloredWords.map((word) => word.style.backgroundImage)).size > 1, true);
	assert.equal(editor.textContent.includes("Improve the onboarding experience"), true);
	await view.focus(editor);
	assert.equal(document.querySelector("[data-description-reveal]"), null);
	await view.fill(editor, "My revised description");
	assert.equal(editor.textContent.startsWith("My revised description"), true);
	await view.unmount();
});

test("the description reveal finishes and does not replay when the item is reopened", async () => {
	const common = { initialPreset: "filled", initialSuggestion: true, onClose() {} };
	const view = await renderWorkItem({ ...common, open: true });
	await view.click(view.getByRole("button", { name: /5 suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Accept description" }));
	assert.notEqual(document.querySelector("[data-description-reveal]"), null);
	for (let waited = 0; document.querySelector("[data-description-reveal]") && waited < 3_000; waited += 50) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
	}
	assert.equal(document.querySelector("[data-description-reveal]"), null);
	await view.rerender({ ...common, open: false });
	await view.rerender({ ...common, open: true });
	assert.equal(document.querySelector("[data-description-reveal]"), null);
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent.includes("Improve the onboarding experience"), true);
	await view.unmount();
});

test("multi-paragraph reveal groups words, lines, paragraphs, and the remainder", async () => {
	const text = ["one two three four five six seven eight nine ten", "eleven twelve thirteen", "fourteen fifteen sixteen", "seventeen eighteen nineteen", Array.from({ length: 1000 }, (_, index) => `extra${index}`).join(" ")].join("\n\n");
	const view = await renderComponent({ entry: "components/blocks/jira-work-item/project-butter/description-rainbow-text.tsx", exportName: "DescriptionRainbowText", props: { text } });
	const words = [...document.querySelectorAll("[data-description-word]")];
	assert.equal(words.length, 64);
	assert.deepEqual(words.slice(0, 5).map((word) => word.getAttribute("data-reveal-phase")), ["word", "word", "word", "word", "word"]);
	assert.equal(words[5].getAttribute("data-reveal-phase"), "line");
	assert.equal(words[10].getAttribute("data-reveal-phase"), "line");
	assert.equal(words[13].getAttribute("data-reveal-phase"), "paragraph");
	assert.equal(words[16].getAttribute("data-reveal-phase"), "paragraph");
	assert.equal(words[19].getAttribute("data-reveal-phase"), "all");
	await view.unmount();
});

test("a long description reveals a bounded prefix before showing the full editable text", async () => {
	const view = await renderWorkItem({ initialSuggestion: true, suggestionProfile: "payments" });
	await view.click(view.getByRole("button", { name: /suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Accept description" }));
	const words = [...document.querySelectorAll("[data-description-reveal] [data-description-word]")];
	assert.equal(words.length, 64);
	assert.deepEqual(words.slice(0, 5).map((word) => word.getAttribute("data-reveal-phase")), ["word", "word", "word", "word", "word"]);
	const editor = view.getByRole("textbox", { name: "Work item description" });
	assert.equal(editor.textContent.length > 500, true);
	for (let waited = 0; document.querySelector("[data-description-reveal]") && waited < 3_000; waited += 50) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
	}
	assert.equal(document.querySelector("[data-description-reveal]"), null);
	await view.focus(editor);
	assert.equal(view.isFocused(editor), true);
	await view.unmount();
});

test("accepting a due date fills its Details field", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Show as list" }));
	await view.click(view.getByRole("button", { name: "Accept due date" }));
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "true");
	await view.unmount();
});

test("the shared stack accepts and dismisses Butter fields and supports undo", async () => {
	const view = await renderWorkItem({ initialSuggestion: true, suggestionProfile: "payments" });
	await view.click(view.getByRole("button", { name: /suggestions/iu }));
	assert.notEqual(view.queryByRole("button", { name: "Show as list" }), null);
	await view.click(view.getByRole("button", { name: "Show as list" }));
	await view.click(view.getByRole("button", { name: "Accept due date" }));
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "true");
	await view.click(view.getByRole("button", { name: "Dismiss parent" }));
	assert.equal(document.querySelector('[data-field-id="parent"]')?.getAttribute("data-field-filled"), "false");
	await view.click(view.getByRole("button", { name: "Undo due date" }));
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "false");
	await view.unmount();
});

test("accept all uses actual values and undo preserves later edits", async () => {
	const view = await renderWorkItem({ initialSuggestion: true, suggestionProfile: "payments" });
	await view.click(view.getByRole("button", { name: /suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Accept all" }));
	const editor = view.getByRole("textbox", { name: "Work item description" });
	assert.equal(editor.textContent.includes("Help merchants adopt Payments SDK v2"), true);
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "true");
	await view.fill(editor, "Revised by me");
	await view.click(view.getByRole("button", { name: /Undo accepting 5 suggestions/u }));
	assert.equal(editor.textContent, "Revised by me");
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "false");
	await view.unmount();
});

test("a description draft is not offered or overwritten", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	const editor = view.getByRole("textbox", { name: "Work item description" });
	await view.fill(editor, "My own draft");
	await view.click(view.getByRole("button", { name: /4 suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Accept all" }));
	assert.equal(editor.textContent.startsWith("My own draft"), true);
	assert.equal(editor.textContent.includes("Improve the onboarding experience"), false);
	await view.unmount();
});

test("suggestions remain scoped to the work item", async () => {
	const common = { initialPreset: "filled", onClose() {}, open: true };
	const demo = { ...common, initialSuggestion: true, suggestionProfile: "payments", workItem: { code: "PAY-999", title: "Merchant onboarding" } };
	const other = { ...common, initialSuggestion: false, workItem: { code: "PAY-118", title: "Card artwork" } };
	const view = await renderWorkItem(demo);
	await view.click(view.getByRole("button", { name: /suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Show as list" }));
	await view.click(view.getByRole("button", { name: "Accept parent" }));
	await view.rerender(other);
	assert.equal(view.queryByRole("button", { name: /suggestions/iu }), null);
	await view.rerender(demo);
	await view.click(view.getByRole("button", { name: "Show more details" }));
	assert.equal(document.querySelector('[data-field-id="parent"]')?.getAttribute("data-field-filled"), "true");
	await view.unmount();
});

test("dismissed suggestions stay dismissed when the suggestion setting is toggled", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Dismiss description" }));
	await view.click(view.getByRole("button", { name: "Close suggestions" }));
	await view.click(view.getByRole("button", { name: "Settings" }));
	await view.click(view.getByRole("switch", { name: "Suggestion" }));
	await view.click(view.getByRole("switch", { name: "Suggestion" }));
	await view.click(view.getByRole("button", { name: "View prototype" }));
	assert.notEqual(view.queryByRole("button", { name: /4 suggestions/iu }), null);
	await view.unmount();
});

test("undoing a dismissal restores it to the work item", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Dismiss description" }));
	await view.click(view.getByRole("button", { name: "Undo dismissing Description" }));
	assert.notEqual(view.queryByRole("button", { name: /5 suggestions/iu }), null);
	await view.unmount();
});


test("the source stack and grid appear together after the border trace", async () => {
	const view = await renderWorkItem({ initialSuggestion: true, suggestionProfile: "payments" });
	const trigger = view.getByRole("button", { name: "Finding suggestions" });
	const banner = trigger.parentElement;
	assert.equal(banner.querySelector("[data-suggestion-grid]"), null);
	assert.equal(banner.querySelector('[aria-label="Confluence"]'), null);
	for (let waited = 0; !banner.querySelector("[data-suggestion-grid]") && waited < 8_000; waited += 50) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
	}
	assert.notEqual(banner.querySelector("[data-suggestion-grid]"), null);
	assert.notEqual(banner.querySelector('[aria-label="Confluence"]'), null);
	assert.notEqual(view.queryByRole("button", { name: /5 suggestions/iu }), null);
	await view.unmount();
});
