import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const evidence = "output/agent-browser/peel-carry-side";

test("regular preview stays level during first and repeated pickup", async ({ page }) => {
	if (!baseURL) throw new Error("Set PLAYWRIGHT_BASE_URL to this worktree's origin");
	const pickupEvidence = "output/agent-browser/flat-pickup-side";
	await mkdir(pickupEvidence, { recursive: true });
	await page.setViewportSize({ width: 1440, height: 920 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, sessionPeel: false })));
	await page.goto(`${baseURL}/jira-team-eu26`);
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
	if (await expand.isVisible()) await expand.click();
	const article = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
	for (const drag of [1, 2]) {
		await article.scrollIntoViewIfNeeded();
		await article.hover();
		const box = await article.boundingBox();
		if (!box) throw new Error("Missing session source");
		await page.evaluate(() => {
			const samples: { pickup: boolean; carryReady: boolean; transform: string }[] = [];
			const result = { samples, done: false };
			(window as typeof window & { flatPickup: typeof result }).flatPickup = result;
			let started: number | undefined;
			const sample = (time: number) => {
				const overlay = document.querySelector("[data-session-drag-overlay]");
				const surface = overlay?.querySelector("[data-session-drag-surface]");
				const paint = overlay?.querySelector<HTMLElement>("[data-session-carry-paint]");
				if (!surface || !paint) return;
				started ??= time;
				const scale = new DOMMatrixReadOnly(getComputedStyle(surface).transform);
				const pickup = Math.abs(scale.a - 1) > 0.0001 || Math.abs(scale.d - 1) > 0.0001
					|| surface.getAnimations().some((animation) => animation.playState === "running" || animation.pending);
				const carryReady = overlay?.querySelector("[data-session-carry-ready=true]") !== null;
				samples.push({ pickup, carryReady, transform: paint.style.transform });
				if (time - started < 1100) requestAnimationFrame(sample);
				else result.done = true;
			};
			const observer = new MutationObserver(() => {
				if (document.querySelector("[data-session-drag-overlay]")) {
					observer.disconnect();
					requestAnimationFrame(sample);
				}
			});
			observer.observe(document.body, { childList: true, subtree: true });
		});
		const x = box.x + box.width * 0.75;
		const y = box.y + box.height / 2;
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + 4, y);
		await page.mouse.move(x + 80, y + 15, { steps: 8 });
		await page.screenshot({ path: `${pickupEvidence}/pickup-${drag}.png` });
		await expect.poll(() => page.evaluate(() => (window as typeof window & { flatPickup: { done: boolean } }).flatPickup.done)).toBe(true);
		const samples = await page.evaluate(() => (window as typeof window & { flatPickup: { samples: { pickup: boolean; carryReady: boolean; transform: string }[] } }).flatPickup.samples);
		await writeFile(`${pickupEvidence}/pickup-${drag}.json`, JSON.stringify(samples, null, 2));
		await page.mouse.move(700, 150);
		await page.mouse.up();
		const pickupSamples = samples.filter((sample) => sample.pickup);
		expect(pickupSamples.length).toBeGreaterThan(0);
		for (const sample of pickupSamples) {
			expect(sample.transform).toBe("rotateY(0rad) rotateZ(0rad)");
			expect(sample.carryReady).toBe(false);
		}
		expect(samples.some((sample) => !sample.pickup && sample.carryReady)).toBe(true);
	}
});

for (const theme of ["light", "dark"] as const) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`regular session preview carries paper tilt, roll and edge light (${theme}, ${reducedMotion})`, async ({ page }) => {
			test.setTimeout(60_000);
			if (!baseURL) throw new Error("Set PLAYWRIGHT_BASE_URL to this worktree's origin");
			await mkdir(evidence, { recursive: true });
			await page.setViewportSize({ width: 1440, height: 920 });
			await page.emulateMedia({ reducedMotion, colorScheme: theme });
			await page.addInitScript((mode) => {
				localStorage.setItem("ui-theme", mode);
				localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, sessionPeel: false }));
			}, theme);
			await page.goto(`${baseURL}/jira-team-eu26`);
			await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
			const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
			if (await expand.isVisible()) await expand.click();
			const article = page.getByTestId("agent-session-row-lw-scope-thread").locator("article");
			await article.scrollIntoViewIfNeeded();
			await article.hover();
			const box = await article.boundingBox();
			if (!box) throw new Error("Missing session source");
			const x = box.x + box.width * 0.7;
			const y = box.y + box.height / 2;
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x + 4, y);
			const overlay = page.locator("[data-session-drag-overlay]");
			const sensor = overlay.locator("[data-session-carry-frame]");
			const paint = overlay.locator("[data-session-carry-paint]");
			await expect(sensor).toHaveCount(1);
			await expect(overlay).toHaveAttribute("aria-hidden", "true");
			await expect(overlay).toHaveAttribute("inert", "");
			await expect(overlay.locator("canvas")).toHaveCount(0);
			await expect(overlay.locator("[data-session-fusion-chip]")).toHaveCount(1);
			await expect(sensor).toHaveAttribute("data-session-fusion-chip", "");
			const footprint = await sensor.boundingBox();
			if (!footprint) throw new Error("Missing stable fusion footprint");
			const readPose = () => paint.evaluate((node) => {
				const transform = (node as HTMLElement).style.transform;
				const read = (axis: string) => Number(transform.match(new RegExp(`rotate${axis}\\(([-.\\de]+)rad\\)`))?.[1] ?? 0);
				const light = (side: string) => Number((node.querySelector(`[data-session-carry-light=${side}]`) as HTMLElement | null)?.style.opacity ?? 0);
				return { tilt: read("Y"), roll: read("Z"), left: light("left"), right: light("right") };
			});
			if (reducedMotion === "no-preference") await expect(sensor).toHaveAttribute("data-session-carry-ready", "true");
			await page.mouse.move(x + 140, y + 20, { steps: 14 });
			if (reducedMotion === "no-preference") {
				await expect.poll(async () => (await readPose()).right).toBeGreaterThan(0.005);
				await expect.poll(async () => Math.abs((await readPose()).roll)).toBeGreaterThan(0.001);
				const right = await readPose();
				expect(right.tilt).toBeGreaterThan(0);
				expect(Math.abs(right.tilt)).toBeLessThanOrEqual(0.19);
				expect(Math.abs(right.roll)).toBeLessThanOrEqual(0.075);
				expect(right.left).toBe(0);
				const carried = await sensor.boundingBox();
				expect(carried?.width).toBeCloseTo(footprint.width, 1);
				expect(carried?.height).toBeCloseTo(footprint.height, 1);
				expect(await sensor.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
				await page.screenshot({ path: `${evidence}/${theme}-right.png` });
				await page.mouse.move(x - 100, y + 20, { steps: 20 });
				await expect.poll(async () => (await readPose()).left).toBeGreaterThan(0.005);
				const left = await readPose();
				expect(left.right).toBe(0);
				expect(Math.abs(left.roll)).toBeLessThanOrEqual(0.075);
				await page.screenshot({ path: `${evidence}/${theme}-left.png` });
				await writeFile(`${evidence}/${theme}-poses.json`, JSON.stringify({ right, left, footprint, carried }, null, 2));
				await expect.poll(() => paint.evaluate((node) => (node as HTMLElement).style.willChange)).toBe("");
			} else {
				await expect(overlay.locator("[data-session-carry-light]")).toHaveCount(0);
				expect(await readPose()).toEqual({ tilt: 0, roll: 0, left: 0, right: 0 });
			}
			await page.mouse.move(700, 150);
			await page.mouse.up();
			await expect(overlay).toHaveCount(0);
			await expect(article).toBeVisible();
		});
	}
}
