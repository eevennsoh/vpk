import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("card selection and built-in actions remain independently clickable", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-lanyard"));
	const card = page.locator('[data-agent-id="claude"]');
	await card.getByRole("button", { name: "Chat with Claude" }).click({ timeout: 5000 });
	await expect(page.getByRole("status")).toHaveText("Selected: Chat with Claude");
	await card.getByRole("button", { name: "More actions for Claude" }).click();
	await expect(page.getByRole("menuitem", { name: "View profile" })).toBeVisible();
	await page.keyboard.press("Escape");
	await card.getByRole("button", { name: "View Claude" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(page.getByRole("dialog").getByRole("heading", { name: "Claude" })).toBeVisible();
});
