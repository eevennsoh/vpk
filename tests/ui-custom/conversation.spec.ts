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
