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
