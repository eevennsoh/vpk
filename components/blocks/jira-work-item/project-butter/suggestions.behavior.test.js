const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");

const { motionDuration } = require("../../../../lib/motion.ts");
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

/** The reveal's safety stop, from the token the product reads; the reveal must end before it. */
const REVEAL_SAFETY_STOP_MS = motionDuration.slowest * 5 * 1000;

/**
 * Runs `body` with timers on fake time, then, even when `body` throws, unmounts `view` and
 * advances fake time so what is still queued runs, such as the editor teardown Tiptap schedules
 * 1 ms after unmount, before the harness cleanup goes back to real timers, for as long as the longest
 * timer the reveal sets (its safety stop). `runAll()` is not used: Node 24 advances it only
 * to the most recently queued timer, not the latest one.
 *
 * The description reveal ends when its word animations finish and a settle timer runs, or at a
 * safety stop timer; on a loaded machine these can fire before the test reads the reveal, so here
 * they run on fake time. happy-dom finishes a Web Animation on a real timer it captured when it
 * loaded, which `t.mock.timers` cannot reach, so each animation that ends finishes on fake time
 * instead; one that never ends stays paused and unfinished, as it would in a browser.
 */
async function onFakeTime(t, view, body) {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const animate = Element.prototype.animate;
	const animateOnFakeTime = t.mock.method(Element.prototype, "animate", function animateOnFakeTime(keyframes, options) {
		const animation = animate.call(this, keyframes, options);
		// Pausing drops happy-dom's real-time finish timer.
		animation.pause();
		const { endTime } = animation.effect.getComputedTiming();
		if (!Number.isFinite(endTime)) return animation;
		const timer = setTimeout(() => animation.finish(), endTime);
		const cancel = animation.cancel;
		animation.cancel = function cancelOnFakeTime() {
			clearTimeout(timer);
			return cancel.call(this);
		};
		return animation;
	});
	try {
		await body();
	} finally {
		animateOnFakeTime.mock.restore();
		await view.unmount();
		for (let elapsed = 0; elapsed < REVEAL_SAFETY_STOP_MS; elapsed += 50) {
			await act(async () => t.mock.timers.tick(50));
		}
		t.mock.timers.reset();
	}
}

/** Advances fake time in animation-sized steps until `done()` or `bound` ms of fake time, never past `bound`. */
async function advanceUntil(t, done, bound) {
	for (let elapsed = 0; !done() && elapsed < bound;) {
		const step = Math.min(50, bound - elapsed);
		await act(async () => t.mock.timers.tick(step));
		elapsed += step;
	}
}

/**
 * The payments profile opens with a border trace driven by animation frames; when it ends, the
 * panel opens by itself unless the user already opened it. On a loaded machine the trace can end
 * during the render, so frames queue from here until the returned release() runs them.
 */
function holdAnimationFrames(t) {
	const request = globalThis.requestAnimationFrame;
	const cancel = globalThis.cancelAnimationFrame;
	const queued = new Map();
	let held = true;
	let nextId = -1;
	t.mock.method(globalThis, "requestAnimationFrame", (callback) => {
		if (!held) return request(callback);
		queued.set(nextId, callback);
		return nextId--;
	});
	t.mock.method(globalThis, "cancelAnimationFrame", (id) => (queued.delete(id) ? undefined : cancel(id)));
	return () => {
		held = false;
		for (const callback of queued.values()) request(callback);
		queued.clear();
	};
}

/** The suggestions trigger: the one button named for suggestions outside the open panel, whose own buttons also mention them. */
function suggestionsTrigger(view) {
	const panel = view.queryByRole("dialog", { name: "Work item suggestions" });
	const triggers = view.getAllByRole("button", { name: /suggestions/iu }).filter((button) => panel?.contains(button) !== true);
	assert.equal(triggers.length, 1, "one suggestions trigger");
	return triggers[0];
}

/**
 * The payments profile opens with a border trace, then opens its panel by itself unless the user
 * already has. On a loaded machine the trace can end during the render, so open it with the
 * trigger only when it is not open yet; a separate test proves the trigger opens a closed panel.
 */
async function openPaymentsSuggestions(props = {}) {
	const view = await renderWorkItem({ initialSuggestion: true, suggestionProfile: "payments", ...props });
	if (suggestionsTrigger(view).getAttribute("aria-expanded") !== "true") await view.click(suggestionsTrigger(view));
	assert.equal(suggestionsTrigger(view).getAttribute("aria-expanded"), "true", "the suggestions panel is open");
	return view;
}

test("a suggested description reveals once, stays editable, and yields immediately to focus", async (t) => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 suggestions/iu }));
	// Tiptap keeps its editor on the editable element; it schedules the editor's destruction after unmount.
	let tiptap;
	await onFakeTime(t, view, async () => {
		await view.click(view.getByRole("button", { name: "Accept description" }));
		const editor = view.getByRole("textbox", { name: "Work item description" });
		tiptap = editor.editor;
		assert.equal(tiptap?.isDestroyed, false, "the description editor is live");
		const reveal = document.querySelector("[data-description-reveal]");
		assert.equal(reveal !== null, true);
		assert.equal(reveal?.getAttribute("aria-hidden"), "true");
		const animatedText = reveal?.querySelector("[data-suggestion-text-reveal]");
		assert.equal(animatedText !== null, true);
		assert.equal(animatedText?.querySelectorAll('[style*="transform"]').length, 0);
		const coloredWords = [...animatedText.querySelectorAll("[data-description-color]")];
		assert.equal(coloredWords.length > 0, true);
		assert.equal(coloredWords.every((word) => word.textContent === word.previousElementSibling?.textContent && word.children.length === 0), true);
		assert.equal(new Set(coloredWords.map((word) => word.style.backgroundImage)).size > 1, true);
		assert.equal(editor.textContent.includes("Improve the onboarding experience"), true);
		await view.focus(editor);
		assert.equal(document.querySelector("[data-description-reveal]") === null, true);
		await view.fill(editor, "My revised description");
		assert.equal(editor.textContent.startsWith("My revised description"), true);
	});
	assert.equal(tiptap.isDestroyed, true, "the editor teardown ran before timers went back to real time");
});

test("the description reveal finishes and does not replay when the item is reopened", async (t) => {
	const common = { initialPreset: "filled", initialSuggestion: true, onClose() {} };
	const view = await renderWorkItem({ ...common, open: true });
	await view.click(view.getByRole("button", { name: /5 suggestions/iu }));
	await onFakeTime(t, view, async () => {
		await view.click(view.getByRole("button", { name: "Accept description" }));
		assert.equal(document.querySelector("[data-description-reveal]") !== null, true);
		await advanceUntil(t, () => document.querySelector("[data-description-reveal]") === null, REVEAL_SAFETY_STOP_MS - 1);
		assert.equal(document.querySelector("[data-description-reveal]") === null, true, "the reveal ends through its animations, before the safety stop");
		await view.rerender({ ...common, open: false });
		await view.rerender({ ...common, open: true });
		assert.equal(document.querySelector("[data-description-reveal]") === null, true);
		assert.equal(view.getByRole("textbox", { name: "Work item description" }).textContent.includes("Improve the onboarding experience"), true);
	});
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

test("a long description reveals a bounded prefix before showing the full editable text", async (t) => {
	const view = await openPaymentsSuggestions();
	await onFakeTime(t, view, async () => {
		await view.click(view.getByRole("button", { name: "Accept description" }));
		const words = [...document.querySelectorAll("[data-description-reveal] [data-description-word]")];
		assert.equal(words.length, 64);
		assert.deepEqual(words.slice(0, 5).map((word) => word.getAttribute("data-reveal-phase")), ["word", "word", "word", "word", "word"]);
		const editor = view.getByRole("textbox", { name: "Work item description" });
		assert.equal(editor.textContent.length > 500, true);
		await advanceUntil(t, () => document.querySelector("[data-description-reveal]") === null, REVEAL_SAFETY_STOP_MS - 1);
		assert.equal(document.querySelector("[data-description-reveal]") === null, true, "the reveal ends through its animations, before the safety stop");
		await view.focus(editor);
		assert.equal(view.isFocused(editor), true);
	});
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
	const view = await openPaymentsSuggestions();
	assert.equal(view.queryByRole("button", { name: "Show as list" }) !== null, true);
	await view.click(view.getByRole("button", { name: "Show as list" }));
	await view.click(view.getByRole("button", { name: "Accept due date" }));
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "true");
	await view.click(view.getByRole("button", { name: /suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Show as list" }));
	await view.click(view.getByRole("button", { name: "Dismiss parent" }));
	assert.equal(document.querySelector('[data-field-id="parent"]')?.getAttribute("data-field-filled"), "false");
	await view.click(view.getByRole("button", { name: /suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Show as list" }));
	await view.click(view.getByRole("button", { name: "Undo due date" }));
	assert.equal(document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled"), "false");
	await view.unmount();
});

test("accept all uses actual values and undo preserves later edits", async () => {
	const view = await openPaymentsSuggestions();
	await view.click(view.getByRole("button", { name: "Accept all" }));
	for (let waited = 0; document.querySelector('[data-field-id="dueDate"]')?.getAttribute("data-field-filled") !== "true" && waited < 8_000; waited += 50) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
	}
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
	const view = await openPaymentsSuggestions(demo);
	await view.click(view.getByRole("button", { name: "Show as list" }));
	await view.click(view.getByRole("button", { name: "Accept parent" }));
	await view.rerender(other);
	assert.equal(view.queryByRole("button", { name: /suggestions/iu }) === null, true);
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
	assert.equal(view.queryByRole("button", { name: /4 suggestions/iu }) !== null, true);
	await view.unmount();
});

test("undoing a dismissal restores it to the work item", async () => {
	const view = await renderWorkItem({ initialSuggestion: true });
	await view.click(view.getByRole("button", { name: /5 suggestions/iu }));
	await view.click(view.getByRole("button", { name: "Dismiss description" }));
	await view.click(view.getByRole("button", { name: "Undo dismissing Description" }));
	assert.equal(view.queryByRole("button", { name: /5 suggestions/iu }) !== null, true);
	await view.unmount();
});


test("the source stack and grid appear together after the border trace", async (t) => {
	const release = holdAnimationFrames(t);
	const view = await renderWorkItem({ initialSuggestion: true, suggestionProfile: "payments" });
	const trigger = view.getByRole("button", { name: "Finding suggestions" });
	const banner = trigger.parentElement;
	assert.equal(banner.querySelector("[data-suggestion-grid]") === null, true);
	assert.equal(banner.querySelector('[aria-label="Confluence"]') === null, true);
	release();
	for (let waited = 0; !banner.querySelector("[data-suggestion-grid]") && waited < 8_000; waited += 50) {
		await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
	}
	assert.equal(banner.querySelector("[data-suggestion-grid]") !== null, true);
	assert.equal(banner.querySelector('[aria-label="Confluence"]') !== null, true);
	assert.equal(view.queryByRole("button", { name: /5 suggestions/iu }) !== null, true);
	await view.unmount();
});

test("on the payments profile, clicking the suggestions trigger opens the closed panel", async (t) => {
	// Held frames keep the border trace running, so the panel cannot open by itself.
	const release = holdAnimationFrames(t);
	const view = await renderWorkItem({ initialSuggestion: true, suggestionProfile: "payments" });
	const trigger = view.getByRole("button", { name: "Finding suggestions" });
	assert.equal(trigger.getAttribute("aria-expanded"), "false");
	assert.equal(view.queryByRole("dialog", { name: "Work item suggestions" }) === null, true);
	await view.click(trigger);
	assert.equal(suggestionsTrigger(view).getAttribute("aria-expanded"), "true");
	assert.equal(view.queryByRole("dialog", { name: "Work item suggestions" }) !== null, true);
	release();
	await view.unmount();
});
