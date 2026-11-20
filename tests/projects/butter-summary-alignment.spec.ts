import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("thread summaries align with their session card in both activity views", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	for (const view of ["Timeline", "Agent sessions"]) {
		await activity.getByRole("tab", { name: view, exact: true }).click();
		const summarize = thread.getByRole("button", { name: "Summarize thread" });
		await summarize.focus();
		await summarize.press("Enter");
		const summary = thread.locator('[id][aria-hidden="false"]').filter({ hasText: "Thread summary" });
		const card = await thread.locator("[data-project-butter-session-start]").boundingBox();
		const heading = await summary.getByText("Thread summary", { exact: true }).locator("..").boundingBox();
		const text = await summary.locator("p").first().boundingBox();
		const restore = summary.getByRole("button", { name: "Show replies", exact: true });
		const action = await restore.boundingBox();
		if (!card || !heading || !text || !action) throw new Error("Missing session card or summary content");
		for (const box of [heading, text, action]) expect(Math.abs(box.x - card.x)).toBeLessThanOrEqual(1);
		await restore.click();
	}
});
