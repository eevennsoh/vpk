import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("selecting a gallery item animates its highlight", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const button = page.getByRole("button", { name: "Select Work item" });
	await expect(button).toBeVisible();
	const sizes = await button.evaluate(async (element) => {
		const samples: number[] = [];
		let start: number | undefined;
		(element as HTMLButtonElement).click();
		await new Promise<void>((resolve) => {
			const sample = () => {
				const surface = element.querySelector<HTMLElement>("[style*='mask-image']");
				if (surface) {
					start ??= performance.now();
					samples.push(surface.getBoundingClientRect().width);
				}
				if (start === undefined || performance.now() - start < 1000) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return samples;
	});
	expect(new Set(sizes).size).toBeGreaterThan(2);
});

test("returning to the journey shows the highlight spreading", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const button = page.getByRole("button", { name: "Select e2e Journey" });
	const sizes = await button.evaluate(async (element) => {
		const samples: number[] = [];
		(element as HTMLButtonElement).click();
		let start: number | undefined;
		await new Promise<void>((resolve) => {
			const sample = () => {
				const surface = element.querySelector<HTMLElement>("[style*='mask-image']");
				if (surface) {
					start ??= performance.now();
					samples.push(surface.getBoundingClientRect().width);
				}
				if (start === undefined || performance.now() - start < 1200) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return samples;
	});
	const finalSize = Math.max(...sizes);
	expect(sizes.some((size) => size > finalSize * 0.2 && size < finalSize * 0.8), JSON.stringify(sizes)).toBe(true);
});

test("returning to the journey shows selection feedback on its first selected frame", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const button = page.getByRole("button", { name: "Select e2e Journey" });
	const firstSelectedSize = await button.evaluate(async (element) => {
		(element as HTMLButtonElement).click();
		return new Promise<number>((resolve) => {
			const sample = () => {
				if (element.getAttribute("aria-pressed") !== "true") {
					requestAnimationFrame(sample);
					return;
				}
				const surface = element.querySelector<HTMLElement>("[style*='mask-image']");
				resolve(surface ? surface.getBoundingClientRect().width : 0);
			};
			requestAnimationFrame(sample);
		});
	});
	expect(firstSelectedSize).toBeGreaterThan(50);
	await expect(page.getByRole("group", { name: "Merchant onboarding journey steps" })).toBeVisible();
});

test("returning to the journey with reduced motion shows the selected tile", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const button = page.getByRole("button", { name: "Select e2e Journey" });
	await button.click();
	await expect(button).toHaveAttribute("aria-pressed", "true");
	await expect.poll(() => button.evaluate((element) => {
		const surface = element.querySelector<HTMLElement>("[style*='mask-image']");
		return surface ? surface.getBoundingClientRect().width : 0;
	})).toBeGreaterThan(700);
});

test("the standalone gallery still switches its uncontrolled selection", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/gallery"));
	const button = page.getByRole("button", { name: "Select Field Notes" });
	await button.click();
	await expect(button).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("heading", { name: "Field Notes", exact: true })).toBeVisible();
});

test("the gallery reveal completes while JavaScript animation frames are paused", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent & app selector" }).click();
	await page.clock.install();
	await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now())));
	const button = page.getByRole("button", { name: "Select e2e Journey" });
	await button.evaluate((element) => {
		if (element instanceof HTMLButtonElement) element.click();
	});
	await expect.poll(() => button.evaluate((element) => {
		const surface = element.querySelector("[style*='mask-image']");
		if (!surface) return 0;
		const size = getComputedStyle(surface).maskSize;
		return size.includes("%") ? surface.getBoundingClientRect().width * Number.parseFloat(size) / 100 : Number.parseFloat(size);
	})).toBeGreaterThan(700);
});

test("the gallery title stays aligned throughout the ink reveal", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/preview/blocks/gallery"));
	const button = page.getByRole("button", { name: "Select Field Notes" });
	await button.click();
	const offsets = await button.evaluate((element) => {
		const surface = element.querySelector("[style*='mask-image']");
		const baseText = element.querySelector(".text-text");
		const highlightedText = element.querySelector(".text-text-inverse");
		if (!surface || !baseText || !highlightedText) throw new Error("Missing gallery title");
		const animations = surface.getAnimations({ subtree: true });
		for (const animation of animations) animation.pause();
		return [17, 123, 299, 471, 719].map((time) => {
			for (const animation of animations) animation.currentTime = time;
			const base = baseText.getBoundingClientRect();
			const highlight = highlightedText.getBoundingClientRect();
			return Math.max(Math.abs(base.x - highlight.x), Math.abs(base.y - highlight.y), Math.abs(base.width - highlight.width), Math.abs(base.height - highlight.height));
		});
	});
	expect(Math.max(...offsets)).toBeLessThan(1);
});

test("returning to the journey does not replay settled session arrivals", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const row = page.getByTestId("agent-session-row-lw-sync-webhook-gap");
	await expect(row).toBeVisible({ timeout: 15_000 });
	await row.hover();
	await expect(row).toHaveCSS("opacity", "1");
	await expect.poll(() => row.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBe(0);
	await page.getByRole("button", { name: "Select Agent & app selector" }).click();
	await expect(row).toBeHidden();
	const frames = await page.getByRole("button", { name: "Select e2e Journey" }).evaluate(async (button) => {
		const row = document.querySelector('[data-testid="agent-session-row-lw-sync-webhook-gap"]');
		if (!row || !(button instanceof HTMLButtonElement)) throw new Error("Missing journey controls");
		const samples: { opacity: number; y: number }[] = [];
		button.click();
		let visibleAt: number | undefined;
		await new Promise<void>((resolve) => {
			const sample = () => {
				if (row.checkVisibility()) {
					visibleAt ??= performance.now();
					const style = getComputedStyle(row);
					samples.push({ opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42 });
				}
				if (visibleAt === undefined || performance.now() - visibleAt < 500) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return samples;
	});
	expect(frames.length).toBeGreaterThan(2);
	expect(frames.every(({ opacity, y }) => opacity >= 0.99 && Math.abs(y) < 1), JSON.stringify(frames)).toBe(true);
});

test("new sessions still animate into the journey column", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const frames = await page.evaluate(async () => {
		const samples: { opacity: number; y: number }[] = [];
		let appearedAt: number | undefined;
		await new Promise<void>((resolve) => {
			const sample = () => {
				const row = document.querySelector('[data-testid="agent-session-row-lw-sync-webhook-gap"]');
				if (row) {
					appearedAt ??= performance.now();
					const style = getComputedStyle(row);
					samples.push({ opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42 });
				}
				if (appearedAt === undefined || performance.now() - appearedAt < 900) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return samples;
	});
	expect(frames.some(({ opacity, y }) => opacity > 0.05 && opacity < 0.95 && y < -1), JSON.stringify(frames)).toBe(true);
	expect(frames.at(-1)).toEqual({ opacity: 1, y: 0 });
});

test("gallery reveals can be interrupted and closed without leaving stale highlights", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	for (const name of ["Select Agent & app selector", "Select e2e Journey", "Select List"]) {
		await page.getByRole("button", { name, exact: true }).evaluate((element) => {
			if (element instanceof HTMLButtonElement) element.click();
		});
	}
	await expect(page.getByRole("button", { name: "Select List" })).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Close gallery" }).click();
	await expect(page.getByRole("group", { name: "Gallery items" })).toHaveCount(0);
	await page.getByRole("button", { name: "Open gallery" }).click();
	await expect(page.getByRole("button", { name: "Select List" })).toHaveAttribute("aria-pressed", "true");
	expect(errors).toEqual([]);
});

