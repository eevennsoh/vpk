// State-lifetime contract for the Automation "Set to recur" row, rendered for
// real (Base UI Popover + DropdownMenu) in happy-dom. The popover edits a draft
// copy of the committed schedule: Cancel and dismissal abandon it, Save commits
// it, and Delete clears both so a later Save cannot resurrect a deleted schedule.
// Assertions compare strings and booleans only; see scripts/lib/render-component.js.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const NO_SCHEDULE = "No schedule set";
const text = (element) => element.textContent.replace(/\s+/gu, " ").trim();

async function renderRecurRow() {
	const view = await renderComponent({
		entry: "components/blocks/jira-work-item/team-eu26/components/set-to-recur-popover.tsx",
		exportName: "SetToRecurRow",
	});
	const trigger = () => view.getByRole("button", { name: "Set to recur" });
	return {
		/** Opens the popover from the row, as a pointer user would. */
		open: () => view.click(trigger()),
		isOpen: () => view.queryByRole("dialog", { name: "Set to recur" }) !== null,
		/** The row's committed-schedule line, visible while the popover is closed. */
		summary: () => text(trigger()).replace(/^Set to recur/u, ""),
		/** The value a draft select currently shows. */
		value: (label) => text(view.getByRole("button", { name: label })),
		pick: async (label, option) => {
			await view.click(view.getByRole("button", { name: label }));
			await view.click(view.getByRole("menuitem", { name: option }));
		},
		view,
	};
}

test("Cancel and dismissal abandon the draft; reopening starts from the committed schedule", async () => {
	const row = await renderRecurRow();
	assert.equal(row.summary(), NO_SCHEDULE);

	await row.open();
	assert.equal(row.value("Recur frequency"), "Weekly");
	await row.pick("Recur frequency", "Daily");
	assert.equal(row.value("Recur frequency"), "Daily", "the draft follows the edit while the popover is open");
	await row.view.click(row.view.getByRole("button", { name: "Cancel" }));
	assert.equal(row.isOpen(), false);
	assert.equal(row.summary(), NO_SCHEDULE);

	await row.open();
	assert.equal(row.value("Recur frequency"), "Weekly", "Cancel must not leave the abandoned edit in the next session");
	await row.pick("Recur frequency", "Monthly");
	await row.view.press(row.view.getByRole("button", { name: "Recur frequency" }), "Escape");
	assert.equal(row.isOpen(), false);

	await row.open();
	assert.equal(row.value("Recur frequency"), "Weekly", "Escape dismissal abandons the draft exactly like Cancel");
	await row.pick("Recur frequency", "Yearly");
	await row.view.click(document.body);
	assert.equal(row.isOpen(), false);

	await row.open();
	assert.equal(row.value("Recur frequency"), "Weekly", "an outside press abandons the draft exactly like Cancel");
	assert.equal(row.summary(), NO_SCHEDULE);
});

test("Save commits the draft, and the next edit starts from a copy of the saved schedule", async () => {
	const row = await renderRecurRow();

	await row.open();
	await row.pick("Recur frequency", "Daily");
	await row.pick("Recur day", "On Friday");
	await row.view.click(row.view.getByRole("button", { name: "Save" }));
	assert.equal(row.isOpen(), false);
	assert.equal(row.summary(), "Daily · On Friday · When scheduled");

	await row.open();
	assert.deepEqual(
		[row.value("Recur frequency"), row.value("Recur day"), row.value("Recur timing")],
		["Daily", "On Friday", "When scheduled"],
	);
	await row.pick("Recur timing", "When work is due");
	await row.view.click(row.view.getByRole("button", { name: "Cancel" }));
	assert.equal(row.summary(), "Daily · On Friday · When scheduled", "a cancelled edit never reaches the saved schedule");

	await row.open();
	assert.equal(row.value("Recur timing"), "When scheduled");
});

test("Delete clears the saved schedule and the open draft, so the next Save cannot resurrect either", async () => {
	const row = await renderRecurRow();

	await row.open();
	assert.equal(row.view.getByRole("button", { name: "Delete recurrence" }).disabled, true, "nothing to delete yet");
	await row.pick("Recur frequency", "Daily");
	await row.view.click(row.view.getByRole("button", { name: "Save" }));

	await row.open();
	await row.pick("Recur frequency", "Monthly");
	const remove = row.view.getByRole("button", { name: "Delete recurrence" });
	assert.equal(remove.disabled, false);
	await row.view.click(remove);
	assert.equal(row.isOpen(), false);
	assert.equal(row.summary(), NO_SCHEDULE);

	await row.open();
	assert.equal(row.value("Recur frequency"), "Weekly", "neither the deleted Daily nor the unsaved Monthly survives Delete");
	assert.equal(row.view.getByRole("button", { name: "Delete recurrence" }).disabled, true);
	await row.view.click(row.view.getByRole("button", { name: "Save" }));
	assert.equal(row.summary(), "Weekly · On Tuesday · When scheduled");
});
