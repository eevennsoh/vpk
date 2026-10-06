import { expect, test, type Page } from "@playwright/test";

import { resolveAppOrigin } from "@/tests/helpers/origin";

const origin = resolveAppOrigin();
const coverSelector = '[data-jira-team-eu26-end-board-surface] [data-slot="jira-issue-cover"]';

test.use({ viewport: { width: 2048, height: 1191 }, ignoreHTTPSErrors: true });

async function cycleTheme(page: Page) {
	await page.getByRole("button", { name: "Profile menu", exact: true }).click();
	await page.getByRole("menuitem", { name: /^Theme:/u }).click();
	await page.keyboard.press("Escape");
}

test("Rovo Desktop glow fades smoothly beyond the exported filter edges in both themes", async ({ page }) => {
	await page.setViewportSize({ width: 1694, height: 1000 });
	await page.emulateMedia({ colorScheme: "light" });
	await page.addInitScript(() => localStorage.setItem("ui-theme", "dark"));
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "domcontentloaded" });
	const cover = page.locator('[data-issue-key="TEU-1"] [data-slot="jira-issue-cover"]');
	const artwork = cover.getByRole("img", { name: "Rovo Desktop preview", exact: true });
	for (const theme of ["dark", "light"] as const) {
		await expect(page.locator("html")).toHaveAttribute("data-color-mode", theme);
		await expect(artwork).toHaveAttribute("src", `/illustration/jira-team-eu26-end/rovo-desktop${theme === "dark" ? "-dark" : ""}.svg`);
		await expect.poll(() => artwork.evaluate((node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0)).toBe(true);
		const screenshot = await cover.screenshot({ scale: "css" });
		const sideSteps = await page.evaluate(async (png) => {
			const image = new Image();
			image.src = `data:image/png;base64,${png}`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = image.width;
			canvas.height = image.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Screenshot pixel reader unavailable");
			context.drawImage(image, 0, 0);
			const pixels = context.getImageData(0, 0, image.width, image.height).data;
			return [[67, 74], [306, 314]].map(([from, to]) => {
				let largest = 0;
				for (let y = Math.round(40 * image.height / 160); y < Math.round(120 * image.height / 160); y++) {
					for (let x = Math.round(from * image.width / 379); x < Math.round(to * image.width / 379); x++) {
						const offset = (y * image.width + x) * 4;
						for (let channel = 0; channel < 3; channel++) {
							largest = Math.max(largest, Math.abs(pixels[offset + channel + 4] - pixels[offset + channel]));
						}
					}
				}
				return largest;
			});
		}, screenshot.toString("base64"));
		for (const step of sideSteps) expect(step, `${theme} glow must not end at a vertical filter boundary`).toBeLessThanOrEqual(2);
		if (theme === "dark") await cycleTheme(page);
	}
});

test("all keynote covers switch to authored dark artwork and back without changing geometry", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "light" });
	await page.addInitScript(() => localStorage.setItem("ui-theme", "light"));
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Team ’26 EU keynote", exact: true })).toBeVisible();
	const covers = page.locator(coverSelector);
	await expect(covers).toHaveCount(23);
	const geometry = () => covers.evaluateAll((nodes) => nodes.map((node) => {
		const cover = node.getBoundingClientRect();
		const app = node.querySelector('[data-slot="jira-issue-cover-apps"]')?.getBoundingClientRect();
		return [cover.width, cover.height, app?.width, app?.height];
	}));
	const original = await geometry();
	const images = covers.locator('[data-slot="jira-issue-cover-artwork"] img');
	const originalSources = await images.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
	await cycleTheme(page);
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
	for (const cover of await covers.all()) await cover.scrollIntoViewIfNeeded();
	await expect.poll(() => images.evaluateAll((nodes) => nodes.every((node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0))).toBe(true);
	const dark = await images.evaluateAll((nodes) => nodes.map((node) => ({
		src: node.getAttribute("src"), filter: getComputedStyle(node).filter,
	})));
	expect(dark.length).toBeGreaterThanOrEqual(23);
	expect(dark.every((image) => image.src?.endsWith("-dark.svg") && image.filter === "none")).toBe(true);
	expect(await geometry()).toEqual(original);
	const appHeights = await covers.locator('[data-slot="jira-issue-cover-apps"]').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
	expect(appHeights.every((height) => height === 24)).toBe(true);
	await cycleTheme(page);
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
	await expect.poll(() => images.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")))).toEqual(originalSources);
	expect(await images.evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).filter === "none"))).toBe(true);
	expect(await geometry()).toEqual(original);
	await page.emulateMedia({ colorScheme: "dark" });
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
	await expect.poll(() => images.evaluateAll((nodes) => nodes.every((node) => node.getAttribute("src")?.endsWith("-dark.svg")))).toBe(true);
	await page.emulateMedia({ colorScheme: "light" });
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
	await expect.poll(() => images.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")))).toEqual(originalSources);
});
