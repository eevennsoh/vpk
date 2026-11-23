import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

for (const height of [900, 1800]) test(`the column line reaches the bottom of the gallery list at ${height}px`, async ({ page }) => {
	await page.setViewportSize({ width: 1800, height });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const list = page.getByTestId("jira-list");
	const scrollport = list.getByTestId("jira-list-table-scroll");
	await scrollport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
	const line = list.getByTestId("jira-list-column-boundary-1").locator("[data-boundary-line]");
	await list.getByRole("button", { name: "Add column between Work and Status" }).focus();
	await expect(line).toHaveCSS("opacity", "1");
	const [lineBounds, scrollBounds, lastRowBounds] = await Promise.all([
		line.boundingBox(), scrollport.boundingBox(), scrollport.locator("tbody tr").last().boundingBox(),
	]);
	if (!lineBounds || !scrollBounds || !lastRowBounds) throw new Error("List geometry is unavailable");
	expect(Math.abs(lineBounds.y + lineBounds.height - (scrollBounds.y + scrollBounds.height))).toBeLessThanOrEqual(1);
	expect(lineBounds.y + lineBounds.height).toBeGreaterThanOrEqual(lastRowBounds.y + lastRowBounds.height - 1);
});

test("the column line and circle share hover, tooltip, and keyboard focus", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const list = page.getByTestId("jira-list");
	const rowControl = list.getByRole("button", { name: "Create work item after PAY-125", exact: true });
	await rowControl.focus();
	const rowMarker = rowControl.locator("span.rounded-full");
	const rowBounds = await rowMarker.boundingBox();
	if (!rowBounds) throw new Error("Expected a measurable row marker");
	await page.getByRole("tab", { name: "List", exact: true }).focus();

	const header = list.getByRole("columnheader", { name: /^Work/ });
	const headerBounds = await header.boundingBox();
	if (!headerBounds) throw new Error("Expected a measurable Work header");
	const control = list.getByRole("button", { name: "Add column between Work and Status", exact: true });
	const marker = control.locator("[data-boundary-marker]");
	const line = page.getByTestId("jira-list-column-boundary-1").locator("[data-boundary-line]");
	const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Add column" });
	await page.mouse.move(headerBounds.x + headerBounds.width / 2, headerBounds.y + headerBounds.height / 2);
	await expect(marker).toHaveCSS("opacity", "0");
	const restColor = await marker.evaluate((element) => getComputedStyle(element).backgroundColor);
	await page.mouse.move(headerBounds.x + headerBounds.width - 6, headerBounds.y + headerBounds.height / 2);
	await expect(marker).toHaveCSS("opacity", "1");
	const markerBounds = await marker.boundingBox();
	if (!markerBounds) throw new Error("Expected a measurable column marker");
	expect({ width: markerBounds.width, height: markerBounds.height }).toEqual({ width: rowBounds.width, height: rowBounds.height });
	const lineX = markerBounds.x + markerBounds.width / 2;
	await page.mouse.move(lineX, headerBounds.y + headerBounds.height + 20);
	await expect(line).toHaveCSS("opacity", "1");
	await expect(tooltip).toBeVisible();
	const lineHoverColor = await marker.evaluate((element) => getComputedStyle(element).backgroundColor);
	expect(lineHoverColor).not.toBe(restColor);
	await page.mouse.move(lineX, markerBounds.y + markerBounds.height / 2);
	await expect(tooltip).toBeVisible();
	expect(await marker.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(lineHoverColor);
	await page.mouse.move(headerBounds.x + headerBounds.width / 2, headerBounds.y + headerBounds.height / 2);
	await expect(marker).toHaveCSS("opacity", "0");
	await expect(tooltip).toBeHidden();
	await page.keyboard.press("Tab");
	await control.focus();
	await expect(line).toHaveCSS("opacity", "1");
	await expect(marker).toHaveCSS("opacity", "1");
	await expect(marker).toHaveCSS("box-shadow", /3px/u);
	await expect(tooltip).toBeVisible();
});

test("the column boundary does not open a creation menu", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const list = page.getByTestId("jira-list");
	const header = list.getByRole("columnheader", { name: /^Work/ });
	const headerBounds = await header.boundingBox();
	if (!headerBounds) throw new Error("Expected a measurable Work header");
	const control = list.getByRole("button", { name: "Add column between Work and Status", exact: true });
	const count = await list.getByRole("columnheader").count();
	const marker = control.locator("[data-boundary-marker]");
	const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Add column" });
	for (const issueKey of ["PAY-118", "PAY-124", "PAY-105"]) {
		const row = list.getByRole("button", { name: issueKey, exact: true }).locator("xpath=ancestor::tr");
		const rowBounds = await row.boundingBox();
		if (!rowBounds) throw new Error(`Expected ${issueKey} to be visible`);
		await page.mouse.move(headerBounds.x + headerBounds.width, rowBounds.y + rowBounds.height / 2);
		await expect(marker).toHaveCSS("opacity", "1");
		await expect(tooltip).toBeVisible();
	}
	await page.mouse.down();
	await page.mouse.up();
	await expect(page.getByRole("searchbox", { name: "Search columns" })).toHaveCount(0);
	await expect(list.getByRole("columnheader")).toHaveCount(count);
	await control.focus();
	await control.press("Enter");
	await expect(page.getByRole("searchbox", { name: "Search columns" })).toHaveCount(0);
	await expect(list.getByRole("columnheader")).toHaveCount(count);
});
