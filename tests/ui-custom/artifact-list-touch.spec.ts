import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const ARTIFACT_LIST_URL = appUrl("/preview/ui-custom/artifact-list");

test.use({
	hasTouch: true,
	isMobile: true,
	viewport: { height: 844, width: 390 },
});

test("artifact actions stay visible and invoke onOpen without hover", async ({ page }) => {
	const consoleMessages: string[] = [];
	page.on("console", (message) => consoleMessages.push(message.text()));

	await page.goto(ARTIFACT_LIST_URL, { waitUntil: "networkidle" });
	await expect.poll(() => page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(true);

	const defaultList = page.locator("section").filter({
		has: page.getByRole("heading", { name: "Default" }),
	});
	const openAction = defaultList.getByRole("button", { exact: true, name: "Open" }).first();

	await expect(openAction).toBeVisible();
	await expect(openAction).toHaveCSS("pointer-events", "auto");
	await openAction.tap();
	await expect.poll(() => consoleMessages).toContain("audience-engagement-report");
});
