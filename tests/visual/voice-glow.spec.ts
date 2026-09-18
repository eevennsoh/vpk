import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${readFileSync(".dev-frontend-port", "utf8").trim()}`;
test.use({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });

test("simulated voice rises and settles by default without requesting microphone access", async ({ page }) => {
	await page.addInitScript(() => {
		navigator.mediaDevices.getUserMedia = async () => { throw new Error("Unexpected microphone request"); };
	});
	await page.goto(`${BASE_URL}/preview/visual/voice-glow`);
	const demo = page.locator("[data-voice-glow-demo]");
	await expect(demo.getByRole("switch", { name: "Simulated voice", exact: true })).toBeChecked();
	await expect(demo.getByRole("textbox", { name: "Manual intensity", exact: true })).toBeDisabled();
	const beam = demo.locator("[data-voice-beam]");
	await expect(beam).toBeVisible();
	const levels = await beam.evaluate(async (element) => {
		const host = element as HTMLElement;
		const property = `--vb-level-${host.dataset.voiceBeam}`;
		const samples: number[] = [];
		for (let sample = 0; sample < 45; sample++) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			samples.push(Number(host.style.getPropertyValue(property)));
		}
		return samples;
	});
	expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.25);
	await expect(demo.getByRole("status")).toContainText("Simulated voice input");
	await demo.getByRole("switch", { name: "Simulated voice", exact: true }).click();
	await expect(demo.getByRole("textbox", { name: "Manual intensity", exact: true })).toBeEnabled();
	await demo.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(demo.getByRole("switch", { name: "Simulated voice", exact: true })).toBeChecked();
});

test("all shapes align the effect boundary with the visible surface, including narrow screens", async ({ page }) => {
	await page.goto(`${BASE_URL}/components/visual/voice-glow`);
	const demo = page.locator("[data-voice-glow-demo]");
	const beam = demo.locator("[data-voice-beam]");
	for (const width of [1280, 390]) {
		await page.setViewportSize({ width, height: 900 });
		if (width < 768) await page.getByRole("button", { name: "Close sidebar", exact: true }).click();
		for (const name of ["Chat input", "Recording pill", "Mobile screen"]) {
			await demo.getByRole("button", { name, exact: true }).click();
			const geometry = await beam.evaluate((element) => {
				const host = element.getBoundingClientRect();
				const child = element.firstElementChild!.getBoundingClientRect();
				return { widthDifference: host.width - child.width, xDifference: host.x - child.x };
			});
			expect(Math.abs(geometry.widthDifference), `${width}/${name}/width`).toBeLessThan(0.5);
			expect(Math.abs(geometry.xDifference), `${width}/${name}/x`).toBeLessThan(0.5);
		}
		await page.screenshot({ path: `output/agent-browser/voice-glow/mobile-shape-${width}.png` });
	}
});

test("pause freezes the painted frame, processing travels, and reset restores the chat preset", async ({ page }) => {
	await page.goto(`${BASE_URL}/preview/visual/voice-glow`);
	const demo = page.locator("[data-voice-glow-demo]");
	const beam = demo.locator("[data-voice-beam]");
	await expect(beam).toBeVisible();
	await demo.getByRole("button", { name: "Pause glow", exact: true }).click();
	await expect(beam).toHaveAttribute("data-paused", "");
	const frozen = await beam.getAttribute("style");
	await page.waitForTimeout(300);
	expect(await beam.getAttribute("style")).toBe(frozen);
	await demo.getByRole("button", { name: "Resume glow", exact: true }).click();
	await demo.getByRole("switch", { name: "Processing", exact: true }).click();
	await expect(beam).toHaveAttribute("data-processing", "");
	const center = () => beam.evaluate((element) => (element as HTMLElement).style.getPropertyValue(`--vb-cx-${element.getAttribute("data-voice-beam")}`));
	const initial = await center();
	await expect.poll(center).not.toBe(initial);
	await demo.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(beam).toHaveAttribute("data-voice-type", "default");
	await expect(beam).not.toHaveAttribute("data-processing", "");
	await page.screenshot({ path: "output/agent-browser/voice-glow/preview-light.png" });
});

test("reduced motion holds decorative travel and hue while retaining a visible glow", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
	await page.addInitScript(() => localStorage.setItem("ui-theme", "dark"));
	await page.goto(`${BASE_URL}/preview/visual/voice-glow`);
	const demo = page.locator("[data-voice-glow-demo]");
	const beam = demo.locator("[data-voice-beam]");
	await demo.getByRole("switch", { name: "Processing", exact: true }).click();
	await expect.poll(() => beam.evaluate((element) => {
		const host = element as HTMLElement;
		const id = host.dataset.voiceBeam;
		return [host.style.getPropertyValue(`--vb-cx-${id}`), host.style.getPropertyValue(`--vb-hue-${id}`)];
	})).toEqual(["0.0px", "0.00deg"]);
	await page.waitForTimeout(300);
	await expect(beam).toBeVisible();
	await page.screenshot({ path: "output/agent-browser/voice-glow/preview-dark-reduced-motion.png" });
});
