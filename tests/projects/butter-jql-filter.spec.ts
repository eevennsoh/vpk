import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const viewportWidth of [1800, 375]) {
	test(`JQL shortcut hints stay inside the popup at ${viewportWidth}px`, async ({ page }) => {
		await page.setViewportSize({ width: viewportWidth, height: 1000 });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Filter board", exact: true }).click();
		await page.getByRole("menuitem", { name: "JQL Open submenu" }).hover();
		const panel = page.getByRole("dialog", { name: "JQL filter" });
		const hints = panel.locator('[data-slot="jql-shortcut-hints"]');
		await expect(hints.locator('[data-slot="kbd"]')).toHaveCount(3);
		await expect(hints.locator('[data-slot="kbd-group"]')).toHaveAttribute("aria-label", "Shift+Enter");
		const bounds = await hints.evaluate((element) => {
			const panelBounds = element.closest('[role="dialog"]')!.getBoundingClientRect();
			const editorBounds = element.closest('[role="dialog"]')!.querySelector('textarea')!.parentElement!.getBoundingClientRect();
			return [...element.children].map((hint) => {
				const box = hint.getBoundingClientRect();
				return { left: box.left - panelBounds.left, right: panelBounds.right - box.right, bottom: panelBounds.bottom - box.bottom, editorRight: editorBounds.right - box.right };
			});
		});
		for (const hint of bounds) {
			expect(hint.left).toBeGreaterThanOrEqual(0);
			expect(hint.right).toBeGreaterThanOrEqual(0);
			expect(hint.bottom).toBeGreaterThanOrEqual(0);
			expect(hint.editorRight).toBeGreaterThanOrEqual(-1);
		}
	});
}

test("JQL editor keeps draft, validation and keyboard behavior", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Needs input", exact: true }).click();
	await page.getByRole("menuitem", { name: "JQL Open submenu" }).hover();
	const panel = page.getByRole("dialog", { name: "JQL filter" });
	await expect(panel.getByRole("button", { name: "Clear", exact: true })).toHaveCSS("height", "32px");
	const input = panel.getByRole("textbox", { name: "JQL query" });
	await expect(input).toHaveValue('agentStatus = "needsInput"');
	const pre = panel.locator('pre[aria-hidden="true"]');
	await expect(pre).toContainText('agentStatus = "needsInput"');
	await expect(pre.locator(".text-text-accent-blue")).toHaveText("agentStatus");
	await expect(pre.locator(".text-text-accent-green")).toHaveText('"needsInput"');
	await input.fill("unknown = value");
	await panel.getByRole("button", { name: "Apply", exact: true }).click();
	await expect(panel.getByRole("alert")).toHaveText("“unknown” is not a supported filter field.");
	await expect(page.getByRole("group", { name: "Agent status is Needs input" })).toBeVisible();
	await input.fill('status = "done"');
	await input.dispatchEvent("keydown", { key: "Enter", shiftKey: true, isComposing: true, bubbles: true });
	await expect(page.getByRole("group", { name: "Agent status is Needs input" })).toBeVisible();
	await input.press("Shift+Enter");
	await expect(page.getByRole("group", { name: "Status is Done" })).toBeVisible();
	await input.press("End");
	await input.press("Enter");
	await expect(input).toHaveValue('status = "done"\n');
	await expect(panel.getByText("for a new line")).toBeVisible();
	await input.fill(Array.from({ length: 30 }, (_, index) => `status = "done" AND label = "line-${index}"`).join("\n"));
	await input.evaluate((element) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event("scroll")); });
	await expect.poll(() => pre.evaluate((element) => element.scrollTop)).toBe(await input.evaluate((element) => element.scrollTop));
	await panel.getByRole("button", { name: "JQL syntax help" }).click();
	await expect(page.getByText("Use field names with =, !=, IN, or NOT IN. Combine conditions with AND.")).toBeVisible();
});

test("expanded JQL editor retains and applies the draft", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitem", { name: "JQL Open submenu" }).hover();
	const panel = page.getByRole("dialog", { name: "JQL filter" });
	await panel.getByRole("textbox", { name: "JQL query" }).fill('status = "done"');
	await panel.getByRole("button", { name: "Expand JQL editor" }).click();
	const expanded = page.getByRole("dialog", { name: "JQL query" });
	await expect(expanded).toBeVisible();
	const input = expanded.getByRole("textbox", { name: "JQL query" });
	await expect(input).toHaveValue('status = "done"');
	await input.press("Shift+Enter");
	await expanded.getByRole("button", { name: "Close", exact: true }).click();
	await expect(page.getByRole("group", { name: "Status is Done" })).toBeVisible();
	await expect(panel.getByRole("textbox", { name: "JQL query" })).toHaveValue('status = "done"');
});
