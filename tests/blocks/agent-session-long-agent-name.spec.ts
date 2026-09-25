import { expect, test } from "@playwright/test";

const AGENT_SESSION_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/components/blocks/agent-session";

test("cloud long metadata stays together before the lifecycle controls", async ({ page }) => {
	await page.goto(`${AGENT_SESSION_URL}#cloud-—-long`, { waitUntil: "domcontentloaded" });
	const cloudLong = page.getByRole("heading", { name: "Cloud — long" }).locator("xpath=../../..");
	const rows = cloudLong.locator('[data-testid^="agent-session-row-"]');
	await expect(rows).toHaveCount(7);

	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		await page.emulateMedia({ reducedMotion });
		for (const viewportWidth of [1440, 900]) {
			await page.setViewportSize({ width: viewportWidth, height: 900 });
			for (const row of await rows.all()) {
				const timestamp = row.locator('span[title="Last update"]');
				await expect(timestamp).toBeVisible();
				const gaps = await timestamp.evaluate((node) => {
					const metadata = node.parentElement?.parentElement?.parentElement;
					if (metadata === null || metadata === undefined) throw new Error("Missing metadata line");
					const segments = Array.from(metadata.children);
					return segments.slice(1).map((segment, index) => {
						const previousContent = segments[index].lastElementChild;
						const separator = segment.firstElementChild;
						if (previousContent === null || separator === null) throw new Error("Missing metadata segment");
						return separator.getBoundingClientRect().left - previousContent.getBoundingClientRect().right;
					});
				});
				for (const gap of gaps) {
					expect(gap, `Metadata separates at ${viewportWidth}px (${reducedMotion})`).toBeGreaterThanOrEqual(3);
					expect(gap, `Metadata separates at ${viewportWidth}px (${reducedMotion})`).toBeLessThanOrEqual(5);
				}
			}
		}
	}
});

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

test("assignment metadata truncates before lifecycle and privacy controls", async ({ page }) => {
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
			const status = await row.getByRole("button", {
				name: /^(Working|Needs input|Finished|Someone is using an agent\. Only they can see the work\.)$/u,
			}).boundingBox();
			if (metadataEnd === null || status === null) {
				throw new Error("Session metadata and trailing control must be visible");
			}
			expect(metadataEnd.x + metadataEnd.width).toBeLessThanOrEqual(status.x - 4);
		}
		const longName = rows.filter({ hasText: "Release Notes Drafter" }).locator('span[title="Release Notes Drafter"]');
		const widths = await longName.evaluate((node) => ({ available: node.clientWidth, content: node.scrollWidth }));
		expect(widths.available).toBeGreaterThan(0);
		expect(widths.available).toBeLessThan(widths.content);
	}
});
