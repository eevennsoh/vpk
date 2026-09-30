import { expect, test, type Locator, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const JIRA_LINKING_URL = appUrl("/components/blocks/jira-linking");

async function dragSessionToCard(page: Page, source: Locator, target: Locator) {
	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	if (!sourceBox || !targetBox) throw new Error("Missing Glow drag source or Jira target");

	await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2);
	await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
	await page.mouse.up();
}

test("Glow halo remains attached to the moving Jira issue surface", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_LINKING_URL);

	const stage = page.locator('section[aria-label="Glow"]');
	await stage.scrollIntoViewIfNeeded();
	const source = stage.locator('article[role="gridcell"]').first();
	const target = stage.locator('[data-jira-linking-card-state="empty"] [data-slot="jira-issue-agent-shell"]');
	await dragSessionToCard(page, source, target);

	await expect(page.locator("[data-jira-linking-glow-halo]")).toHaveCount(1);
	const result = await page.evaluate(async () => {
		const offsets: Array<{ height: number; left: number; top: number; width: number }> = [];
		let parentSlot: string | null = null;
		for (let frame = 0; frame < 30; frame += 1) {
			const halo = document.querySelector<HTMLElement>("[data-jira-linking-glow-halo]");
			const surface = halo?.parentElement;
			if (halo && surface) {
				parentSlot ??= halo.parentElement?.getAttribute("data-slot") ?? null;
				const haloRect = halo.getBoundingClientRect();
				const surfaceRect = surface.getBoundingClientRect();
				offsets.push({
					height: haloRect.height - surfaceRect.height,
					left: haloRect.left - surfaceRect.left,
					top: haloRect.top - surfaceRect.top,
					width: haloRect.width - surfaceRect.width,
				});
			}
			await new Promise((resolve) => window.setTimeout(resolve, 20));
		}
		return {
			maxHeight: Math.max(...offsets.map(({ height }) => Math.abs(height))),
			maxLeft: Math.max(...offsets.map(({ left }) => Math.abs(left))),
			maxTop: Math.max(...offsets.map(({ top }) => Math.abs(top))),
			maxWidth: Math.max(...offsets.map(({ width }) => Math.abs(width))),
			parentSlot,
		};
	});

	expect(result.parentSlot).toBe("jira-issue-surface");
	expect(result.maxHeight).toBeLessThan(1.5);
	expect(result.maxLeft).toBeLessThan(1.5);
	expect(result.maxTop).toBeLessThan(1.5);
	expect(result.maxWidth).toBeLessThan(1.5);
});

test("Glow demonstrates linking into running and empty Jira cards", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_LINKING_URL);

	const stage = page.locator('section[aria-label="Glow"]');
	await stage.scrollIntoViewIfNeeded();
	const activeCard = stage.locator('[data-jira-linking-card-state="active"]');
	const emptyCard = stage.locator('[data-jira-linking-card-state="empty"]');
	await expect(activeCard.getByText("Agent session already running", { exact: true })).toBeVisible();
	await expect(emptyCard.getByText("No agent session yet", { exact: true })).toBeVisible();
	await expect(activeCard.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(1);
	await expect(emptyCard.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(0);

	await dragSessionToCard(
		page,
		stage.locator('article[role="gridcell"]').first(),
		activeCard.locator('[data-slot="jira-issue-agent-shell"]'),
	);
	await expect(stage.getByText("1 session linked — reset to compare again", { exact: true })).toBeVisible();
	await expect(activeCard.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(1);
	await expect(emptyCard.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(0);
	await expect(stage.locator(".jira-issue-link-flash")).toHaveCount(0);

	await dragSessionToCard(
		page,
		stage.locator('article[role="gridcell"]').first(),
		emptyCard.locator('[data-slot="jira-issue-agent-shell"]'),
	);
	await expect(stage.getByText("2 sessions linked — reset to compare again", { exact: true })).toBeVisible();
	await expect(activeCard.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(1);
	await expect(emptyCard.locator('[data-slot="jira-issue-agent-row"]')).toHaveCount(1);
	await expect(stage.locator(".jira-issue-link-flash")).toHaveCount(0);
});
