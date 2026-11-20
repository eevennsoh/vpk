import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the Jira Suggestion preview offers Menu and Floating reviews", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/blocks/jira-suggestion"));
	const preview = page.locator("#preview");
	const menu = preview.getByRole("button", { name: "Menu", exact: true });
	const floating = preview.getByRole("button", { name: "Floating", exact: true });
	await expect(menu).toHaveAttribute("aria-pressed", "true");
	await expect(preview.getByRole("button", { name: "Show as list" })).toBeVisible();

	await floating.click();
	await expect(floating).toHaveAttribute("aria-pressed", "true");
	await preview.getByRole("button", { name: "Review AI suggestions", exact: true }).click();
	const panel = preview.getByRole("dialog", { name: /^Work item suggestions/ });
	const list = panel.getByRole("list", { name: "Suggestions", exact: true });
	await expect(list.locator(':scope > [role="listitem"]')).toHaveCount(6);
	const tags = list.locator('[data-slot="tag"]');
	await expect(tags).toHaveText(["onboarding", "sdk-v2", "merchant-experience", "q4-ga"]);
	await expect.poll(() => tags.evaluateAll((elements) => new Set(elements.map((element) => getComputedStyle(element).borderTopColor)).size)).toBe(4);
	await panel.getByRole("button", { name: "Dismiss all", exact: true }).click();
	await preview.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
	await preview.getByRole("button", { name: "Suggest work item fields", exact: true }).click();
	await expect(list.locator(':scope > [role="listitem"]')).toHaveCount(6);

	await menu.click();
	await expect(menu).toHaveAttribute("aria-pressed", "true");
	await expect(preview.getByRole("button", { name: "Show as list" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Review AI suggestions", exact: true })).toHaveCount(0);
});

test("floating suggestion cards keep their proportions as the stack opens", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/components/blocks/jira-suggestion"));
	const preview = page.locator("#preview");
	await preview.getByRole("button", { name: "Floating", exact: true }).click();
	const launcher = preview.getByRole("button", { name: "Review AI suggestions", exact: true });
	const opening = await launcher.evaluateHandle((button) => {
		const samples: { maxStretch: number; tailTransform: string }[] = [];
		function sampleList() {
			const faces = [...document.querySelectorAll('[role="list"][aria-label="Suggestions"] [data-suggestion-card-face]')];
			if (faces.length === 0) {
				requestAnimationFrame(sampleList);
				return;
			}
			let maxStretch = 0;
			for (const face of faces) {
				if (!face.parentElement) continue;
				const transform = getComputedStyle(face.parentElement).transform;
				const matrix = new DOMMatrix(transform === "none" ? undefined : transform);
				maxStretch = Math.max(maxStretch, Math.abs(Math.hypot(matrix.a, matrix.b) - Math.hypot(matrix.c, matrix.d)));
			}
			const tail = faces.at(-1)?.closest('[role="listitem"]');
			samples.push({ maxStretch, tailTransform: tail ? getComputedStyle(tail).transform : "none" });
			if (samples.length < 12) requestAnimationFrame(sampleList);
		}
		button.addEventListener("click", () => requestAnimationFrame(sampleList), { once: true, capture: true });
		return samples;
	});
	await launcher.click();
	await expect.poll(() => opening.evaluate((samples) => samples.length)).toBe(12);
	const samples = await opening.jsonValue();
	expect(Math.max(...samples.map((sample) => sample.maxStretch))).toBeLessThan(0.05);
	expect(samples[0]?.tailTransform).not.toBe("none");
	expect(new Set(samples.map((sample) => sample.tailTransform)).size).toBe(1);
});

test("the floating suggestions Close tooltip appears above its button", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review AI suggestions", exact: true }).click();
	const close = page.getByRole("button", { name: "Close suggestions", exact: true });
	await close.hover();
	const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: /^Close$/ });
	await expect(tooltip).toBeVisible();
	await expect.poll(async () => {
		const [button, tip] = await Promise.all([close.boundingBox(), tooltip.boundingBox()]);
		return button && tip ? tip.y + tip.height <= button.y : false;
	}).toBe(true);
});

async function openDescription(page: Page) {
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	const text = page.locator("[data-top-card] [data-suggestion-value-scroll]");
	await expect(text).toBeVisible();
	return text;
}

test("clicking the scrollable description opens the suggestion list", async ({ page }) => {
	const text = await openDescription(page);
	await text.click({ position: { x: 30, y: 20 } });
	await expect(page.getByRole("list", { name: "Suggestions" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Accept description" }).first()).toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`description fades only while more text remains (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const text = await openDescription(page);
		await expect.poll(() => text.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
		await text.evaluate((element) => { element.scrollTop = element.scrollHeight; });
		await expect.poll(() => text.evaluate((element) => getComputedStyle(element).maskImage)).toBe("none");
		await text.evaluate((element) => { element.scrollTop = 0; });
		await expect.poll(() => text.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
		await expect(page.getByRole("list", { name: "Suggestions" })).toHaveCount(0);
	});
}
