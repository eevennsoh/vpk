import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

for (const { height, reducedMotion, view } of [
	{ height: 900, reducedMotion: "reduce", view: "Timeline" },
	{ height: 900, reducedMotion: "no-preference", view: "Timeline" },
	{ height: 900, reducedMotion: "reduce", view: "Agent sessions" },
	{ height: 900, reducedMotion: "no-preference", view: "Agent sessions" },
	{ height: 1200, reducedMotion: "reduce", view: "Agent sessions" },
	{ height: 1200, reducedMotion: "no-preference", view: "Agent sessions" },
] as const) {
	test(`reply context keeps the composer bottom anchored (${view}, ${height}px, ${reducedMotion})`, async ({ page }) => {
		await page.setViewportSize({ width: 1280, height });
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Work item", exact: true }).click();
		await page.getByRole("button", { name: "Close gallery", exact: true }).click();
		const activity = page.getByRole("region", { name: "Activity", exact: true });
		await activity.getByRole("tab", { name: view, exact: true }).click();
		const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
		if (view === "Agent sessions") {
			const summarize = thread.getByRole("button", { name: "Summarize thread" });
			await summarize.focus();
			await summarize.press("Enter");
			await expect(thread.getByRole("button", { name: "Show replies", exact: true })).toBeVisible();
		}
		const form = page.getByRole("form", { name: "Comment editor" });
		const editor = form.getByRole("textbox", { name: "Comment editor" });
		await editor.fill("Keep this draft");
		const reply = thread.getByRole("button", { name: "Reply", exact: true }).first();
		await reply.focus();
		await page.evaluate(() => {
			const samples: { action: string; bottom: number; height: number }[] = [];
			Reflect.set(window, "__composerAnchorSamples", samples);
			document.addEventListener("click", (event) => {
				const button = event.target instanceof Element ? event.target.closest("button") : null;
				const action = button?.getAttribute("aria-label");
				if (action !== "Reply" && action !== "Remove reply target") return;
				const form = document.querySelector<HTMLElement>('form[aria-label="Comment editor"]');
				if (!form) return;
				const start = performance.now();
				function sample(time: number) {
					if (!form || !action) return;
					const box = form.getBoundingClientRect();
					samples.push({ action, bottom: box.bottom, height: box.height });
					if (time - start < 450) requestAnimationFrame(sample);
				}
				sample(start);
			}, true);
		});
		await reply.press("Enter");
		const chip = form.getByTestId("reply-target-chip");
		await expect(chip).toBeVisible();
		await expect(form.locator('[data-align="block-start"] > div')).toHaveCSS("clip-path", "inset(-4px)");
		await expect(editor).toHaveText("Keep this draft");
		await expect.poll(() => page.evaluate(() => {
			const samples = Reflect.get(window, "__composerAnchorSamples");
			return Array.isArray(samples) ? samples.filter((sample) => sample.action === "Reply").length : 0;
		})).toBeGreaterThan(4);
		const remove = chip.getByRole("button", { name: "Remove reply target" });
		await remove.focus();
		await remove.press("Enter");
		await expect(chip).toHaveCount(0);
		await expect.poll(() => page.evaluate(() => {
			const samples = Reflect.get(window, "__composerAnchorSamples");
			return Array.isArray(samples) ? samples.filter((sample) => sample.action === "Remove reply target").length : 0;
		})).toBeGreaterThan(4);
		const samples = await page.evaluate(() => Reflect.get(window, "__composerAnchorSamples") as { action: string; bottom: number; height: number }[]);
		for (const action of ["Reply", "Remove reply target"]) {
			const frames = samples.filter((sample) => sample.action === action);
			expect(Math.max(...frames.map((frame) => frame.bottom)) - Math.min(...frames.map((frame) => frame.bottom))).toBeLessThanOrEqual(1);
			expect(Math.max(...frames.map((frame) => frame.height)) - Math.min(...frames.map((frame) => frame.height))).toBeGreaterThan(30);
		}
		const compact = await form.boundingBox();
		if (!compact) throw new Error("Missing compact composer");
		await editor.press("End");
		await editor.press("Shift+Enter");
		await editor.press("Shift+Enter");
		await expect.poll(async () => (await form.boundingBox())?.height).toBeGreaterThan(compact.height);
		const multiline = await form.boundingBox();
		if (!multiline) throw new Error("Missing expanded composer");
		expect(Math.abs(multiline.y + multiline.height - compact.y - compact.height)).toBeLessThanOrEqual(1);
		await editor.fill("Keep this draft");
		await expect.poll(async () => (await form.boundingBox())?.height).toBeCloseTo(compact.height, 0);
		const restored = await form.boundingBox();
		if (!restored) throw new Error("Missing restored composer");
		expect(Math.abs(restored.y + restored.height - compact.y - compact.height)).toBeLessThanOrEqual(1);
	});
}
