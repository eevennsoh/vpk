// The whole-card action, Stop/Delete/Retry buttons and group toggles are sibling
// controls. Each action keeps its keyboard and pointer behavior without activating another.
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
	const card = view.getByRole("button", { name: "Release plan agent progress" });
	return { calls, card, view };
}

for (const key of ["Enter", " "]) {
	const keyName = key === " " ? "Space" : key;

	test(`${keyName} on Delete run deletes the run without activating the card`, async () => {
		const { calls, view } = await renderCard({ runStatus: "failed" });
		const before = view.container.textContent;
		const deleteRun = view.getByRole("button", { name: "Delete run" });

		await view.focus(deleteRun);
		await view.press(deleteRun, key);

		assert.deepEqual(calls, ["delete"]);
		assert.equal(view.container.textContent, before, "the card did not collapse");
	});

	test(`${keyName} on Stop execution leaves the card alone`, async () => {
		const { calls, view } = await renderCard({ runStatus: "running" });
		const before = view.container.textContent;
		const stop = view.getByRole("button", { name: "Stop execution" });

		await view.focus(stop);
		await view.press(stop, key);

		assert.deepEqual(calls, []);
		assert.equal(view.container.textContent, before);
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

const failedTasks = {
	done: [], inReview: [], inProgress: [], todo: [],
	failed: [{ id: "failure", label: "Fix deployment", description: "" }],
};

for (const runStatus of ["running", "failed", "completed"]) {
	test(`${runStatus} agent card keeps its action before sibling controls and preserves pointer activation`, async () => {
		const { calls, card, view } = await renderCard({ runStatus, taskStatusGroups: failedTasks });
		const secondaryName = runStatus === "running" ? "Stop execution" : "Delete run";
		assert.equal(accessibleName(card), "Release plan agent progress");
		assert.equal(card.getAttribute("aria-expanded"), "true");
		assert.deepEqual(view.tabOrder(), ["Release plan agent progress", secondaryName, "Retry failed tasks", "1"]);
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
		assert.equal(accessibleName(card), "Release plan agent progress");
		assert.equal(view.queryByText("Fix deployment") === null, true);
		assert.equal(document.activeElement === focusedBeforeClick, true);
		assert.deepEqual(view.tabOrder(), ["Release plan agent progress", secondaryName]);
		await view.focus(card);
		await view.press(card, "Enter");
		assert.equal(card.getAttribute("aria-expanded"), "true");
		assert.equal(accessibleName(card), "Release plan agent progress");
		assert.equal(view.queryByText("Fix deployment") !== null, true);
		assert.deepEqual(calls, ["card", "card"]);
		await view.click(view.getByRole("button", { name: "Retry failed tasks" }));
		assert.deepEqual(calls, ["card", "card", "retry:failed"]);
		await view.click(view.getByRole("button", { name: "1" }));
		assert.equal(view.queryByText("Fix deployment") === null, true);
		assert.deepEqual(calls, ["card", "card", "retry:failed"]);
	});
}

test("clicking the agent card's text toggles it without moving focus", async () => {
	const { calls, card, view } = await renderCard({ runStatus: "failed" });
	const focusedBeforeClick = document.activeElement;

	await view.click(view.getByText("Release plan"));

	assert.deepEqual(calls, ["card"]);
	assert.equal(card.getAttribute("aria-expanded"), "false");
	assert.equal(document.activeElement === focusedBeforeClick, true);
	assert.equal(view.isFocused(card), false);
});

test("a non-collapsible agent card keeps its callback and a passive card has only secondary controls", async () => {
	const { calls, card, view } = await renderCard({ isCollapsible: false, taskStatusGroups: failedTasks });
	await view.press(card, " ");
	assert.deepEqual(calls, ["card"]);
	assert.equal(card.hasAttribute("aria-expanded"), false);
	assert.equal(view.queryByText("Fix deployment") !== null, true);
	await view.rerender({ isCollapsible: false, runCreatedAt: null, taskStatusGroups: failedTasks });
	assert.deepEqual(view.tabOrder(), ["Stop execution", "1"]);
	assert.equal(view.getAllByRole("button").length, 2);
});
