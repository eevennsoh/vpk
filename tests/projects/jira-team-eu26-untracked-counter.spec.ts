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
