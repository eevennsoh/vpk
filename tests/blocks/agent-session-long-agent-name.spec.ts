import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const AGENT_SESSION_URL = appUrl("/components/blocks/agent-session");

test("compact session and assignment status glyphs are 12px", async ({ page }) => {
	await page.goto(AGENT_SESSION_URL, { waitUntil: "domcontentloaded" });
	for (const section of ["Local — short", "Cloud — short"]) {
		const example = page.getByRole("heading", { name: section }).locator("xpath=../../..");
		const info = example.getByRole("button", { name: "Someone is using an agent. Only they can see the work." }).locator("svg");
		await expect(info).toHaveCSS("width", "12px");
		await expect(info).toHaveCSS("height", "12px");
	}
	const local = page.getByRole("heading", { name: "Local — short" }).locator("xpath=../../..");
	const finished = local.getByRole("img", { name: "Finished" }).locator("svg");
	await expect(finished).toHaveCSS("width", "12px");
	await expect(finished).toHaveCSS("height", "12px");

	await page.goto(appUrl("/components/blocks/agent-assignment"), { waitUntil: "domcontentloaded" });
	await page.locator("#preview").getByRole("button", { name: "Edit agents", exact: true }).click();
	const menu = page.locator('[aria-label="Agent assignment"]');
	for (const name of ["Finished", "Needs input", "Someone is using an agent. Only they can see the work."]) {
		const icon = menu.getByRole("button", { name, exact: true }).locator("svg");
		await expect(icon).toHaveCSS("width", "12px");
		await expect(icon).toHaveCSS("height", "12px");
	}
	const working = menu.getByRole("button", { name: "Working", exact: true }).locator('[data-slot="spinner"]');
	await expect(working).toHaveCSS("width", "16.75px");
	await expect(working).toHaveCSS("height", "16.75px");
});

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
	await page.goto(appUrl("/components/blocks/agent-assignment"), { waitUntil: "domcontentloaded" });
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
