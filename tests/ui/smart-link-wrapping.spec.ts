import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("wrapped Smart Links keep their lines close and icons aligned at each size", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/smart-link"));
	await page.evaluate(() => document.fonts.ready);

	for (const [label, size] of [["Small · 12px", 12], ["Medium · 14px", 14], ["Large · 16px", 16]] as const) {
		const example = page.getByText(label, { exact: true }).last().locator("..");
		const link = example.getByRole("link");
		await expect(link).toBeVisible();
		const metrics = await link.evaluate((element) => {
			const text = element.querySelector("[data-smart-link-text]");
			const icon = text?.previousElementSibling;
			const tile = icon?.firstElementChild;
			const lines = Array.from(element.getClientRects());
			if (!icon || !tile || lines.length !== 2) throw new Error("Expected an icon and two wrapped lines");
			const iconRect = icon.getBoundingClientRect();
			return {
				gap: lines[1].top - lines[0].bottom,
				tileSize: tile.getBoundingClientRect().width,
				verticalOffset: (iconRect.top + iconRect.bottom - lines[0].top - lines[0].bottom) / 2,
				leftInset: iconRect.left - lines[0].left,
				verticalInset: (lines[0].height - iconRect.height) / 2,
			};
		});
		expect(metrics.gap).toBeGreaterThanOrEqual(0);
		expect(metrics.gap).toBeLessThanOrEqual(3);
		expect(metrics.tileSize).toBeCloseTo(size, 0);
		expect(Math.abs(metrics.verticalOffset)).toBeLessThanOrEqual(1);
		expect(Math.abs(metrics.leftInset - metrics.verticalInset)).toBeLessThanOrEqual(0.75);
	}
});

test("single-line Smart Links keep the icon evenly inset at each size", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/smart-link"));
	await page.evaluate(() => document.fonts.ready);

	for (const label of ["Small · 12px", "Medium · 14px", "Large · 16px"]) {
		const example = page.getByText(label, { exact: true }).first().locator("..");
		const link = example.getByRole("link");
		await expect(link).toBeVisible();
		const insets = await link.evaluate((element) => {
			const icon = element.querySelector("[data-smart-link-text]")?.previousElementSibling;
			const status = element.querySelector("[data-slot=lozenge]");
			if (!icon || !status) throw new Error("Expected a Smart Link icon and status");
			const linkRect = element.getBoundingClientRect();
			const iconRect = icon.getBoundingClientRect();
			const statusRect = status.getBoundingClientRect();
			return {
				left: iconRect.left - linkRect.left,
				top: iconRect.top - linkRect.top,
				bottom: linkRect.bottom - iconRect.bottom,
				statusTop: statusRect.top - linkRect.top,
				statusBottom: linkRect.bottom - statusRect.bottom,
				statusRight: linkRect.right - statusRect.right,
			};
		});
		const wrappedLink = page.getByText(label, { exact: true }).last().locator("..").getByRole("link");
		const wrappedInset = await wrappedLink.evaluate((element) => {
			const icon = element.querySelector("[data-smart-link-text]")?.previousElementSibling;
			if (!icon) throw new Error("Expected a wrapped Smart Link icon");
			return icon.getBoundingClientRect().left - element.getClientRects()[0].left;
		});
		expect(Math.abs(insets.left - insets.top)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(insets.left - insets.bottom)).toBeLessThanOrEqual(0.5);
		if (label !== "Large · 16px") expect(Math.abs(insets.left - wrappedInset)).toBeLessThanOrEqual(0.5);
		expect(insets.statusTop).toBeGreaterThanOrEqual(1);
		expect(insets.statusBottom).toBeGreaterThanOrEqual(1);
		expect(Math.abs(insets.statusRight - insets.statusTop)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(insets.statusRight - insets.statusBottom)).toBeLessThanOrEqual(0.5);
	}
});
