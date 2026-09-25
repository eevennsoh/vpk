import { expect, test, type Page } from "@playwright/test";

const JIRA_GOLDEN_JOURNEYS_V4_URL = `${
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
}/jira-golden-journeys-v4`;

interface ListFooterGeometry {
	gapTableToFooter: number;
	footerToSectionBottom: number;
	scrollable: boolean;
	rowCount: number;
}

async function readListFooterGeometry(page: Page): Promise<ListFooterGeometry> {
	return page.evaluate(() => {
		const section = document.querySelector("[data-testid=jira-list]");
		const scrollport = document.querySelector("[data-testid=jira-list-table-scroll]");
		const footer = document.querySelector("[data-testid=jira-list-sticky-footer]");
		const table = scrollport?.querySelector("table");
		if (!section || !scrollport || !footer || !table) {
			throw new Error("Jira list is not mounted");
		}
		const tableRect = table.getBoundingClientRect();
		const footerRect = footer.getBoundingClientRect();
		const sectionRect = section.getBoundingClientRect();
		return {
			gapTableToFooter: footerRect.top - tableRect.bottom,
			footerToSectionBottom: sectionRect.bottom - footerRect.bottom,
			scrollable: scrollport.scrollHeight > scrollport.clientHeight,
			rowCount: scrollport.querySelectorAll("tbody tr").length,
		};
	});
}

async function openWorkItemsList(page: Page) {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_GOLDEN_JOURNEYS_V4_URL, { waitUntil: "domcontentloaded" });
	// Team EU without Simple views splits work items into Board and List tabs.
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByTestId("jira-list")).toBeVisible();
}

test("the work items list hugs short content instead of stranding its footer", async ({ page }) => {
	await openWorkItemsList(page);

	// Filter down to a handful of rows so the table cannot fill the container.
	await page.getByRole("button", { name: "Filter list by Diego Santos" }).click();

	await expect.poll(async () => (await readListFooterGeometry(page)).rowCount)
		.toBeLessThan(10);

	const geometry = await readListFooterGeometry(page);
	expect(geometry.scrollable).toBe(false);
	// The footer sits directly under the last row — no slack absorbed above it.
	expect(Math.abs(geometry.gapTableToFooter)).toBeLessThanOrEqual(1);
});

test("the work items list anchors its footer once the rows overflow", async ({ page }) => {
	await openWorkItemsList(page);

	const geometry = await readListFooterGeometry(page);
	expect(geometry.rowCount).toBeGreaterThan(10);
	expect(geometry.scrollable).toBe(true);
	// Sticky footer stays parked on the card's bottom edge (1px border).
	expect(geometry.footerToSectionBottom).toBeLessThanOrEqual(2);
});

const JIRA_TEAM_EU26_URL = `${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`;

for (const { width, height, reducedMotion } of [
	{ width: 1440, height: 900, reducedMotion: "no-preference" as const },
	{ width: 1024, height: 768, reducedMotion: "reduce" as const },
]) {
	test(`list frame matches the session column height at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height });
		await page.emulateMedia({ reducedMotion });
		await page.goto(JIRA_TEAM_EU26_URL, { waitUntil: "domcontentloaded" });
		await page.getByRole("tab", { name: "List", exact: true }).click();
		const list = page.getByTestId("jira-list");
		const sessionColumn = page.locator("[data-agent-session-column]");
		const footer = page.getByTestId("jira-list-sticky-footer");
		await expect(list).toBeVisible();
		const expectAlignedFrames = async () => {
			await expect.poll(async () => {
				const listBounds = await list.boundingBox();
				const columnBounds = await sessionColumn.boundingBox();
				if (!listBounds || !columnBounds) return Infinity;
				return Math.max(
					Math.abs(listBounds.y - columnBounds.y),
					Math.abs(listBounds.height - columnBounds.height),
				);
			}).toBeLessThanOrEqual(1);
			await expect(footer).toBeVisible();
			await expect(footer).toHaveCSS("height", "40px");
		};
		await expectAlignedFrames();
		const readGutters = () => page.evaluate(() => {
			const workspace = document.querySelector("[data-jira-team-eu26-board-surface]")!.getBoundingClientRect();
			const session = document.querySelector("[data-agent-session-column]")!.getBoundingClientRect();
			const list = document.querySelector("[data-testid=jira-list]")?.getBoundingClientRect();
			const columns = Array.from(document.querySelectorAll("[data-jira-kanban-column-backdrop]"));
			return {
				left: session.left - workspace.left,
				sessionBottom: workspace.bottom - session.bottom,
				contentBottom: workspace.bottom - (list && list.height > 0 ? list.bottom : Math.max(...columns.map((column) => column.getBoundingClientRect().bottom))),
			};
		});
		await expect.poll(readGutters).toEqual({ left: 24, sessionBottom: 24, contentBottom: 24 });
		const fullListHeight = (await list.boundingBox())!.height;
		const scrollport = page.getByTestId("jira-list-table-scroll");
		await expect.poll(() => scrollport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
		await scrollport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
		await expect(footer).toBeVisible();
		await page.getByRole("button", { name: "Filter list by Diego Santos", exact: true }).click();
		await expect.poll(async () => (await list.boundingBox())!.height).toBe(fullListHeight);
		await expect(footer).toBeVisible();
		await expect.poll(() => scrollport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(false);
		await page.getByRole("button", { name: "Filter list by Diego Santos", exact: true }).click();
		await page.screenshot({ path: `output/agent-browser/jira-list-height-${width}.png` });
		await page.getByRole("tab", { name: "Board", exact: true }).click();
		await expect(list).not.toBeVisible();
		await expect.poll(readGutters).toEqual({ left: 24, sessionBottom: 24, contentBottom: 24 });
		await page.screenshot({ path: `output/agent-browser/jira-board-gutter-${width}.png` });
	});
}
