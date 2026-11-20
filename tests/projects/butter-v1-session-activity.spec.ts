import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("activity icon tabs expose their labels above and switch views", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const list = activity.getByRole("tablist", { name: "Activity view" });
	const timeline = list.getByRole("tab", { name: "Timeline", exact: true });
	const sessions = list.getByRole("tab", { name: "Agent sessions", exact: true });
	const filter = activity.getByRole("button", { name: "Filter activity", exact: true });
	await expect(filter).toHaveCSS("width", "32px");
	await expect(filter).toHaveCSS("height", "32px");
	await expect(filter.locator("svg")).toHaveCSS("width", "12px");
	await expect(filter.locator("svg")).toHaveCSS("height", "12px");
	const filterBox = await filter.boundingBox();
	const filterIconBox = await filter.locator("svg").boundingBox();
	const tabsBox = await list.boundingBox();
	if (!filterBox || !filterIconBox || !tabsBox) throw new Error("Missing activity filter, icon, or tabs");
	expect(Math.abs(filterBox.x + filterBox.width / 2 - filterIconBox.x - filterIconBox.width / 2)).toBeLessThanOrEqual(1);
	expect(Math.abs(filterBox.y + filterBox.height / 2 - filterIconBox.y - filterIconBox.height / 2)).toBeLessThanOrEqual(1);
	expect(tabsBox.x - (filterBox.x + filterBox.width)).toBeCloseTo(4, 1);
	expect(await filter.evaluate((element) => Boolean(element.compareDocumentPosition(element.closest("[data-project-butter-activity-header]")!.querySelector('[role="tablist"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
	await filter.click();
	await expect(page.getByRole("menu")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(timeline).toHaveAttribute("aria-selected", "true");
	await expect(timeline).toHaveText("");
	await expect(sessions).toHaveText("");
	for (const [tab, label] of [[timeline, "Timeline"], [sessions, "Agent sessions"]] as const) {
		await tab.hover();
		const tooltip = page.getByRole("tooltip").filter({ hasText: label });
		await expect(tooltip).toBeVisible();
		await expect(tooltip).toHaveAttribute("data-side", "top");
		await expect.poll(async () => {
			const tabBox = await tab.boundingBox();
			const tooltipBox = await tooltip.boundingBox();
			return tabBox && tooltipBox ? tooltipBox.y + tooltipBox.height - tabBox.y : Infinity;
		}).toBeLessThanOrEqual(0);
	}
	await sessions.click();
	await expect(sessions).toHaveAttribute("aria-selected", "true");
	await expect(activity.getByRole("tabpanel", { name: "Agent sessions" })).toBeVisible();
	await timeline.focus();
	await page.keyboard.press("ArrowRight");
	await expect(sessions).toBeFocused();
	await page.keyboard.press("ArrowLeft");
	await expect(timeline).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(timeline).toHaveAttribute("aria-selected", "true");
	await expect(activity.getByRole("tabpanel", { name: "Timeline" })).toBeVisible();
});

test("other agent activity starts collapsed and can be expanded", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	const toggle = activity.getByRole("button", { name: "Other agent activity", exact: true });
	const teammateSession = activity.getByText("Implement onboarding step validation", { exact: true });
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(teammateSession).toBeHidden();
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	await expect(teammateSession).toBeVisible();
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(teammateSession).toBeHidden();
});

test("session summaries run once and refresh only for new replies", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const timeline = activity.getByRole("tab", { name: "Timeline", exact: true });
	const sessions = activity.getByRole("tab", { name: "Agent sessions", exact: true });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	const summary = thread.locator('[id][aria-hidden="false"]').filter({ hasText: "Thread summary" });
	await sessions.click();
	await expect(summary).toBeVisible();
	await expect(summary.getByText("Thread summary", { exact: true })).toBeVisible();
	const time = summary.locator("time");
	const firstRun = await time.getAttribute("datetime");
	expect(firstRun).toBeTruthy();
	await expect(summary.locator("[data-suggestion-text-reveal]")).toHaveCount(0, { timeout: 10_000 });
	await timeline.click();
	await sessions.click();
	await expect(summary).toBeVisible();
	await expect(time).toHaveAttribute("datetime", firstRun!);
	await expect(summary.locator("[data-suggestion-text-reveal]")).toHaveCount(0);
	await summary.getByRole("button", { name: "Show replies", exact: true }).click();
	const summarize = thread.getByRole("button", { name: "Summarize thread" });
	await summarize.focus();
	await summarize.press("Enter");
	await expect(summary).toBeVisible();
	await expect(time).toHaveAttribute("datetime", firstRun!);
	await expect(summary.locator("[data-suggestion-text-reveal]")).toHaveCount(0);
	await timeline.click();
	const otherThread = activity.locator('[data-project-butter-activity-feed] [data-jira-activity-entry-id="butter-source-comment-1"]');
	const otherReply = otherThread.getByRole("button", { name: "Reply", exact: true }).first();
	await otherReply.focus();
	await otherReply.press("Enter");
	const composer = page.getByRole("form", { name: "Comment editor" });
	await composer.getByRole("textbox", { name: "Comment editor" }).fill("A reply in another thread.");
	await composer.getByRole("button", { name: "Submit", exact: true }).click();
	await sessions.click();
	await expect(time).toHaveAttribute("datetime", firstRun!);
	await expect(summary.locator("[data-suggestion-text-reveal]")).toHaveCount(0);
	await timeline.click();
	const reply = thread.getByRole("button", { name: "Reply", exact: true }).first();
	await reply.focus();
	await reply.press("Enter");
	await composer.getByRole("textbox", { name: "Comment editor" }).fill("Please check the signup metrics.");
	await composer.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(thread.getByText("Please check the signup metrics.", { exact: true })).toBeVisible();
	await sessions.click();
	await expect(summary).toBeVisible();
	await expect(summary.getByText(/Please check the signup metrics/u)).toBeVisible();
	await expect.poll(() => time.getAttribute("datetime")).not.toBe(firstRun);
	const refreshedRun = await time.getAttribute("datetime");
	await expect(summary.locator("[data-suggestion-text-reveal]")).toBeVisible();
	await expect(summary.locator("[data-suggestion-text-reveal]")).toHaveCount(0, { timeout: 10_000 });
	await timeline.click();
	await sessions.click();
	await expect(time).toHaveAttribute("datetime", refreshedRun!);
	await expect(summary.locator("[data-suggestion-text-reveal]")).toHaveCount(0);
	await summary.getByRole("button", { name: "Show replies", exact: true }).click();
	const sessionReply = thread.getByRole("button", { name: "Reply", exact: true }).first();
	await sessionReply.focus();
	await sessionReply.press("Enter");
	await composer.getByRole("textbox", { name: "Comment editor" }).fill("Also check the recovery metrics.");
	await composer.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(thread.getByText("Also check the recovery metrics.", { exact: true })).toBeVisible();
	await timeline.click();
	await sessions.click();
	await expect(summary).toBeVisible();
	await expect(summary.getByText(/Also check the recovery metrics/u)).toBeVisible();
	await expect.poll(() => time.getAttribute("datetime")).not.toBe(refreshedRun);
	await expect(summary.locator("[data-suggestion-text-reveal]")).toBeVisible();
});

test("summary last-run time uses the session relative-time format", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.clock.install({ time: new Date("2026-11-20T00:00:00.000Z") });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	const summary = thread.locator('[id][aria-hidden="false"]').filter({ hasText: "Thread summary" });
	const time = summary.locator("time");
	await expect(summary).toContainText("Last run Just now");
	const runAt = await time.getAttribute("datetime");
	await page.clock.fastForward(3 * 24 * 60 * 60 * 1000);
	await expect(time).toHaveText("3d ago");
	await expect(time).toHaveAttribute("datetime", runAt!);
	await time.hover();
	await page.clock.fastForward(1000);
	await expect(page.getByRole("tooltip").filter({ hasText: "Last run on" })).toBeVisible();
});

test("expanded replies align in Timeline and Agent sessions", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	const assertAvatarSizes = async () => {
		const agents = thread.locator('[data-avatar-role="agent"] [data-slot="avatar"]:visible');
		await expect(agents).toHaveCount(3);
		for (const agent of await agents.all()) {
			const box = await agent.boundingBox();
			expect(box?.width).toBe(24);
			expect(box?.height).toBe(24);
		}
		const badges = thread.locator('[data-slot="human-agent-avatar"] [data-avatar-role="human"] [data-slot="avatar"]:visible');
		await expect(badges).toHaveCount(3);
		for (const badge of await badges.all()) {
			const box = await badge.boundingBox();
			expect(box?.width).toBe(12);
			expect(box?.height).toBe(12);
			await badge.scrollIntoViewIfNeeded();
			expect(await badge.evaluate((element) => {
				const rect = element.getBoundingClientRect();
				const thread = element.closest("[data-jira-activity-entry-id]");
				for (let parent = element.parentElement; parent && parent !== thread; parent = parent.parentElement) {
					const style = getComputedStyle(parent);
					const bounds = parent.getBoundingClientRect();
					if (["hidden", "clip"].includes(style.overflowX) && (rect.left < bounds.left || rect.right > bounds.right)) return false;
					if (["hidden", "clip"].includes(style.overflowY) && (rect.top < bounds.top || rect.bottom > bounds.bottom)) return false;
				}
				return true;
			})).toBe(true);
		}
		const human = thread.locator('[aria-label="Replies"] > div:visible').first().locator("img").first();
		const box = await human.boundingBox();
		expect(box?.width).toBe(24);
		expect(box?.height).toBe(24);
	};
	const measure = async () => {
		const toggle = thread.getByRole("button", { name: "Hide replies", exact: true });
		const avatar = thread.locator('[aria-label="Replies"] > div:visible').first().locator("img").first();
		await expect(avatar).toBeVisible();
		const toggleBox = await toggle.boundingBox();
		const avatarBox = await avatar.boundingBox();
		if (!toggleBox || !avatarBox) throw new Error("Missing reply disclosure or avatar");
		return avatarBox.y - (toggleBox.y + toggleBox.height);
	};
	for (const id of ["butter-source-comment-1", "comment-budget-breakdown"]) {
		const row = activity.locator(`[data-project-butter-activity-feed] [data-jira-activity-entry-id="${id}"]`);
		const geometry = await row.evaluate((element) => {
			const avatar = element.firstElementChild?.querySelector('[data-slot="avatar"]');
			const stem = element.firstElementChild?.querySelector("[data-jira-activity-timeline-stem]");
			const previousStem = element.previousElementSibling?.querySelector("[data-jira-activity-timeline-stem]");
			if (!avatar || !stem || !previousStem) throw new Error("Missing activity avatar or connector");
			const box = avatar.getBoundingClientRect();
			return { size: [box.width, box.height], above: box.top - previousStem.getBoundingClientRect().bottom, below: stem.getBoundingClientRect().top - box.bottom };
		});
		expect(geometry.size).toEqual([24, 24]);
		expect(geometry.above).toBeCloseTo(4, 1);
		expect(geometry.below).toBeCloseTo(4, 1);
	}
	await thread.getByRole("button", { name: /Show 4 more replies/u }).click();
	const timelineGap = await measure();
	await assertAvatarSizes();
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	await thread.getByRole("button", { name: "Show replies", exact: true }).click();
	const sessionGap = await measure();
	await assertAvatarSizes();
	expect(Math.abs(timelineGap - sessionGap)).toBeLessThanOrEqual(1);
	const geometry = (avatar: HTMLElement) => {
		const frame = avatar.getBoundingClientRect();
		const agent = avatar.querySelector<HTMLElement>('[data-avatar-role="agent"]');
		const badge = avatar.querySelector<HTMLElement>('[data-avatar-role="human"] [data-slot="avatar"]');
		if (!agent || !badge) throw new Error("Missing agent or human avatar");
		const box = badge.getBoundingClientRect();
		return { badgeX: box.x - frame.x, badgeY: box.y - frame.y, mask: getComputedStyle(agent).maskImage };
	};
	const activityGeometry = await thread.locator('[data-slot="human-agent-avatar"]').first().evaluate(geometry);
	await page.getByRole("button", { name: "Open gallery", exact: true }).click();
	await page.getByRole("button", { name: "Select List", exact: true }).click();
	const listAvatar = page.getByTestId("jira-list-horizontal-content").locator('[data-slot="human-agent-avatar"]:visible').first();
	await expect(listAvatar).toBeVisible();
	expect(await listAvatar.evaluate(geometry)).toEqual(activityGeometry);
});

test("Butter work item keeps its Timeline and drafts instructions from Agent sessions", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const switcher = activity.getByRole("tablist", { name: "Activity view" });
	const timeline = switcher.getByRole("tab", { name: "Timeline" });
	const sessions = switcher.getByRole("tab", { name: "Agent sessions" });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	await expect(timeline).toHaveAttribute("aria-selected", "true");
	await expect(thread.getByText(/Thanks. Let's include both fixes/)).toBeVisible();
	await expect(thread.locator("[data-jira-activity-timeline-stem]")).toBeVisible();
	const composer = page.locator("[data-project-butter-comment-bar]:visible");
	const editor = composer.getByRole("textbox");
	await page.keyboard.press("m");
	await editor.fill("Keep this work-item draft.");

	await sessions.click();
	const otherActivity = activity.getByRole("button", { name: "Other agent activity", exact: true });
	await expect(otherActivity).toHaveAttribute("aria-expanded", "false");
	await otherActivity.click();
	await expect(otherActivity).toHaveAttribute("aria-expanded", "true");
	await expect(activity.getByText(/Visuals are looking strong/).filter({ visible: true })).toHaveCount(0);
	await expect(thread.getByText("Thread summary", { exact: true })).toBeVisible();
	await timeline.click();
	await expect(thread.locator('[id][aria-hidden="true"][inert]').filter({ hasText: "Thread summary" })).toHaveCount(1);
	await expect(thread.getByText(/Thanks. Let's include both fixes/)).toBeVisible();
	await sessions.click();
	await thread.getByRole("button", { name: "Draft instruction" }).click();

	await expect(editor).toBeFocused();
	await expect(editor).toContainText("error summary");
	await expect(editor).not.toContainText("Keep this work-item draft.");
	await expect(composer.getByTestId("reply-target-chip")).toContainText("Review the onboarding flow");
	await composer.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(thread.getByText(/Follow up on the work-item discussion/)).toBeVisible();
	await expect(thread.getByText("👀", { exact: true })).toBeVisible();
	await expect(thread.getByRole("button", { name: "Working", exact: true })).toBeVisible();
	await page.keyboard.press("m");
	await expect(editor).toContainText("Keep this work-item draft.");
	await composer.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(timeline).toHaveAttribute("aria-selected", "true");
	await expect(activity.getByText("Keep this work-item draft.", { exact: true })).toBeVisible();
});

test("a Butter board work item can switch to Agent sessions", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	await page.locator('[data-issue-key="PAY-118"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const activity = page.getByRole("dialog", { name: "Project butter" }).getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	await expect(activity.getByText("No agent sessions yet", { exact: true })).toBeVisible();
	await activity.getByRole("tab", { name: "Timeline", exact: true }).click();
	await expect(activity.getByRole("tab", { name: "Timeline", exact: true })).toHaveAttribute("aria-selected", "true");
});
