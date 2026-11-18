import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("the prompt timeline jumps within the message scroller", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/chat-timeline"));
	const preview = page.locator("#preview");
	const viewport = preview.locator('[data-slot="message-scroller-viewport"]');
	await expect.poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(100);
	await preview.getByRole("button", { name: "Open prompt timeline" }).click();
	await preview.getByRole("button", { name: /^Please turn that into a migration plan/ }).click();
	await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
	const target = viewport.locator('[data-chat-timeline-message-id="msg-13"]');
	await expect.poll(() => target.evaluate((element) => {
		const scrollport = element.closest('[data-slot="message-scroller-viewport"]');
		if (!scrollport) return Infinity;
		return element.getBoundingClientRect().top - scrollport.getBoundingClientRect().bottom;
	})).toBeLessThan(0);
});
