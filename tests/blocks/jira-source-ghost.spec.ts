import { expect, test, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost";
const issue = (page: Page, code: string) => page.locator(`[data-jira-kanban-scrollport] [data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`);
const card = (page: Page, code: string) => issue(page, code).locator('[draggable]').first();

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const width of [1600, 1280]) {
		test(`EU26 source ghost gaps match the full column side gap (${reducedMotion}, ${width}px)`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/jira-team-eu26`);
			const selected = ["PAY-118", "PAY-124", "PAY-125"];
			for (const code of [selected[0], selected.at(-1)!]) {
				await card(page, code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			}
			await expect.poll(async () => {
				const slots = (await sourceGeometry(page)).slice(0, selected.length);
				return Math.max(...slots.slice(1).map((rect, index) => Math.abs(rect.y - slots[index].y - slots[index].height)));
			}).toBe(0);
			const original = await sourceGeometry(page);
			await start(page, selected[0]);
			for (const code of selected) {
				await expect(issue(page, code).locator('[data-issue-source-ghost-content]')).toHaveCSS("opacity", "0");
			}
			await expect.poll(async () => {
				const painted = await page.locator('[data-jira-kanban-column="To do"] [data-issue-source-ghost-placeholder]').evaluateAll((nodes) => nodes.slice(0, 3).map((node) => {
					const rect = node.getBoundingClientRect();
					const values = getComputedStyle(node).clipPath.match(/inset\(([^)]*) round/)![1].trim().split(/\s+/).map(parseFloat);
					const vertical = values[0];
					const horizontal = values[1] ?? vertical;
					const column = node.closest('[data-jira-kanban-column-content]')!.getBoundingClientRect();
					return { top: rect.top + vertical, bottom: rect.bottom - vertical, leftGap: rect.left + horizontal - column.left, rightGap: column.right - rect.right + horizontal };
				}));
				return Math.max(...painted.slice(1).flatMap((rect, index) => {
					const gap = rect.top - painted[index].bottom;
					return [Math.abs(gap - rect.leftGap), Math.abs(gap - rect.rightGap)];
				}));
			}).toBeLessThan(0.1);
			expect(await sourceGeometry(page)).toEqual(original);
			await page.screenshot({ path: `output/agent-browser/ghost-spacing/eu26-${reducedMotion}-${width}.png` });
			await page.keyboard.press("Escape");
			await page.mouse.up();
			for (const code of selected) {
				await expect(issue(page, code).locator('[data-issue-source-ghost-content]')).toHaveCSS("opacity", "1");
			}
			expect(await sourceGeometry(page)).toEqual(original);
		});
	}
}

async function sourceGeometry(page: Page) {
	return page.locator('[data-jira-kanban-column="To do"] [data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes.map((node) => {
		const rect = node.getBoundingClientRect();
		return { code: node.getAttribute("data-issue-key"), x: rect.x, y: rect.y, width: rect.width, height: rect.height };
	}));
}

async function start(page: Page, code: string) {
	const rect = (await card(page, code).boundingBox())!;
	await test.step("move to source", () => page.mouse.move(rect.x + 70, rect.y + 30));
	await test.step("press source", () => page.mouse.down());
	await test.step("start native drag", () => page.mouse.move(rect.x + 95, rect.y + 35, { steps: 5 }));
	await test.step("confirm native drag", () => expect(card(page, code)).toHaveAttribute("data-dragging", "true"));
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const selected of [["PAY-105"], ["PAY-123"], ["PAY-105", "PAY-107", "PAY-123"]]) {
		test(`${selected.join(", ")} leaves inset source placeholders without moving cards (${reducedMotion})`, async ({ page }) => {
			await page.addInitScript(() => {
				document.addEventListener("transitionrun", (event) => {
					const target = event.target;
					if (!(target instanceof HTMLElement)) return;
					if (target.matches('[data-issue-source-ghost-placeholder]') && event.propertyName === "clip-path") {
						const animation = target.getAnimations().find((animation) => animation instanceof CSSTransition && animation.transitionProperty === "clip-path");
						const effect = animation?.effect;
						const frames = effect instanceof KeyframeEffect ? effect.getKeyframes() : null;
						document.documentElement.dataset.sourceGhostInsetFrom = frames ? String(frames[0].clipPath) : "";
						requestAnimationFrame(() => {
							const inset = parseFloat(getComputedStyle(target).clipPath.replace("inset(", ""));
							if (inset > 0 && inset < 6.5) document.documentElement.dataset.sourceGhostInsetSeen = "true";
						});
					}
					if (!target.matches('[data-issue-source-ghost-content]') || event.propertyName !== "opacity") return;
					requestAnimationFrame(() => {
						const opacity = Number(getComputedStyle(target).opacity);
						if (opacity > 0 && opacity < 1) document.documentElement.dataset.sourceGhostFadeSeen = "true";
					});
				});
			});
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/preview/blocks/jira-dragging`);
			await page.waitForLoadState("networkidle");
			if (selected.length > 1) {
				await card(page, selected[0]).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
				await card(page, selected.at(-1)!).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			}
			await expect.poll(async () => {
				const before = await sourceGeometry(page);
				await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
				const after = await sourceGeometry(page);
				return Math.max(...after.map((rect, index) => Math.abs(rect.y - before[index].y)));
			}).toBeLessThan(0.01);
			const original = await sourceGeometry(page);
			for (const code of selected) {
				await expect(issue(page, code).locator('[data-issue-source-ghost-content]')).toHaveCSS("opacity", "1");
				await expect(issue(page, code).locator('[data-issue-source-ghost-placeholder]')).toHaveCSS("opacity", "0");
			}
			await start(page, selected[0]);
			for (const code of selected) {
				const content = issue(page, code).locator('[data-issue-source-ghost-content]');
				const placeholder = issue(page, code).locator('[data-issue-source-ghost-placeholder]');
				await expect(content).toHaveCSS("opacity", "0");
				await expect(card(page, code)).not.toHaveAttribute("inert", "");
				const blocked = await content.locator('[draggable="true"]').evaluate((source) => [...source.children].every((node) => node instanceof HTMLElement && node.inert));
				expect(blocked).toBe(true);
				await expect(content).toHaveAttribute("aria-hidden", "true");
				await expect(placeholder).toHaveCSS("opacity", "1");
				await expect(placeholder).toBeEmpty();
				const frame = (await issue(page, code).locator('[data-issue-source-ghost-frame]').boundingBox())!;
				await expect.poll(() => placeholder.evaluate((node) => getComputedStyle(node).clipPath)).toBe("inset(6.5px 8px round 8px)");
				const bounds = (await placeholder.boundingBox())!;
				// The decorative box retains the full slot. Its painted clip has
				// 6.5px vertical and 8px horizontal insets, independent of card size.
				expect(bounds).toEqual(frame);
				const inset = await placeholder.evaluate((node) => parseFloat(getComputedStyle(node).clipPath.replace("inset(", "")));
				expect(inset).toBe(6.5);
				if (reducedMotion === "reduce") await expect(content).toHaveCSS("transition-property", "none");
			}
			if (reducedMotion === "no-preference") {
				await expect(page.locator("html")).toHaveAttribute("data-source-ghost-fade-seen", "true");
				await expect(page.locator("html")).toHaveAttribute("data-source-ghost-inset-seen", "true");
				await expect(page.locator("html")).toHaveAttribute("data-source-ghost-inset-from", "inset(0px round 8px)");
			}
			expect(await sourceGeometry(page)).toEqual(original);
			await expect(page.locator('[data-issue-cohort-preview]')).toContainText(selected[0]);
			await page.mouse.move(1100, 100);
			await page.mouse.move(1101, 100);
			await expect(card(page, selected[0])).toHaveAttribute("data-dragging", "true");
			expect(await sourceGeometry(page)).toEqual(original);
			await page.screenshot({ path: `output/agent-browser/source-ghost/placeholder-${selected.length}-${selected[0]}-${reducedMotion}.png` });
			await page.keyboard.press("Escape");
			await page.mouse.up();
			for (const code of selected) {
				const content = issue(page, code).locator('[data-issue-source-ghost-content]');
				await expect(content).toHaveCSS("opacity", "1");
				await expect(content).not.toHaveAttribute("inert", "");
				await expect(content).not.toHaveAttribute("aria-hidden", "true");
				await expect(issue(page, code).locator('[data-issue-source-ghost-placeholder]')).toHaveCSS("opacity", "0");
			}
			expect(await sourceGeometry(page)).toEqual(original);
			await expect(page.locator('[data-issue-cohort-preview]')).toHaveCount(0);
		});
	}
}

test("a source placeholder keeps the native drop transaction working", async ({ page }) => {
	await page.goto(`${origin}/preview/blocks/jira-dragging`);
	await page.waitForLoadState("networkidle");
	await start(page, "PAY-105");
	await expect(issue(page, "PAY-105").locator('[data-issue-source-ghost-content]')).toHaveCSS("opacity", "0");
	const review = (await page.locator('[data-jira-kanban-column="In review"]').boundingBox())!;
	await page.mouse.move(review.x + 90, review.y + 150);
	await page.mouse.move(review.x + 91, review.y + 150);
	await page.mouse.up();
	await expect(page.locator('[data-jira-kanban-column="In review"] [data-issue-key="PAY-105"]')).toHaveCount(1);
	await expect(issue(page, "PAY-105").locator('[data-issue-source-ghost-content]')).toHaveCSS("opacity", "1");
	await expect(page.locator('[data-issue-cohort-preview]')).toHaveCount(0);
});

test("boards without the source-placeholder presentation retain their native preview", async ({ page }) => {
	await page.goto(`${origin}/jira-team-eu26`);
	await page.waitForLoadState("networkidle");
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Move visual", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(page.locator('[data-issue-source-ghost-frame]')).toHaveCount(0);
	await start(page, "PAY-118");
	await expect(page.locator('[data-issue-drag-preview]')).toHaveCount(1);
	await page.keyboard.press("Escape");
	await page.mouse.up();
});

test("catalog preview records the full-size to inset source animation", async ({ browser }) => {
	const context = await browser.newContext({
		viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true,
		recordVideo: { dir: "output/agent-browser/source-ghost/recording", size: { width: 1600, height: 1000 } },
	});
	const page = await context.newPage();
	const video = page.video()!;
	try {
		await page.goto(`${origin}/components/blocks/jira-dragging`);
		await page.locator('[data-jira-dragging]').scrollIntoViewIfNeeded();
		await page.waitForLoadState("networkidle");
		for (const code of ["PAY-105", "PAY-107"]) await card(page, code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await expect.poll(async () => {
			const before = await sourceGeometry(page);
			await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
			return Math.max(...(await sourceGeometry(page)).map((rect, index) => Math.abs(rect.y - before[index].y)));
		}).toBeLessThan(0.01);
		const original = await sourceGeometry(page);
		await start(page, "PAY-105");
		await page.mouse.move(original[0].x + 350, original[0].y + 20, { steps: 8 });
		for (const code of ["PAY-105", "PAY-107"]) {
			await expect(issue(page, code).locator('[data-issue-source-ghost-placeholder]')).toHaveCSS("clip-path", "inset(6.5px 8px round 8px)");
		}
		expect(await sourceGeometry(page)).toEqual(original);
		await page.screenshot({ path: "output/agent-browser/source-ghost/catalog-inset-shrink.png" });
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(issue(page, "PAY-105").locator('[data-issue-source-ghost-content]')).toHaveCSS("opacity", "1");
		expect(await sourceGeometry(page)).toEqual(original);
	} finally {
		await context.close();
		await video.saveAs("output/agent-browser/source-ghost/inset-shrink.webm");
	}
});
