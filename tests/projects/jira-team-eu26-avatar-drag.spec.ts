import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const evidence = "output/agent-browser/avatar-drag";

for (const peel of [false, true]) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`avatars stay on the painted card during first and repeated drags (peel=${peel}, motion=${reducedMotion})`, async ({ page }) => {
			test.setTimeout(60_000);
			await page.setViewportSize({ width: 1440, height: 1000 });
			await page.emulateMedia({ reducedMotion });
			await page.addInitScript((sessionPeel) => {
				localStorage.setItem("ui-design-variants", JSON.stringify({ schemaVersion: 2, sessionPeel }));
			}, peel);
			await page.goto(`${baseURL}/jira-team-eu26`, { waitUntil: "domcontentloaded" });
			await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
			const row = page.locator("[data-agent-session-column] article").first();
			if (!await row.isVisible()) {
				await page.getByRole("button", { name: "Expand Unlink sessions column", exact: true }).click();
			}
			await expect(row).toBeVisible();
			await mkdir(evidence, { recursive: true });

			for (const drag of [1, 2]) {
				await row.scrollIntoViewIfNeeded();
				const box = await row.boundingBox();
				expect(box).not.toBeNull();
				if (!box) return;
				// Collect painted frames, starting on the frame that mounts the
				// portal. Read the background itself: the pill's layout box does
				// not include its independently animated travelling surface.
				await page.evaluate(() => {
					const samples: { time: number; surface: number[]; avatars: { role: string; rect: number[] }[]; ready: boolean; composition: string | null }[] = [];
					(window as typeof window & { avatarDragSamples: typeof samples }).avatarDragSamples = samples;
					let started = 0;
					let scheduled = false;
					const observer = new MutationObserver(() => {
						if (!scheduled && document.querySelector("[data-session-drag-overlay]")) {
							scheduled = true;
							requestAnimationFrame(sample);
						}
					});
					const sample = (time: number) => {
						const overlay = document.querySelector("[data-session-drag-overlay]");
						const pill = overlay?.querySelector("[data-session-drag-pill]");
						const surface = pill?.querySelector("[data-session-drag-surface]")?.getBoundingClientRect();
						if (!surface || !pill) { observer.disconnect(); return; }
						started ||= time;
						samples.push({
							time: time - started,
							surface: [surface.x, surface.y, surface.width, surface.height],
							avatars: [...pill.querySelectorAll("[data-avatar-role]")].map((element) => {
								const rect = element.getBoundingClientRect();
								return { role: element.getAttribute("data-avatar-role") ?? "", rect: [rect.x - surface.x, rect.y - surface.y, rect.width, rect.height] };
							}),
							ready: overlay?.querySelector("[data-peel-ready=true]") !== null,
							composition: pill.querySelector("[data-composition]")?.getAttribute("data-composition") ?? null,
						});
						if (time - started < 650) requestAnimationFrame(sample);
						else observer.disconnect();
					};
					observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-session-drag-overlay"] });
				});
				const x = box.x + 80;
				const y = box.y + box.height / 2;
				await page.mouse.move(x, y);
				await page.mouse.down();
				await page.mouse.move(x + 4, y + 4);
				// Keep moving while the entrance runs, so transformed ancestors
				// cannot appear correct merely because the pointer is parked.
				await page.mouse.move(x + 120, y + 35, { steps: 12 });
				await page.waitForFunction(() => (window as typeof window & { avatarDragSamples: { time: number }[] }).avatarDragSamples.at(-1)!.time >= 650);
				const samples = await page.evaluate(() => (window as typeof window & { avatarDragSamples: { time: number; surface: number[]; avatars: { role: string; rect: number[] }[]; ready: boolean; composition: string | null }[] }).avatarDragSamples);
				const name = `peel-${peel}-${reducedMotion}-drag-${drag}`;
				await writeFile(`${evidence}/${name}.json`, JSON.stringify(samples, null, 2));
				// A cold paper capture can finish after the entrance. Verify its
				// handoff separately instead of imposing a capture-time budget.
				if (peel && reducedMotion === "no-preference") {
					await expect(page.locator("[data-session-drag-overlay] [data-peel-surface]"))
						.toHaveAttribute("data-peel-ready", "true", { timeout: 15_000 });
				}
				await page.screenshot({ path: `${evidence}/${name}.png` });
				await page.mouse.move(700, 140);
				await page.mouse.up();
				await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
				expect(samples.length).toBeGreaterThan(8);
				expect(samples[0].time).toBe(0);
				for (const sample of samples) {
					expect(sample.composition).toBe("group");
					expect(sample.avatars).toHaveLength(2);
					for (const avatar of sample.avatars) {
						const [left, top, width, height] = avatar.rect;
						const message = `${name} at ${sample.time}ms (${avatar.role})`;
						expect(left, message).toBeGreaterThanOrEqual(-2);
						expect(top, message).toBeGreaterThanOrEqual(-2);
						expect(left + width, message).toBeLessThanOrEqual(sample.surface[2] + 2);
						expect(top + height, message).toBeLessThanOrEqual(sample.surface[3] + 2);
						expect(width, message).toBeCloseTo(16, 1);
						expect(height, message).toBeCloseTo(16, 1);
					}
				}
				if (reducedMotion === "reduce") {
					expect(samples.some((sample) => sample.ready)).toBe(false);
				}
			}
		});
	}
}
