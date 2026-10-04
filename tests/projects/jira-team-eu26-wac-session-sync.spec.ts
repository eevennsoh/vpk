import { expect, test } from "@playwright/test";
import { appUrl } from "../helpers/origin";

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1720, height: 1100 } });

for (const expanded of [true, false]) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`WAC sessions arrive and change state like the original (${expanded ? "expanded" : "collapsed"}, ${reducedMotion})`, async ({ page }) => {
			const advance = async (milliseconds: number) => {
				for (let elapsed = 0; elapsed < milliseconds; elapsed += 1_000) {
					await page.clock.runFor(Math.min(1_000, milliseconds - elapsed));
				}
			};
			await page.emulateMedia({ reducedMotion });
			await page.goto(appUrl("/jira-team-eu26"));
			await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Settings", exact: true }).click();
			await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
			const column = page.getByLabel(/^Unlink sessions,/);
			await expect(column).toHaveAttribute("aria-label", "Unlink sessions, 16 sessions");
			if (expanded) await page.getByRole("button", { name: "Expand Unlink sessions column", exact: true }).click();
			await column.hover();
			await page.clock.install({ time: new Date(await page.evaluate(() => Date.now())) });
			await page.evaluate(() => { Math.random = () => 0; });
			await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 250));
			await page.getByRole("heading", { name: "Checkout roadmap", exact: true }).click();
			await advance(1_800);
			const session = page.getByTestId(`agent-session-${expanded ? "row" : "notch"}-wac:lw-sync-webhook-gap`);
			await expect(session).toHaveCount(1);
			await expect(column).toHaveAttribute("aria-label", "Unlink sessions, 17 sessions");
			await advance(3_000);
			if (expanded) await expect(session.getByRole("img", { name: "Needs input", exact: true })).toBeVisible();
			else await expect(session.locator('[data-agent-session-state-mark="needs-input"]')).toHaveCount(1);
			await advance(4_000);
			if (expanded) await expect(session.getByRole("img", { name: "Finished", exact: true })).toBeVisible();
			else await expect(session.locator('[data-agent-session-state-mark="complete"]')).toHaveCount(1);
			await column.hover();
			const pausedCount = await column.getAttribute("aria-label");
			await advance(10_000);
			await expect(column).toHaveAttribute("aria-label", pausedCount!);
			await page.getByRole("heading", { name: "Checkout roadmap", exact: true }).click();
			await advance(6_000);
			const resumedCount = await column.getAttribute("aria-label");
			expect(Number(resumedCount?.match(/\d+/)?.[0])).toBeGreaterThan(Number(pausedCount?.match(/\d+/)?.[0]));
			await expect(page.locator('img[src*="/avatar-user/venn/"]')).toHaveCount(0);
			await page.screenshot({ path: `output/agent-browser/wac-session-parity/${expanded ? "expanded" : "collapsed"}-${reducedMotion}.png` });
		});
	}
}
