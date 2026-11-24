import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("pinned threads fade as dashed lines until replies are expanded", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	for (const view of ["Timeline", "Agent sessions"]) {
		await activity.getByRole("tab", { name: view, exact: true }).click();
		if (view === "Timeline") {
			await thread.hover();
			await thread.getByRole("button", { name: "Summarize thread" }).click();
		}
		const stem = thread.locator("[data-jira-activity-thread-stem]");
		const summaryBranch = thread.locator("[data-summary-thread-branch]");
		await expect(stem).toHaveCSS("background-image", "none");
		await expect(summaryBranch).toBeVisible();
		await thread.hover();
		await thread.getByRole("button", { name: "Pin comment", exact: true }).click();
		await expect(stem).toBeVisible();
		await expect(stem).toHaveCSS("background-image", /repeating-linear-gradient/u);
		await expect(stem).toHaveCSS("mask-image", /linear-gradient/u);
		await expect(summaryBranch).toBeHidden();
		await thread.getByRole("button", { name: /^Show \d+ replies/u }).click();
		await expect(stem).toHaveCSS("background-image", "none");
		await expect(thread.locator("[data-jira-activity-thread-branch]:visible").first()).toBeVisible();
		await expect(summaryBranch).toBeVisible();
		await thread.getByRole("button", { name: "Hide replies", exact: true }).click();
		await expect(stem).toHaveCSS("background-image", /repeating-linear-gradient/u);
		await expect(summaryBranch).toBeHidden();
		await thread.getByRole("button", { name: "Unpin comment", exact: true }).click();
		await expect(stem).toHaveCSS("background-image", "none");
		await expect(summaryBranch).toBeVisible();
	}
});
