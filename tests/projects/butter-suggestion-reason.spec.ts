import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("PAY-999 explains suggested values in both stack and list views", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	await page.getByRole("button", { name: "Why description was suggested" }).hover();
	await expect(page.getByText("Payments SDK v2 — Merchant onboarding PRD", { exact: true })).toBeVisible();
	await page.mouse.move(0, 0);
	await page.getByRole("button", { name: "Show as list" }).click();
	for (const field of ["description", "due date", "parent", "labels", "story points"]) {
		await expect(page.getByRole("button", { name: `Why ${field} was suggested` })).toBeVisible();
	}
	await page.getByRole("button", { name: "Why due date was suggested" }).click();
	await expect(page.getByText("Lands three days before the SDK v2.0 general-availability release.")).toBeVisible();
	await expect(page.getByText("Release SDK v2.0 GA — Dec 18, 2026")).toBeVisible();
	await page.getByText("Lands three days before the SDK v2.0 general-availability release.").hover();
	const openColor = () => page.getByRole("button", { name: "Why due date was suggested" }).evaluate((button) => getComputedStyle(button).color);
	const defaultColor = await page.getByRole("button", { name: "Why parent was suggested" }).evaluate((button) => getComputedStyle(button).color);
	await expect.poll(openColor).toBe(defaultColor);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Why story points was suggested" }).hover();
	await expect(page.getByText("A five-point estimate fits the onboarding quickstart.")).toBeVisible();
});
