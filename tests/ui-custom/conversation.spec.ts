import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const CONVERSATION_URL = appUrl("/components/ui-custom/conversation");

test("conversation docs preview exposes markdown download", async ({ page }) => {
	await page.goto(CONVERSATION_URL, { waitUntil: "networkidle" });

	const downloadButton = page.getByRole("button", {
		name: /download conversation/i,
	});

	await expect(downloadButton).toBeVisible();

	const downloadPromise = page.waitForEvent("download");
	await downloadButton.click();
	const download = await downloadPromise;

	expect(download.suggestedFilename()).toBe("conversation.md");
});

test("conversation preview uses the message scroller and returns to the latest message", async ({ page }) => {
	await page.goto(CONVERSATION_URL);
	const preview = page.locator("#preview");
	const viewport = preview.locator('[data-slot="message-scroller-viewport"]');
	const button = preview.locator('[data-slot="message-scroller-button"]');
	await expect(viewport.locator('[data-slot="message-scroller-item"]')).toHaveCount(8);
	await viewport.hover();
	await page.mouse.wheel(0, -2000);
	await expect(button).toHaveAttribute("data-active", "true");
	await button.click();
	await expect.poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
	await expect(button).toHaveAttribute("data-active", "false");
});
