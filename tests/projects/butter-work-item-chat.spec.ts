import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("work item keeps the Rovo launcher and opens local session menus", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	const launcher = workItem.getByRole("button", { name: "Open Rovo chat" });
	await expect(launcher).toBeVisible();
	await expect.poll(async () => {
		const box = await launcher.boundingBox();
		const viewport = page.viewportSize();
		return box && viewport ? [Math.round(viewport.width - box.x - box.width), Math.round(viewport.height - box.y - box.height)] : null;
	}).toEqual([24, 24]);
	const launcherBox = await launcher.boundingBox();
	const workItemBox = await workItem.boundingBox();
	if (!launcherBox || !workItemBox) throw new Error("Missing launcher or work item geometry");
	expect(launcherBox.x).toBeGreaterThan(workItemBox.x + workItemBox.width);
	await launcher.focus();
	await page.keyboard.press("Enter");
	const chat = workItem.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toBeVisible();
	await expect.poll(async () => {
		const box = await chat.boundingBox();
		const viewport = page.viewportSize();
		return box && viewport ? [Math.round(viewport.width - box.x - box.width), Math.round(viewport.height - box.y - box.height)] : null;
	}).toEqual([24, 24]);
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await expect(launcher).toBeVisible();

	// The local Cursor session is an Activity session card; it opens the continue menu instead of a chat.
	await workItem.getByRole("list", { name: "Activity timeline" }).getByRole("button", { name: /^Replaying 3-D Secure fixtures Cursor/ }).click();
	const continueMenu = page.getByRole("menu", { name: /^Replaying 3-D Secure fixtures Cursor/ });
	await expect(continueMenu.getByRole("menuitem", { name: "Cursor" })).toBeVisible();
	await expect(continueMenu.getByRole("menuitem", { name: /Terminal/ })).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Reply to Cursor" })).toHaveCount(0);
	await expect(chat).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(continueMenu).toHaveCount(0);
});

test("moving the floating chat into and out of a work item keeps its draft", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await page.getByRole("button", { name: "Open Rovo chat" }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	const composer = chat.getByRole("textbox", { name: "Chat message input" });
	await composer.fill("A draft to keep");
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem.locator('[data-rovo-chat-placement="floating"]')).toBeVisible();
	await expect(composer).toHaveText("A draft to keep");
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(chat).toBeVisible();
	await expect(composer).toHaveText("A draft to keep");
});

