import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("expanding and collapsing a suggestion keeps its corners round", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const row = page.locator('[data-suggestion-field="labels"]');
	const paper = row.locator(":scope > div");
	const why = row.getByRole("button", { name: "Why labels was suggested" });
	await expect(paper).toHaveCSS("border-top-left-radius", "8px");
	for (const expanded of [true, false]) {
		const samples = await why.evaluate(async (button) => {
			const paper = button.closest('[data-suggestion-field]')?.firstElementChild;
			if (!(paper instanceof HTMLElement)) throw new Error("Suggestion card is missing");
			const values: { radius: string; x: number; y: number; height: number }[] = [];
			const start = performance.now();
			button.click();
			await new Promise<void>((resolve) => {
				const sample = () => {
					const style = getComputedStyle(paper);
					const matrix = new DOMMatrixReadOnly(style.transform);
					values.push({ radius: style.borderTopLeftRadius, x: matrix.a, y: matrix.d, height: paper.getBoundingClientRect().height });
					if (performance.now() - start < 600) requestAnimationFrame(sample);
					else resolve();
				};
				requestAnimationFrame(sample);
			});
			return values;
		});
		await expect(why).toHaveAttribute("aria-expanded", String(expanded));
		expect(Math.max(...samples.map((sample) => sample.height)) - Math.min(...samples.map((sample) => sample.height))).toBeGreaterThan(40);
		for (const sample of samples) {
			expect(sample.radius).toBe("8px");
			expect(Math.abs(sample.x - sample.y)).toBeLessThan(0.02);
		}
	}
});
