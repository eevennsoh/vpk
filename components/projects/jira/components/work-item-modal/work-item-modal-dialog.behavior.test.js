// The Jira work-item modal must behave as a modal dialog for keyboard and screen-reader users:
// named by its work item, focus moves in on open and stays inside, Escape closes it and returns
// focus to the opener, and the dimmed backdrop is not an announced or focusable control.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { act } = require("react");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const TITLE = "Acmecorp: Prepare for bid recommendation for ESM RFP";

async function renderModalWithOpener() {
	const view = await renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import JiraWorkItemModal from "@/components/projects/jira/components/jira-work-item-modal";
			export default function ModalProbe() {
				const [open, setOpen] = React.useState(false);
				return (
					<ThemeWrapper>
						<button type="button" onClick={() => setOpen(true)}>Open work item</button>
						<button type="button">Outside action</button>
						<JiraWorkItemModal isOpen={open} onClose={() => setOpen(false)} />
					</ThemeWrapper>
				);
			}`,
	});
	return { opener: view.getByRole("button", { name: "Open work item" }), view };
}

// Base UI moves focus in a microtask/frame after mount; let it settle.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
// A real mouse press (click count 1). The harness's `click()` reports no click count, which
// Base UI reads as a keyboard/assistive click, not as a pointer press outside the popup.
async function mousePress(element) {
	await act(async () => {
		const init = { bubbles: true, button: 0, cancelable: true, composed: true, detail: 1 };
		element.dispatchEvent(new PointerEvent("pointerdown", { ...init, isPrimary: true, pointerType: "mouse" }));
		element.dispatchEvent(new MouseEvent("mousedown", init));
		element.dispatchEvent(new PointerEvent("pointerup", { ...init, isPrimary: true, pointerType: "mouse" }));
		element.dispatchEvent(new MouseEvent("mouseup", init));
		element.dispatchEvent(new MouseEvent("click", init));
	});
}
// Base UI ignores outside presses for a moment after opening, so the opening click cannot close it.
const waitPastOpening = () => act(() => new Promise((resolve) => setTimeout(resolve, 500)));
const isInside = (element) => element !== null && document.activeElement !== null && element.contains(document.activeElement);

test("opening the work-item modal exposes a modal dialog named by the work item and moves focus into it", async () => {
	const { opener, view } = await renderModalWithOpener();
	await view.click(opener);
	await settle();

	const dialog = view.getByRole("dialog", { name: TITLE });
	assert.equal(accessibleName(dialog), TITLE);
	assert.equal(dialog.getAttribute("aria-modal"), "true");
	assert.equal(isInside(dialog), true, "focus moved into the dialog");
});

test("Tab and Shift+Tab keep focus inside the open work-item modal", async () => {
	const { opener, view } = await renderModalWithOpener();
	await view.click(opener);
	await settle();
	const dialog = view.getByRole("dialog", { name: TITLE });

	for (let step = 0; step < 80; step += 1) {
		await view.press(null, "Tab");
		await settle();
		assert.equal(isInside(dialog), true, `focus is still inside after Tab ${step + 1}`);
	}
	for (let step = 0; step < 5; step += 1) {
		await view.press(null, "Tab", { shiftKey: true });
		await settle();
		assert.equal(isInside(dialog), true, `focus is still inside after Shift+Tab ${step + 1}`);
	}
});

test("Escape closes the work-item modal and returns focus to the opener", async () => {
	const { opener, view } = await renderModalWithOpener();
	await view.click(opener);
	await settle();
	assert.equal(document.body.textContent.includes(TITLE), true, "the modal opened");
	assert.equal(view.isFocused(opener), false, "focus left the opener while the modal is open");

	await view.press(null, "Escape");
	await settle();

	assert.equal(document.body.textContent.includes(TITLE), false, "the modal closed");
	assert.equal(view.isFocused(opener), true, "focus returned to the opener");
});

test("clicking the backdrop still closes the modal, and the backdrop is not a focusable control", async () => {
	const { opener, view } = await renderModalWithOpener();
	await view.click(opener);
	await settle();

	const backdrop = [...document.body.querySelectorAll("div")].find((element) => element.style.backgroundColor.includes("blanket"));
	assert.equal(backdrop !== undefined, true, "the blanket backdrop rendered");
	assert.equal(backdrop.hasAttribute("tabindex"), false);
	assert.equal(["button", "dialog"].includes(backdrop.getAttribute("role") ?? ""), false);

	await waitPastOpening();
	await mousePress(backdrop);
	await settle();
	assert.equal(document.body.textContent.includes(TITLE), false, "the modal closed");
});

// Surfaces that float above the modal (the Rovo chat, an attachment preview) live outside its
// DOM; pressing them, or pressing Escape while typing in them, must not close the work item.
test("a press or Escape on a surface outside the modal leaves the modal open", async () => {
	const { opener, view } = await renderModalWithOpener();
	await view.click(opener);
	await settle();
	const outside = view.getByRole("button", { hidden: true, name: "Outside action" });

	await waitPastOpening();
	await mousePress(outside);
	await settle();
	assert.equal(document.body.textContent.includes(TITLE), true, "a press outside left the modal open");

	await view.focus(outside);
	await view.press(outside, "Escape");
	await settle();
	assert.equal(document.body.textContent.includes(TITLE), true, "Escape outside left the modal open");
});
