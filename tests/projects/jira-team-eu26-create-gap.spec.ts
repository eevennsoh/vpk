import { expect, test } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

test.describe("dropzone label clipping", () => {
	test.use({ ignoreHTTPSErrors: true });
	for (const width of [1720, 1100]) {
		for (const reducedMotion of ["no-preference", "reduce"] as const) {
			test(`dropzone label stays fully painted at ${width}px (${reducedMotion})`, async ({ page }) => {
				await page.emulateMedia({ reducedMotion });
				await page.setViewportSize({ width, height: 760 });
				await page.goto(`${origin}/jira-team-eu26`);
				await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
				const expand = page.getByRole("button", { name: "Expand Unlink sessions column", exact: true });
				if (await expand.isVisible()) await expand.click();
				const source = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]').first();
				const sourceBox = (await source.boundingBox())!;
				await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
				await page.mouse.down();
				await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2 + 20, { steps: 2 });
				const column = page.locator('[data-jira-kanban-column="To do"]');
				const button = column.locator('[data-jira-dropzone-control="To do"]');
				await expect(button).toHaveAttribute("aria-label", /^Drop to create work item in To do/u);
				const label = button.locator('[data-jira-dropzone-copy-layer="label"] > span');
				for (const edge of ["top", "bottom"] as const) {
					await page.mouse.move(900, 100);
					await expect(button).toHaveCSS("height", "32px");
					const sensor = (await column.locator("[data-create-work-item-proximity]").boundingBox())!;
					await page.mouse.move(sensor.x + sensor.width / 2, sensor.y + (edge === "top" ? 6 : sensor.height - 6));
					await expect.poll(async () => (await button.boundingBox())!.height).toBeGreaterThanOrEqual(64);
					const offset = () => label.evaluate((node) => {
						const transform = getComputedStyle(node).transform;
						return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
					});
					if (reducedMotion === "reduce") {
						await expect.poll(offset).toBe(0);
					} else {
						await expect.poll(async () => (await offset()) * (edge === "top" ? -1 : 1)).toBeGreaterThan(3);
					}
					// Compare actual glyph bounds with every ancestor that can clip them.
					const clippedPixels = await label.evaluate((node) => {
						const range = document.createRange();
						range.selectNodeContents(node);
						const text = range.getBoundingClientRect();
						let clipped = 0;
						for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
							if (getComputedStyle(ancestor).overflowY === "visible") continue;
							const rect = ancestor.getBoundingClientRect();
							clipped = Math.max(clipped, rect.top - text.top, text.bottom - rect.bottom);
						}
						return clipped;
					});
					expect(clippedPixels).toBeLessThanOrEqual(0.5);
					await page.screenshot({ path: `output/agent-browser/dropzone-text/label-${width}-${reducedMotion}-${edge}.png` });
				}
				await page.mouse.move(900, 100);
				await page.mouse.up();
				await expect(button).toHaveAttribute("aria-label", "Create in To do");
				await expect(button).toHaveCSS("height", "24px");
			});
		}
	}
});

for (const width of [1720, 1440]) {
	test(`create button matches all four column gaps at ${width}px`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.setViewportSize({ width, height: 1100 });
		await page.goto(`${origin}/jira-team-eu26`);
		await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
		await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();

		for (const title of ["To do", "Done"]) {
			const button = page.locator(`[data-jira-kanban-column="${title}"]`)
				.getByRole("button", { name: `Create in ${title}` });
			await expect(button).toBeVisible();
			await expect.poll(() => button.evaluate((node) => {
				const buttonRect = node.getBoundingClientRect();
				const column = node.closest("[data-kanban-column-chrome]")!;
				const columnRect = column.getBoundingClientRect();
				const cards = column.querySelectorAll("[data-issue-key]");
				const lastCardRect = cards[cards.length - 1].getBoundingClientRect();
				const top = buttonRect.top - lastCardRect.bottom;
				return Math.max(
					Math.abs(top - (buttonRect.left - columnRect.left)),
					Math.abs(top - (columnRect.right - buttonRect.right)),
					Math.abs(top - (columnRect.bottom - buttonRect.bottom)),
				);
			})).toBeLessThanOrEqual(0.5);
		}

		await page.screenshot({ path: `output/agent-browser/side-gap/board-${width}.png` });
	});
}

for (const width of [1720, 1440]) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`collapsed column empty space reveals expand at ${width}px (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.setViewportSize({ width, height: 1100 });
			await page.goto(`${origin}/jira-team-eu26`);
			const heading = page.getByRole("heading", { name: "Jira Design", exact: true });
			await expect(heading).toBeVisible();
			const column = page.locator('[data-jira-kanban-column="Done"]');
			const collapse = column.getByRole("button", { name: "Collapse Done column", exact: true });
			await collapse.press("Enter");
			await expect(column).toHaveAttribute("data-collapsed", "true");
			const expand = column.getByRole("button", { name: "Expand Done column", exact: true });
			const count = expand.locator("..").locator(":scope > span");
			await heading.hover();
			await expect(expand).toHaveCSS("opacity", "0");
			await expect(count).toHaveCSS("opacity", "1");
			const pill = column.locator(":scope > div").first();
			await pill.hover();
			await expect(expand).toHaveCSS("opacity", "1");
			await expect(count).toHaveCSS("opacity", "0");
			await heading.hover();
			await expect(expand).toHaveCSS("opacity", "0");
			const shellBox = (await column.boundingBox())!;
			const pillBox = (await pill.boundingBox())!;
			const buttonBox = await expand.boundingBox();
			const emptyY = (pillBox.y + pillBox.height + shellBox.y + shellBox.height) / 2;
			expect(emptyY).toBeGreaterThan(pillBox.y + pillBox.height + 4);
			await page.mouse.move(shellBox.x + shellBox.width / 2, emptyY);
			await expect(expand).toHaveCSS("opacity", "1");
			await expect(expand).toHaveCSS("pointer-events", "auto");
			await expect(count).toHaveCSS("opacity", "0");
			expect(await expand.boundingBox()).toEqual(buttonBox);
			await expect(page.getByRole("button", { name: "Collapse To do column", exact: true })).toHaveCSS("opacity", "0");
			if (reducedMotion === "reduce") {
				const duration = await expand.evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration));
				expect(duration).toBeLessThanOrEqual(0.001);
			}
			await page.screenshot({ path: `output/agent-browser/column-hover/collapsed-empty-space-${width}-${reducedMotion}.png` });
			await expand.click();
			await expect(column).not.toHaveAttribute("data-collapsed", "true");
			await expect(collapse).toBeVisible();
			await collapse.press("Enter");
			await heading.hover();
			await expand.focus();
			await page.keyboard.press("Shift+Tab");
			await expect(expand).toHaveCSS("opacity", "0");
			await expect(count).toHaveCSS("opacity", "1");
			await page.keyboard.press("Tab");
			await expect(expand).toBeFocused();
			await expect(expand).toHaveCSS("opacity", "1");
			await expect(count).toHaveCSS("opacity", "0");
			await page.keyboard.press("Enter");
			await expect(column).not.toHaveAttribute("data-collapsed", "true");
			await expect(collapse).toBeVisible();
		});

		test(`empty column space hovers its create and header actions at ${width}px (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.setViewportSize({ width, height: 1100 });
			await page.goto(`${origin}/jira-team-eu26`);
			const heading = page.getByRole("heading", { name: "Jira Design", exact: true });
			await expect(heading).toBeVisible();
			const column = page.locator('[data-jira-kanban-column="Done"]');
			const content = column.locator("[data-jira-kanban-column-content]");
			const create = column.getByRole("button", { name: "Create in Done", exact: true });
			const collapse = column.getByRole("button", { name: "Collapse Done column", exact: true });
			const addAgent = column.getByRole("button", { name: "Add agent to Done", exact: true });
			await create.scrollIntoViewIfNeeded();
			await heading.hover();
			await expect(collapse).toHaveCSS("opacity", "0");
			await expect(addAgent).toHaveCSS("opacity", "0");
			await expect(create).toHaveCSS("border-top-style", "dashed");
			const restingBackground = await create.evaluate((node) => getComputedStyle(node).backgroundColor);
			await create.hover();
			await expect.poll(() => create.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(restingBackground);
			await expect.poll(() => create.evaluate((node) => node.getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
			const hoveredBackground = await create.evaluate((node) => getComputedStyle(node).backgroundColor);
			await heading.hover();
			await expect(collapse).toHaveCSS("opacity", "0");
			const shellBox = (await column.boundingBox())!;
			const contentBox = (await content.boundingBox())!;
			const createBox = await create.boundingBox();
			const headerBox = await collapse.boundingBox();
			const emptyY = (contentBox.y + contentBox.height + shellBox.y + shellBox.height) / 2;
			expect(emptyY).toBeGreaterThan(contentBox.y + contentBox.height + 4);
			await page.mouse.move(shellBox.x + shellBox.width / 2, emptyY);
			await expect(collapse).toHaveCSS("opacity", "1");
			await expect(collapse).toHaveCSS("pointer-events", "auto");
			await expect(addAgent).toHaveCSS("opacity", "1");
			await expect(create).toHaveCSS("border-top-style", "solid");
			await expect(create).toHaveCSS("background-color", hoveredBackground);
			expect(await create.boundingBox()).toEqual(createBox);
			expect(await collapse.boundingBox()).toEqual(headerBox);
			await expect(page.getByRole("button", { name: "Collapse To do column", exact: true })).toHaveCSS("opacity", "0");
			await page.screenshot({ path: `output/agent-browser/column-hover/empty-space-${width}-${reducedMotion}.png` });
			await heading.hover();
			await expect(collapse).toHaveCSS("opacity", "0");
			await expect(addAgent).toHaveCSS("opacity", "0");
			await expect(create).toHaveCSS("border-top-style", "dashed");
			await expect(create).toHaveCSS("background-color", restingBackground);
			// Reach the header action with Tab while the pointer stays outside the column.
			await addAgent.focus();
			await page.keyboard.press("Tab");
			await expect(collapse).toBeFocused();
			await expect(collapse).toHaveCSS("opacity", "1");
			await create.focus();
			await page.keyboard.press("Enter");
			await expect(page.getByRole("dialog", { name: "Create in Done", exact: true })).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(create).toBeFocused();
		});
	}
}
