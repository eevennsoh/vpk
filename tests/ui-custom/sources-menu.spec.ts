import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("Context aligns its icon and app logo without shrinking the logo", async ({ page }) => {
	await page.goto(appUrl("/components/ui-custom/sources-menu"));
	const trigger = page.locator("#preview").getByRole("button", { name: "Context", exact: true }).first();
	const icon = trigger.locator('[data-slot="icon"]');
	const label = trigger.getByText("Context", { exact: true });
	const tile = trigger.locator('[data-slot="tile"]').first();
	const logo = tile.locator("svg");
	await expect(logo).toHaveCSS("width", "16px");
	await expect(logo).toHaveCSS("height", "16px");
	const boxes = await Promise.all([icon.boundingBox(), label.boundingBox(), tile.boundingBox(), logo.boundingBox()]);
	for (const box of boxes) expect(box).not.toBeNull();
	const centers = boxes.map((box) => box!.y + box!.height / 2);
	expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
	await trigger.click();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
});

test("simple and verbose variants show the appropriate source details", async ({ page }) => {
	await page.goto(appUrl("/components/ui-custom/sources-menu"));
	const triggers = page.locator("#preview").getByRole("button", { name: "Context", exact: true });
	for (const trigger of await triggers.all()) {
		await expect(trigger.locator('div[aria-hidden="true"] > div')).toHaveCount(3);
	}
	await triggers.first().click();
	const simple = page.getByRole("dialog", { name: "Source previews" });
	const link = simple.getByRole("link", { name: "About UST", exact: true });
	await expect(link).toHaveAttribute("href", "https://hello.atlassian.net/wiki/spaces/UST/pages/5483563868");
	await expect(link.locator('[data-slot="icon-tile"]')).toBeVisible();
	await link.hover();
	await expect(link).toHaveCSS("text-decoration-line", "none");
	await expect(simple.getByText(/Owned by/)).toHaveCount(0);
	await expect(simple.getByRole("link", { name: "VPK repository" })).toBeVisible();
	await expect(simple.getByRole("link", { name: "Team conversation" })).toBeVisible();
	await page.keyboard.press("Escape");
	await triggers.nth(1).click();
	await expect(page.getByRole("dialog", { name: "Source previews" }).getByText("Owned by Amy Glancey").first()).toBeVisible();
	const actions = page.getByRole("button", { name: "More actions for About UST" });
	await actions.focus();
	await actions.click();
	for (const name of ["Copy link", "Open preview modal"]) {
		const item = page.getByRole("menuitem", { name, exact: true });
		await expect(item.locator(":scope > span").first()).toHaveCSS("width", "16px");
		await expect(item.locator("svg")).toHaveCSS("width", "16px");
		await expect(item.locator("svg")).toHaveCSS("height", "16px");
	}
});
