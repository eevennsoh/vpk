// Behavioral contract for the card stack popover, rendered for real (Base UI popover, Motion) in happy-dom.
// It locks the keyboard path that once trapped focus: the reasoning card opened by keyboard focus must close
// on the first Escape without reopening, and the second Escape must close the deck and return focus to its trigger.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { act } = require("react");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const SOURCE = `import React from "react";
	import { ThemeWrapper } from "@/components/utils/theme-wrapper";
	import { JiraSuggestion } from "@/components/blocks/jira-suggestion";
	export default function JiraSuggestionTest() {
		return <ThemeWrapper><JiraSuggestion /></ThemeWrapper>;
	}`;

/** happy-dom has no :focus-visible heuristics; treat programmatic focus as keyboard focus, as a Tab would be. */
function withKeyboardFocusVisible() {
	const original = Element.prototype.matches;
	Element.prototype.matches = function matches(selector) {
		if (selector === ":focus-visible") return document.activeElement === this;
		return original.call(this, selector);
	};
	return () => {
		Element.prototype.matches = original;
	};
}

const whyIsOpen = (view) => view.getAllByRole("dialog").length > 1;
const deckIsOpen = (view) => view.getByRole("button", { name: /^\d+ suggestions?/ }).getAttribute("aria-expanded") === "true";

test("Escape closes a keyboard-opened why card first, then the deck, returning focus to the trigger", async (t) => {
	t.after(withKeyboardFocusVisible());
	const view = await renderComponent({ source: SOURCE });
	assert.equal(deckIsOpen(view), true, "the deck opens by default");

	const why = view.getByRole("button", { name: "Why description was suggested" });
	await view.focus(why);
	assert.equal(whyIsOpen(view), true, "keyboard focus opens the reasoning card");

	await view.press(null, "Escape");
	assert.equal(whyIsOpen(view), false, "the first Escape closes the reasoning card");
	assert.equal(deckIsOpen(view), true, "…and leaves the deck open");
	assert.equal(view.isFocused(why), true, "focus stays on the Why trigger");

	// Focus returning to the trigger (as Base UI does after closing) must not bounce the card back open.
	why.dispatchEvent(new FocusEvent("focus"));
	assert.equal(whyIsOpen(view), false);

	await view.press(null, "Escape");
	assert.equal(deckIsOpen(view), false, "the second Escape closes the deck");
	assert.equal(view.isFocused(view.getByRole("button", { name: /^\d+ suggestions?/ })), true, "focus returns to the trigger");
});

const undoButtons = () => [...document.querySelectorAll("button[aria-label^=Undo]")];
const scrollport = () => document.querySelector("[data-scrollport]");

test("Undo only exists once there is a decision to undo, and leaves again when it is undone", async () => {
	const view = await renderComponent({ source: SOURCE });
	assert.equal(undoButtons(view).length, 0, "no Undo at rest");

	await view.click(view.getByRole("button", { name: "Dismiss description" }));
	assert.equal(undoButtons(view).length, 1, "Undo appears after a decision");

	await view.click(view.getByRole("button", { name: "Undo dismissing Description" }));
	await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
	assert.equal(undoButtons(view).length, 0, "…and goes once nothing is left to undo");
	assert.equal(view.getAllByRole("button", { name: "Accept description" }).length, 1, "the description is the top card again");
});

test("the stack unpacks into a list with per-card accept and dismiss, and gathers back", async () => {
	const view = await renderComponent({ source: SOURCE });
	// The morph moves cards, it never swaps them: the top card and the sheets behind it are the very nodes that become rows.
	const topCard = document.querySelector("[data-top-card]");
	const sheetCount = document.querySelectorAll("[aria-hidden=true] > [style*=border-radius]").length;
	assert.equal(sheetCount >= 2, true, "blank sheets wait behind the top card at rest");
	await view.click(view.getByRole("button", { name: "Show as list" }));
	assert.equal(topCard.isConnected, true, "the top card is the same element as the first row");
	assert.equal(view.queryByRole("list", { name: "Suggestions" }) !== null, true, "the list is showing");
	// The canvas behind the preview only hands the wheel to nested areas whose computed overflow scrolls.
	await act(() => new Promise((resolve) => setTimeout(resolve, 1500)));
	assert.equal(getComputedStyle(scrollport()).overflowY, "auto", "the settled list is a scroll container, so the wheel scrolls it");
	assert.equal(view.getAllByRole("button", { name: /^Accept / }).length > 2, true, "every pending card has its own Accept");
	assert.equal(undoButtons(view).length, 0, "no Undo before anything is decided");

	await view.click(view.getByRole("button", { name: "Accept assignee" }));
	await view.click(view.getByRole("button", { name: "Dismiss labels" }));
	assert.equal(view.queryByRole("button", { name: "Accept assignee" }) === null, true, "the accepted card folds");
	assert.equal(view.queryByRole("button", { name: "Undo assignee" }) !== null, true, "…and offers its own Undo");

	await view.click(view.getByRole("button", { name: "Undo labels" }));
	assert.equal(view.queryByRole("button", { name: "Dismiss labels" }) !== null, true, "Undo returns the card to pending in place");

	await view.click(view.getByRole("button", { name: "Show as stack" }));
	assert.equal(topCard.isConnected, true, "…and the same element again once the list gathers back");
	assert.equal(view.queryByRole("list", { name: "Suggestions" }) === null, true, "the list gathers back into the stack");
	assert.equal(view.getAllByRole("button", { name: /^Accept / }).filter((button) => button.textContent !== "Accept all").length, 1, "one top card again");
	await act(() => new Promise((resolve) => setTimeout(resolve, 1500)));
	assert.notEqual(getComputedStyle(scrollport()).overflowY, "auto", "the stack at rest does not scroll");
});

test("Accept all can be undone in one step from the caught-up state", async () => {
	const view = await renderComponent({ source: SOURCE });
	await view.click(view.getByRole("button", { name: "Accept all" }));
	assert.equal(view.queryByRole("button", { name: "Check again" }) !== null, true, "the empty deck offers another check");
	assert.equal(view.queryByText("6 added") !== null, true, "…with one summary of what was decided");

	await view.click(view.getByRole("button", { name: "Undo accepting 6 suggestions" }));
	await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
	assert.equal(view.queryByRole("button", { name: "Check again" }) === null, true, "the caught-up state gives way to the deck");
	assert.equal(view.getAllByRole("button", { name: "Accept description" }).length, 1, "every card is back in the deck");
});

const triggerName = () => {
	const trigger = document.querySelector("button[aria-labelledby]");
	return document.getElementById(trigger.getAttribute("aria-labelledby")).textContent;
};
const waitForRun = () => act(() => new Promise((resolve) => setTimeout(resolve, 2200)));

test("a check from the caught-up state runs in place and says when it found nothing new", async () => {
	const view = await renderComponent({ source: SOURCE });
	// The first re-run brings two more; the trigger announces them as separate words.
	await view.click(view.getByRole("button", { name: "Check for new suggestions" }));
	await waitForRun();
	assert.equal(triggerName(), "8 suggestions, 2 new", "the trigger's name reads as words, not '8 suggestions2 new'");

	await view.click(view.getByRole("button", { name: "Accept all" }));
	// Let the footer finish folding away, so what follows is about the check, not the exit.
	await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
	assert.equal(view.queryByRole("button", { name: "Check for new suggestions" }) === null, true, "caught up offers one way to re-run: the body's Check again");
	await view.click(view.getByRole("button", { name: "Check again" }));
	assert.equal(view.queryByRole("button", { name: "Check again" }) !== null, true, "the caught-up state holds while the check runs");
	assert.equal(document.body.textContent.includes("reviewed"), false, "…with no footer or stack sliding in for it");
	await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
	assert.equal(view.queryByRole("button", { name: /^Undo/ }), null, "Undo steps aside while the check runs instead of sitting there disabled");
	await waitForRun();
	assert.equal(view.queryByRole("button", { name: /^Undo/ }) !== null, true, "…and comes back once the check is done");
	assert.equal(view.queryByText("Nothing new since you last checked") !== null, true, "a quiet check is acknowledged in the body");
	assert.equal(view.queryByText("Checked just now") !== null, true, "…and in the header");
});
