import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const origin = (process.env.PLAYWRIGHT_BASE_URL
	?? execFileSync(process.execPath, [".agents/skills/vpk-verify/scripts/control-vpk", "url"], { encoding: "utf8" }).trim())
	.replace(/\/$/u, "");

interface EntryFrame {
	height: number;
	overrun: number;
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const settled of [false, true]) {
		test(`creation well stays anchored on ${settled ? "settled" : "immediate"} first contact (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.setViewportSize({ width: 1440, height: 760 });
			await page.goto(`${origin}/jira-team-eu26`);
			await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
			const expand = page.getByRole("button", { name: "Expand Unlink sessions column", exact: true });
			if (await expand.isVisible()) await expand.click();
			const source = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]').first();
			await expect(source).toBeVisible();
			const column = page.locator('[data-jira-kanban-column="To do"]');
			const button = column.locator('[data-jira-dropzone-control="To do"]');
			await expect(button).toHaveCSS("height", "24px");
			const inset = await button.evaluate((node) => {
				const footer = node.closest("[data-board-column-create-action]")!;
				return footer.getBoundingClientRect().bottom - node.getBoundingClientRect().bottom;
			});
			const sourceBox = (await source.boundingBox())!;
			await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
			await page.mouse.down();
			await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2 + 20, { steps: 2 });
			await expect(column.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(1);
			if (settled) await expect(button).toHaveCSS("height", "32px");
			const sensor = (await column.locator("[data-create-work-item-proximity]").boundingBox())!;
			await page.evaluate((inset) => {
				const trace = { running: true, frames: [] as EntryFrame[] };
				Object.assign(window, { sideEntryTrace: trace });
				const started = performance.now();
				function sample() {
					const button = document.querySelector('[data-jira-dropzone-control="To do"]')!;
					const rect = button.getBoundingClientRect();
					const footer = button.closest("[data-board-column-create-action]")!.getBoundingClientRect();
					const transform = getComputedStyle(button.parentElement!.parentElement!).transform;
					const magneticY = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
					trace.frames.push({ height: rect.height, overrun: rect.bottom - magneticY - (footer.bottom - inset) });
					if (trace.running && performance.now() - started < 2000) requestAnimationFrame(sample);
				}
				requestAnimationFrame(sample);
			}, inset);
			await page.mouse.move(sensor.x + sensor.width / 2, sensor.y + sensor.height - 12);
			await expect(button).toHaveCSS("height", "64px");
			await page.waitForTimeout(250);
			const frames = await page.evaluate(() => {
				const trace = (window as typeof window & { sideEntryTrace: { running: boolean; frames: EntryFrame[] } }).sideEntryTrace;
				trace.running = false;
				return trace.frames;
			});
			const { mkdir, writeFile } = await import("node:fs/promises");
			await mkdir("output/agent-browser/overshoot-side", { recursive: true });
			await writeFile(`output/agent-browser/overshoot-side/entry-${reducedMotion}-${settled}.json`, JSON.stringify(frames, null, 2));
			await page.screenshot({ path: `output/agent-browser/overshoot-side/entry-${reducedMotion}-${settled}.png` });
			if (settled && reducedMotion === "no-preference") {
				const cards = column.locator("[data-issue-key]");
				const count = await cards.count();
				await page.mouse.up();
				await expect(page.locator("[data-jira-dropzone-flight]")).toBeVisible();
				await expect(page.locator("[data-jira-dropzone-flight]")).toHaveCount(0);
				await expect(cards).toHaveCount(count + 1);
			} else {
				await page.mouse.move(900, 100);
				await page.mouse.up();
			}
			await expect(button).toHaveCSS("height", "24px");
			expect(frames.length).toBeGreaterThan(5);
			expect(Math.max(...frames.map((frame) => frame.overrun))).toBeLessThanOrEqual(1.5);
		});
	}
}

test("an empty well still fills downward and receives the dragged session", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(`${origin}/jira-team-eu26`);
	await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
	const expandSessions = page.getByRole("button", { name: "Expand Unlink sessions column", exact: true });
	if (await expandSessions.isVisible()) await expandSessions.click();
	await page.getByRole("button", { name: "Filter board by Venn", exact: true }).click();
	const expand = page.getByRole("button", { name: "Expand To do column", exact: true });
	if (await expand.isVisible()) {
		await expand.focus();
		await page.keyboard.press("Enter");
	}
	const column = page.locator('[data-jira-kanban-column="To do"]');
	await expect(column.locator("[data-issue-key]")).toHaveCount(0);
	const source = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]').first();
	const box = (await source.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20, { steps: 2 });
	await expect(column.locator('[data-board-agent-session-drop-zone="create"]')).toHaveCount(1);
	const sensor = (await column.locator("[data-create-work-item-proximity]").boundingBox())!;
	expect(sensor.height).toBeGreaterThan(500);
	await page.mouse.move(sensor.x + sensor.width / 2, sensor.y + sensor.height / 2);
	const button = column.locator('[data-jira-dropzone-control="To do"]');
	await expect.poll(async () => (await button.boundingBox())!.height).toBeCloseTo(sensor.height, 0);
	const expanded = (await button.boundingBox())!;
	expect(Math.abs(expanded.y - sensor.y)).toBeLessThanOrEqual(10.5);
	expect(Math.abs(expanded.y + expanded.height - sensor.y - sensor.height)).toBeLessThanOrEqual(10.5);
	await page.mouse.up();
	await expect(page.locator("[data-jira-dropzone-flight]")).toBeVisible();
	await expect(page.locator("[data-jira-dropzone-flight]")).toHaveCount(0);
	await expect(column.locator("[data-issue-key]")).toHaveCount(1);
	await expect(column.locator("[data-issue-key]")).toBeVisible();
	await expect(button).toHaveCSS("height", "24px");
});
