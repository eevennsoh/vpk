import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("scrolling filter options meet their fixed footer separator", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitem", { name: "Labels Open submenu" }).hover();
	const menu = page.getByRole("menu", { name: "Labels filter options" });
	const viewport = menu.locator(".overflow-y-auto");
	const separator = menu.getByRole("separator");
	await expect(menu.getByRole("menuitem", { name: "Clear", exact: true })).toBeVisible();
	const measure = async () => {
		const bottom = await viewport.evaluate((element) => element.getBoundingClientRect().bottom);
		const top = await separator.evaluate((element) => element.getBoundingClientRect().top);
		return Math.abs(top - bottom);
	};
	await expect.poll(measure).toBeLessThanOrEqual(1);
	const scrollable = await viewport.evaluate((element) => element.scrollHeight > element.clientHeight);
	expect(scrollable).toBe(true);
	await viewport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
	await expect.poll(measure).toBeLessThanOrEqual(1);
	await expect(menu.getByRole("menuitemcheckbox", { name: "payments-api", exact: true })).toBeVisible();
});

test("filter options that fit retain their bottom spacing", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitem", { name: "Status Open submenu", exact: true }).hover();
	const menu = page.getByRole("menu", { name: "Status filter options" });
	const viewport = menu.locator(".overflow-y-auto");
	const lastRow = menu.getByRole("menuitemcheckbox", { name: "Done", exact: true });
	const separator = menu.getByRole("separator");
	await expect(lastRow).toBeVisible();
	expect(await viewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(false);
	const lastBottom = await lastRow.evaluate((element) => element.getBoundingClientRect().bottom);
	const separatorTop = await separator.evaluate((element) => element.getBoundingClientRect().top);
	expect(separatorTop - lastBottom).toBe(6);
});
