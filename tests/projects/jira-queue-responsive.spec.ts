import { expect, test, type Locator, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const JIRA_QUEUE_URL = appUrl("/jira-queue");

async function expectHitTestable(page: Page, locator: Locator): Promise<void> {
	await expect(locator).toBeVisible();
	await expect(locator).toBeInViewport();
	await expect(
		locator.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			const hitTarget = document.elementFromPoint(
				bounds.left + bounds.width / 2,
				bounds.top + bounds.height / 2,
			);
			return hitTarget === element || element.contains(hitTarget);
		}),
	).resolves.toBe(true);
}

test("small Jira Queue loads with every top-navigation action reachable", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(JIRA_QUEUE_URL, { waitUntil: "domcontentloaded" });

	await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
	await expectHitTestable(page, page.getByRole("searchbox", { name: "Search" }));
	await expectHitTestable(page, page.getByRole("button", { name: "Create" }));
	await expectHitTestable(page, page.getByRole("button", { name: "More" }));
	await expect(
		page.evaluate(() => document.documentElement.scrollWidth),
	).resolves.toBe(390);
});
