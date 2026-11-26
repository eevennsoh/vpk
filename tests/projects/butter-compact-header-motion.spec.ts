import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the compact header stays visible while the review panel collapses", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	await expect(panel.getByRole("button", { name: "Discard all" })).toBeVisible();
	const samples = await panel.evaluate(async (element) => {
		const title = element.querySelector("header h2");
		const button = [...element.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === "Discard all");
		if (!(title instanceof HTMLElement) || !button) throw new Error("Review controls are missing");
		const startHeight = element.getBoundingClientRect().height;
		const start = performance.now();
		const values: { time: number; height: number; opacity: number; sameTitle: boolean }[] = [];
		button.click();
		await new Promise<void>((resolve) => {
			const sample = () => {
				values.push({ time: performance.now() - start, height: element.getBoundingClientRect().height, opacity: Number(getComputedStyle(title).opacity), sameTitle: element.querySelector("header h2") === title });
				if (performance.now() - start < 700) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return { startHeight, values };
	});
	expect(samples.startHeight).toBeGreaterThan(100);
	expect(samples.values.every((sample) => sample.opacity >= 0.99)).toBe(true);
	expect(samples.values.every((sample) => sample.sameTitle)).toBe(true);
	await expect(panel.getByText("5 suggestions discarded")).toBeVisible();
	await expect(panel.getByRole("button", { name: "Check again" })).toBeVisible();
});

test("reduced motion shows the compact header immediately", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	await panel.getByRole("button", { name: "Discard all" }).click();
	await expect(panel.getByText("5 suggestions discarded")).toBeVisible();
	await expect(panel.locator("header h2")).toHaveCSS("opacity", "1");
	await expect(panel.getByRole("button", { name: "Check again" })).toBeVisible();
});

test("a manual re-check keeps the header visible while the panel folds", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	await expect(panel.getByRole("button", { name: "Check for new suggestions" })).toBeVisible();
	await expect(panel.getByRole("list", { name: "Suggestions" })).toBeVisible();
	const samples = await panel.evaluate(async (element) => {
		const title = element.querySelector("header h2");
		const controls = title?.nextElementSibling;
		const button = element.querySelector<HTMLButtonElement>('[aria-label="Check for new suggestions"]');
		if (!(title instanceof HTMLElement) || !(controls instanceof HTMLElement) || !button) throw new Error("Header controls are missing");
		const start = performance.now();
		const values: { time: number; height: number; opacity: number; controls: number; sameTitle: boolean; text: string; stop: boolean }[] = [];
		button.click();
		await new Promise<void>((resolve) => {
			const sample = () => {
				values.push({ time: performance.now() - start, height: element.getBoundingClientRect().height, opacity: Number(getComputedStyle(title).opacity), controls: Number(getComputedStyle(controls).opacity), sameTitle: element.querySelector("header h2") === title, text: title.textContent ?? "", stop: Boolean(element.querySelector('[aria-label="Stop checking for suggestions"]')) });
				if (performance.now() - start < 700) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return values;
	});
	expect(samples.every((sample) => sample.opacity >= 0.99 && sample.controls >= 0.99), JSON.stringify(samples)).toBe(true);
	expect(samples.every((sample) => sample.sameTitle)).toBe(true);
	expect(samples.some((sample) => sample.text.includes("Checking for suggestions") && sample.stop)).toBe(true);
});

for (const action of ["Check for new suggestions", "Discard all", "Accept all"] as const) {
	test(`${action} hides the cards at the start of the same panel fold`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
		await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
		const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
		await expect(panel.getByRole("list", { name: "Suggestions" })).toBeVisible();
		const button = panel.getByRole("button", { name: action, exact: true });
		await expect(button).toBeVisible();
		const result = await panel.evaluate(async (element, label) => {
			const button = [...element.querySelectorAll("button")].find((candidate) => candidate.getAttribute("aria-label") === label || candidate.textContent?.trim() === label);
			if (!button) throw new Error(`Missing ${label}`);
			button.click();
			await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
			const content = element.querySelector<HTMLElement>("[data-scrollport] > div");
			return { opacity: content ? Number(getComputedStyle(content).opacity) : 0, duration: getComputedStyle(element).transitionDuration };
		}, action);
		expect(result.opacity).toBe(0);
		expect(result.duration).toContain("0.4s");
	});
}
