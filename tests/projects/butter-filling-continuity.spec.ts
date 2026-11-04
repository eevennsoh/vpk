import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

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
