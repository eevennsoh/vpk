import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Butter v1 animates status changes when an agent starts (${reducedMotion})`, async ({ page }) => {
		await page.setViewportSize({ width: 1800, height: 1100 });
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
		const item = page.getByRole("dialog", { name: "Project butter" });
		const status = (name: string) => item.getByRole("button", { name: `Change status, ${name}` });
		await item.getByRole("button", { name: "Add agent", exact: true }).click();
		const agent = page.getByRole("dialog", { name: "Add agent", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true });
		async function sampleTransition(target: typeof agent, destination: string) {
			await target.evaluate((button, nextStatus) => {
				const original = document.querySelector('[aria-label^="Change status,"] [data-slot="progress-circle"]');
				button.addEventListener("click", () => {
					const start = performance.now();
					const samples: { value: string | null; path: string | null; same: boolean }[] = [];
					function sample() {
						const circle = document.querySelector(`[aria-label="Change status, ${nextStatus}"] [data-slot="progress-circle"]`);
						if (circle) samples.push({ value: circle.getAttribute("aria-valuenow"), path: circle.querySelector("svg > path")?.getAttribute("d") ?? null, same: circle === original });
						if (performance.now() - start < 2500) requestAnimationFrame(sample);
						else document.documentElement.dataset.statusTransitionFrames = JSON.stringify(samples);
					}
					requestAnimationFrame(sample);
				}, { capture: true, once: true });
			}, destination);
			await page.locator("html").evaluate((element) => { delete element.dataset.statusTransitionFrames; });
			await target.click();
			await expect(status(destination)).toBeVisible();
			await expect.poll(() => page.locator("html").getAttribute("data-status-transition-frames")).not.toBeNull();
			return JSON.parse((await page.locator("html").getAttribute("data-status-transition-frames")) ?? "[]") as { value: string | null; path: string | null; same: boolean }[];
		}
		const progress = await sampleTransition(agent, "In progress");
		expect(progress.length).toBeGreaterThan(0);
		expect(progress.every((sample) => sample.same && sample.value === "50")).toBe(true);
		if (reducedMotion === "no-preference") expect(new Set(progress.map((sample) => sample.path)).size).toBeGreaterThan(1);
		else expect(new Set(progress.map((sample) => sample.path)).size).toBe(1);
		await status("In progress").click();
		const done = await sampleTransition(page.getByRole("menuitem", { name: "Done" }), "Done");
		expect(done.length).toBeGreaterThan(0);
		expect(done.every((sample) => sample.same && sample.value === "100")).toBe(true);
		if (reducedMotion === "no-preference") expect(new Set(done.map((sample) => sample.path)).size).toBeGreaterThan(1);
		await expect(status("Done").locator("svg path.text-icon-success")).toBeVisible();
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`agent self-assignment updates the status with the expected motion (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
		const item = page.getByRole("dialog", { name: "Project butter" });
		await item.getByRole("button", { name: "Add agent", exact: true }).click();
		const run = page.getByRole("button", { name: /^Claude(?: Claude| \(Recommended\))?$/ });
		await run.evaluate((button) => {
			const original = document.querySelector('[aria-label="Change status, To do"] [data-slot="progress-circle"]');
			button.addEventListener("click", () => {
				const started = performance.now();
				const samples: { value: string | null; same: boolean; path: string | null }[] = [];
				function sample() {
					const status = document.querySelector('[aria-label="Change status, In progress"] [data-slot="progress-circle"]');
					if (status) samples.push({ value: status.getAttribute("aria-valuenow"), same: status === original, path: status.querySelector("svg > path")?.getAttribute("d") ?? null });
					if (performance.now() - started < 2500) requestAnimationFrame(sample);
					else document.documentElement.dataset.agentStatusFrames = JSON.stringify(samples);
				}
				requestAnimationFrame(sample);
			}, { once: true, capture: true });
		});
		await run.click();
		await expect(item.getByRole("button", { name: "Change status, In progress" })).toBeVisible();
		await expect.poll(() => page.locator("html").getAttribute("data-agent-status-frames")).not.toBeNull();
		const samples: { value: string | null; same: boolean; path: string | null }[] = JSON.parse((await page.locator("html").getAttribute("data-agent-status-frames")) ?? "[]");
		expect(samples.length).toBeGreaterThan(0);
		expect(samples.every((sample) => sample.same)).toBe(true);
		expect(samples.at(-1)?.value).toBe("50");
		if (reducedMotion === "no-preference") {
			expect(samples.every((sample) => sample.value === "50")).toBe(true);
			expect(new Set(samples.map((sample) => sample.path)).size).toBeGreaterThan(1);
		} else {
			expect(samples.every((sample) => sample.value === "50")).toBe(true);
		}
	});
}
