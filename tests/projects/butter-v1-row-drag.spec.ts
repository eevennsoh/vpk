import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

for (const [tab, sourceKey, targetKey] of [["List", "PAY-118", "PAY-999"], ["Backlog", "PAY-105", "PAY-107"]] as const) {
	test(`${tab} drags from the row without showing create controls or clipping the preview`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: tab, exact: true }).click();
		const source = page.getByRole("button", { name: sourceKey, exact: true }).locator("xpath=ancestor::tr");
		const target = page.getByRole("button", { name: targetKey, exact: true }).locator("xpath=ancestor::tr");
		const from = await source.boundingBox();
		const to = await target.boundingBox();
		if (!from || !to) throw new Error("Expected measurable work item rows");
		await page.mouse.move(from.x + 300, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(from.x + 300, to.y + to.height / 2, { steps: 10 });
		await expect(source).toHaveAttribute("data-dragging", "true");
		const preview = page.getByTestId("jira-list-drag-preview");
		await expect(preview).toBeVisible();
		await expect(preview).toHaveCSS("box-shadow", "none");
		await expect(preview.locator("td").first()).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
		expect(await preview.evaluate((element) => element.parentElement?.parentElement === document.body)).toBe(true);
		await expect(page.getByRole("button", { name: /Create work item (before|after)/ })).toHaveCount(0);
		await expect(page.locator("[data-boundary-control]")).toHaveCount(0);
		await page.mouse.up();
		await expect(preview).toHaveCount(0);
		await expect(page.getByRole("button", { name: `Create work item after ${sourceKey}` })).toHaveCount(1);
		await expect.poll(async () => (await source.boundingBox())?.y ?? 0).toBeGreaterThan((await target.boundingBox())?.y ?? 0);
		await page.getByRole("button", { name: new RegExp(`Change status for ${sourceKey}`) }).click();
		await expect(page.getByRole("menu")).toBeVisible();
	});
}
