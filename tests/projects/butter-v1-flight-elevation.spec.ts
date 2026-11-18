import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the flying mention has an opaque surface and a temporary elevation shadow", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	const session = page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Summarize onboarding feedback/ });
	await session.focus();
	const source = await editor.locator(".rich-text-mention-chip").evaluate((chip) => {
		const style = getComputedStyle(chip);
		const rect = chip.getBoundingClientRect();
		return { fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, lineHeight: style.lineHeight, borderRadius: style.borderRadius, background: style.backgroundColor, height: rect.height, width: rect.width, x: rect.x, y: rect.y };
	});
	const samples = page.evaluate(() => new Promise<Array<{ background: string; shadow: string; opacity: number; x: number; y: number; height: number; width: number; chipHeight: number; chipWidth: number; fontSize: string; fontFamily: string; fontWeight: string; lineHeight: string; borderRadius: string; chipBackground: string }>>((resolve, reject) => {
		const values: Array<{ background: string; shadow: string; opacity: number; x: number; y: number; height: number; width: number; chipHeight: number; chipWidth: number; fontSize: string; fontFamily: string; fontWeight: string; lineHeight: string; borderRadius: string; chipBackground: string }> = [];
		const start = performance.now();
		function sample() {
			const flight = document.querySelector<HTMLElement>("[data-project-butter-mention-flight]");
			const shadow = flight?.querySelector<HTMLElement>("[data-project-butter-mention-flight-shadow]");
			const chip = flight?.querySelector<HTMLElement>(".rich-text-mention-chip");
			if (flight && shadow && chip) {
				const style = getComputedStyle(chip);
				const bounds = flight.getBoundingClientRect();
				const chipBounds = chip.getBoundingClientRect();
				values.push({ background: getComputedStyle(flight).backgroundColor, shadow: getComputedStyle(shadow).boxShadow, opacity: Number(getComputedStyle(shadow).opacity), x: chipBounds.x, y: chipBounds.y, height: bounds.height, width: bounds.width, chipHeight: chipBounds.height, chipWidth: chipBounds.width, fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, lineHeight: style.lineHeight, borderRadius: style.borderRadius, chipBackground: style.backgroundColor });
			}
			if (!flight && values.length) resolve(values);
			else if (performance.now() - start > 4000) reject(new Error("The flying mention did not settle"));
			else requestAnimationFrame(sample);
		}
		requestAnimationFrame(sample);
	}));
	await session.press("Enter");
	const values = await samples;
	const first = values.at(0);
	const last = values.at(-1);
	if (!first || !last) throw new Error("The handoff never presented a flying chip");
	for (const value of values) {
		expect(value.background).toMatch(/^rgb\(/u);
		expect(value.shadow).not.toBe("none");
		expect(value.height).toBeCloseTo(value.chipHeight, 1);
		expect(value.width).toBeCloseTo(value.chipWidth, 1);
		expect(value.fontSize).toBe(source.fontSize);
		expect(value.fontFamily).toBe(source.fontFamily);
		expect(value.fontWeight).toBe(source.fontWeight);
		expect(value.lineHeight).toBe(source.lineHeight);
		expect(value.borderRadius).toBe(source.borderRadius);
		expect(value.chipBackground).toBe(source.background);
	}
	expect(first.chipHeight).toBeCloseTo(source.height, 1);
	expect(first.chipWidth).toBeCloseTo(source.width, 1);
	expect(Math.hypot(first.x - source.x, first.y - source.y)).toBeLessThan(5);
	expect(first.opacity).toBeLessThan(0.8);
	expect(Math.max(...values.map((value) => value.opacity))).toBeGreaterThan(0.8);
	expect(last.opacity).toBeLessThan(0.35);
	await expect(page.locator("[data-project-butter-mention-flight]")).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: "Leave a reply..." }).locator(".rich-text-mention-chip")).toBeVisible();
});
