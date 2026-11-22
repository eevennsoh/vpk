import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function expectSolidRail(thread: Locator) {
	const stem = thread.locator("[data-jira-activity-thread-stem]");
	const continuation = thread.locator("[data-jira-activity-replies-disclosure] > [data-jira-activity-thread-continuation]");
	const replyLine = thread.locator('[aria-label="Replies"] [data-jira-activity-thread-continuation]').first();
	await expect(stem).toHaveCSS("background-image", "none");
	await expect(continuation).toHaveCSS("background-image", "none");
	await expect(continuation).toHaveCSS("mask-image", "none");
	const colors = await Promise.all([stem, continuation, replyLine].map((line) => line.evaluate((element) => getComputedStyle(element).backgroundColor)));
	expect(colors[0]).toBe(colors[2]);
	expect(colors[1]).toBe(colors[2]);
	const [stemBox, continuationBox] = await Promise.all([stem.boundingBox(), continuation.boundingBox()]);
	if (!stemBox || !continuationBox) throw new Error("Missing thread connector");
	expect(Math.abs(stemBox.x - continuationBox.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(stemBox.y + stemBox.height - continuationBox.y)).toBeLessThanOrEqual(1);
}

test("visible session replies use a continuous solid connector", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	await expect(thread.getByRole("button", { name: "Show replies", exact: true })).toBeVisible();
	await expect(thread.locator("[data-jira-activity-thread-stem]")).toHaveCSS("background-image", /repeating-linear-gradient/u);
	await thread.getByRole("button", { name: "Show replies", exact: true }).click();
	await expectSolidRail(thread);
	await thread.getByRole("button", { name: "Hide replies", exact: true }).click();
	await expect(thread.locator("[data-jira-activity-thread-stem]")).toHaveCSS("background-image", /repeating-linear-gradient/u);
	await thread.getByRole("button", { name: /5 replies/u }).click();
	await thread.getByRole("button", { name: "Reply", exact: true }).first().focus();
	await page.keyboard.press("Enter");
	const composer = page.getByRole("form", { name: "Comment editor" });
	await composer.getByRole("textbox", { name: "Comment editor" }).fill("A local follow-up");
	await composer.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(thread.getByText("A local follow-up", { exact: true })).toBeVisible();
	const restore = thread.getByRole("button", { name: "Show replies", exact: true });
	if (await restore.isVisible()) await restore.click();
	const hide = thread.getByRole("button", { name: "Hide replies", exact: true });
	if (await hide.isVisible()) await hide.click();
	await expect(thread.getByRole("button", { name: /Show 5 replies/u })).toHaveAttribute("aria-expanded", "false");
	await expect(thread.getByText("A local follow-up", { exact: true })).toBeVisible();
	await expectSolidRail(thread);
});

test("expanded pinned timeline replies use a continuous solid connector", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const thread = page.locator('[data-project-butter-activity-feed] [data-jira-activity-entry-id="invocation-butter-cursor-forecast"]');
	await thread.getByRole("button", { name: "Pin comment", exact: true }).focus();
	await page.keyboard.press("Enter");
	await thread.getByRole("button", { name: /5 replies/u }).click();
	await expectSolidRail(thread);
});
