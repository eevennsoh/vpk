// The card's whole-surface action and its Stop/Done/Delete controls are independent
// buttons. Keyboard and pointer activation of a secondary action leave the card alone.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

async function renderCard(props) {
	const calls = [];
	const view = await renderComponent({
		entry: "components/blocks/task-progress/page.tsx",
		props: {
			initialNowMs: 0,
			onCardClick: () => calls.push("card"),
			onDelete: () => calls.push("delete"),
			planTitle: "Release plan",
			runCreatedAt: new Date(0).toISOString(),
			...props,
		},
	});
	const card = view.getByRole("button", { name: "Release plan task progress" });
	return { calls, card, view };
}

for (const runStatus of ["running", "failed", "completed"]) {
	test(`${runStatus} task card keeps its action before sibling controls and preserves pointer activation`, async () => {
		const { calls, card, view } = await renderCard({ runStatus });
		const secondaryName = runStatus === "running" ? "Stop execution" : runStatus === "failed" ? "Delete run" : "Done";
		assert.deepEqual(view.tabOrder(), ["Release plan task progress", secondaryName]);
		for (const button of view.getAllByRole("button")) {
			assert.equal(button.parentElement.closest('button, [role="button"]') === null, true, "each control has no interactive ancestor");
		}
		await view.press(null, "Tab");
		assert.equal(view.isFocused(card), true);
		await view.press(card, "Tab");
		assert.equal(view.isFocused(view.getByRole("button", { name: secondaryName })), true);
		await view.focus(null);
		const focusedBeforeClick = document.activeElement;
		await view.click(view.getByText("Release plan"));
		assert.deepEqual(calls, ["card"]);
		assert.equal(card.getAttribute("aria-expanded"), "false");
		assert.equal(document.activeElement === focusedBeforeClick, true);
		await view.focus(card);
		await view.press(card, "Enter");
		assert.equal(card.getAttribute("aria-expanded"), "true");
		assert.deepEqual(calls, ["card", "card"]);
	});
}

test("clicking the task card's text toggles it without moving focus", async () => {
	const { calls, card, view } = await renderCard({ runStatus: "failed" });
	const focusedBeforeClick = document.activeElement;

	await view.click(view.getByText("Release plan"));

	assert.deepEqual(calls, ["card"]);
	assert.equal(card.getAttribute("aria-expanded"), "false");
	assert.equal(document.activeElement === focusedBeforeClick, true);
	assert.equal(view.isFocused(card), false);
});

test("a non-collapsible task card keeps its callback and a passive card has only secondary controls", async () => {
	const { calls, card, view } = await renderCard({ isCollapsible: false });
	await view.press(card, " ");
	assert.deepEqual(calls, ["card"]);
	assert.equal(card.hasAttribute("aria-expanded"), false);
	await view.rerender({ isCollapsible: false, runCreatedAt: null });
	assert.deepEqual(view.tabOrder(), ["Stop execution"]);
	assert.equal(view.getAllByRole("button").length, 1);
});

for (const key of ["Enter", " "]) {
	const keyName = key === " " ? "Space" : key;

	test(`${keyName} on Delete run deletes the run without toggling the card`, async () => {
		const { calls, card, view } = await renderCard({ runStatus: "failed" });
		const deleteRun = view.getByRole("button", { name: "Delete run" });

		await view.focus(deleteRun);
		await view.press(deleteRun, key);

		assert.deepEqual(calls, ["delete"]);
		assert.equal(card.getAttribute("aria-expanded"), "true");
	});

	test(`${keyName} on Stop execution leaves the card alone`, async () => {
		const { calls, card, view } = await renderCard({ runStatus: "running" });
		const stop = view.getByRole("button", { name: "Stop execution" });

		await view.focus(stop);
		await view.press(stop, key);

		assert.deepEqual(calls, []);
		assert.equal(card.getAttribute("aria-expanded"), "true");
	});

	test(`${keyName} on the card itself still toggles it`, async () => {
		const { calls, card, view } = await renderCard({ runStatus: "running" });

		await view.focus(card);
		await view.press(card, key);

		assert.deepEqual(calls, ["card"]);
		assert.equal(card.getAttribute("aria-expanded"), "false");
	});
}
