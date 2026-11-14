// The task-progress card is itself a keyboard button (collapse / onCardClick) and holds
// real buttons (Stop execution, Done, Delete run). Enter/Space on one of those nested
// buttons must run that button and leave the card alone.
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
