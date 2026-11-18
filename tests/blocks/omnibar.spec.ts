import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const OMNIBAR_URL = appUrl("/preview/blocks/omnibar");

test("keyboard activation moves focus from the Omnibar pill into the revealed composer", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(OMNIBAR_URL, { waitUntil: "domcontentloaded" });

	const omnibar = page.locator('[data-slot="omnibar"]');
	const pill = omnibar.getByRole("button", { name: "Ask Rovo" });

	await pill.focus();
	await page.keyboard.press("Enter");

	await expect(omnibar).toHaveAttribute("data-state", "expanded");
	await expect(omnibar.getByRole("textbox", { name: "Ask Rovo" })).toBeFocused();
});

test("the docked chat uses the shared scroller and message primitives", async ({ page }) => {
	await page.goto(OMNIBAR_URL, { waitUntil: "domcontentloaded" });
	const omnibar = page.locator('[data-slot="omnibar"]');
	await omnibar.getByRole("button", { name: "Ask Rovo" }).focus();
	await page.keyboard.press("Enter");
	await expect(omnibar).toHaveAttribute("data-state", "expanded");
	await omnibar.getByRole("button", { name: "Switch to side panel" }).click();
	const panel = page.locator('[data-slot="omnibar-panel"]');
	const input = panel.getByRole("textbox", { name: "Chat message input" });
	await input.fill("Show the new chat");
	await input.press("Enter");
	const viewport = panel.locator('[data-slot="message-scroller-viewport"]');
	await expect(viewport.getByText("Show the new chat", { exact: true })).toBeVisible();
	await expect(viewport.getByText("Got it. I can help with: Show the new chat")).toBeVisible();
	await expect(viewport.locator('[data-slot="bubble"]')).toHaveCount(2);
});
