import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

async function geometry(page: Page, status = "In progress") {
	return page.locator(`[data-issue-status-zone="${status}"]`).evaluate((zone) => {
		const box = (node: Element) => {
			const rect = node.getBoundingClientRect();
			return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
		};
		const label = zone.querySelector('[data-jira-dropzone-magnetic-label]')!;
		const stroke = zone.querySelector('[data-jira-dropzone-ants-stroke]');
		return { frame: box(zone), label: box(label), stroke: stroke ? box(stroke) : null, transform: getComputedStyle(zone).transform };
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`status labels react before entry without choosing a status (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.clock.install();
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const card = page.locator('[data-issue-key="PAY-105"] [draggable="true"]').first();
		const source = (await card.boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await expect(card).toHaveAttribute("data-dragging", "true");
		const column = page.locator('[data-jira-kanban-column="In progress"]');
		const choices = column.getByRole("group", { name: "Choose a status in In progress", exact: true });
		await expect(choices).toBeVisible();
		await page.clock.pauseAt(new Date(Date.now() + 100));
		for (const status of ["In progress", "Paused"]) {
			const zone = (await choices.locator(`[data-issue-status-zone="${status}"]`).boundingBox())!;
			const y = zone.y + zone.height / 2;
			await page.mouse.move(zone.x - 33, y);
			await page.mouse.move(zone.x - 32, y);
			await page.clock.runFor(350);
			const resting = await geometry(page, status);
			// Approach from outside the frame, inside Create's 24px sensor area.
			await page.mouse.move(zone.x - 13, y);
			await page.mouse.move(zone.x - 12, y);
			await page.clock.runFor(700);
			const near = await geometry(page, status);
			expect(near.frame).toEqual(resting.frame);
			expect(near.stroke).toEqual(resting.stroke);
			expect(near.transform).toBe("none");
			if (reducedMotion === "reduce") {
				expect(near.label).toEqual(resting.label);
			} else {
				expect(resting.label.x - near.label.x).toBeGreaterThan(1);
			}
			await expect(column.locator('[data-board-column-destination-copy-layer="label"]')).toHaveCount(0);
			await expect(column.locator('[data-issue-drop-entered]')).toHaveCount(0);
			await expect(choices).toBeVisible();
			await page.screenshot({ path: `output/agent-browser/jira-dragging/status-approach-${status.replaceAll(" ", "-")}-${reducedMotion}.png` });
			await page.mouse.move(zone.x - 33, y);
			await page.mouse.move(zone.x - 32, y);
			await page.clock.runFor(350);
			const reset = await geometry(page, status);
			expect(reset.label.x).toBeCloseTo(resting.label.x, 1);
			expect(reset.label.y).toBeCloseTo(resting.label.y, 1);
		}
		await page.clock.resume();
		await page.keyboard.press("Escape");
		await page.mouse.up();
	});

	test(`status targets share create-well chrome and only their labels move (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.clock.install();
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const card = page.locator('[data-issue-key="PAY-105"] [draggable="true"]').first();
		const source = (await card.boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await expect(card).toHaveAttribute("data-dragging", "true");
		const column = page.locator('[data-jira-kanban-column="In progress"]');
		const ring = column.locator('[data-jira-kanban-column-drop-ring]');
		const choices = column.getByRole("group", { name: "Choose a status in In progress", exact: true });
		await expect(choices).toBeVisible();
		await expect(column).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
		await expect(ring).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
		await expect(choices).toHaveCSS("border-top-width", "0px");
		const createBackgroundClip = await page.getByRole("button", { name: "Create in To do", exact: true }).evaluate((node) => getComputedStyle(node).backgroundClip);
		for (const status of ["In progress", "Paused"]) {
			const zone = choices.locator(`[data-issue-status-zone="${status}"]`);
			await expect(zone).toHaveClass(/border-dashed/);
			await expect(zone).toHaveCSS("border-top-width", "1px");
			await expect(zone).toHaveCSS("background-clip", createBackgroundClip);
			await expect(zone.locator('[data-jira-dropzone-ants-stroke]')).toHaveCount(reducedMotion === "reduce" ? 0 : 1);
		}
		const panel = (await choices.boundingBox())!;
		const zone = (await choices.locator('[data-issue-status-zone="In progress"]').boundingBox())!;
		const paused = (await choices.locator('[data-issue-status-zone="Paused"]').boundingBox())!;
		const outer = (await column.boundingBox())!;
		expect(outer.y).toBeLessThan(panel.y);
		expect(outer.y + outer.height).toBeGreaterThan(panel.y + panel.height);
		expect(zone.x).toBeGreaterThan(panel.x);
		expect(paused.y - zone.y - zone.height).toBeGreaterThan(0);
		const sideInset = zone.x - outer.x;
		expect(outer.x + outer.width - zone.x - zone.width).toBeCloseTo(sideInset, 1);
		const borderInset = await choices.locator('[data-issue-status-zone="In progress"]').evaluate((node) => parseFloat(getComputedStyle(node).borderLeftWidth));
		const columnBorder = await column.evaluate((node) => parseFloat(getComputedStyle(node).borderLeftWidth));
		// Compare painted gaps, including target insets but excluding the blue outline.
		expect(paused.y - zone.y - zone.height + 2 * borderInset).toBeCloseTo(sideInset + borderInset - columnBorder, 1);
		expect(outer.y + outer.height - paused.y - paused.height).toBeCloseTo(sideInset, 1);
		const review = (await page.locator('[data-jira-kanban-column="In review"]').boundingBox())!;
		await page.mouse.move(review.x + 90, review.y + review.height - 80);
		await page.mouse.move(review.x + 91, review.y + review.height - 80);
		await expect(ring).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
		// The header and gaps share the whole column's hover target.
		await page.mouse.move(outer.x + 90, outer.y + 10);
		await page.mouse.move(outer.x + 91, outer.y + 10);
		await expect(ring).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
		await page.mouse.move(review.x + 90, review.y + review.height - 80);
		await page.mouse.move(review.x + 91, review.y + review.height - 80);
		await expect(ring).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");

		// Compare both positions within the 500 ms dwell using the same motion clock.
		await page.clock.pauseAt(new Date(Date.now() + 100));
		await page.mouse.move(zone.x + zone.width * 0.25, zone.y + zone.height * 0.25, { steps: 3 });
		await page.mouse.move(zone.x + zone.width * 0.25 + 1, zone.y + zone.height * 0.25);
		await page.clock.runFor(120);
		await expect(ring).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
		const first = await geometry(page);
		await page.mouse.move(zone.x + zone.width * 0.75, zone.y + zone.height * 0.75, { steps: 3 });
		await page.mouse.move(zone.x + zone.width * 0.75 + 1, zone.y + zone.height * 0.75);
		await page.clock.runFor(120);
		const second = await geometry(page);
		expect(first.transform).toBe("none");
		expect(second.transform).toBe("none");
		expect(second.frame).toEqual(first.frame);
		expect(second.stroke).toEqual(first.stroke);
		if (reducedMotion === "reduce") {
			expect(second.label).toEqual(first.label);
		} else {
			expect(second.label.x - first.label.x).toBeGreaterThan(1);
			expect(second.label.y - first.label.y).toBeGreaterThan(1);
		}
		await page.screenshot({ path: `output/agent-browser/jira-dragging/inset-status-targets-${reducedMotion}.png` });
		if (reducedMotion === "no-preference") {
			await page.emulateMedia({ reducedMotion: "reduce" });
			await expect(choices.locator('[data-jira-dropzone-ants-stroke]')).toHaveCount(0);
			await expect(choices.locator('[data-issue-status-zone="In progress"] [data-jira-dropzone-magnetic-label]')).toHaveCSS("transform", "none");
			expect((await geometry(page)).frame).toEqual(first.frame);
		}
		await page.clock.resume();
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(ring).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	});
}
