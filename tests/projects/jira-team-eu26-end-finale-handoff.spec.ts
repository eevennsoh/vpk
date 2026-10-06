import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("the shader-to-DOM handoff keeps an unchanged pixel at the same brightness", async ({ page }) => {
	test.setTimeout(90_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/jira-team-eu26-end?finale=7.5&hold"), { waitUntil: "domcontentloaded" });
	await page.getByRole("heading", { name: /EU keynote/ }).first().click();
	const label = page.locator("dialog").getByText("Rovo work mode", { exact: true });
	await expect(label).toBeVisible({ timeout: 30_000 });
	await label.evaluate((element) => {
		const tile = element.parentElement!.parentElement!.parentElement!;
		const host = document.createElement("div");
		host.id = "handoff-pixel-proof";
		host.style.cssText = "position:fixed;left:0;top:0;width:16px;height:16px;background:white;z-index:2147483647";
		const layers = document.createElement("div");
		layers.style.cssText = `position:absolute;inset:0;isolation:${getComputedStyle(tile.parentElement!).isolation}`;
		const sheet = document.createElement("canvas");
		sheet.width = sheet.height = 16;
		const context = sheet.getContext("2d")!;
		context.fillStyle = "rgb(64, 64, 64)";
		context.fillRect(0, 0, 16, 16);
		sheet.style.cssText = "position:absolute;inset:0";
		const face = document.createElement("div");
		face.style.cssText = `position:absolute;inset:0;background:rgb(64,64,64);mix-blend-mode:${getComputedStyle(tile).mixBlendMode}`;
		layers.append(sheet, face);
		host.append(layers);
		document.querySelector("dialog")!.append(host);
	});
	for (const handoff of [0, 0.25, 0.5, 0.75, 1]) {
		await page.evaluate((amount) => {
			const layers = document.querySelector("#handoff-pixel-proof")!.firstElementChild!;
			(layers.children[0] as HTMLElement).style.opacity = String(1 - amount);
			(layers.children[1] as HTMLElement).style.opacity = String(amount);
		}, handoff);
		const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 16, height: 16 } });
		const pixel = await page.evaluate(async (base64) => {
			const image = new Image();
			image.src = `data:image/png;base64,${base64}`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = canvas.height = 16;
			const context = canvas.getContext("2d")!;
			context.drawImage(image, 0, 0, 16, 16);
			return [...context.getImageData(8, 8, 1, 1).data];
		}, shot.toString("base64"));
		for (const channel of pixel.slice(0, 3)) expect(Math.abs(channel - 64), `handoff ${handoff}: ${pixel}`).toBeLessThanOrEqual(1);
		expect(pixel[3]).toBe(255);
	}
});

const captureScript = buildSync({
	stdin: { contents: 'export { printFinaleElement } from "./components/projects/jira-team-eu26-end/finale/hooks/use-finale-prints";', resolveDir: process.cwd(), loader: "ts" },
	bundle: true, format: "iife", globalName: "finaleHandoffCapture", platform: "browser",
	define: { "process.env.NODE_ENV": '"production"' }, write: false,
}).outputFiles[0].text;

declare global {
	interface Window {
		finaleHandoffCapture: { printFinaleElement: (element: HTMLElement, options: { detach: boolean }) => Promise<HTMLCanvasElement> };
	}
}

test("shader snapshots retain the Latin font sources used by the live bento", async ({ page }) => {
	test.setTimeout(90_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/jira-team-eu26-end?finale=7.5&hold"), { waitUntil: "domcontentloaded" });
	await page.getByRole("heading", { name: /EU keynote/ }).first().click();
	await expect(page.locator("dialog").getByText("Rovo work mode", { exact: true })).toBeVisible({ timeout: 30_000 });
	await page.addScriptTag({ content: captureScript });
	const fonts = await page.evaluate(async () => {
		await document.fonts.ready;
		const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
		let svg = "";
		Object.defineProperty(HTMLImageElement.prototype, "src", { ...descriptor, set(value: string) {
			if (value.startsWith("data:image/svg+xml")) svg = decodeURIComponent(value.slice(value.indexOf(",") + 1));
			descriptor.set!.call(this, value);
		} });
		try {
			const label = [...document.querySelectorAll<HTMLParagraphElement>("dialog p")].find(element => element.textContent === "Rovo work mode")!;
			await window.finaleHandoffCapture.printFinaleElement(label, { detach: true });
		} finally {
			Object.defineProperty(HTMLImageElement.prototype, "src", descriptor);
		}
		const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
		const sheet = new CSSStyleSheet();
		sheet.replaceSync([...parsed.querySelectorAll("style")].map(style => style.textContent).join("\n"));
		return [...sheet.cssRules].filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
			.filter(rule => rule.style.fontFamily.includes("Atlassian") && rule.style.fontStyle === "normal" && rule.style.getPropertyValue("unicode-range").includes("U+0-FF"))
			.map(rule => ({ family: rule.style.fontFamily.replaceAll('"', ""), embedded: rule.style.getPropertyValue("src").includes("data:") }));
	});
	expect(fonts).toEqual(expect.arrayContaining([
		{ family: "Atlassian Sans", embedded: true },
		{ family: "Atlassian Mono", embedded: true },
	]));
});
