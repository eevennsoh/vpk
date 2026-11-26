import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const reducedMotion of ["no-preference", "reduce"] as const) test(`pinning and unpinning moves the same activity row (${reducedMotion})`, async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-sarah-onboarding-copy"]:visible');
	await thread.evaluate((node) => { Reflect.set(window, "__pinMotionRow", node); });
	for (const label of ["Pin comment", "Unpin comment"]) {
		await thread.hover();
		const button = thread.getByRole("button", { name: label, exact: true });
		await button.focus();
		const samples = thread.evaluate(async (row) => {
			const button = row.querySelector<HTMLButtonElement>('button[aria-label="Pin comment"], button[aria-label="Unpin comment"]');
			if (!button) throw new Error("Pin control is missing");
			await new Promise<void>((resolve) => button.addEventListener("click", () => resolve(), { capture: true, once: true }));
			const frames: string[] = [];
			const start = performance.now();
			while (performance.now() - start < 500) {
				frames.push(getComputedStyle(row).transform);
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			}
			return frames;
		});
		await button.click();
		const transforms = await samples;
		if (reducedMotion === "no-preference") expect(transforms.some((value) => value !== "none" && value !== "matrix(1, 0, 0, 1, 0, 0)")).toBe(true);
		else expect(transforms.every((value) => value === "none" || value === "matrix(1, 0, 0, 1, 0, 0)")).toBe(true);
		await expect(thread.getByRole("button", { name: label === "Pin comment" ? "Unpin comment" : "Pin comment", exact: true })).toBeFocused();
		await expect.poll(() => thread.evaluate((node) => node === Reflect.get(window, "__pinMotionRow"))).toBe(true);
	}
	await thread.hover();
	await thread.getByRole("button", { name: "Pin comment", exact: true }).click();
	await thread.getByRole("button", { name: "Unpin comment", exact: true }).click();
	await expect(thread.getByRole("button", { name: "Pin comment", exact: true })).toHaveAttribute("aria-pressed", "false");
	await expect.poll(() => thread.evaluate((node) => node === Reflect.get(window, "__pinMotionRow"))).toBe(true);
});

test("a teammate session animates between the session groups when pinned and unpinned", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("button", { name: "Agent sessions", exact: true }).click();
	await activity.getByRole("button", { name: /Other agent activity/u }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-marcus-accessibility"]:visible');
	for (const label of ["Pin comment", "Unpin comment"]) {
		await thread.hover();
		const button = thread.getByRole("button", { name: label, exact: true });
		await button.focus();
		const samples = page.evaluate(async () => {
			const button = [...document.querySelectorAll<HTMLButtonElement>('[data-jira-activity-entry-id="invocation-butter-marcus-accessibility"] button[aria-label="Pin comment"], [data-jira-activity-entry-id="invocation-butter-marcus-accessibility"] button[aria-label="Unpin comment"]')].find((node) => node.getBoundingClientRect().width > 0);
			if (!button) throw new Error("Pin control is missing");
			await new Promise<void>((resolve) => button.addEventListener("click", () => resolve(), { capture: true, once: true }));
			const frames: string[] = [];
			const start = performance.now();
			while (performance.now() - start < 500) {
				const row = [...document.querySelectorAll<HTMLElement>('[data-jira-activity-entry-id="invocation-butter-marcus-accessibility"]')].find((node) => node.getBoundingClientRect().width > 0);
				const wrapper = row?.closest<HTMLElement>("[data-pin-motion-row]");
				if (wrapper) frames.push(getComputedStyle(wrapper).transform);
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			}
			return frames;
		});
		await button.click();
		expect((await samples).some((value) => value !== "none" && value !== "matrix(1, 0, 0, 1, 0, 0)")).toBe(true);
		await expect(thread.getByRole("button", { name: label === "Pin comment" ? "Unpin comment" : "Pin comment", exact: true })).toBeFocused();
	}
});

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
