import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const reducedMotion of ["reduce", "no-preference"] as const) test(`the floating suggestions panel fits its contents after individual decisions (${reducedMotion})`, async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	const list = panel.getByRole("list", { name: "Suggestions" });
	const footer = panel.locator("footer");
	const initial = await panel.boundingBox();
	if (!initial) throw new Error("Suggestions panel is not visible");
	for (const field of ["description", "assignee", "due date"]) {
		await panel.getByRole("button", { name: `Accept ${field}`, exact: true }).click();
	}
	await expect(panel.getByText("3 of 5 reviewed")).toBeVisible();
	await expect.poll(async () => {
		const listBounds = await list.boundingBox();
		const footerBounds = await footer.boundingBox();
		return listBounds && footerBounds ? footerBounds.y - (listBounds.y + listBounds.height) : Infinity;
	}).toBeLessThan(32);
	await expect.poll(async () => (await panel.boundingBox())?.height ?? Infinity).toBeLessThan(initial.height - 20);
	await expect(panel.getByRole("button", { name: "Accept parent" })).toBeVisible();
	const collapsed = await panel.boundingBox();
	if (!collapsed) throw new Error("Suggestions panel is not visible");
	await panel.getByRole("button", { name: "Why parent was suggested" }).click();
	await expect.poll(async () => (await panel.boundingBox())?.height ?? 0).toBeGreaterThan(collapsed.height + 20);
	await panel.getByRole("button", { name: "Why parent was suggested" }).click();
	await expect.poll(async () => (await panel.boundingBox())?.height ?? Infinity).toBeLessThan(collapsed.height + 10);
});

test("the suggestions panel keeps overflow scrollable in a short viewport", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	const scrollport = panel.locator("[data-scrollport]");
	await expect.poll(() => scrollport.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
	await scrollport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
	await expect.poll(() => scrollport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});
