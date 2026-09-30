import { expect, test } from "@playwright/test";

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1720, height: 1100 } });

test("WAC finishes review sessions after one minute without moving their cards", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.clock.install();
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
	await page.clock.fastForward(90_000);
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Checkout roadmap", exact: true })).toBeVisible();
	const integration = page.getByRole("region", { name: "In progress work items", exact: true }).locator('[data-issue-key="PAY-105"]');
	await expect(integration.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(0);
	const review = page.getByRole("region", { name: "In review work items", exact: true });
	await page.clock.fastForward(55_000);
	for (const code of ["PAY-115", "PAY-119"]) {
		await expect(review.locator(`[data-issue-key="${code}"]`).getByRole("button", { name: "Cursor: Working", exact: true })).toBeVisible();
	}
	await page.clock.fastForward(6_000);
	for (const code of ["PAY-115", "PAY-119"]) {
		const card = review.locator(`[data-issue-key="${code}"]`);
		await expect(card.getByRole("button", { name: "Cursor: Finished", exact: true })).toBeVisible();
		await expect(card.getByRole("button", { name: "Cursor: Working", exact: true })).toHaveCount(0);
	}
	await expect.poll(() => review.locator("[data-issue-key]").evaluateAll((cards) => cards.map((card) => card.getAttribute("data-issue-key"))))
		.toEqual(["PAY-112", "PAY-115", "PAY-119"]);
	await expect(review.getByRole("button", { name: "GitHub Copilot: Needs input", exact: true })).toBeVisible();
	await page.screenshot({ path: "output/agent-browser/wac-content/review-agents-finished.png" });
});

test("WAC review completion animates only the status icon and preserves compact agent avatars", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	// Shorten only the demo's minute-long completion wait; keep Motion's native clock untouched.
	await page.addInitScript(() => {
		const nativeSetTimeout = window.setTimeout.bind(window);
		Object.defineProperty(window, "setTimeout", {
			configurable: true,
			writable: true,
			value: (handler: TimerHandler, delay?: number, ...args: unknown[]) => nativeSetTimeout(handler, delay !== undefined && delay > 59_000 && delay <= 60_000 ? 2_500 : delay, ...args),
		});
	});
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Checkout roadmap", exact: true })).toBeVisible();
	const review = page.getByRole("region", { name: "In review work items", exact: true });
	const rows = ["PAY-115", "PAY-119"].map((code) => review.locator(`[data-issue-key="${code}"] [data-slot="jira-issue-agent-row"]`));
	const before = await Promise.all(rows.map((row) => row.elementHandle()));
	for (const row of rows) {
		await expect(row.locator('[data-slot="human-agent-avatar"]')).toHaveCount(0);
		const avatar = row.locator('[data-slot="avatar"]');
		await expect(avatar).toHaveCount(1);
		const bounds = await avatar.boundingBox();
		expect(bounds).toMatchObject({ width: 20, height: 20 });
		await expect(row).toContainText("Working");
	}
	await review.evaluate((element) => {
		for (const code of ["PAY-115", "PAY-119"]) {
			const row = element.querySelector<HTMLElement>(`[data-issue-key="${code}"] [data-slot="jira-issue-agent-row"]`)!;
			const avatar = row.querySelector<HTMLElement>('[data-slot="avatar"]')!;
			const sample = () => {
				const status = row.querySelector<HTMLElement>('[data-agent-session-lifecycle-current="complete"]');
				const glyph = status?.firstElementChild;
				if (glyph && getComputedStyle(glyph).transform !== "none") {
					row.dataset.observedStatusAnimation = "true";
				}
				if (getComputedStyle(avatar).transform !== "none" || avatar.getAnimations({ subtree: true }).length > 0) {
					row.dataset.observedAvatarAnimation = "true";
				}
				if (row.isConnected && row.dataset.observedStatusAnimation !== "true") requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		}
	});
	for (const [index, row] of rows.entries()) {
		await expect(row.getByRole("button", { name: "Cursor: Finished", exact: true })).toBeVisible();
		await expect(row.locator('[data-agent-session-lifecycle-current="complete"][data-agent-session-lifecycle-shown="complete"]')).toBeVisible();
		await expect(row).toHaveAttribute("data-observed-status-animation", "true");
		await expect(row).not.toHaveAttribute("data-observed-avatar-animation", "true");
		await expect(row.locator('[data-slot="human-agent-avatar"]')).toHaveCount(0);
		expect(await row.locator('[data-slot="avatar"]').boundingBox()).toMatchObject({ width: 20, height: 20 });
		const after = await row.elementHandle();
		expect(await before[index]!.evaluate((original, current) => original === current, after)).toBe(true);
	}
	await page.screenshot({ path: "output/agent-browser/side-wac-state-transition/review-finished.png" });
});
