import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

/** The work item's own scrollport: bounded by the viewport, taller content than it shows. */
async function scrollport(page: Page) {
	return page.evaluate(() => {
		const root = document.querySelector("[data-project-butter-work-item]")?.firstElementChild;
		return root ? { clientHeight: root.clientHeight, scrollHeight: root.scrollHeight, scrollTop: root.scrollTop } : null;
	});
}

// Regression: hosting the Rovo chat wrapped the work item in a non-flex `h-full` box, which
// let it grow to its content height so nothing scrolled.
test("the hosted Project butter work item still scrolls with the Rovo chat closed and open", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/jira-work-item"));
	await page.getByRole("button", { name: "Open Project butter session" }).click();
	await expect(page.getByRole("button", { name: "Ask Rovo" })).toBeVisible();
	await expect.poll(async () => (await scrollport(page))?.scrollHeight ?? 0).toBeGreaterThan(1000);

	const closed = await scrollport(page);
	expect(closed!.clientHeight).toBeLessThan(1000);
	await page.mouse.move(800, 600);
	await page.mouse.wheel(0, 600);
	await expect.poll(async () => (await scrollport(page))?.scrollTop ?? 0).toBeGreaterThan(0);

	await page.getByRole("button", { name: "Ask Rovo" }).click();
	await expect(page.locator("[data-project-butter-chat]")).toBeVisible();
	const before = (await scrollport(page))!.scrollTop;
	await page.mouse.move(700, 600);
	await page.mouse.wheel(0, 600);
	await expect.poll(async () => (await scrollport(page))?.scrollTop ?? 0).toBeGreaterThan(before);
	expect((await page.locator("[data-project-butter-chat]").boundingBox())!.height).toBeLessThanOrEqual(1000);

	// Jira's flush sidebar: butts against the nav and viewport edges, no inset card.
	const flush = await page.locator("[data-project-butter-chat]").evaluate((aside) => {
		const box = aside.getBoundingClientRect();
		const panel = getComputedStyle(aside.firstElementChild!);
		return { right: box.right, bottom: box.bottom, radius: panel.borderRadius, border: panel.borderWidth };
	});
	expect(flush).toEqual({ right: 1600, bottom: 1000, radius: "0px", border: "0px" });
});

// Like the Butter board, the hosted work item offers the floating Rovo button in every presentation.
for (const presentation of ["Full screen", "Modal"] as const) {
	test(`the hosted Project butter ${presentation} work item shows the floating Rovo button`, async ({ page }) => {
		await page.goto(appUrl("/components/blocks/jira-work-item"));
		const sizes = page.getByRole("group", { name: "Screen size" });
		await expect(async () => {
			await page.mouse.wheel(0, 1200);
			await expect(sizes).toBeVisible({ timeout: 500 });
		}).toPass();
		await sizes.getByRole("button", { name: presentation }).click();
		const launcher = page.getByRole("button", { name: "Open Rovo chat" });
		await expect(launcher).toBeVisible();
		await launcher.click();
		await expect(page.getByText("How can I help?")).toBeVisible();
	});
}
