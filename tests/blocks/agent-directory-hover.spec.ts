import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

test("featured lanyard remains visible when it tilts beyond its resting edge", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-directory"));
	const hero = page.getByRole("article", { name: "Jira Coding Agent recommendation" });
	const card = hero.locator('[data-slot="agent-lanyard-surface"]');
	await expect(hero.getByText("Analyses work items and proposes a world class coding approach to deliver", { exact: true })).toHaveCount(1);
	await hero.getByRole("button", { name: "View Jira Coding Agent" }).hover();
	await page.waitForTimeout(250);
	expect(await hero.evaluate((element) => element.scrollTop)).toBe(0);
	const visiblePoints = await card.evaluate((surface) => {
		const clip = surface.parentElement?.parentElement?.getBoundingClientRect();
		if (!clip) return 0;
		let visiblePoints = 0;
		for (let y = clip.top + 5; y < clip.bottom - 5; y += 2) {
			for (let x = clip.left - 8; x <= clip.left - 1; x += 0.5) {
				const hit = document.elementFromPoint(x, y);
				if (hit && surface.contains(hit)) visiblePoints++;
			}
		}
		return visiblePoints;
	});
	expect(visiblePoints).toBeGreaterThan(0);
});

test("hover elevation does not add a second card outline", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-directory"));
	const card = page.locator('[data-agent-id="claude"] [data-slot="agent-lanyard-surface"]');
	const body = card.locator(":scope > div:last-child");
	const bodyTop = await body.evaluate((element) => (element as HTMLElement).offsetTop);
	await expect(card).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await page.getByRole("button", { name: "View Claude" }).hover();
	await expect(card).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(card).not.toHaveCSS("box-shadow", "none");
	const cover = card.locator(':scope > div[aria-hidden="true"]');
	const geometry = await card.evaluate((surface) => {
		const header = surface.querySelector<HTMLElement>(':scope > div[aria-hidden="true"]');
		if (!(surface instanceof HTMLElement) || !header) return null;
		return { surfaceWidth: surface.offsetWidth, coverWidth: header.offsetWidth, coverLeft: header.offsetLeft, coverTop: header.offsetTop };
	});
	await expect(cover).toBeVisible();
	expect(geometry).not.toBeNull();
	expect(geometry?.coverWidth).toBe(geometry?.surfaceWidth);
	expect(geometry?.coverLeft).toBe(-1);
	expect(geometry?.coverTop).toBe(-1);
	expect(await body.evaluate((element) => (element as HTMLElement).offsetTop)).toBe(bodyTop);
});

test("the lanyard grid wave remains visible after the original short hover duration", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-directory"));
	const lines = page.locator('[data-agent-id="claude"] [data-slot="agent-lanyard-grid-lines"]');
	const restingPath = await lines.getAttribute("d");
	await page.getByRole("button", { name: "View Claude" }).hover();
	await page.waitForTimeout(250);
	expect(await lines.getAttribute("d")).not.toBe(restingPath);
	await expect.poll(() => lines.getAttribute("d"), { timeout: 1500 }).toBe(restingPath);
});

test("reduced motion keeps the directory grid still on hover", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/preview/blocks/agent-directory"));
	const grid = page.locator('[data-agent-id="claude"] [data-slot="agent-lanyard-grid"]');
	const lines = grid.locator('[data-slot="agent-lanyard-grid-lines"]');
	const restingPath = await lines.getAttribute("d");
	await page.getByRole("button", { name: "View Claude" }).hover();
	await expect(grid).toHaveAttribute("data-animated", "false");
	await page.waitForTimeout(250);
	expect(await lines.getAttribute("d")).toBe(restingPath);
});
