import { expect, test } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost";
test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

test("auto arrange unfolds full-size issue cards in their committed slots", async ({ page }) => {
	await page.addInitScript(() => {
		const samples: { code: string; width: number; height: number }[] = [];
		Object.assign(window, { fullSizeIssueDrops: samples });
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (frames, options) {
			if (this.closest("[data-issue-drop-trace]")) {
				for (const node of document.querySelectorAll('[data-jira-kanban-column="Done"] [data-slot="jira-issue-card"]')) {
					const { width, height } = node.getBoundingClientRect();
					samples.push({ code: node.closest('[data-issue-key]')!.getAttribute("data-issue-key")!, width, height });
				}
			}
			return animate.call(this, frames, options);
		};
	});
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
	const codes = ["TEU-1", "TEU-2", "TEU-3"];
	const expected = await page.locator('[data-jira-kanban-column="Context"] [data-slot="jira-issue-card"]').evaluateAll(nodes => nodes.map(node => {
		const { width, height } = node.getBoundingClientRect();
		return { code: node.closest('[data-issue-key]')!.getAttribute("data-issue-key")!, width, height };
	}));
	for (const code of codes) await page.locator(`[data-issue-key="${code}"] [draggable]`).first().click({ modifiers: ["Meta"] });
	await expect(page.locator('[data-issue-key="TEU-1"] [data-slot="jira-issue-cover"]')).toHaveCSS("clip-path", "inset(4px 4px 0px round 7px 7px 0px 0px)");
	await page.getByRole("button", { name: "Auto arrange", exact: true }).click();
	const done = page.locator('[data-jira-kanban-column="Done"]');
	await expect(done.locator("[data-issue-key]")).toHaveCount(codes.length);
	// Auto arrange may scroll the destination, which deliberately cancels its
	// decoration. Capture geometry when the drop effect starts, before that scroll.
	const cards = await page.evaluate(() => (window as typeof window & { fullSizeIssueDrops: { code: string; width: number; height: number }[] }).fullSizeIssueDrops);
	expect(cards.map(card => card.code)).toEqual(codes);
	for (const card of cards) {
		const source = expected.find(source => source.code === card.code)!;
		expect(card.width).toBeCloseTo(source.width, 1);
		expect(card.height).toBeCloseTo(source.height, 1);
	}
	await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
	await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(0);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`keynote auto arrange sends all work items to Done (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26-end`);
		await page.getByRole("button", { name: "Create in Context", exact: true }).click();
		const name = page.getByRole("textbox", { name: "Name this work item", exact: true });
		await name.fill("New keynote item");
		await name.press("Enter");
		await expect(page.locator('[data-jira-kanban-scrollport] [data-issue-key]')).toHaveCount(14);
		await page.locator('[data-issue-key="TEU-1"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		// Opposite outer corners span all columns before the scoped toolbar expansion.
		await page.locator('[data-issue-key="TEU-13"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await page.getByRole("button", { name: "Select all", exact: true }).click();
		const arrange = page.getByRole("button", { name: "Auto arrange", exact: true });
		await expect(arrange).toBeEnabled();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-auto-arrange-count]')).toHaveAttribute("data-auto-arrange-count", "14");
		await arrange.click();
		const done = page.locator('[data-jira-kanban-column="Done"]');
		await expect(done.locator("[data-issue-key]")).toHaveCount(14);
		for (const title of ["Context", "Collaboration", "Confidence"]) {
			await expect(page.locator(`[data-jira-kanban-column="${title}"] [data-issue-key]`)).toHaveCount(0);
		}
		await expect(done.getByText("New keynote item", { exact: true })).toBeVisible();
		await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
		await expect(arrange).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/keynote-auto-arrange/done-${reducedMotion}.png` });
	});
}
