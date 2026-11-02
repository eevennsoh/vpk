import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("the old Live Waveform documentation URL opens its new location", async ({ page }) => {
	await page.goto(appUrl("/components/ui-audio/live-waveform"));
	await expect(page).toHaveURL(appUrl("/components/ui-custom/live-waveform"));
	await expect(page.getByRole("heading", { name: "Live Waveform", level: 1 })).toBeVisible();
});
