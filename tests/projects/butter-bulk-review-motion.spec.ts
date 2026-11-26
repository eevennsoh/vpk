import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const action of ["Accept all", "Discard all"] as const) {
	test(`${action} settles into the compact confirmation without card flights`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
		await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
		const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
		const list = panel.getByRole("list", { name: "Suggestions" });
		await expect(list.getByRole("button", { name: "Accept description" })).toBeVisible();
		const result = await panel.evaluate(async (element, label) => {
			const cards = [...element.querySelectorAll<HTMLElement>('[data-suggestion-field] > div')];
			const positions = cards.map((card) => card.getBoundingClientRect().left - element.getBoundingClientRect().left);
			const button = [...element.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === label);
			if (!button) throw new Error(`Missing ${label} button`);
			let maximum = 0;
			const start = performance.now();
			button.click();
			await new Promise<void>((resolve) => {
				const sample = () => {
					for (const [index, card] of cards.entries()) {
						if (card.isConnected) maximum = Math.max(maximum, Math.abs(card.getBoundingClientRect().left - element.getBoundingClientRect().left - positions[index]));
					}
					if (performance.now() - start < 700) requestAnimationFrame(sample);
					else resolve();
				};
				requestAnimationFrame(sample);
			});
			return { maximum, count: cards.length };
		}, action);
		expect(result.count).toBeGreaterThan(1);
		expect(result.maximum).toBeLessThan(32);
		await expect(panel.getByText(`5 suggestions ${action === "Accept all" ? "accepted" : "discarded"}`)).toBeVisible();
		await expect(panel.getByRole("button", { name: /^Undo/ })).toBeVisible();
	});

	test(`undoing ${action} restores cards without sideways flights`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
		await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
		const panel = page.getByRole("dialog").last();
		await panel.getByRole("button", { name: action, exact: true }).click();
		await expect(panel.getByText(`5 suggestions ${action === "Accept all" ? "accepted" : "discarded"}`)).toBeVisible();
		const result = await panel.evaluate(async (element) => {
			const undo = element.querySelector<HTMLButtonElement>('button[aria-label^="Undo "]');
			if (!undo) throw new Error("Missing Undo button");
			let maximumX = 0;
			let minimumTopY = 0;
			let samples = 0;
			const start = performance.now();
			undo.click();
			await new Promise<void>((resolve) => {
				const sample = () => {
					for (const face of element.querySelectorAll<HTMLElement>("[data-suggestion-card-face]")) {
						const paper = face.parentElement;
						if (!paper) continue;
						const transform = new DOMMatrixReadOnly(getComputedStyle(paper).transform);
						maximumX = Math.max(maximumX, Math.abs(transform.m41));
						if (paper.hasAttribute("data-top-card")) minimumTopY = Math.min(minimumTopY, transform.m42);
						samples += 1;
					}
					if (performance.now() - start < 1200) requestAnimationFrame(sample);
					else resolve();
				};
				requestAnimationFrame(sample);
			});
			return { maximumX, minimumTopY, samples };
		});
		expect(result.samples).toBeGreaterThan(0);
		expect(result.maximumX).toBeLessThan(32);
		expect(result.minimumTopY).toBeLessThan(-2);
		await expect(panel.getByRole("button", { name: "Accept description" })).toBeVisible();
	});
}
