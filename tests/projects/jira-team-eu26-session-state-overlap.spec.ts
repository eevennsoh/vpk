import { expect, test } from "@playwright/test";

test("a status change followed by synced sessions keeps expanded rows apart", async ({ page }) => {
	test.setTimeout(75_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`, {
		waitUntil: "networkidle",
	});
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	await expect(page.locator("[data-agent-session-column-scrollport]")).toBeVisible();
	await page.getByRole("heading", { name: "Jira Design" }).click();
	const changedRow = page.getByTestId("agent-session-row-lw-sync-sandbox-root-cause");
	await expect(changedRow).toBeAttached({ timeout: 10_000 });
	const samples = page.evaluate(async () => {
		let maxOverlapPx = 0;
		let overlapRows: readonly string[] = [];
		let sawStatusChange = false;
		let sawLaterBatch = false;
		let batchAt: number | undefined;
		const started = performance.now();
		while (performance.now() - started < 50_000) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const list = document.querySelector("[data-agent-session-column-scrollport] ul");
			const changing = list?.querySelector<HTMLElement>('[data-testid="agent-session-row-lw-sync-sandbox-root-cause"]');
			if (!list || !changing) continue;
			sawStatusChange ||= changing.querySelector('[data-agent-session-lifecycle-current="needs-input"]') !== null;
			if (!sawStatusChange) continue;
			sawLaterBatch ||= list.querySelector('[data-testid="agent-session-row-lw-sync-deprecation-copy"]') !== null;
			if (sawLaterBatch) batchAt ??= performance.now();
			const visibleRows = Array.from(list.children)
				.filter((row): row is HTMLElement => row instanceof HTMLElement)
				.filter((row) => !row.hasAttribute("data-departing") && Number(getComputedStyle(row).opacity) > 0.3);
			for (const [index, row] of visibleRows.entries()) {
				const rect = row.getBoundingClientRect();
				for (const other of visibleRows.slice(index + 1)) {
					const otherRect = other.getBoundingClientRect();
					const overlap = Math.max(0, Math.min(rect.bottom, otherRect.bottom) - Math.max(rect.top, otherRect.top));
					if (overlap > maxOverlapPx) {
						maxOverlapPx = overlap;
						overlapRows = [row.dataset.testid ?? "", other.dataset.testid ?? ""];
					}
				}
			}
			if (batchAt !== undefined && performance.now() - batchAt > 1_200) break;
		}
		return { sawStatusChange, sawLaterBatch, maxOverlapPx, overlapRows };
	});
	await expect(changedRow.locator("[data-agent-session-lifecycle-current]"))
		.toHaveAttribute("data-agent-session-lifecycle-current", "needs-input", { timeout: 25_000 });
	const result = await samples;
	expect(result.sawStatusChange).toBe(true);
	expect(result.sawLaterBatch).toBe(true);
	expect(result.maxOverlapPx, result.overlapRows.join(" / ")).toBeLessThan(2);
	await page.screenshot({ path: "output/agent-browser/session-status-reorder-fixed.png" });
});
