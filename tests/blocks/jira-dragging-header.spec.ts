import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`drag headers cycle vertically with soft entry and exit fades (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/components/blocks/jira-dragging"));
		await page.waitForLoadState("networkidle");
		const headers = page.locator('[data-slot="board-column-header"]');
		await expect(headers).toHaveCount(4);
		await expect(headers.locator("[data-board-column-count]")).toHaveCount(4);
		const before = await headers.evaluateAll((nodes) => nodes.map((node) => {
			const range = document.createRange();
			range.selectNodeContents(node.querySelector('[data-board-column-header-copy-layer="add"]')!);
			return { left: range.getBoundingClientRect().x, height: node.getBoundingClientRect().height };
		}));
		await page.evaluate(() => {
			const sample = () => {
				for (const label of document.querySelectorAll<HTMLElement>('[data-board-column-header-copy-layer], [data-board-column-destination-copy-layer]')) {
					const destination = label.hasAttribute("data-board-column-destination-copy-layer");
					const labelOpacity = Number(getComputedStyle(label).opacity);
					const y = new DOMMatrix(getComputedStyle(label).transform).m42;
					if (Math.abs(y) > 0.01) document.documentElement.dataset.headerVerticalCycleSeen = "true";
					if (labelOpacity > 0 && labelOpacity < 1) {
						if (!destination && y > 0) document.documentElement.dataset.headerEntryFadeSeen = "true";
						if (!destination && y < 0 && label.getAttribute("aria-hidden") === "true") document.documentElement.dataset.headerExitFadeSeen = "true";
						if (destination && y > 0 && label.closest<HTMLElement>("[data-jira-kanban-column]")?.dataset.jiraKanbanColumn === "In progress") document.documentElement.dataset.destinationEntryFadeSeen = "true";
					}
				}
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		const card = page.locator('[data-issue-key="PAY-105"] [draggable="true"]').first();
		const source = (await card.boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await expect(card).toHaveAttribute("data-dragging", "true");
		await expect(headers.locator("[data-board-column-count]")).toHaveCount(0);
		for (const header of await headers.all()) {
			const label = header.locator('[data-board-column-header-copy-layer="label"]');
			await expect.poll(() => label.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m42)).toBe(0);
			await expect(header.locator('[data-board-column-header-copy-layer="add"]')).toHaveCount(0);
			await expect(label).toHaveCSS("opacity", "1");
		}
		const geometry = await headers.evaluateAll((nodes) => nodes.map((node) => {
			const range = document.createRange();
			range.selectNodeContents(node.querySelector('[data-board-column-header-copy-layer="label"]')!);
			const label = range.getBoundingClientRect();
			return { left: label.x, height: node.getBoundingClientRect().height };
		}));
		for (const [index, header] of geometry.entries()) {
			expect(Math.abs(header.left - before[index].left)).toBeLessThan(1);
			expect(header.height).toBe(before[index].height);
		}
		const sawCycle = await page.locator("html").getAttribute("data-header-vertical-cycle-seen");
		expect(sawCycle === "true").toBe(reducedMotion === "no-preference");
		expect(await page.locator("html").getAttribute("data-header-entry-fade-seen") === "true").toBe(reducedMotion === "no-preference");
		expect(await page.locator("html").getAttribute("data-header-exit-fade-seen") === "true").toBe(reducedMotion === "no-preference");
		const progress = page.locator('[data-jira-kanban-column="In progress"]');
		const prefix = progress.locator('[data-board-column-transition-prefix]');
		const prefixBefore = (await prefix.boundingBox())!;
		const paused = (await progress.locator('[data-issue-status-zone="Paused"]').boundingBox())!;
		await page.mouse.move(paused.x + 90, paused.y + paused.height / 2, { steps: 5 });
		await page.mouse.move(paused.x + 91, paused.y + paused.height / 2);
		await expect(progress.locator('[data-issue-drop-entered]')).toHaveAttribute("data-issue-drop-entered", "Paused");
		const destination = progress.locator('[data-board-column-destination-copy-layer="label"]');
		await expect(destination).toHaveText("Paused");
		await expect(destination).toHaveCSS("opacity", "1");
		expect((await prefix.boundingBox())!.x).toBe(prefixBefore.x);
		expect(await page.locator("html").getAttribute("data-destination-entry-fade-seen") === "true").toBe(reducedMotion === "no-preference");
		await page.screenshot({ path: `output/agent-browser/header-side/drag-headers-${reducedMotion}.png` });
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(headers.locator("[data-board-column-count]")).toHaveCount(4);
		for (const header of await headers.all()) {
			await expect(header.locator('[data-board-column-header-copy-layer="add"]')).toHaveCSS("opacity", "1");
		}
	});
}
