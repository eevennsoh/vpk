import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the attributed avatar pair stays with its session when pinning and unpinning", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	await activity.getByRole("button", { name: /Other agent activity/u }).click();
	const marcus = activity.locator('[data-jira-activity-entry-id="invocation-butter-marcus-accessibility"]:visible');
	await marcus.hover();
	await marcus.getByRole("button", { name: "Pin comment" }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	const pair = thread.locator('[data-summary-avatar-pair] [data-composition="group"]');
	await expect(pair).toBeVisible();
	await expect(thread.locator("[data-summary-avatar-stack] > span").first()).toHaveCSS("opacity", "1");

	for (const label of ["Pin comment", "Unpin comment"]) {
		await thread.hover();
		const control = thread.getByRole("button", { name: label, exact: true });
		await control.evaluate((button) => {
			button.addEventListener("click", () => {
				const result: Array<{ agent: number; human: number }> = [];
				Reflect.set(window, "__pinAvatarSamples", null);
				const start = performance.now();
				const sample = () => {
					const row = button.closest('[data-jira-activity-entry-id]');
					const anchor = row?.querySelector<HTMLElement>("[data-summary-avatar-stack]");
					const agent = row?.querySelector<HTMLElement>('[data-summary-avatar-pair] [data-avatar-role="agent"]');
					const human = row?.querySelector<HTMLElement>('[data-summary-avatar-pair] [data-avatar-role="human"]');
					if (anchor && agent && human) result.push({ agent: agent.getBoundingClientRect().top - anchor.getBoundingClientRect().top, human: human.getBoundingClientRect().top - anchor.getBoundingClientRect().top });
					if (performance.now() - start < 700) requestAnimationFrame(sample);
					else Reflect.set(window, "__pinAvatarSamples", result);
				};
				requestAnimationFrame(sample);
			}, { once: true, capture: true });
		});
		await control.click();
		await page.waitForFunction(() => Array.isArray(Reflect.get(window, "__pinAvatarSamples")));
		const frames: Array<{ agent: number; human: number }> = await page.evaluate(() => Reflect.get(window, "__pinAvatarSamples"));
		expect(frames.length).toBeGreaterThan(3);
		for (const role of ["agent", "human"] as const) {
			const values = frames.map((frame) => frame[role]);
			expect(Math.max(...values) - Math.min(...values), `${label}: ${role} left the row`).toBeLessThanOrEqual(1);
		}
	}
});
