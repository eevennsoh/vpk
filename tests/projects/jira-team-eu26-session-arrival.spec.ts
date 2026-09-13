import { expect, test } from "@playwright/test";

const BOARD_URL = (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000") + "/jira-team-eu26";

test("Needs input preserves the timeline and never replays arrivals across modes", async ({ page }) => {
	await page.clock.install();
	await page.goto(BOARD_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
	await page.getByRole("button", { name: "Unlink sessions column options" }).click();
	await page.getByRole("menuitem", { name: "Expand", exact: true }).click();
	await expect(page.locator("[data-agent-session-column-expansion]"))
		.toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await page.getByRole("heading", { name: "Jira Design" }).hover();
	const column = page.locator("[data-agent-session-column]");
	await expect.poll(() => column.locator('[data-testid^="agent-session-row-"]').count()).toBeGreaterThan(16);
	await page.clock.pauseAt(new Date(Date.now() + 100));
	const originalColumn = await column.elementHandle();
	const enteredIds = await column.locator('[data-testid^="agent-session-row-"]').evaluateAll(
		(rows) => rows.map((row) => row.getAttribute("data-testid")!.replace("agent-session-row-", "")),
	);
	expect(enteredIds.length).toBeGreaterThan(16);
	const filter = page.getByRole("button", { name: "Needs input: 1 agent" });
	for (let toggle = 0; toggle < 4; toggle += 1) {
		await filter.click();
		await page.clock.runFor(100);
		expect(await originalColumn!.evaluate((element) => element.isConnected)).toBe(true);
		const replayedIds = await column.locator('[data-arrival-reveal="true"]').evaluateAll(
			(faces) => faces.map((face) => face.closest("[data-agent-session-notch]")?.getAttribute("data-testid")?.replace("agent-session-notch-", "")),
		);
		expect(replayedIds.filter((id) => id !== undefined && enteredIds.includes(id))).toEqual([]);
	}
});
