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

test("board suggestion demo stays scoped to its work item and retains accepted fields", async () => {
	const common = { initialPreset: "filled", onClose() {}, open: true };
	const demo = { ...common, initialSuggestion: true, suggestionProfile: "payments", workItem: { code: "PAY-999", title: "Merchant onboarding" } };
	const other = { ...common, initialSuggestion: false, workItem: { code: "PAY-118", title: "Card artwork" } };
	const view = await renderWorkItem(demo);
	await view.click(view.getByRole("button", { name: /suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Accept Parent suggestion" }));
	assert.equal(document.querySelector('[data-field-id="parent"]')?.getAttribute("data-field-filled"), "true");
	await view.rerender(other);
	assert.equal(document.querySelector("[data-project-butter-state]")?.getAttribute("data-project-butter-state"), "filled");
	assert.equal(view.queryByRole("button", { name: /Suggestions/u }), null);
	await view.rerender(demo);
	assert.equal(document.querySelector("[data-project-butter-state]")?.getAttribute("data-project-butter-state"), "suggestion");
	await view.click(view.getByRole("button", { name: "Show more details" }));
	assert.equal(document.querySelector('[data-field-id="parent"]')?.getAttribute("data-field-filled"), "true");
	await view.click(view.getByRole("button", { name: /suggestions/iu }));
	assert.equal(document.querySelector("[data-project-butter-suggestion-panel]")?.getAttribute("data-suggestion-count"), "4");
});

test("suggestion grid and sources appear together after the loading highlight", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	const banner = document.querySelector("[data-suggestion-trigger]")?.parentElement;
	assert.ok(banner);
	assert.equal(banner.querySelector("[data-suggestion-grid]"), null);
	assert.equal(banner.querySelector('[aria-label="Confluence"]'), null);
	for (let waited = 0; !banner.querySelector("[data-suggestion-grid]") && waited < 5_000; waited += 50) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
	}
	assert.notEqual(banner.querySelector("[data-suggestion-grid]"), null);
	assert.notEqual(banner.querySelector('[aria-label="Confluence"]'), null);
	await view.unmount();
});

test("suggestion state proposes empty details fields and accepts or dismisses one at a time", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	assert.equal(document.querySelector("[data-project-butter-state]")?.getAttribute("data-project-butter-state"), "suggestion");
	const suggestions = view.getByRole("button", { name: /5 Suggestions/u });
	assert.equal(suggestions.getAttribute("aria-expanded"), "false");
	assert.equal(document.querySelectorAll("[data-project-butter-detail-fields] [data-field-id]").length, 4);
	assert.equal(view.queryByRole("list", { name: "Suggested field values" }), null);
	assert.equal(view.queryByRole("button", { name: "Accept all" }), null);
	assert.equal(view.queryByRole("button", { name: "Accept Due Date suggestion" }), null);
	await view.click(suggestions);
	assert.equal(suggestions.getAttribute("aria-expanded"), "true");
	assert.equal(view.queryByRole("list", { name: "Suggested field values" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Accept all" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Accept Reporter suggestion" }), null);
	assert.equal(document.querySelectorAll("[data-project-butter-detail-fields] [data-field-id]").length, 4);
	assert.equal(view.queryByText("Dec 15, 2026") !== null, true);
	await view.click(suggestions);
	assert.equal(suggestions.getAttribute("aria-expanded"), "false");
	assert.equal(view.queryByRole("button", { name: "Accept all" }), null);
	await view.click(suggestions);
	assert.equal(document.querySelector("[data-project-butter-suggestion-panel]")?.getAttribute("data-suggestion-count"), "5");
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "false");
	await view.click(view.getByRole("button", { name: "Accept Due Date suggestion" }));
	assert.equal(document.querySelectorAll("[data-project-butter-detail-fields] [data-field-id]").length > 4, true);
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "true");
	assert.equal(document.querySelector("[data-project-butter-suggestion-panel]")?.getAttribute("data-suggestion-count"), "4");
	assert.equal(document.querySelector('[data-field-id="parent"]')?.getAttribute("data-field-filled"), "false");
	await view.click(view.getByRole("button", { name: "Dismiss Parent suggestion" }));
	assert.equal(document.querySelector("[data-project-butter-suggestion-panel]")?.getAttribute("data-suggestion-count"), "3");
	assert.equal(document.querySelector('[data-field-id="reporter"]')?.getAttribute("data-field-filled"), "true");
});

test("a suggested description reveals once, stays editable, and yields immediately to focus", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 Suggestions/u }));
	await view.click(view.getByRole("button", { name: "Accept Description suggestion" }));
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
	await view.click(view.getByRole("button", { name: /5 Suggestions/u }));
	await view.click(view.getByRole("button", { name: "Accept Description suggestion" }));
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
	await view.click(view.getByRole("button", { name: "Accept Description suggestion" }));
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

test("Details suggestions use the same stationary rainbow text reveal", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 Suggestions/u }));
	await view.click(view.getByRole("button", { name: "Accept Due Date suggestion" }));
	const reveal = document.querySelector('[data-field-id="dueDate"] [data-suggestion-text-reveal]');
	assert.notEqual(reveal, null);
	assert.equal(reveal?.querySelectorAll('[style*="transform"]').length, 0);
	assert.equal(new Set([...reveal.querySelectorAll("[style]")].map((node) => node.style.color).filter(Boolean)).size > 1, true);
	await view.unmount();
});

test("accepting a description suggestion fills the editor and survives reopening", async () => {
	const common = { initialPreset: "filled", initialSuggestion: true, suggestionProfile: "payments", onClose() {}, workItem: { code: "PAY-999", title: "Merchant onboarding" } };
	const view = await renderWorkItem({ ...common, open: true });
	await view.click(view.getByRole("button", { name: /suggestions/iu }));
	await view.click(view.getByText("Show full description"));
	const preview = view.getByRole("list", { name: "Suggested field values" }).textContent;
	await view.click(view.getByText("Show full description"));
	await view.click(view.getByRole("button", { name: "Accept Description suggestion" }));
	const description = [...view.getByRole("textbox", { name: "Work item description" }).querySelectorAll("p")].map((paragraph) => paragraph.textContent).join("\n\n");
	assert.equal(description.length > 500, true);
	assert.equal(description.startsWith("Help merchants adopt Payments SDK v2"), true);
	assert.equal(preview.includes(description), true);
	await view.rerender({ ...common, open: false });
	await view.rerender({ ...common, open: true });
	assert.equal([...view.getByRole("textbox", { name: "Work item description" }).querySelectorAll("p")].map((paragraph) => paragraph.textContent).join("\n\n"), description);
});

test("a description draft removes its suggestion and is not overwritten by Accept all", async () => {
	const matchMedia = window.matchMedia;
	window.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	try {
		const view = await renderWorkItem({ initialSuggestion: true });
		await view.fill(view.getByRole("textbox", { name: "Work item description" }), "My own draft");
		await view.click(view.getByRole("button", { name: /4 Suggestions/u }));
		assert.equal(view.queryByRole("button", { name: "Accept Description suggestion" }), null);
		await view.click(view.getByRole("button", { name: "Accept all" }));
		assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent.startsWith("My own draft"), true);
		assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent.includes("Improve the onboarding experience"), false);
		await view.unmount();
	} finally {
		window.matchMedia = matchMedia;
	}
});

test("Accept all preserves a description started while suggestions are filling", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 Suggestions/u }));
	await view.click(view.getByRole("button", { name: "Accept all" }));
	await view.fill(view.getByRole("textbox", { name: "Work item description" }), "Typed while filling");
	for (let waited = 0; !view.queryByText("4 updated") && waited < 10_000; waited += 50) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
	}
	assert.notEqual(view.queryByText("4 updated"), null);
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent.startsWith("Typed while filling"), true);
	await view.click(view.getByRole("button", { name: "Undo" }));
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent.startsWith("Typed while filling"), true);
	await view.unmount();
});

test("undo preserves a description edited after accepting all suggestions", async () => {
	const matchMedia = window.matchMedia;
	window.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	try {
		const view = await renderWorkItem({ initialSuggestion: true });
		await view.click(view.getByRole("button", { name: /5 Suggestions/u }));
		await view.click(view.getByRole("button", { name: "Accept all" }));
		assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent.includes("Improve the onboarding experience"), true);
		await view.fill(view.getByRole("textbox", { name: "Work item description" }), "Revised by me");
		await view.click(view.getByRole("button", { name: "Undo" }));
		assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent, "Revised by me");
		assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "false");
		await view.unmount();
	} finally {
		window.matchMedia = matchMedia;
	}
});

test("suggestions follow visible field order and exclude hidden fields", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: "Show more details" }));
	await view.click(view.getByRole("button", { name: "More parent field actions" }));
	await view.click(view.getByRole("menuitem", { name: "Hide field" }));
	await view.click(view.getByRole("button", { name: "More labels field actions" }));
	await view.click(view.getByRole("menuitem", { name: "Move up" }));
	await view.click(view.getByRole("button", { name: /4 Suggestions/u }));
	assert.equal(view.queryByRole("button", { name: "Accept Parent suggestion" }), null);
	const labels = [...document.querySelectorAll('[aria-label="Suggested field values"] li')].map((row) => row.textContent);
	assert.equal(labels[0].includes("Description"), true);
	assert.equal(labels[1].includes("Labels"), true);
	assert.equal(labels[2].includes("Due Date"), true);
});

test("dismiss all clears remaining suggestions without undoing accepted fields", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 Suggestions/u }));
	await view.click(view.getByRole("button", { name: "Accept Due Date suggestion" }));
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "true");
	await view.click(view.getByRole("button", { name: "Dismiss all" }));
	assert.equal(view.queryByRole("button", { name: /Suggestions/u }), null);
	assert.equal(view.queryByRole("button", { name: "Dismiss all" }), null);
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "true");
	assert.equal(document.querySelector('[data-field-id="parent"]')?.getAttribute("data-field-filled"), "false");
});

const SUGGESTION_FIELD_ORDER = ["dueDate", "parent", "labels", "acceptanceCriteria"];

function detailRailOrder() {
	return [...document.querySelectorAll("[data-project-butter-detail-fields] [data-field-id], [data-project-butter-detail-fields] [data-project-butter-suggestion-cursor]")].map((node) => node.getAttribute("data-field-id") ?? "filling-bar");
}

async function acceptAllSuggestions(view) {
	await view.click(view.getByRole("button", { name: /5 Suggestions/u }));
	await view.click(view.getByRole("button", { name: "Accept all" }));
}

function assertFilledInRailOrder() {
	assert.deepEqual(detailRailOrder().slice(0, 8), ["status", "assignee", "priority", ...SUGGESTION_FIELD_ORDER, "reporter"]);
	assert.equal(SUGGESTION_FIELD_ORDER.every((field) => document.querySelector(`[data-field-id="${field}"]`)?.getAttribute("data-field-filled") === "true"), true);
}

test("Accept all walks the filling bar down the rail one field at a time and keeps the field order", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await acceptAllSuggestions(view);
	const barSlots = [];
	let sawDescriptionReveal = false;
	const filledState = (field) => document.querySelector(`[data-field-id="${field}"]`)?.getAttribute("data-field-filled");
	for (let waited = 0; !view.queryByText("5 updated") && waited < 10_000; waited += 25) {
		if (document.querySelector("[data-description-reveal]")) sawDescriptionReveal = true;
		const rail = detailRailOrder();
		const slot = rail.indexOf("filling-bar");
		if (slot >= 0) {
			const position = slot === 0 ? "top" : rail[slot - 1];
			if (barSlots.at(-1) !== position) barSlots.push(position);
			if (slot > 0 && SUGGESTION_FIELD_ORDER.includes(position)) assert.equal(filledState(position), "true");
		}
		await act(() => new Promise((resolve) => setTimeout(resolve, 25)));
	}
	const expectedSlots = ["top", "status", "assignee", "priority", ...SUGGESTION_FIELD_ORDER, "reporter"];
	assert.equal(["top", "status"].includes(barSlots[0]), true);
	assert.equal(barSlots.at(-1), "reporter");
	assert.equal(barSlots.every((slot, index) => index === 0 || expectedSlots.indexOf(slot) > expectedSlots.indexOf(barSlots[index - 1])), true);
	assert.equal(sawDescriptionReveal, true);
	assert.equal(view.queryByText("5 updated") !== null, true);
	assert.equal(detailRailOrder().includes("filling-bar"), false);
	assertFilledInRailOrder();
});

test("the suggestion banner keeps one Teamwork Graph loader from loading to resting and back", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	const loader = () => document.querySelector('[data-slot="twg-loader"][aria-label="Teamwork Graph"]');
	const waitForState = async (state) => {
		for (let waited = 0; loader()?.getAttribute("data-state") !== state && waited < 10_000; waited += 50) {
			await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
		}
		return loader()?.getAttribute("data-state");
	};
	const original = loader();
	assert.equal(original !== null, true);
	assert.equal(await waitForState("resting"), "resting", "the intro settles to rest");
	await acceptAllSuggestions(view);
	assert.equal(await waitForState("loading"), "loading");
	assert.equal(loader() === original, true, "starting to fill keeps the resting loader");
	assert.equal(await waitForState("resting"), "resting");
	assert.equal(view.queryByText("5 updated") !== null, true);
	assert.equal(loader() === original, true, "the review banner keeps the loader that was filling");
	await view.click(view.getByRole("button", { name: "Undo" }));
	assert.equal(loader() === original, true, "undo keeps the same loader");
	assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent, "");
	await acceptAllSuggestions(view);
	assert.equal(await waitForState("loading"), "loading");
	assert.equal(loader() === original, true, "filling again resumes the same loader");
	for (let waited = 0; !document.querySelector("[data-description-reveal]") && waited < 5_000; waited += 50) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
	}
	await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
	const replay = document.querySelector("[data-description-reveal]");
	assert.notEqual(replay, null);
	assert.equal(replay?.nextElementSibling?.classList.contains("opacity-0"), true);
	await view.unmount();
});

test("Accept all under reduced motion fills instantly without the filling bar", async () => {
	const matchMedia = window.matchMedia;
	window.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
	try {
		const view = await renderWorkItem({ initialSuggestion: true });
		await acceptAllSuggestions(view);
		assert.equal(view.queryByText("5 updated") !== null, true);
		assert.equal(document.querySelector("[data-description-reveal]"), null);
		assert.equal(detailRailOrder().includes("filling-bar"), false);
		assertFilledInRailOrder();
		await view.unmount();
	} finally {
		window.matchMedia = matchMedia;
	}
});

test("settings can switch Project butter into the suggestion state", async () => {
	const view = await renderWorkItem();
	await view.click(view.getByRole("button", { name: "Settings" }));
	assert.equal(view.getByRole("switch", { name: "Suggestion" }).getAttribute("aria-checked"), "false");
	await view.click(view.getByRole("switch", { name: "Suggestion" }));
	assert.equal(view.getByRole("switch", { name: "Empty" }).getAttribute("aria-checked"), "false");
	await view.click(view.getByRole("button", { name: "View prototype" }));
	assert.equal(document.querySelector("[data-project-butter-state]")?.getAttribute("data-project-butter-state"), "suggestion");
	assert.equal(view.queryByRole("button", { name: "Accept Parent suggestion" }), null);
	await view.click(view.getByRole("button", { name: /Suggestions/u }));
	assert.equal(view.queryByRole("button", { name: "Accept Parent suggestion" }) !== null, true);
});
