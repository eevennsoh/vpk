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
		const mention = element.querySelector("[data-jira-activity-user-mention]");
		const mentionText = element.querySelector("[data-tag-text]");
		const avatar = element.querySelector("[data-slot=tag-before]");
		if (!mention || !mentionText || !avatar) throw new Error("Activity mention is missing");
		return [Math.abs(center(element) - center(track)), ...[...element.children, mention, mentionText, avatar].map((child) => Math.abs(center(child) - center(element)))];
	});
	for (const offset of offsets) expect(offset).toBeLessThanOrEqual(1);
	const gap = await button.evaluate((element) => element.children[2].getBoundingClientRect().left - element.children[1].getBoundingClientRect().right);
	expect(gap).toBeCloseTo(6, 0);
	await button.click();
	const details = page.locator('[data-jira-activity-entry-id="butter-accepted-suggestions"] dd');
	await expect(details.first()).toBeVisible();
	const colors = await details.evaluateAll((elements) => elements.flatMap((element) => [...element.querySelectorAll("span")].map((span) => ({ color: getComputedStyle(span).color, parentColor: getComputedStyle(element).color, background: getComputedStyle(span).backgroundColor }))));
	expect(colors.length).toBeGreaterThan(0);
	for (const value of colors) {
		expect(value.color).toBe(value.parentColor);
		expect(value.background).toBe("rgba(0, 0, 0, 0)");
	}
});

test("agent invocation uses the shared session card", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("dialog", { name: "Add agent", exact: true }).getByRole("button", { name: "Claude", exact: true }).click();
	const invocation = item.locator('[data-jira-activity-entry-id^="invocation-"]');
	await expect(invocation).toContainText("Venn added Claude and self-assigned the issue");
	await expect(invocation.locator("[data-project-butter-session-start]")).toBeVisible();
});

test("comment and reply action icons share the same right-hand columns", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "In progress", exact: true }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const invocation = page.getByRole("dialog", { name: "Project butter" }).locator('[data-jira-activity-entry-id^="invocation-"]');
	await expect(invocation).toContainText("I'm looking into this issue now");
	const header = invocation.locator('[data-slot="jira-activity-comment-header"]').first();
	const reply = invocation.locator('[data-jira-activity-reply-header]').first();
	const centers = await Promise.all([
		header.getByRole("button", { name: "Summarize thread" }),
		header.getByRole("button", { name: "Pin comment" }),
		reply.getByRole("button", { name: "Reply" }),
		reply.getByRole("button", { name: "Add reaction" }),
	].map((button) => button.evaluate((element) => { const box = element.getBoundingClientRect(); return box.left + box.width / 2; })));
	expect(Math.abs(centers[0] - centers[2])).toBeLessThanOrEqual(1);
	expect(Math.abs(centers[1] - centers[3])).toBeLessThanOrEqual(1);
});

for (const motion of ["no-preference", "reduce"] as const) test(`adding a private agent reply changes its visibility label with ${motion} motion`, async ({ page }) => {
	await page.emulateMedia({ reducedMotion: motion });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "In progress", exact: true }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const invocation = page.getByRole("dialog", { name: "Project butter" }).locator('[data-jira-activity-entry-id^="invocation-"]');
	const reply = invocation.locator('[aria-label="Replies"] > div').filter({ hasText: "I'm looking into this issue now" });
	await expect(reply).toContainText("Only visible to you");
	await reply.getByRole("button", { name: "Add reply" }).click();
	await expect(reply).toContainText("Visible to everyone");
	const shownAt = Date.now();
	await expect.poll(async () => (await reply.textContent())?.includes("Visible to everyone") && Date.now() - shownAt >= 900, { intervals: [100] }).toBe(true);
	await expect(reply.getByRole("button", { name: "Add reply" })).toHaveCount(0);
	if (motion === "no-preference") {
		await expect.poll(() => reply.locator('[data-visibility-metadata] > span:last-child').evaluate((node) => node.getAnimations({ subtree: true }).some((animation) => animation.playState === "running")), { intervals: [50], timeout: 2000 }).toBe(true);
	}
	await expect(reply).not.toContainText("Visible to everyone", { timeout: 5000 });
});
