// The agent-progress card is itself a keyboard button (collapse / onCardClick) and holds
// real buttons (Stop execution, Delete run, each status group's expand toggle and Retry).
// Enter/Space on one of those nested buttons must run that button and leave the card alone.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

async function renderCard(props) {
	const calls = [];
	const view = await renderComponent({
		entry: "components/blocks/agent-progress/page.tsx",
		props: {
			initialNowMs: 0,
			onCardClick: () => calls.push("card"),
			onDelete: () => calls.push("delete"),
			onRetryGroup: (groupKey) => calls.push(`retry:${groupKey}`),
			planTitle: "Release plan",
			runCreatedAt: new Date(0).toISOString(),
			...props,
		},
	});
	const [card] = view.getAllByRole("button").filter((button) => button.getAttribute("tabindex") === "0" && button.tagName === "DIV");
	return { calls, card, view };
}

const cardText = (card) => card.textContent;

for (const key of ["Enter", " "]) {
	const keyName = key === " " ? "Space" : key;

	test(`${keyName} on Delete run deletes the run without activating the card`, async () => {
		const { calls, card, view } = await renderCard({ runStatus: "failed" });
		const before = cardText(card);
		const deleteRun = view.getByRole("button", { name: "Delete run" });

		await view.focus(deleteRun);
		await view.press(deleteRun, key);

		assert.deepEqual(calls, ["delete"]);
		assert.equal(cardText(card), before, "the card did not collapse");
	});

	test(`${keyName} on Stop execution leaves the card alone`, async () => {
		const { calls, card, view } = await renderCard({ runStatus: "running" });
		const before = cardText(card);
		const stop = view.getByRole("button", { name: "Stop execution" });

		await view.focus(stop);
		await view.press(stop, key);

		assert.deepEqual(calls, []);
		assert.equal(cardText(card), before);
	});

	test(`${keyName} on Retry failed tasks retries without activating the card`, async () => {
		const { calls, view } = await renderCard({ runStatus: "failed" });
		const retry = view.getAllByRole("button").find((button) => /^Retry /.test(accessibleName(button)));
		assert.ok(retry, "a Retry button is rendered for the failed group");

		await view.focus(retry);
		await view.press(retry, key);

		assert.deepEqual(calls, ["retry:failed"]);
	});

	test(`${keyName} on a status group toggle opens or closes that group without activating the card`, async () => {
		const { calls, view } = await renderCard({ runStatus: "failed" });
		const toggle = view.getAllByRole("button").find((button) => button.tagName === "BUTTON" && button.querySelector("svg") && /^[1-9]\d*$/.test(accessibleName(button)));
		assert.ok(toggle, "a group expand toggle is rendered");
		const before = view.container.textContent;

		await view.focus(toggle);
		await view.press(toggle, key);

		assert.deepEqual(calls, []);
		assert.notEqual(view.container.textContent, before, "the group's task list opened or closed");
	});

	test(`${keyName} on the card itself still activates it`, async () => {
		const { calls, card, view } = await renderCard({ runStatus: "running" });

		await view.focus(card);
		await view.press(card, key);

		assert.deepEqual(calls, ["card"]);
	});
}
