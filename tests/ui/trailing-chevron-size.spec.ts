import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const [name, route, selector] of [
	["Select", "/preview/ui/select", '[data-slot="select-trigger"]'],
	["Combobox", "/butter-v1", '[aria-label="Show values for condition 1"]'],
] as const) {
	test(`${name} keeps its chevron at 12px in a 16px slot`, async ({ page }) => {
		await page.goto(appUrl(route));
		if (name === "Combobox") {
			await page.getByRole("button", { name: "Filter board", exact: true }).click();
			await page.getByRole("menuitem", { name: "Advanced Open submenu" }).hover();
		}
		const trigger = page.locator(selector).first();
		await expect(trigger).toBeVisible();
		const geometry = await trigger.evaluate((element, component) => {
			const svg = element.querySelector("svg");
			const slot = component === "Select" ? element.querySelector('[data-slot="icon"]') : element.querySelector(":scope > span");
			if (!svg || !slot) throw new Error("Missing chevron or its slot");
			const icon = svg.getBoundingClientRect();
			const bounds = slot.getBoundingClientRect();
			return { icon: [icon.width, icon.height], slot: [bounds.width, bounds.height], inset: [icon.left - bounds.left, icon.top - bounds.top] };
		}, name);
		expect(geometry).toEqual({ icon: [12, 12], slot: [16, 16], inset: [2, 2] });
	});
}

test("board view settings use compact field icons and aligned chevrons", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	await page.getByRole("button", { name: "Customize", exact: true }).click();
	const panel = page.getByRole("dialog", { name: "View settings" });
	for (const name of ["Agent sessions", "Assignee", "Development", "Due date", "Flagged"]) {
		const row = panel.getByRole("listitem").filter({ hasText: name });
		const tile = row.locator('[data-slot="icon-tile"]');
		await expect(tile).toHaveAttribute("data-variant", "transparent");
		await expect(tile).toHaveCSS("width", "16px");
		await expect(tile).toHaveCSS("height", "16px");
		await expect(tile.locator("svg")).toHaveCSS("width", "12px");
		await expect(tile.locator("svg")).toHaveCSS("height", "12px");
	}
	for (const name of ["Show Hide done work items after options", "Show Mute agent sessions after options", "Show field options"]) {
		const trigger = panel.getByRole("button", { name, exact: true });
		const geometry = await trigger.evaluate((element) => {
			const group = element.closest('[data-slot="input-group"]')!.getBoundingClientRect();
			const slot = element.querySelector(":scope > span")!.getBoundingClientRect();
			const icon = element.querySelector("svg")!.getBoundingClientRect();
			return { slot: [slot.width, slot.height], icon: [icon.width, icon.height], inset: [icon.left - slot.left, icon.top - slot.top], right: group.right - slot.right };
		});
		expect(geometry).toEqual({ slot: [16, 16], icon: [12, 12], inset: [2, 2], right: 11 });
	}
	const openAlignedMenu = async (name: string) => {
		const trigger = panel.getByRole("button", { name, exact: true });
		await trigger.click();
		await expect(page.locator('[data-slot="combobox-content"][data-open]')).toBeVisible();
		const geometry = await page.locator(`button[aria-label="${name}"]`).evaluate((element) => {
			const input = element.closest('[data-slot="input-group"]')!.getBoundingClientRect();
			const popup = document.querySelector('[data-slot="combobox-content"][data-open]')!.getBoundingClientRect();
			return { left: popup.left - input.left, right: popup.right - input.right, width: popup.width - input.width };
		});
		for (const offset of Object.values(geometry)) expect(Math.abs(offset)).toBeLessThanOrEqual(1);
	};
	await openAlignedMenu("Show Hide done work items after options");
	await page.getByRole("option", { name: "Never", exact: true }).click();
	await expect(panel.getByRole("combobox", { name: "Hide done work items after" })).toHaveValue("Never");
	await openAlignedMenu("Show Mute agent sessions after options");
	await page.getByRole("option", { name: "2 weeks", exact: true }).click();
	await expect(panel.getByRole("combobox", { name: "Mute agent sessions after" })).toHaveValue("2 weeks");
	await openAlignedMenu("Show field options");
	const options = page.getByRole("listbox");
	await expect(options.getByRole("option", { name: "Priority" })).toBeVisible();
	await options.getByRole("option", { name: "Priority" }).click();
	await expect(panel.getByRole("button", { name: "Remove Priority" })).toBeAttached();
});

test("view settings dropdowns match their inputs on a narrow screen", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 900 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	await page.getByRole("button", { name: "Customize", exact: true }).click();
	for (const name of ["Show Hide done work items after options", "Show Mute agent sessions after options", "Show field options"]) {
		await page.getByRole("button", { name, exact: true }).click();
		await expect(page.locator('[data-slot="combobox-content"][data-open]')).toBeVisible();
		const bounds = await page.locator(`button[aria-label="${name}"]`).evaluate((element) => {
			const input = element.closest('[data-slot="input-group"]')!.getBoundingClientRect();
			const popup = document.querySelector('[data-slot="combobox-content"][data-open]')!.getBoundingClientRect();
			return { left: popup.left - input.left, right: popup.right - input.right, width: popup.width - input.width };
		});
		for (const offset of Object.values(bounds)) expect(Math.abs(offset)).toBeLessThanOrEqual(1);
		await page.keyboard.press("Escape");
	}
});
