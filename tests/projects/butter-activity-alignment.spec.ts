import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("work item activity text aligns with its icon and timestamp", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept description" }).click();
	const button = page.getByRole("button", { name: /Venn updated description/ });
	await expect(button).toBeVisible();
	const offsets = await button.evaluate((element) => {
		const row = element.closest("[data-jira-activity-entry-id]");
		const track = row?.firstElementChild?.firstElementChild;
		if (!track) throw new Error("Activity icon track not found");
		const center = (child: Element) => { const box = child.getBoundingClientRect(); return box.top + box.height / 2; };
		return [Math.abs(center(element) - center(track)), ...[...element.children].map((child) => Math.abs(center(child) - center(element)))];
	});
	for (const offset of offsets) expect(offset).toBeLessThanOrEqual(1);
});
