import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the Jira Suggestion preview offers Menu and Floating reviews", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/blocks/jira-suggestion"));
	const preview = page.locator("#preview");
	const menu = preview.getByRole("button", { name: "Menu", exact: true });
	const floating = preview.getByRole("button", { name: "Floating", exact: true });
	await expect(menu).toHaveAttribute("aria-pressed", "true");
	await expect(preview.getByRole("button", { name: "Show as list" })).toBeVisible();

	await floating.click();
	await expect(floating).toHaveAttribute("aria-pressed", "true");
	await preview.getByRole("button", { name: "Review AI suggestions", exact: true }).click();
	const panel = preview.getByRole("dialog", { name: /^Work item suggestions/ });
	const list = panel.getByRole("list", { name: "Suggestions", exact: true });
	await expect(list.locator(':scope > [role="listitem"]')).toHaveCount(6);
	await panel.getByRole("button", { name: "Dismiss all", exact: true }).click();
	await preview.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
	await preview.getByRole("button", { name: "Suggest work item fields", exact: true }).click();
	await expect(list.locator(':scope > [role="listitem"]')).toHaveCount(6);

	await menu.click();
	await expect(menu).toHaveAttribute("aria-pressed", "true");
	await expect(preview.getByRole("button", { name: "Show as list" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Review AI suggestions", exact: true })).toHaveCount(0);
});

async function openDescription(page: Page) {
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	const text = page.locator("[data-top-card] [data-suggestion-value-scroll]");
	await expect(text).toBeVisible();
	return text;
}

test("clicking the scrollable description opens the suggestion list", async ({ page }) => {
	const text = await openDescription(page);
	await text.click({ position: { x: 30, y: 20 } });
	await expect(page.getByRole("list", { name: "Suggestions" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Accept description" }).first()).toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`description fades only while more text remains (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const text = await openDescription(page);
		await expect.poll(() => text.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
		await text.evaluate((element) => { element.scrollTop = element.scrollHeight; });
		await expect.poll(() => text.evaluate((element) => getComputedStyle(element).maskImage)).toBe("none");
		await text.evaluate((element) => { element.scrollTop = 0; });
		await expect.poll(() => text.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
		await expect(page.getByRole("list", { name: "Suggestions" })).toHaveCount(0);
	});
}
