import { expect, test, type Page } from "@playwright/test";

const JIRA_TEAM_EU26_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/jira-team-eu26";

async function getUntrackedSessionCount(page: Page): Promise<number> {
	const label = await page.getByLabel(/^Unlink sessions,/u).getAttribute("aria-label");
	const count = Number(label?.match(/\d+/u)?.[0]);
	expect(Number.isFinite(count)).toBe(true);
	return count;
}

test("the collapsed local session icon yields to a rising count and returns when syncing pauses", async ({ page }) => {
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Expand Unlink sessions column" })).toBeVisible();
	const count = page.locator("[data-agent-session-column-count]");
	const number = count.locator("[data-agent-session-column-number]");
	const icon = count.locator("[data-agent-session-column-local-icon]");
	await page.locator("[data-agent-session-column]").hover();
	const initialPausedCount = await getUntrackedSessionCount(page);
	await expect(count).toHaveAttribute("data-agent-session-column-counter-state", "local", { timeout: 6_000 });
	await expect(icon).toHaveCSS("opacity", "1");
	await expect(number).toHaveCSS("opacity", "0");
	expect(await getUntrackedSessionCount(page)).toBe(initialPausedCount);

	await page.getByRole("heading", { name: "Jira Design" }).hover();
	const beforeSync = await getUntrackedSessionCount(page);
	await expect.poll(() => getUntrackedSessionCount(page), { timeout: 5_000 }).toBeGreaterThan(beforeSync);
	await expect(count).toHaveAttribute("data-agent-session-column-counter-state", "count");
	await expect(number).toHaveCSS("opacity", "1");
	await expect(icon).toHaveCSS("opacity", "0");

	await page.locator("[data-agent-session-column]").hover();
	const pausedCount = await getUntrackedSessionCount(page);
	await expect(count).toHaveAttribute("data-agent-session-column-counter-state", "local", { timeout: 6_000 });
	await expect(icon).toHaveCSS("opacity", "1");
	await expect(number).toHaveCSS("opacity", "0");
	expect(await getUntrackedSessionCount(page)).toBe(pausedCount);
});

test("the collapsed counter returns to the monitor three times while new sessions sync", async ({ page }) => {
	test.setTimeout(120_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.clock.install();
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
	const initialCount = await getUntrackedSessionCount(page);
	const browserNow = await page.evaluate(() => Date.now());
	await page.clock.pauseAt(new Date(browserNow + 1_000));
	await expect(page.getByRole("button", { name: "Expand Unlink sessions column" })).toBeVisible();
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	const count = page.locator("[data-agent-session-column-count]");
	const number = count.locator("[data-agent-session-column-number]");
	const icon = count.locator("[data-agent-session-column-local-icon]");

	for (const added of [8, 16, 24]) {
		const milestoneCount = initialCount + added;
		for (let step = 0; step < 80 && await getUntrackedSessionCount(page) < milestoneCount; step += 1) {
			await page.clock.runFor(1_000);
		}
		expect(await getUntrackedSessionCount(page)).toBe(milestoneCount);
		await expect(count).toHaveAttribute("data-agent-session-column-counter-state", "count");

		await page.clock.runFor(4_300);
		await expect(count).toHaveAttribute("data-agent-session-column-counter-state", "local");
		await page.clock.resume();
		await expect(count).toHaveCSS("opacity", "1");
		await expect(icon).toHaveCSS("opacity", "1");
		await expect(number).toHaveCSS("opacity", "0");
		const resumedAt = await page.evaluate(() => Date.now());
		await page.clock.pauseAt(new Date(resumedAt + 1_000));
		for (let step = 0; step < 20 && await getUntrackedSessionCount(page) === milestoneCount; step += 1) {
			await page.clock.runFor(1_000);
		}
		expect(await getUntrackedSessionCount(page)).toBeGreaterThan(milestoneCount);
	}
});
