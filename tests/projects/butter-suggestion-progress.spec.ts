import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("individual decisions finish with the reviewed count", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog").last();
	for (const [action, field] of [["Accept", "description"], ["Discard", "assignee"], ["Accept", "due date"], ["Discard", "parent"], ["Accept", "labels"]] as const) {
		await panel.getByRole("button", { name: `${action} ${field}`, exact: true }).click();
	}
	await expect(panel.getByText("5 suggestions reviewed")).toBeVisible();
});

test("accepting and discarding keep the reviewed counter in the footer", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog").last();
	const footer = panel.locator("footer");
	await expect(footer).toContainText("0 of 5 reviewed");
	await panel.getByRole("button", { name: "Accept description" }).click();
	await expect(footer).toContainText("1 of 5 reviewed");
	await expect(footer).not.toContainText("Description accepted");
	await panel.getByRole("button", { name: "Discard assignee" }).click();
	await expect(footer).toContainText("2 of 5 reviewed");
	await panel.getByRole("button", { name: "Undo assignee" }).click();
	await expect(footer).toContainText("1 of 5 reviewed");
});

test("Discard all keeps its text color on hover", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const button = page.getByRole("button", { name: "Discard all", exact: true });
	await expect(button).toBeVisible();
	const resting = await button.evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
	await button.hover();
	await expect(button).toHaveCSS("color", resting.color);
	await expect.poll(() => button.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(resting.background);
});

test("compact header icons keep their color on hover", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog").last();
	await panel.getByRole("button", { name: "Discard all" }).click();
	await expect(panel.getByText("5 suggestions discarded")).toBeVisible();
	for (const name of [/^Undo dismissing/u, /^Check again$/u, /^Close suggestions$/u]) {
		const button = panel.getByRole("button", { name });
		await page.mouse.move(0, 0);
		const resting = await button.evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor }));
		await button.hover();
		await expect(button).toHaveCSS("color", resting.color);
		await expect.poll(() => button.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(resting.background);
	}
});

test("dismissing suggestions keeps the reviewed count visible", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	const footer = page.getByRole("dialog", { name: "Work item suggestions", exact: true }).locator("footer");
	await expect(footer).toContainText("0 of 5 reviewed");
	await page.getByRole("button", { name: "Discard description" }).click();
	await expect(footer).toContainText("1 of 5 reviewed");
	await expect(footer).not.toContainText("Description dismissed");
	await page.getByRole("button", { name: "Discard due date" }).click();
	await expect(footer).toContainText("2 of 5 reviewed");
	await expect(footer).not.toContainText("Due Date dismissed");
	await page.getByRole("button", { name: "Undo dismissing Due Date" }).click();
	await expect(footer).toContainText("1 of 5 reviewed");
});

test("the reviewed list uses the same caught-up state as the stack", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	await page.getByRole("button", { name: "Show as list" }).click();
	const panel = page.getByRole("dialog", { name: "Work item suggestions", exact: true });
	await panel.getByRole("list", { name: "Suggestions" }).getByRole("button", { name: "Accept description" }).click();
	await panel.getByRole("button", { name: "Discard all" }).click();
	await expect(panel.getByText("4 suggestions discarded")).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check again", exact: true })).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check again", exact: true })).toBeFocused();
	await expect(panel.getByRole("button", { name: /^Undo/ })).toHaveCount(1);
	await expect(panel.getByRole("list", { name: "Suggestions" })).toHaveCount(0);
	await panel.getByRole("button", { name: "Check for new suggestions" }).click();
	await expect(panel.getByText("No new suggestions")).toBeVisible();
	await panel.getByRole("button", { name: "Check again", exact: true }).click();
	await expect(panel.getByText("No new suggestions")).toBeVisible();
	await panel.getByRole("button", { name: /^Undo/ }).click();
	await expect(panel.getByRole("button", { name: "Accept due date" })).toBeVisible();
});

test("dismissing the stack shows the same caught-up state and can be undone", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	const panel = page.getByRole("dialog", { name: "Work item suggestions", exact: true });
	await panel.getByRole("button", { name: "Discard all" }).click();
	await expect(panel.getByText("5 suggestions discarded")).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check for new suggestions" })).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check again" })).toBeVisible();
	await panel.getByRole("button", { name: /^Undo/ }).click();
	await expect(panel.getByRole("button", { name: "Accept description" })).toBeVisible();
});

test("checking again from the floating confirmation uses the checking header", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog").last();
	const title = await panel.locator("header h2").elementHandle();
	await panel.getByRole("button", { name: "Discard all" }).click();
	await expect(panel.getByText("5 suggestions discarded")).toBeVisible();
	expect(await panel.locator("header h2").evaluate((element, previous) => element === previous, title)).toBe(true);
	const confirmationBounds = await panel.boundingBox();
	await panel.getByRole("button", { name: "Check again" }).click();
	await expect(panel.getByText("Checking for suggestions", { exact: true })).toBeVisible();
	expect(await panel.locator("header h2").evaluate((element, previous) => element === previous, title)).toBe(true);
	const checkingBounds = await panel.boundingBox();
	expect(confirmationBounds).not.toBeNull();
	expect(checkingBounds).not.toBeNull();
	expect(Math.abs(confirmationBounds!.height - checkingBounds!.height)).toBeLessThan(1);
	expect(Math.abs(confirmationBounds!.y - checkingBounds!.y)).toBeLessThan(1);
	const stop = panel.getByRole("button", { name: "Stop checking for suggestions" });
	await expect(stop).toBeVisible();
	await stop.click();
	await expect(panel.getByText("5 suggestions discarded")).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check again" })).toBeFocused();
});

test("a quiet re-check shows its result in the floating confirmation", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog").last();
	await panel.getByRole("button", { name: "Discard all" }).click();
	await expect(panel.getByText(/\d+ suggestions discarded/u)).toBeVisible();
	for (let run = 0; run < 5; run += 1) {
		await panel.getByRole("button", { name: "Check again" }).click();
		await expect(panel.getByText("Checking for suggestions", { exact: true })).toBeVisible();
		await expect(panel.getByText("Checking for suggestions", { exact: true })).toBeHidden({ timeout: 10000 });
		if (await panel.getByText("No new suggestions", { exact: true }).isVisible()) break;
		await panel.getByRole("button", { name: "Discard all" }).click();
	}
	await expect(panel.getByText("No new suggestions", { exact: true })).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check again" })).toBeVisible();
});
