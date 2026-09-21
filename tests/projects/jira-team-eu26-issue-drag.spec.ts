import { expect, test, type Page } from "@playwright/test";

test.setTimeout(60_000);

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });
const issue = (page: Page, code: string) => page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`);
const column = (page: Page, title: string) => page.locator(`[data-jira-kanban-column="${title}"]`);

async function startDrag(page: Page, code: string) {
	const card = issue(page, code).locator('[draggable="true"]').first();
	await card.scrollIntoViewIfNeeded();
	const box = await card.boundingBox();
	if (!box) throw new Error(`Missing card ${code}`);
	await page.mouse.move(box.x + 70, box.y + 35);
	await page.mouse.down();
	await page.mouse.move(box.x + 90, box.y + 40, { steps: 5 });
	await expect(card).toHaveAttribute("data-dragging", "true");
}

async function enterStatus(page: Page, status: string) {
	const zone = page.locator(`[data-issue-status-zone="${status}"]`);
	const box = await zone.boundingBox();
	if (!box) throw new Error(`Missing zone ${status}`);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.locator(`[data-issue-drop-entered="${status}"]`)).toBeVisible();
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`issue-only preview and two-stage status drop (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await expect(issue(page, "PAY-105")).toBeVisible();
		await page.evaluate(() => {
			const original = DataTransfer.prototype.setDragImage;
			DataTransfer.prototype.setDragImage = function (node, x, y) {
				document.documentElement.dataset.dragPreviewSlot = (node as HTMLElement).dataset.slot;
				document.documentElement.dataset.dragPreviewText = (node as HTMLElement).innerText;
				const bounds = node.getBoundingClientRect();
				const surface = node.querySelector('[data-slot="jira-issue-surface"]')?.getBoundingClientRect();
				if (surface) {
					document.documentElement.dataset.dragPreviewGaps = JSON.stringify({
						top: surface.top - bounds.top,
						left: surface.left - bounds.left,
						right: bounds.right - surface.right,
						bottom: bounds.bottom - surface.bottom,
					});
				}
				const moreSelector = '[aria-label="More actions for PAY-105"]';
				const sourceMore = document.querySelector(`[data-issue-key="PAY-105"] ${moreSelector}`);
				const previewMore = node.querySelector(moreSelector);
				if (sourceMore && previewMore) {
					document.documentElement.dataset.dragSourceMoreOpacity = getComputedStyle(sourceMore).opacity;
					document.documentElement.dataset.dragPreviewMoreOpacity = getComputedStyle(previewMore).opacity;
				}
				original.call(this, node, x, y);
			};
		});
		const sourceHeight = await issue(page, "PAY-105").evaluate((node) => node.getBoundingClientRect().height);
		await startDrag(page, "PAY-105");
		await expect(page.locator("html")).toHaveAttribute("data-drag-preview-gaps", JSON.stringify({ top: 4, left: 4, right: 4, bottom: 4 }));
		await expect(page.locator("html")).not.toHaveAttribute("data-drag-preview-text", /Working|Needs input/);
		const sourceMoreOpacity = await page.locator("html").getAttribute("data-drag-source-more-opacity");
		await expect(page.locator("html")).toHaveAttribute("data-drag-preview-more-opacity", sourceMoreOpacity ?? "1");
		await expect.poll(() => issue(page, "PAY-105").evaluate((node) => node.getBoundingClientRect().height)).toBe(sourceHeight);
		await expect(page.locator("[data-issue-drag-preview]")).toHaveAttribute("aria-hidden", "true");
		await expect(page.locator("[data-issue-drag-preview]")).toHaveAttribute("inert", "");
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(page.locator("[data-issue-drag-preview]")).toHaveCount(0);
		await expect(page.locator("[data-issue-status-zone]")).toHaveCount(0);

		await startDrag(page, "PAY-118");
		await expect(page.locator("[data-issue-drag-preview]")).toHaveCount(0);
		const transitionHeader = column(page, "To do").locator("[data-transitioning]");
		await expect(transitionHeader).toHaveText("Transition to...");
		await expect(transitionHeader).toHaveCSS("justify-content", "center");
		await expect(transitionHeader).not.toContainText("4");
		await expect(transitionHeader.getByRole("button")).toHaveCount(0);
		const inProgress = column(page, "In progress");
		await expect(inProgress.locator("[data-issue-status-zone]")).toHaveCount(2);
		const inProgressBounds = await inProgress.boundingBox();
		if (!inProgressBounds) throw new Error("Missing In progress column");
		// Crossing the header keeps the two body choices available.
		await page.mouse.move(inProgressBounds.x + inProgressBounds.width / 2, inProgressBounds.y + 12, { steps: 3 });
		await expect(inProgress.locator("[data-issue-status-zone]")).toHaveCount(2);
		await page.screenshot({ timeout: 5_000, path: `output/agent-browser/dnd/choices-${reducedMotion}.png` });
		await enterStatus(page, "Paused");
		await expect(column(page, "In progress")).toContainText("To do → Paused");
		const next = await issue(page, "PAY-107").boundingBox();
		if (!next) throw new Error("Missing insertion anchor");
		await page.mouse.move(next.x + 100, next.y + 20, { steps: 5 });
		// Chromium may emit dragenter on the final step; another move emits dragover.
		await page.mouse.move(next.x + 100, next.y + 20);
		await expect(page.locator('[data-issue-drop-before="PAY-107"] [data-insertion-line]')).toBeVisible();
		await page.screenshot({ timeout: 5_000, path: `output/agent-browser/dnd/entered-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(issue(page, "PAY-118")).toHaveAttribute("data-board-column-title", "In progress");
		await expect(column(page, "In progress").locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(5);
		await expect.poll(() => column(page, "In progress").locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.issueKey))).toEqual(["PAY-105", "PAY-118", "PAY-107", "PAY-123", "PAY-130"]);
		await page.getByRole("tab", { name: "List", exact: true }).click();
		await expect(page.getByRole("row").filter({ hasText: "Carry card-artwork metadata" })).toContainText("Paused");
	});
}

test("leaving a chosen zone resets it; a second drag can choose another status", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	await startDrag(page, "PAY-118");
	await enterStatus(page, "Paused");
	const todo = await column(page, "To do").boundingBox();
	if (!todo) throw new Error("Missing source column");
	await page.mouse.move(todo.x + 120, todo.y + 100, { steps: 4 });
	await expect(column(page, "In progress").locator("[data-issue-status-zone]")).toHaveCount(2);
	await enterStatus(page, "In progress");
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(issue(page, "PAY-118")).toHaveAttribute("data-board-column-title", "To do");
	await startDrag(page, "PAY-118");
	await expect(column(page, "In progress").locator("[data-issue-status-zone]")).toHaveCount(2);
	await enterStatus(page, "In progress");
	await page.mouse.up();
	await expect(issue(page, "PAY-118")).toHaveAttribute("data-board-column-title", "In progress");
});

test("a running issue reorders in its column and scrolls to the last slot", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 800 });
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	await startDrag(page, "PAY-105");
	const list = column(page, "In progress").locator("[data-jira-kanban-card-list]");
	const bounds = await list.boundingBox();
	if (!bounds) throw new Error("Missing card scrollport");
	await page.mouse.move(bounds.x + 100, bounds.y + bounds.height - 5, { steps: 5 });
	await page.mouse.move(bounds.x + 100, bounds.y + bounds.height - 5);
	await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	await expect(column(page, "In progress").locator('[data-issue-drop-before="end"]')).toHaveCount(1);
	await page.mouse.up();
	await expect.poll(() => column(page, "In progress").locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.issueKey))).toEqual(["PAY-107", "PAY-123", "PAY-130", "PAY-105"]);
	await expect(issue(page, "PAY-105")).toContainText("Working");
	await expect(page.locator("[data-issue-drop-entered]")).toHaveCount(0);
});

test("grouped statuses reject header drops and use 2px split-zone strokes", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	await startDrag(page, "PAY-127");
	const progress = column(page, "In progress");
	const bounds = await progress.boundingBox();
	if (!bounds) throw new Error("Missing In progress column");
	await page.mouse.move(bounds.x + 120, bounds.y + 20, { steps: 5 });
	await page.mouse.move(bounds.x + 120, bounds.y + 20);
	await expect(progress).not.toHaveClass(/\bborder-ring\b/);
	const zones = progress.getByRole("group", { name: "Choose a status in In progress" });
	await expect(zones).toBeVisible();
	await expect(zones).toHaveCSS("border-top-width", "2px");
	await expect(zones).toHaveCSS("border-right-width", "2px");
	await expect(progress.locator('[data-issue-status-zone="Paused"]')).toHaveCSS("border-top-width", "2px");
	await expect(progress.locator("[data-issue-transition-arrow]")).toHaveCount(2);
	for (const status of ["In progress", "Paused"]) {
		const zone = progress.locator(`[data-issue-status-zone="${status}"]`);
		await expect(zone.locator("[data-issue-transition-arrow]")).toBeVisible();
		await expect(zone.locator("[data-issue-transition-arrow]")).toHaveClass(/text-icon-subtle/);
	}
	await page.screenshot({ path: "output/agent-browser/dnd/header-body-only.png" });
	await page.mouse.up();
	await expect(issue(page, "PAY-127")).toHaveAttribute("data-board-column-title", "To do");

	await startDrag(page, "PAY-127");
	await enterStatus(page, "Paused");
	await expect(progress).not.toHaveClass(/\boutline-2\b/);
	await page.mouse.move(bounds.x + 120, bounds.y + 20, { steps: 5 });
	await page.mouse.move(bounds.x + 120, bounds.y + 20);
	await expect(progress).not.toHaveClass(/\bborder-ring\b/);
	await expect(progress.locator("[data-issue-drop-entered]")).toHaveCount(0);
	await expect(zones).toBeVisible();
	await page.mouse.up();
	await expect(issue(page, "PAY-127")).toHaveAttribute("data-board-column-title", "To do");
});
