import { expect, test } from "@playwright/test";

const AGENT_SESSION_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/components/blocks/agent-session";

test("local long metadata keeps the full agent name visible", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(AGENT_SESSION_URL, { waitUntil: "domcontentloaded" });
	const localLong = page.getByRole("heading", { name: "Local — long" }).locator("xpath=../../..");

	for (const viewportWidth of [1440, 900]) {
		await page.setViewportSize({ width: viewportWidth, height: 900 });
		for (const [id, name] of [
			["lw-scope-thread", "Claude"],
			["lw-kickoff-killswitch-session", "Cursor"],
			["lw-night-suite-session", "Rovo"],
		] as const) {
			const labels = localLong.getByTestId(`agent-session-row-${id}`).locator(`span[title="${name}"]`);
			await expect(labels).toHaveCount(2);
			for (const label of await labels.all()) {
				await expect(label).toBeVisible();
				const width = await label.evaluate((node) => ({
					available: node.clientWidth,
					content: node.scrollWidth,
				}));
				expect(width.available, `${name} is truncated at ${viewportWidth}px`).toBeGreaterThanOrEqual(width.content);
			}
		}
	}
});
