import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const PULL_REQUEST_FIX_URL = appUrl("/preview/blocks/pull-request-fix");

test("keyboard dismissal restores focus to the compact fix composer", async ({ page }) => {
	await page.goto(PULL_REQUEST_FIX_URL, { waitUntil: "domcontentloaded" });

	const transformSection = page
		.getByRole("heading", { name: "Transform on focus" })
		.locator("..");
	const editor = transformSection.getByRole("textbox", {
		name: "write your instruction...",
	});

	await editor.focus();
	const closeButton = transformSection.getByRole("button", { name: "Close fix" });
	await expect(closeButton).toBeVisible();

	await closeButton.focus();
	await page.keyboard.press("Enter");

	await expect(closeButton).toHaveCount(0);
	await expect(editor).toBeFocused();

	await editor.evaluate((element) => element.blur());
	await editor.focus();
	await expect(closeButton).toBeVisible();
	await closeButton.click();
	await expect(closeButton).toHaveCount(0);
	await expect(editor).not.toBeFocused();
});
