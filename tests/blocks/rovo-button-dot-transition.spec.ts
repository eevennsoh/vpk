import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the dot variant flies into the panel and returns on close", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/components/blocks/rovo-button#notification-dot-transition"));
	const example = page.locator("#notification-dot-transition");
	const review = example.getByRole("button", { name: "Review suggestions" });
	await expect(example.getByRole("button", { name: "Review AI suggestions", exact: true })).toHaveCSS("border-radius", "16px");
	const dot = review.locator("[data-notification-dot]");
	await expect(dot).toBeVisible();
	await review.scrollIntoViewIfNeeded();
	await review.focus();
	const samples = page.evaluate(() => new Promise<{ widths: number[]; controls: boolean[] }>((resolve) => {
		const widths: number[] = [];
		const controls: boolean[] = [];
		const start = performance.now();
		function sample() {
			const shape = document.querySelector<HTMLElement>("[data-notification-morph]");
			if (shape) {
				const rect = shape.getBoundingClientRect();
				const [insets] = getComputedStyle(shape).clipPath.slice(6, -1).split(" round ");
				const [, right, , left] = insets.split(" ").map(parseFloat);
				widths.push(rect.width - left - right);
				controls.push(Number(getComputedStyle(document.querySelector<HTMLElement>("[data-notification-launchers]")!).opacity) > 0.9);
			}
			if (performance.now() - start < 1000) requestAnimationFrame(sample);
			else resolve({ widths, controls });
		}
		requestAnimationFrame(sample);
	}));
	await review.click();
	const opening = await samples;
	expect(opening.widths.some((width) => width < 24)).toBe(true);
	expect(opening.widths.some((width) => width > 200)).toBe(true);
	expect(opening.controls[0]).toBe(true);
	const panel = example.getByRole("dialog", { name: /^Work item suggestions/ });
	await expect(panel).toBeVisible();
	await expect(panel.getByRole("list", { name: "Suggestions" }).getByRole("listitem")).toHaveCount(5);
	await expect(panel.getByText("Robi Lopez", { exact: true })).toBeVisible();
	await panel.getByRole("button", { name: "Close suggestions" }).click();
	await expect(page.locator("[data-notification-morph]")).toBeAttached();
	await expect(panel).toHaveCount(0);
	await expect(dot).toBeVisible();
	await review.click();
	await panel.getByRole("button", { name: "Accept description", exact: true }).click();
	await panel.getByRole("button", { name: "Close suggestions" }).click();
	await expect(dot).toBeVisible();
	await review.click();
	await panel.getByRole("button", { name: "Discard all", exact: true }).click();
	await expect(panel).toHaveCount(0);
	await expect(dot).toHaveCount(0);
});

test("the button variant opens the same suggestions from the toolbar button", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/components/blocks/rovo-button#toolbar-button-transition"));
	const example = page.locator("#toolbar-button-transition");
	const review = example.getByRole("button", { name: "Review suggestions" });
	const dot = review.locator("[data-notification-dot]");
	await expect(dot).toBeVisible();
	await review.scrollIntoViewIfNeeded();
	await review.focus();
	const frames = page.evaluate(() => new Promise<{ width: number; shadow: string }[]>((resolve) => {
		const samples: { width: number; shadow: string }[] = [];
		const start = performance.now();
		function sample() {
			const button = document.querySelector<HTMLElement>("#toolbar-button-transition [data-button-morph]");
			const host = button?.closest<HTMLElement>("[data-notification-opening]");
			if (button && host) samples.push({ width: button.getBoundingClientRect().width, shadow: getComputedStyle(host).boxShadow });
			if (performance.now() - start < 1000) requestAnimationFrame(sample);
			else resolve(samples);
		}
		requestAnimationFrame(sample);
	}));
	await review.press("Enter");
	const samples = await frames;
	expect(samples.length).toBeGreaterThan(2);
	expect(samples[0].width).toBeGreaterThan(35);
	expect(Math.max(...samples.map((sample) => sample.width))).toBeGreaterThan(200);
	expect(samples.every((sample) => sample.shadow === "none" || [...sample.shadow.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/gu)].every((match) => Number(match[1]) === 0))).toBe(true);
	const panel = example.getByRole("dialog", { name: /^Work item suggestions/ });
	await expect(panel.getByRole("list", { name: "Suggestions" }).getByRole("listitem")).toHaveCount(5);
	await expect(panel.getByText("Robi Lopez", { exact: true })).toBeVisible();
	await panel.getByRole("button", { name: "Close suggestions" }).click();
	await expect(panel).toHaveCount(0);
	await expect(dot).toBeVisible();
});

test("repeated pointer opens keep the panel shadow and the review button in place", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/components/blocks/rovo-button#toolbar-button-transition"));
	const example = page.locator("#toolbar-button-transition");
	const review = example.getByRole("button", { name: "Review suggestions" });
	const panel = example.getByRole("dialog", { name: /^Work item suggestions/ });
	await review.scrollIntoViewIfNeeded();
	await page.mouse.move(0, 0);
	await expect.poll(async () => (await review.boundingBox())?.width).toBeCloseTo(48, 0);
	const position = () => review.evaluate((element) => {
		const button = element.getBoundingClientRect();
		const example = element.closest("#toolbar-button-transition")!.getBoundingClientRect();
		return { x: button.x - example.x, y: button.y - example.y };
	});
	const original = await position();
	for (let attempt = 0; attempt < 3; attempt += 1) {
		await review.hover();
		await expect.poll(async () => (await review.boundingBox())?.width).toBeCloseTo(52.8, 0);
		await review.click();
		await expect(panel.getByRole("list", { name: "Suggestions" })).toBeVisible();
		await expect.poll(() => panel.evaluate((element) => {
			const surface = element.parentElement?.parentElement;
			if (!surface) return false;
			const reference = document.createElement("span");
			reference.style.boxShadow = "var(--ds-shadow-overlay)";
			surface.append(reference);
			const matches = getComputedStyle(surface).boxShadow.includes(getComputedStyle(reference).boxShadow);
			reference.remove();
			return matches;
		})).toBe(true);
		await panel.getByRole("button", { name: "Close suggestions" }).click();
		await expect(panel).toHaveCount(0);
		await page.mouse.move(0, 0);
		await expect.poll(async () => (await review.boundingBox())?.width).toBeCloseTo(48, 0);
		const restored = await position();
		expect(restored.x).toBeCloseTo(original.x, 0);
		expect(restored.y).toBeCloseTo(original.y, 0);
	}
});
