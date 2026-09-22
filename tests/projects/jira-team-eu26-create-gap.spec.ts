import { expect, test } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

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
