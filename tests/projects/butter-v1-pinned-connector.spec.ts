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
		if (view === "Agent sessions") await activity.getByRole("button", { name: "Agent sessions", exact: true }).click();
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
		await expect(stem).toHaveCSS("border-left-style", "dashed");
		const separator = activity.locator('[data-jira-activity-group-separator]:visible');
		await expect(separator).toHaveCount(1);
		await expect(separator).toHaveText("1 pinned");
		await expect(separator).toHaveCSS("border-top-style", "dashed");
		await expect(separator).toHaveCSS("border-top-color", await stem.evaluate((node) => getComputedStyle(node).borderLeftColor));
		await expect(stem).toHaveCSS("mask-image", /linear-gradient/u);
		await expect(summaryBranch).toBeHidden();
		await thread.getByRole("button", { name: /^Show \d+ replies/u }).click();
		await expect(stem).toHaveCSS("background-image", "none");
		await expect(thread.locator("[data-jira-activity-thread-branch]:visible").first()).toBeVisible();
		await expect(summaryBranch).toBeVisible();
		await thread.getByRole("button", { name: "Hide replies", exact: true }).click();
		await expect(stem).toHaveCSS("border-left-style", "dashed");
		await expect(summaryBranch).toBeHidden();
		await thread.getByRole("button", { name: "Unpin comment", exact: true }).click();
		await expect(separator).toHaveCount(0);
		await expect(stem).toHaveCSS("background-image", "none");
		await expect(summaryBranch).toBeVisible();
	}
});

test("pinned separator has equal breathing room around it", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	await thread.hover();
	await thread.getByRole("button", { name: "Pin comment", exact: true }).click();
	const gaps = await thread.locator("[data-jira-activity-group-separator]").evaluate((line) => {
		const row = line.closest("li");
		const label = row?.querySelector("[data-jira-activity-replies-disclosure] button");
		const next = row?.nextElementSibling;
		if (!label || !next) throw new Error("Pinned group boundaries are missing");
		return [line.getBoundingClientRect().top - label.getBoundingClientRect().bottom, next.getBoundingClientRect().top - line.getBoundingClientRect().bottom];
	});
	expect(gaps[0]).toBeGreaterThanOrEqual(30);
	expect(Math.abs(gaps[1] - gaps[0])).toBeLessThanOrEqual(1);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) test(`reply participants return when replies collapse (${reducedMotion})`, async ({ page }) => {
	await page.emulateMedia({ reducedMotion });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	const show = thread.getByRole("button", { name: /^Show \d+ replies/u });
	await expect(show.locator("[data-reply-participant-avatar]")).toHaveCount(2);
	const overlap = await show.locator('[data-slot="avatar-group"]').evaluate((group) => {
		const [first, second] = [...group.children].map((node) => node.getBoundingClientRect());
		return first.right - second.left;
	});
	expect(overlap).toBeGreaterThan(0);
	await show.click();
	const hide = thread.getByRole("button", { name: "Hide replies", exact: true });
	const stagger = reducedMotion === "no-preference" ? thread.evaluate(async (element) => {
		const button = [...element.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Hide replies"));
		if (!button) throw new Error("Reply disclosure is missing");
		await new Promise<void>((resolve) => button.addEventListener("click", () => resolve(), { once: true, capture: true }));
		const start = performance.now();
		while (performance.now() - start < 500) {
			const avatars = element.querySelectorAll<HTMLElement>("[data-reply-participant-avatar]");
			if (avatars.length > 1 && Number(getComputedStyle(avatars[0]).opacity) > Number(getComputedStyle(avatars[1]).opacity) + 0.05) return true;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return false;
	}) : undefined;
	await hide.click();
	const avatars = show.locator("[data-reply-participant-avatar]");
	await expect(avatars).toHaveCount(2);
	if (reducedMotion === "no-preference") {
		expect(await stagger).toBe(true);
	}
	await expect(avatars.last()).toHaveCSS("opacity", "1");
});
