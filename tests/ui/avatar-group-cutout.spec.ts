import { expect, test } from "@playwright/test";
import { Resvg } from "@resvg/resvg-js";
import { appUrl } from "@/tests/helpers/origin";

test("overlapping avatar cutouts follow hover in both directions", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const group = page.getByRole("group", { name: "Cursor, used by Venn", exact: true });
	const agent = group.locator('[data-avatar-group-item][data-shape="hexagon"]');
	const human = group.locator('[data-avatar-group-item][data-shape="circle"]');
	const visual = human.locator('[data-slot="avatar-group-visual"]');
	await page.mouse.move(0, 0);
	await expect.poll(() => agent.evaluate((element) => (element as HTMLElement).style.transform)).toBe("none");
	await expect(visual).toHaveCSS("mask-image", /^url\(/u);
	const restingMask = await visual.evaluate((element) => (element as HTMLElement).style.maskImage);
	const restingWidth = (await agent.boundingBox())?.width;
	if (!restingWidth) throw new Error("Missing agent avatar geometry");
	await group.evaluate((element) => {
		element.addEventListener("pointerover", () => {
			const samples: { width: number; mask: string }[] = [];
			(window as Window & { avatarCutoutSamples?: typeof samples }).avatarCutoutSamples = samples;
			const sample = () => {
				const front = element.querySelector<HTMLElement>('[data-avatar-group-item][data-shape="hexagon"]');
				const back = element.querySelector<HTMLElement>('[data-slot="avatar-group-visual"]');
				if (!front || !back) return;
				samples.push({ width: front.getBoundingClientRect().width, mask: back.style.maskImage });
				if (samples.length < 40) requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		}, { once: true });
	});
	await agent.hover({ position: { x: 4, y: 8 } });
	await expect.poll(async () => (await agent.boundingBox())?.width ?? 0).toBeGreaterThan(restingWidth + 1);
	await expect.poll(() => page.evaluate(() => (window as Window & { avatarCutoutSamples?: unknown[] }).avatarCutoutSamples?.length ?? 0)).toBe(40);
	const samples = await page.evaluate(() => (window as Window & { avatarCutoutSamples?: { width: number; mask: string }[] }).avatarCutoutSamples ?? []);
	expect(new Set(samples.map(({ width }) => width)).size).toBeGreaterThan(3);
	expect(new Set(samples.map(({ mask }) => mask)).size).toBeGreaterThan(3);
	await expect.poll(() => visual.evaluate((element) => (element as HTMLElement).style.maskImage)).not.toBe(restingMask);
	await expect.poll(() => agent.evaluate((element) => (element as HTMLElement).style.transform)).toBe("scale(1.12)");
	await group.evaluate((element) => { (element as HTMLElement).style.backgroundColor = "rgb(30, 180, 90)"; });
	const groupBox = await group.boundingBox();
	if (!groupBox) throw new Error("Missing avatar group geometry");
	const image = await group.screenshot({ scale: "css" });
	const rendered = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${groupBox.width}" height="${groupBox.height}"><image href="data:image/png;base64,${image.toString("base64")}" width="${groupBox.width}" height="${groupBox.height}" /></svg>`).render();
	const gapPixel = (Math.floor(groupBox.height / 2) * rendered.width + Math.round(restingWidth)) * 4;
	for (const [index, expected] of [30, 180, 90].entries()) {
		expect(Math.abs(rendered.pixels[gapPixel + index] - expected)).toBeLessThan(30);
	}
	await group.evaluate((element) => { (element as HTMLElement).style.removeProperty("background-color"); });
	await page.mouse.move(0, 0);
	await expect.poll(() => visual.evaluate((element) => (element as HTMLElement).style.maskImage)).toBe(restingMask);
	await human.hover({ position: { x: 14, y: 8 } });
	await expect.poll(() => visual.evaluate((element) => (element as HTMLElement).style.maskImage)).not.toBe(restingMask);
	await page.mouse.move(0, 0);
	await expect.poll(() => visual.evaluate((element) => (element as HTMLElement).style.maskImage)).toBe(restingMask);
});
