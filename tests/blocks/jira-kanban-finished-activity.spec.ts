import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("finished agent activity dismisses while the work item and active sessions remain", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/jira-kanban"));
	const preview = page.locator("#preview");
	const finished = preview.getByRole("button", { name: "Claude: Finished", exact: true });
	await expect(finished).toHaveCount(1);
	await expect(preview.getByRole("button", { name: "Cursor: Working", exact: true })).toHaveCount(1);
	await finished.focus();
	await page.waitForTimeout(6000);
	await expect(finished).toHaveCount(1);
	const recording = page.evaluate(() => new Promise<{ opacity: number; height: number; scale: number; actualTop: number; actualOpacity: number }[]>((resolve) => {
		const button = document.querySelector('#preview [aria-label="Claude: Finished"]');
		const row = button?.closest('[data-slot="jira-issue-agent-row"]')?.parentElement;
		const chin = button?.closest('[data-slot="jira-issue-agent-invocation-chin"]');
		const actual = button?.closest('[data-slot="jira-issue-agent-invocation-actual"]');
		if (!row || !chin || !actual) return resolve([]);
		const samples: { opacity: number; height: number; scale: number; actualTop: number; actualOpacity: number }[] = [];
		const sample = () => {
			if (!row.isConnected) return resolve(samples);
			const style = getComputedStyle(row);
			const transform = new DOMMatrixReadOnly(style.transform);
			samples.push({ opacity: Number(style.opacity), height: chin.getBoundingClientRect().height, scale: Math.hypot(transform.a, transform.b), actualTop: actual.getBoundingClientRect().top, actualOpacity: Number(getComputedStyle(actual).opacity) });
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	}));
	await preview.getByRole("button", { name: /^PAY-101:/u }).focus();
	await expect(finished).toHaveCount(0, { timeout: 10000 });
	const samples = await recording;
	const fullHeight = Math.max(...samples.map((sample) => sample.height));
	expect(samples.some((sample) => sample.opacity > 0 && sample.opacity < 1)).toBe(true);
	expect(samples.some((sample) => sample.scale < 0.995 && sample.opacity > 0)).toBe(true);
	expect(samples.some((sample) => sample.height > 0 && sample.height < fullHeight - 1)).toBe(true);
	expect(samples.filter((sample) => sample.opacity >= 0.995).every((sample) => sample.height >= fullHeight - 1)).toBe(true);
	expect(samples.every((sample) => sample.actualOpacity > 0.99)).toBe(true);
	const actualTops = samples.map((sample) => sample.actualTop);
	expect(Math.max(...actualTops) - Math.min(...actualTops)).toBeLessThan(5);
	await expect(preview.getByRole("button", { name: /^PAY-101:/u })).toHaveCount(1);
	await expect(preview.getByRole("button", { name: "Cursor: Working", exact: true })).toHaveCount(1);
	await expect(preview.getByRole("button", { name: /More actions for The adapter keep-or-delete argument/u })).toHaveCount(1);
});

test("finished agent activity dismisses with reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/blocks/jira-kanban"));
	const preview = page.locator("#preview");
	const finished = preview.getByRole("button", { name: "Claude: Finished", exact: true });
	await expect(finished).toHaveCount(1);
	await expect(finished).toHaveCount(0, { timeout: 10000 });
	await expect(preview.getByRole("button", { name: /^PAY-101:/u })).toHaveCount(1);
});
