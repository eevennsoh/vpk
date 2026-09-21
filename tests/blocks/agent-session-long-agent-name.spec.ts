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

test("assignment metadata truncates before lifecycle controls", async ({ page }) => {
	const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
	await page.goto(`${origin}/components/blocks/agent-assignment`, { waitUntil: "domcontentloaded" });
	const editAgents = page.locator("#preview").getByRole("button", { name: "Edit agents", exact: true });
	await editAgents.click();
	const rows = page.locator('[aria-label="Agent assignment"] article');
	await expect(rows).toHaveCount(4);

	for (const viewportWidth of [1440, 900]) {
		await page.setViewportSize({ width: viewportWidth, height: 900 });
		for (const row of await rows.all()) {
			const metadataEnd = await row.locator('span[title="Last update"]').boundingBox();
			const status = await row.getByRole("button", { name: /^(Working|Needs input|Finished)$/ }).boundingBox();
			if (metadataEnd === null || status === null) {
				throw new Error("Session metadata and status must be visible");
			}
			expect(metadataEnd.x + metadataEnd.width).toBeLessThanOrEqual(status.x - 4);
		}
		const longName = rows.filter({ hasText: "Release Notes Drafter" }).locator('span[title="Release Notes Drafter"]');
		const widths = await longName.evaluate((node) => ({ available: node.clientWidth, content: node.scrollWidth }));
		expect(widths.available).toBeGreaterThan(0);
		expect(widths.available).toBeLessThan(widths.content);
	}
});
