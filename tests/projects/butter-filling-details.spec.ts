import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function openSuggestions(page: import("@playwright/test").Page) {
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	return item;
}

test("accepting all suggestions moves the filling indicator through Details", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const item = await openSuggestions(page);
	const exitTiming = page.evaluate(() => new Promise<{ fade: number; scale: number; lastSize: number; largestStep: number; clippedAtEnd: boolean }>((resolve, reject) => {
		let ready = false;
		let appeared: number | undefined;
		let fade: number | undefined;
		let scale: number | undefined;
		let lastSize = 1;
		let lastTime = 0;
		let largestStep = 0;
		let clippedAtEnd = false;
		const deadline = performance.now() + 12_000;
		function sample(now: number) {
			const surface = document.querySelector<HTMLElement>("[data-project-butter-suggestion-cursor-surface]");
			if (surface) {
				appeared ??= now;
				const style = getComputedStyle(surface);
				const size = new DOMMatrixReadOnly(style.transform).a;
				const opacity = Number(style.opacity);
				if (now - appeared > 500 && opacity > 0.99 && size > 0.99) ready = true;
				if (ready && opacity < 0.98 && fade === undefined) fade = now;
				if (ready && size < 0.99 && scale === undefined) scale = now;
				if (scale !== undefined) {
					if (lastTime && now - lastTime < 50) largestStep = Math.max(largestStep, Math.abs(size - lastSize) * 16.67 / (now - lastTime));
					lastSize = size;
					lastTime = now;
					const cursor = surface.parentElement;
					const clip = cursor?.parentElement;
					const fields = document.querySelectorAll<HTMLElement>("[data-project-butter-detail-fields] [data-field-id]");
					const lastField = fields.item(fields.length - 1);
					if (cursor && clip && lastField) {
						const cursorBounds = cursor.getBoundingClientRect();
						clippedAtEnd ||= getComputedStyle(clip).overflow === "clip"
							&& cursorBounds.top >= lastField.getBoundingClientRect().bottom - 2
							&& cursorBounds.bottom > clip.getBoundingClientRect().bottom;
					}
				}
			}
			if (!surface && fade !== undefined && scale !== undefined) resolve({ fade, scale, lastSize, largestStep, clippedAtEnd });
			else if (now > deadline) reject(new Error("The filling indicator did not complete its exit"));
			else requestAnimationFrame(sample);
		}
		requestAnimationFrame(sample);
	}));
	await page.getByRole("button", { name: "Accept all" }).click();
	const cursor = item.locator("[data-project-butter-suggestion-cursor]");
	await expect(cursor).toBeVisible();
	const start = await cursor.boundingBox();
	if (!start) throw new Error("The filling indicator has no visible position");
	await expect.poll(async () => (await cursor.boundingBox())?.y ?? start.y, { timeout: 8_000 }).toBeGreaterThan(start.y + 30);
	const { fade, scale, lastSize, largestStep, clippedAtEnd } = await exitTiming;
	expect(scale - fade).toBeGreaterThan(40);
	expect(lastSize).toBeLessThan(0.82);
	expect(largestStep).toBeLessThan(0.06);
	expect(clippedAtEnd).toBe(true);
	await expect(cursor).toHaveCount(0, { timeout: 12_000 });
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Dec 15, 2026");
	await page.getByRole("button", { name: "Undo accepting 5 suggestions" }).click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).not.toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Add due date");
});

test("undo during filling cancels remaining changes", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const item = await openSuggestions(page);
	await page.getByRole("button", { name: "Accept all" }).click();
	const cursor = item.locator("[data-project-butter-suggestion-cursor]");
	await expect(cursor).toBeVisible();
	await page.getByRole("button", { name: "Undo accepting 5 suggestions" }).click();
	await expect(cursor).toHaveCount(0);
	await expect(item.getByRole("textbox", { name: "Work item description" })).not.toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Add due date");
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect(cursor).toBeVisible();
	await expect(cursor).toHaveCount(0, { timeout: 12_000 });
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Dec 15, 2026");
});

test("accepting all respects reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const item = await openSuggestions(page);
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect(item.locator("[data-project-butter-suggestion-cursor]")).toHaveCount(0);
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: "Change due date" })).toContainText("Dec 15, 2026");
});
