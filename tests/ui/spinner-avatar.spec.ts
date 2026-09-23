import { expect, test } from "@playwright/test";

const URL = `${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/components/ui/spinner#experimental`;

test.use({ ignoreHTTPSErrors: true });

test("Avatar spinner blooms from a hexagonal cluster and preserves the original dot collapse", async ({ page }) => {
	await page.goto(URL);
	const demo = page.locator("#experimental");
	const avatar = demo.getByRole("switch", { name: "Avatar spinner" });
	const pulse = demo.getByRole("switch", { name: "Grow in/out" });
	const spinners = demo.getByRole("status", { name: "Loading" });
	await expect(spinners).toHaveCount(4);
	await expect(avatar).not.toBeChecked();
	await expect(pulse).not.toBeChecked();
	await avatar.focus();
	await avatar.press("Space");
	await expect(avatar).toBeChecked();
	await expect(pulse).toBeChecked();

	// Sample stable points in the real CSS loop instead of relying on wall-clock timing.
	const sampleDots = (fraction: number) => spinners.first().evaluate((svg, progress) => {
		for (const animation of svg.getAnimations({ subtree: true })) {
			animation.pause();
			const timing = animation.effect!.getTiming();
			animation.currentTime = Number(timing.delay) + Number(timing.duration) * progress;
		}
		return Array.from(svg.querySelectorAll("circle"), (dot) => {
			const style = getComputedStyle(dot);
			const matrix = new DOMMatrixReadOnly(style.transform);
			return { radius: Math.hypot(matrix.e, matrix.f), opacity: Number(style.opacity) };
		});
	}, fraction);
	const contracted = await sampleDots(0);
	expect(contracted).toHaveLength(6);
	for (const dot of contracted) {
		expect(dot.radius).toBeCloseTo(1.3, 2);
		expect(dot.opacity).toBe(1);
	}
	const expanded = await sampleDots(0.25);
	for (const dot of expanded) expect(dot.radius).toBeCloseTo(5.5, 2);
	expect(expanded.map((dot) => dot.opacity)).toEqual([0.82, 0.62, 0.78, 0.58, 0.8, 0.6]);

	await pulse.click();
	await expect(pulse).not.toBeChecked();
	for (const dot of await sampleDots(0)) expect(dot.radius).toBeCloseTo(5.5, 2);
	await avatar.press("Space");
	await expect(avatar).not.toBeChecked();
	await pulse.click();
	for (const dot of await sampleDots(0)) {
		expect(dot.radius).toBe(0);
		expect(dot.opacity).toBe(1);
	}
});

test("Avatar spinner stays static when reduced motion changes while mounted", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(URL);
	await page.getByRole("button", { name: "Close sidebar", exact: true }).click();
	const demo = page.locator("#experimental");
	await demo.getByRole("switch", { name: "Avatar spinner" }).click();
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect.poll(() => demo.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
	await expect(demo.getByRole("status", { name: "Loading" })).toHaveCount(4);
	await expect(demo.getByRole("switch", { name: "Avatar spinner" })).toBeChecked();
	await demo.getByRole("switch", { name: "Avatar spinner" }).click();
	await expect.poll(() => demo.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});
