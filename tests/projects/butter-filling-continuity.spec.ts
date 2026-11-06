import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("accepting suggestions with reduced motion fills the fields without the indicator", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.locator("[data-project-butter-suggestion-cursor]")).toHaveCount(0);
});

test("filling keeps the rail stable and a revealing field usable", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	const status = item.locator('[data-field-id="status"]');
	const before = await status.boundingBox();
	if (!before) throw new Error("Status field is not visible");
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect(item.locator("[data-project-butter-suggestion-cursor]")).toBeVisible();
	const during = await status.boundingBox();
	if (!during) throw new Error("Status field disappeared during filling");
	expect(Math.abs(during.y - before.y)).toBeLessThan(2);
	const dueDateRow = item.locator('[data-field-id="dueDate"]');
	await expect(dueDateRow.locator("[data-suggestion-text-reveal]")).toBeVisible();
	const date = dueDateRow.getByRole("button", { name: "Change due date" });
	await date.focus();
	await expect(date).toBeFocused();
	await expect.poll(() => date.evaluate((element) => getComputedStyle(element.parentElement!).opacity)).toBe("1");
	await date.click();
	await expect(date).toHaveAttribute("aria-expanded", "true");
	await page.keyboard.press("Escape");
	await date.blur();
	await expect(dueDateRow.locator("[data-suggestion-text-reveal]")).toHaveCount(0);
	await expect(date).toContainText("Dec 15, 2026");
});

test("accepted field controls appear together after their previews finish", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	const fields = ["dueDate", "parent", "labels", "storyPoints"];
	for (const field of fields) await expect(item.locator(`[data-field-id="${field}"] [data-suggestion-text-reveal]`)).toBeVisible();
	await expect.poll(() => item.evaluate((root, ids) => ids.every((id) => {
		const element = root.querySelector<HTMLElement>(`[data-field-id="${id}"] [data-project-butter-field-control]`);
		return element && Number(getComputedStyle(element).opacity) <= 0.05;
	}), fields)).toBe(true);
	const spread = await item.evaluate((root, ids) => new Promise<number>((resolve, reject) => {
		const starts = new Map<string, number>();
		const start = performance.now();
		function sample(now: number) {
			for (const id of ids) {
				const element = root.querySelector<HTMLElement>(`[data-field-id="${id}"] [data-project-butter-field-control]`);
				if (element && Number(getComputedStyle(element).opacity) > 0.05 && !starts.has(id)) starts.set(id, now);
			}
			if (starts.size === ids.length) resolve(Math.max(...starts.values()) - Math.min(...starts.values()));
			else if (now - start > 8000) reject(new Error("Not all field controls completed their handoff"));
			else requestAnimationFrame(sample);
		}
		requestAnimationFrame(sample);
	}), fields);
	expect(spread).toBeLessThanOrEqual(80);
});

test("the filling indicator begins its exit before the last field without overshooting it", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.evaluate(() => {
		const started = performance.now();
		let seen = false;
		let settled = false;
		let enteredScale = 1;
		let exitedScale = 1;
		let visibleOvershoot = 0;
		let exitStartBeforeLast = false;
		let exitDistanceToEnd: number | null = null;
		let exitScaleBeforeFade = false;
		let entryScaleVisible = false;
		let entryScaleBeforeFade = false;
		let firstScale: number | null = null;
		let firstOpacity: number | null = null;
		let centered = false;
		let entryStart: number | null = null;
		let entryEnd: number | null = null;
		let exitStart: number | null = null;
		let exitEnd: number | null = null;
		let clippedDuringExit = false;
		function sample(now: number) {
			const cursor = document.querySelector<HTMLElement>("[data-project-butter-suggestion-cursor]");
			const surface = cursor?.querySelector<HTMLElement>("[data-project-butter-suggestion-cursor-surface]");
			const rows = document.querySelectorAll<HTMLElement>("[data-project-butter-detail-fields] [data-field-id]");
			const last = rows.item(rows.length - 1);
			if (cursor && surface && last) {
				seen = true;
				entryStart ??= now;
				const style = getComputedStyle(surface);
				const scale = new DOMMatrixReadOnly(style.transform).a;
				const opacity = Number(style.opacity);
				firstScale ??= scale;
				firstOpacity ??= opacity;
				const [originX, originY] = style.transformOrigin.split(" ").map(Number.parseFloat);
				centered = Math.abs(originX - surface.offsetWidth / 2) < 1 && Math.abs(originY - surface.offsetHeight / 2) < 1;
				if (opacity > 0.99 && scale > 0.999) { settled = true; entryEnd ??= now; }
				if (!settled) {
					enteredScale = Math.min(enteredScale, scale);
					if (scale < 0.94 && opacity >= 0.45) entryScaleVisible = true;
					if (scale > firstScale + 0.001 && opacity <= firstOpacity + 0.005) entryScaleBeforeFade = true;
				}
				else {
					if (scale < 0.998 && opacity > 0.99) {
						exitScaleBeforeFade = true;
						if (exitStart === null) exitStartBeforeLast = cursor.getBoundingClientRect().top < last.getBoundingClientRect().top;
						exitStart ??= now;
					}
					if (opacity < 0.95) exitedScale = Math.min(exitedScale, scale);
					if (opacity < 0.02 && scale < 0.81) exitEnd ??= now;
					const panel = cursor.closest<HTMLElement>('[data-panel-id="details"]');
					const contentId = panel?.querySelector<HTMLButtonElement>('button[aria-controls]')?.getAttribute("aria-controls");
					const panelContent = contentId ? document.getElementById(contentId) : null;
					if (opacity > 0.1 && scale < 0.99 && panelContent && getComputedStyle(panelContent).overflowY !== "visible") {
						clippedDuringExit ||= surface.getBoundingClientRect().bottom > panelContent.getBoundingClientRect().bottom + 1;
					}
				}
				const cursorBox = cursor.getBoundingClientRect();
				const lastBox = last.getBoundingClientRect();
				if (settled && opacity < 0.95 && exitDistanceToEnd === null) exitDistanceToEnd = lastBox.bottom - cursorBox.top;
				if (opacity > 0.02) visibleOvershoot = Math.max(visibleOvershoot, surface.getBoundingClientRect().bottom - lastBox.bottom);
			} else if (seen) {
				document.documentElement.dataset.fillingMotion = JSON.stringify({ enteredScale, exitedScale, visibleOvershoot, exitStartBeforeLast, exitDistanceToEnd, entryScaleVisible, entryScaleBeforeFade, exitScaleBeforeFade, centered, clippedDuringExit, entryDuration: entryStart !== null && entryEnd !== null ? entryEnd - entryStart : null, exitDuration: exitStart !== null && exitEnd !== null ? exitEnd - exitStart : null });
				return;
			}
			if (now - started < 10000) requestAnimationFrame(sample);
		}
		requestAnimationFrame(sample);
	});
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect.poll(() => page.locator("html").getAttribute("data-filling-motion"), { timeout: 12000 }).not.toBeNull();
	const result = JSON.parse((await page.locator("html").getAttribute("data-filling-motion")) ?? "{}");
	expect(result.clippedDuringExit).toBe(false);
	expect(result.visibleOvershoot, JSON.stringify(result)).toBeLessThanOrEqual(2);
	expect(result.exitStartBeforeLast, JSON.stringify(result)).toBe(true);
	expect(result.enteredScale).toBeLessThan(0.92);
	expect(result.exitedScale).toBeLessThan(0.92);
	expect(result.entryScaleVisible, JSON.stringify(result)).toBe(true);
	expect(result.entryScaleBeforeFade).toBe(true);
	expect(result.exitScaleBeforeFade).toBe(true);
	expect(result.centered).toBe(true);
	expect(result.entryDuration).not.toBeNull();
	expect(result.exitDuration).not.toBeNull();
	expect(Math.abs(result.entryDuration - result.exitDuration), JSON.stringify(result)).toBeLessThan(120);
	expect(result.exitDistanceToEnd).not.toBeNull();
	expect(result.exitDistanceToEnd).toBeGreaterThan(2);
});
