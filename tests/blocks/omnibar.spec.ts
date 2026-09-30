import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const OMNIBAR_URL = appUrl("/preview/blocks/omnibar");

test("keyboard activation moves focus from the Omnibar pill into the revealed composer", async ({ page }) => {
	await page.goto(OMNIBAR_URL, { waitUntil: "domcontentloaded" });

	const omnibar = page.locator('[data-slot="omnibar"]');
	const pill = omnibar.getByRole("button", { name: "Ask Rovo" });

	await pill.focus();
	await page.keyboard.press("Enter");

	await expect(omnibar).toHaveAttribute("data-state", "expanded");
	await expect(omnibar.getByRole("textbox", { name: "Ask Rovo" })).toBeFocused();
});
