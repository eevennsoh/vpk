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
	await preview.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = preview.getByRole("dialog", { name: /^Work item suggestions/ });
	const list = panel.getByRole("list", { name: "Suggestions", exact: true });
	await expect(list.locator(':scope > [role="listitem"]')).toHaveCount(6);
	const tags = list.locator('[data-slot="tag"]');
	await expect(tags).toHaveText(["onboarding", "sdk-v2", "merchant-experience", "q4-ga"]);
	await expect.poll(() => tags.evaluateAll((elements) => new Set(elements.map((element) => getComputedStyle(element).borderTopColor)).size)).toBe(4);
	await panel.getByRole("button", { name: "Discard all", exact: true }).click();
	await preview.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
	await preview.getByRole("button", { name: "Suggest work item fields", exact: true }).click();
	await expect(list.locator(':scope > [role="listitem"]')).toHaveCount(6);

	await menu.click();
	await expect(menu).toHaveAttribute("aria-pressed", "true");
	await expect(preview.getByRole("button", { name: "Show as list" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Review suggestions", exact: true })).toHaveCount(0);
});

test("Butter's stacked suggestions settle into rows without jumping or stretching their content", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	const launcher = page.getByRole("button", { name: "Review suggestions", exact: true });
	const opening = await launcher.evaluateHandle((button) => {
		const samples: { listed: boolean; secondHeight: number; secondOpacity: number; tailTop: number; maxStretch: number; pointerTarget: boolean }[] = [];
		const matrixFor = (element: Element) => {
			const transform = getComputedStyle(element).transform;
			return new DOMMatrix(transform === "none" ? undefined : transform);
		};
		button.addEventListener("click", () => {
			const end = performance.now() + 1400;
			function sampleDeck(now: number) {
				const deck = document.querySelector('[aria-roledescription="suggestion stack"], [role="list"][aria-label="Suggestions"]');
				const faces = Array.from(deck?.querySelectorAll("[data-suggestion-card-face]") ?? []);
				const second = faces[1];
				const tail = faces.at(-1)?.parentElement;
				if (second?.parentElement && tail) {
					const maxStretch = Math.max(...faces.map((face) => {
						const paper = face.parentElement;
						if (!paper) return 0;
						const matrix = matrixFor(paper).multiply(matrixFor(face));
						return Math.abs(Math.hypot(matrix.a, matrix.b) - Math.hypot(matrix.c, matrix.d));
					}));
					samples.push({
						listed: deck?.getAttribute("role") === "list",
						secondHeight: second.parentElement.getBoundingClientRect().height,
						secondOpacity: Number(getComputedStyle(second).opacity),
						tailTop: tail.getBoundingClientRect().top,
						maxStretch,
						pointerTarget: faces.some((face) => getComputedStyle(face).pointerEvents !== "none"),
					});
				}
				if (now < end) requestAnimationFrame(sampleDeck);
			}
			requestAnimationFrame(sampleDeck);
		}, { once: true, capture: true });
		return samples;
	});
	await launcher.click();
	await expect.poll(() => opening.evaluate((samples) => {
		const latest = samples.at(-1);
		const firstList = samples.find((sample) => sample.listed);
		return latest?.secondOpacity === 1 && !!firstList && latest.tailTop - firstList.tailTop > 120;
	})).toBe(true);
	const samples = await opening.jsonValue();
	const lastStack = samples.findLast((sample) => !sample.listed);
	const firstList = samples.find((sample) => sample.listed);
	const settled = samples.at(-1);
	expect(lastStack && firstList && settled).toBeTruthy();
	if (!lastStack || !firstList || !settled) return;
	expect(Math.abs(firstList.secondHeight - lastStack.secondHeight)).toBeLessThan(24);
	expect(Math.abs(firstList.tailTop - lastStack.tailTop)).toBeLessThan(24);
	expect(firstList.secondOpacity).toBeLessThan(0.5);
	expect(firstList.pointerTarget).toBe(false);
	expect(firstList.secondHeight - settled.secondHeight).toBeGreaterThan(40);
	expect(Math.max(...samples.filter((sample) => sample.listed).map((sample) => sample.maxStretch))).toBeLessThan(0.05);
	const description = page.locator('[data-suggestion-field="description"]');
	await description.hover();
	await expect(page.locator('[data-suggestion-preview="description"]')).toBeVisible();
});

test("accepting and undoing glide neighboring cards with their content", async ({ page }) => {
	await page.setViewportSize({ width: 1911, height: 1130 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	const list = panel.getByRole("list", { name: "Suggestions" });
	await expect(list).toHaveCSS("pointer-events", "auto");
	for (const action of ["Accept description", "Undo description", "Accept assignee", "Undo assignee"]) {
		const button = panel.getByRole("button", { name: action, exact: true });
		const samples = await button.evaluateHandle((button) => {
			const list = button.closest('[aria-label="Suggestions"]');
			const neighbor = list?.querySelector('[data-suggestion-field="dueDate"] [data-suggestion-card-face]')?.parentElement;
			if (!list || !neighbor) throw new Error("Missing suggestion cards");
			const frames: { neighborTop: number; maxContentOffset: number }[] = [];
			const recording = { frames, done: false };
			button.addEventListener("click", () => {
				const end = performance.now() + 600;
				const sample = () => {
					const offsets = Array.from(list.querySelectorAll("[data-suggestion-card-face]"), (face) => {
						const content = face.getBoundingClientRect();
						const card = face.parentElement?.getBoundingClientRect();
						return card ? Math.max(Math.abs(content.top - card.top), Math.abs(content.bottom - card.bottom)) : Infinity;
					});
					frames.push({ neighborTop: neighbor.getBoundingClientRect().top, maxContentOffset: Math.max(...offsets) });
					if (performance.now() < end) requestAnimationFrame(sample);
					else recording.done = true;
				};
				sample();
			}, { capture: true, once: true });
			return recording;
		});
		await button.click();
		await expect.poll(() => samples.evaluate(({ done }) => done)).toBe(true);
		const { frames: values } = await samples.jsonValue();
		const positions = values.map(({ neighborTop }) => neighborTop);
		const start = positions[0];
		const travel = positions[positions.length - 1] - start;
		expect(action.startsWith("Accept") ? -travel : travel, action).toBeGreaterThan(24);
		const intermediate = positions.filter((top) => {
			const progress = (top - start) / travel;
			return progress > 0.15 && progress < 0.85;
		});
		expect(new Set(intermediate.map(Math.round)).size, action).toBeGreaterThanOrEqual(2);
		expect(Math.max(...values.map(({ maxContentOffset }) => maxContentOffset)), action).toBeLessThan(2);
	}
});

test("the floating suggestions Close tooltip appears above its button", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	await expect(page.getByRole("heading", { name: /Review suggestions for PAY-999/ })).toBeVisible();
	const close = page.getByRole("button", { name: "Close suggestions", exact: true });
	await close.hover();
	const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: /^Close$/ });
	await expect(tooltip).toBeVisible();
	await expect.poll(async () => {
		const [button, tip] = await Promise.all([close.boundingBox(), tooltip.boundingBox()]);
		return button && tip ? tip.y + tip.height <= button.y : false;
	}).toBe(true);
});

test("closing floating suggestions clears the title before the launcher shrinks", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	const launcher = page.getByRole("button", { name: "Review suggestions", exact: true });
	await launcher.click();
	await expect(page.getByRole("list", { name: "Suggestions" })).toBeVisible();
	const close = page.getByRole("button", { name: "Close suggestions", exact: true });
	await close.hover();
	const closing = await close.evaluateHandle((button) => {
		const title = button.closest('[role="dialog"]')?.querySelector("h2");
		if (!title) throw new Error("Missing suggestions title");
		const frames: boolean[] = [];
		button.addEventListener("click", () => {
			const sample = () => {
				frames.push(title.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
				if (frames.length < 12) requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		}, { capture: true, once: true });
		return frames;
	});
	await close.click();
	await expect.poll(() => closing.evaluate((frames) => frames.length)).toBe(12);
	expect(await closing.jsonValue()).not.toContain(true);
	await expect(launcher).toBeFocused();
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
