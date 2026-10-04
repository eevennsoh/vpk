import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`hover previews each status before the dwell and clears in the gap (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.clock.install();
		await page.goto(appUrl("/preview/blocks/jira-dragging"));
		await page.waitForLoadState("networkidle");
		const card = page.locator('[data-issue-key="PAY-105"] [draggable="true"]').first();
		const source = (await card.boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await expect(card).toHaveAttribute("data-dragging", "true");
		const progress = page.locator('[data-jira-kanban-column="In progress"]');
		const choices = progress.getByRole("group", { name: "Choose a status in In progress", exact: true });
		await expect(choices).toBeVisible();
		await expect(progress.locator('[data-board-column-header-copy-layer="label"]')).toHaveCSS("opacity", "1");
		const prefix = progress.locator('[data-board-column-transition-prefix]');
		const prefixBox = (await prefix.boundingBox())!;
		const first = (await choices.locator('[data-issue-status-zone="In progress"]').boundingBox())!;
		const second = (await choices.locator('[data-issue-status-zone="Paused"]').boundingBox())!;
		await page.clock.pauseAt(new Date(Date.now() + 100));
		for (const [status, zone] of [["In progress", first], ["Paused", second]] as const) {
			await page.mouse.move(zone.x + 90, zone.y + zone.height / 2, { steps: 3 });
			await page.mouse.move(zone.x + 91, zone.y + zone.height / 2);
			const destination = progress.locator('[data-board-column-destination-copy-layer="label"]:not([aria-hidden="true"])');
			// Wait for the native drag event to commit the new caption before advancing its clock.
			await expect(destination).toHaveText(status);
			await page.clock.runFor(200);
			await expect(destination).toHaveCSS("opacity", "1");
			await expect(progress.locator('[data-issue-drop-entered]')).toHaveCount(0);
			await expect(choices).toBeVisible();
			expect((await prefix.boundingBox())!.x).toBe(prefixBox.x);
		}
		const gapY = (first.y + first.height + second.y) / 2;
		await page.mouse.move(first.x + 90, gapY);
		await page.mouse.move(first.x + 91, gapY);
		await page.clock.runFor(120);
		await expect(progress.locator('[data-board-column-destination-copy-layer="label"]')).toHaveCount(0);
		await expect(progress.locator('[data-slot="board-column-header"]')).toHaveText("To do →");
		await expect(progress.locator('[data-issue-drop-entered]')).toHaveCount(0);
		await page.clock.resume();
		await page.keyboard.press("Escape");
		await page.mouse.up();
	});

	test(`destination changes preserve the transition prefix (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/preview/blocks/jira-dragging"));
		await page.waitForLoadState("networkidle");
		const card = page.locator('[data-issue-key="PAY-105"] [draggable="true"]').first();
		const source = (await card.boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await expect(card).toHaveAttribute("data-dragging", "true");
		const progress = page.locator('[data-jira-kanban-column="In progress"]');
		const prefix = progress.locator('[data-board-column-transition-prefix]');
		await expect(prefix).toHaveText("To do →");
		await expect.poll(() => prefix.evaluate((node) => new DOMMatrix(getComputedStyle(node.closest('[data-board-column-header-copy-layer="label"]')!).transform).m42)).toBe(0);
		await expect(progress.locator('[data-board-column-header-copy-layer="label"]')).toHaveCSS("opacity", "1");
		await prefix.evaluate((node) => {
			const column = node.closest<HTMLElement>('[data-jira-kanban-column]')!;
			const initial = node.getBoundingClientRect();
			column.dataset.sidePrefixWatch = "true";
			const sample = () => {
				if (column.dataset.sidePrefixWatch !== "true") return;
				const current = column.querySelectorAll('[data-board-column-transition-prefix]');
				const box = node.getBoundingClientRect();
				const parent = node.closest('[data-board-column-header-copy-layer="label"]')!;
				if (current.length !== 1 || current[0] !== node || Math.abs(box.x - initial.x) > 0.5 || Math.abs(box.y - initial.y) > 0.5 || Number(getComputedStyle(parent).opacity) < 0.99) column.dataset.sidePrefixMoved = "true";
				for (const destination of column.querySelectorAll<HTMLElement>('[data-board-column-destination-copy-layer="label"]')) {
					const style = getComputedStyle(destination);
					const y = new DOMMatrix(style.transform).m42;
					const opacity = Number(style.opacity);
					if ((y > 0 && y < destination.offsetHeight) || (opacity > 0 && opacity < 1)) column.dataset.sideDestinationCycleSeen = "true";
				}
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		for (const status of ["In progress", "Paused"]) {
			if (status === "Paused") {
				const review = (await page.locator('[data-jira-kanban-column="In review"]').boundingBox())!;
				await page.mouse.move(review.x + 90, review.y + 90, { steps: 5 });
				await page.mouse.move(review.x + 91, review.y + 90);
			}
			const choices = progress.getByRole("group", { name: "Choose a status in In progress", exact: true });
			await expect(choices).toBeVisible();
			const zone = (await choices.locator(`[data-issue-status-zone="${status}"]`).boundingBox())!;
			await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2);
			await page.mouse.move(zone.x + zone.width / 2 + 1, zone.y + zone.height / 2);
			await expect(progress.locator('[data-issue-drop-entered]')).toHaveAttribute("data-issue-drop-entered", status);
			const destination = progress.locator('[data-board-column-destination-copy-layer="label"]:not([aria-hidden="true"])');
			await expect(destination).toHaveText(status);
			await expect.poll(() => destination.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m42)).toBe(0);
			await expect(destination).toHaveCSS("opacity", "1");
			await expect(prefix).toHaveText("To do →");
		}
		await progress.evaluate((node) => { (node as HTMLElement).dataset.sidePrefixWatch = "false"; });
		expect(await progress.getAttribute("data-side-prefix-moved")).toBeNull();
		expect((await progress.getAttribute("data-side-destination-cycle-seen")) === "true").toBe(reducedMotion === "no-preference");
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(page.locator('[data-board-column-count]')).toHaveCount(4);
	});
}
