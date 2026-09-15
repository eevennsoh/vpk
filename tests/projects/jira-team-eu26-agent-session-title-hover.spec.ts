import { expect, test } from "@playwright/test";

const JIRA_TEAM_EU26_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/jira-team-eu26";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`session row backgrounds follow rapid hover without fading (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: "Expand Unlink sessions column", exact: true }).click();
		const rows = page.locator("[data-agent-session-column] article");
		await expect(rows.first()).toBeVisible();
		await rows.first().hover();
		await expect.poll(async () => (await rows.first().boundingBox())?.width).toBe(270);

		for (const index of [1, 2, 0, 1, 0]) {
			const row = rows.nth(index);
			// Arm before moving: polling only after the transition settles misses
			// the transparent frames that flash as the pointer enters each row.
			await row.evaluate((element) => {
				element.removeAttribute("data-hover-background-samples");
				const samples: string[] = [];
				element.addEventListener("pointerenter", () => {
					const sample = () => {
						samples.push(getComputedStyle(element).backgroundColor);
						element.setAttribute("data-hover-background-samples", JSON.stringify(samples));
						if (samples.length < 8) requestAnimationFrame(sample);
					};
					requestAnimationFrame(sample);
				}, { once: true });
			});
			await row.hover({ position: { x: 220, y: 30 } });
			await expect.poll(async () => JSON.parse(
				await row.getAttribute("data-hover-background-samples") ?? "[]",
			).length).toBe(8);
			const samples = JSON.parse(await row.getAttribute("data-hover-background-samples") ?? "[]");
			const hoveredColor = await row.evaluate((element) => {
				const probe = document.createElement("span");
				probe.style.backgroundColor = "var(--ds-surface-hovered)";
				element.append(probe);
				const color = getComputedStyle(probe).backgroundColor;
				probe.remove();
				return color;
			});
			expect(samples).toEqual(Array(8).fill(hoveredColor));
			expect(await row.evaluate((element) => element.matches(":hover"))).toBe(true);
		}
	});
}

test("long session titles stay one line while revealing actions", async ({ page }) => {
	await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({
		timeout: 15_000,
	});
	const row = page.getByTestId("agent-session-row-lw-rehearsal-pager-session");
	if (!await row.isVisible()) {
		await page
			.getByRole("button", { name: "Expand Unlink sessions column", exact: true })
			.click();
	}
	await expect(row).toBeVisible();
	await row.scrollIntoViewIfNeeded();
	const article = row.locator("article");
	const title = row.locator("[data-agent-list-title]");
	const actions = row.locator("[data-agent-list-card-actions]");
	const actionButton = row.getByRole("button", {
		name: /^More actions for How to hold the pager/u,
	});
	const restingRowBox = await row.boundingBox();
	const restingTitleBox = await title.boundingBox();
	expect(restingRowBox).not.toBeNull();
	expect(restingTitleBox).not.toBeNull();
	if (!restingRowBox || !restingTitleBox) return;

	expect(restingTitleBox.height).toBe(20);
	await expect(title).toHaveCSS("white-space", "nowrap");
	await expect(title).toHaveCSS("text-overflow", "ellipsis");
	await expect(actions).toHaveCSS("position", "absolute");
	await expect(actions).toHaveCSS("opacity", "0");
	await page.mouse.move(
		restingTitleBox.x + restingTitleBox.width / 2,
		restingTitleBox.y + restingTitleBox.height / 2,
	);
	await expect(title).toBeVisible();
	await expect(title).toHaveCSS("opacity", "1");
	await expect(title).toHaveCSS("white-space", "nowrap");
	await expect(title).toHaveCSS("text-overflow", "ellipsis");
	await expect(actions).toHaveCSS("opacity", "1");
	expect((await title.boundingBox())?.width).toBeLessThan(restingTitleBox.width);
	await expect(actionButton).toBeVisible();
	const hoveredArticleBox = await article.boundingBox();
	const actionButtonBox = await actionButton.boundingBox();
	expect(hoveredArticleBox).not.toBeNull();
	expect(actionButtonBox).not.toBeNull();
	if (!hoveredArticleBox || !actionButtonBox) return;
	expect(
		Math.abs(
			hoveredArticleBox.y + hoveredArticleBox.height / 2
				- (actionButtonBox.y + actionButtonBox.height / 2),
		),
	).toBeLessThanOrEqual(1);
	expect(await article.evaluate((element) => element.matches(":hover"))).toBe(true);
	expect((await row.boundingBox())?.height).toBe(restingRowBox.height);
	await page.waitForTimeout(200);
	expect(await article.evaluate((element) => element.matches(":hover"))).toBe(true);
});
