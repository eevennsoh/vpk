import { expect, test } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost";
test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

test("auto arrange keeps generated flights at the full issue-card size", async ({ page }) => {
	await page.addInitScript(() => {
		const samples: { code: string; width: number; height: number; bodyWidth: number; bodyHeight: number }[] = [];
		Object.assign(window, { fullSizeIssueFlights: samples });
		const animate = Element.prototype.animate;
		Element.prototype.animate = function (frames, options) {
			if (this.hasAttribute("data-issue-drop-flight")) {
				const face = this.firstElementChild?.firstElementChild;
				const body = face?.querySelector('[data-slot="jira-issue-card"]');
				if (face && body) {
					const bounds = face.getBoundingClientRect();
					const card = body.getBoundingClientRect();
					samples.push({ code: this.getAttribute("data-issue-drop-flight")!, width: bounds.width, height: bounds.height, bodyWidth: card.width, bodyHeight: card.height });
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
	const flights = await page.evaluate(() => (window as typeof window & { fullSizeIssueFlights: { code: string; width: number; height: number; bodyWidth: number; bodyHeight: number }[] }).fullSizeIssueFlights);
	expect(flights).toHaveLength(codes.length);
	for (const flight of flights) {
		const source = expected.find(card => card.code === flight.code)!;
		expect({ width: flight.width, height: flight.height }).toEqual({ width: source.width, height: source.height });
		expect(flight.bodyWidth).toBe(flight.width);
		expect(flight.bodyHeight).toBe(flight.height);
	}
	await expect(page.locator('[data-jira-kanban-column="Done"] [data-issue-key]')).toHaveCount(codes.length);
	await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
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
