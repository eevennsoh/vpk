import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function openSuggestions(page: import("@playwright/test").Page) {
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	return item;
}

test("accepting all suggestions moves the filling indicator through Details", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const item = await openSuggestions(page);
	await page.getByRole("button", { name: "Accept all" }).click();
	const cursor = item.locator("[data-project-butter-suggestion-cursor]");
	await expect(cursor).toBeVisible();
	const start = await cursor.boundingBox();
	if (!start) throw new Error("The filling indicator has no visible position");
	await expect.poll(async () => (await cursor.boundingBox())?.y ?? start.y, { timeout: 8_000 }).toBeGreaterThan(start.y + 30);
	await expect(cursor).toHaveCount(0, { timeout: 12_000 });
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Dec 15, 2026");
	await page.getByRole("button", { name: "Undo accepting 5 suggestions" }).click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).not.toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Add due date");
});

test("undo during filling cancels remaining changes", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const item = await openSuggestions(page);
	await page.getByRole("button", { name: "Accept all" }).click();
	const cursor = item.locator("[data-project-butter-suggestion-cursor]");
	await expect(cursor).toBeVisible();
	await page.getByRole("button", { name: "Undo accepting 5 suggestions" }).click();
	await expect(cursor).toHaveCount(0);
	await expect(item.getByRole("textbox", { name: "Work item description" })).not.toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Add due date");
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect(cursor).toBeVisible();
	await expect(cursor).toHaveCount(0, { timeout: 12_000 });
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Dec 15, 2026");
});

test("undoing one suggestion during filling leaves the others accepted", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const item = await openSuggestions(page);
	await page.getByRole("button", { name: "Show as list" }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	const cursor = item.locator("[data-project-butter-suggestion-cursor]");
	await expect(cursor).toBeVisible();
	await page.getByRole("button", { name: "Undo due date" }).click();
	await expect(cursor).toHaveCount(0, { timeout: 12_000 });
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Add due date");
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: "Change story points" })).toContainText("5");
});

test("accepting all respects reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const item = await openSuggestions(page);
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect(item.locator("[data-project-butter-suggestion-cursor]")).toHaveCount(0);
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Dec 15, 2026");
});
