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
	import { CardStackVariant } from "@/components/blocks/jira-work-item/suggestion-canvas/variants/card-stack";
	export default function CardStackTest() {
		return <ThemeWrapper><CardStackVariant /></ThemeWrapper>;
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
const deckIsOpen = (view) => view.getByRole("button", { name: "Suggestions" }).getAttribute("aria-expanded") === "true";

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
	assert.equal(view.isFocused(view.getByRole("button", { name: "Suggestions" })), true, "focus returns to the trigger");
});

test("a decided card stays reachable: the reviewed list lists it and its Undo puts it back on top", async () => {
	const view = await renderComponent({ source: SOURCE });
	await view.click(view.getByRole("button", { name: "Dismiss description" }));
	assert.notEqual(view.queryByText("dismissed"), null, "the footer confirms the decision first");
	// …then settles back to progress, which opens the reviewed list.
	await act(() => new Promise((resolve) => setTimeout(resolve, 2600)));
	await view.click(view.getByRole("button", { name: "1 of 6 reviewed" }));

	const restore = view.getByRole("button", { name: "Undo description" });
	await view.click(restore);
	assert.equal(view.queryByRole("button", { name: "Undo description" }), null);
	assert.equal(view.getAllByRole("button", { name: "Accept description" }).length, 1, "the description is the top card again");
});

test("Accept all can be undone in one step from the caught-up state", async () => {
	const view = await renderComponent({ source: SOURCE });
	await view.click(view.getByRole("button", { name: "Accept all" }));
	assert.notEqual(view.queryByRole("button", { name: "Check again" }), null, "the empty deck offers another check");
	assert.notEqual(view.queryByText("6 added"), null, "…with one summary of what was decided");

	await view.click(view.getByRole("button", { name: "Undo accepting 6 suggestions" }));
	assert.equal(view.queryByRole("button", { name: "Check again" }), null);
	assert.equal(view.getAllByRole("button", { name: "Accept description" }).length, 1, "every card is back in the deck");
});
