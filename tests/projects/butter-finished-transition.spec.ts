import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

declare global {
	interface Window {
		__finishedTransitionRow: Element;
		__finishedTransitionAvatar: Element | null;
		__finishedTransitionSamples: { time: number; rowWidth: number; avatarWidth: number; label: string | null }[];
	}
}

test("the arriving agent row stays mounted while its status finishes", async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const steps = page.getByRole("group", { name: "Merchant onboarding journey steps" });
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await steps.getByRole("button", { name: "In progress" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await steps.getByRole("button", { name: "Done" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "Done");
	const row = card.locator('[data-slot="jira-issue-agent-row"]');
	await expect(row).toContainText("Working");
	await row.evaluate((element) => {
		const avatar = element.querySelector('[data-slot="jira-issue-agent-avatar-handoff"]');
		const samples: { time: number; rowWidth: number; avatarWidth: number; label: string | null }[] = [];
		Object.assign(window, { __finishedTransitionRow: element, __finishedTransitionAvatar: avatar, __finishedTransitionSamples: samples });
		const sample = () => {
			if (!element.isConnected) return;
			samples.push({ time: performance.now(), rowWidth: element.getBoundingClientRect().width, avatarWidth: avatar?.getBoundingClientRect().width ?? 0, label: element.querySelector('[data-jira-issue-agent-row-handle]')?.getAttribute("aria-label") ?? null });
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
	await expect(card.getByRole("button", { name: "Claude: Finished" })).toBeVisible();
	// Sample for 350ms of frames after the status flips to Finished.
	await page.waitForFunction(() => {
		const samples = window.__finishedTransitionSamples;
		const finished = samples.find((sample) => sample.label === "Claude: Finished");
		const last = samples.at(-1);
		return Boolean(finished && last && last.time - finished.time >= 350);
	});
	const continuity = await row.evaluate((element) => {
		const state = window;
		const finished = state.__finishedTransitionSamples.find((sample) => sample.label === "Claude: Finished");
		const samples = state.__finishedTransitionSamples.filter((sample) => finished && sample.time >= finished.time - 100);
		return { row: state.__finishedTransitionRow === element, avatar: state.__finishedTransitionAvatar === element.querySelector('[data-slot="jira-issue-agent-avatar-handoff"]'), sampleCount: samples.length, rowRatio: Math.min(...samples.map((sample) => sample.rowWidth)) / Math.max(...samples.map((sample) => sample.rowWidth)), avatarRatio: Math.min(...samples.map((sample) => sample.avatarWidth)) / Math.max(...samples.map((sample) => sample.avatarWidth)) };
	});
	expect(continuity.row).toBe(true);
	expect(continuity.avatar).toBe(true);
	expect(continuity.sampleCount).toBeGreaterThan(2);
	expect(continuity.rowRatio).toBeGreaterThan(0.95);
	expect(continuity.avatarRatio).toBeGreaterThan(0.95);
});
