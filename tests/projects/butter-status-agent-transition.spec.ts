import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`agent self-assignment updates the status with the expected motion (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
		const item = page.getByRole("dialog", { name: "Project butter" });
		await item.getByRole("button", { name: /\. Add agent$/ }).click();
		await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
		await page.getByRole("option", { name: /^Claude/ }).first().click();
		const run = page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" });
		await run.evaluate((button) => {
			const original = document.querySelector('[aria-label="Change status, To do"] [data-slot="progress-circle"]');
			button.addEventListener("click", () => {
				const started = performance.now();
				const samples: { value: string | null; same: boolean; path: string | null }[] = [];
				function sample() {
					const status = document.querySelector('[aria-label="Change status, In progress"] [data-slot="progress-circle"]');
					if (status) samples.push({ value: status.getAttribute("aria-valuenow"), same: status === original, path: status.querySelector("svg > path")?.getAttribute("d") ?? null });
					if (performance.now() - started < 1400) requestAnimationFrame(sample);
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
			expect(samples.some((sample) => sample.value === "0")).toBe(true);
			expect(new Set(samples.map((sample) => sample.path)).size).toBeGreaterThan(1);
		} else {
			expect(samples.every((sample) => sample.value === "50")).toBe(true);
		}
	});
}
