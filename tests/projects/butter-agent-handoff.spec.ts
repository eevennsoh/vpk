import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

async function selectCodingAgent(page: Page, key: string) {
	const card = page.locator(`[data-issue-key="${key}"][data-board-column-title]`);
	await card.getByRole("button", { name: `Add agent to ${key}` }).focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents", exact: true });
	const option = picker.getByRole("option", { name: /^Jira Coding Agent/ });
	await option.hover();
	const observations = page.evaluate(async (issueKey) => {
		const results = { glow: false, handoff: false, overlap: false, scaled: false, working: false, shadow: "" };
		const start = performance.now();
		await new Promise<void>((resolve) => {
			const target = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) => element.textContent?.includes("Jira Coding Agent"));
			if (!target) return resolve();
			target.addEventListener("click", () => resolve(), { once: true, capture: true });
		});
		while (performance.now() - start < 3000) {
			const card = document.querySelector<HTMLElement>(`[data-issue-key="${issueKey}"][data-board-column-title]`);
			const handoff = card?.querySelector('[data-slot="jira-issue-agent-invocation-handoff"][data-agent-id="jira-coding"]');
			const preview = card?.querySelector('[data-slot="jira-issue-agent-invocation-preview"]');
			results.handoff ||= Boolean(handoff);
			const avatar = handoff?.querySelector<HTMLElement>("span");
			if (avatar) results.scaled ||= new DOMMatrixReadOnly(getComputedStyle(avatar).transform).a < 0.99;
			results.overlap ||= Boolean(handoff && preview);
			const halo = card?.querySelector<HTMLElement>('[data-jira-linking-glow-halo]');
			results.glow ||= Boolean(halo);
			if (halo) results.shadow = halo.style.boxShadow;
			results.working ||= Boolean(card?.querySelector('[data-jira-issue-agent-row-handle]')?.textContent?.includes("Working"));
			if (results.glow && results.working && performance.now() - start > 500) break;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return results;
	}, key);
	await option.click();
	return { card, result: await observations };
}

test("new and repeated selections replace the preview and each show the avatar-colored glow", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	for (let iteration = 0; iteration < 2; iteration++) {
		const { card, result } = await selectCodingAgent(page, "PAY-105");
		expect(result).toMatchObject({ glow: true, handoff: true, overlap: false, scaled: true, working: true });
		expect(result.shadow).toContain("rgb(148, 199, 72)");
		await expect(card.locator('[data-agent-loading-slot="front"]')).toHaveAttribute("data-agent-id", /jira-coding$/);
		await expect(card.locator('[data-jira-linking-glow-halo]')).toHaveCount(0);
	}
	const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-105" }).focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents", exact: true });
	await picker.getByRole("combobox", { name: "Search agents" }).fill("Figma");
	await picker.getByRole("option", { name: /^Figma/ }).click();
	await expect(card.getByRole("button", { name: "3 agents: Working" })).toBeVisible();
	await expect(card.locator('[data-jira-linking-glow-halo]')).toHaveCount(0);
	const repeated = await selectCodingAgent(page, "PAY-105");
	expect(repeated.result.glow).toBe(true);
	await expect(card.locator('[data-agent-loading-slot="front"]')).toHaveAttribute("data-agent-id", /jira-coding$/);
});

test("the handoff and glow survive a card moving into In progress", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	const { card, result } = await selectCodingAgent(page, "PAY-118");
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	expect(result.glow).toBe(true);
	expect(result.working).toBe(true);
	expect(result.overlap).toBe(false);
});

test("an added agent enters, holds, and joins the loading puzzle", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-105" }).focus();
	await page.keyboard.press("Enter");
	const option = page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("option", { name: /^Jira Coding Agent/ });
	const observations = page.evaluate(async () => {
		const samples: { time: number; opacity: number; scale: number; loadingOpacity: number }[] = [];
		let start = 0;
		const deadline = performance.now() + 4000;
		while (performance.now() < deadline) {
			const card = document.querySelector('[data-issue-key="PAY-105"][data-board-column-title]');
			const avatar = card?.querySelector<HTMLElement>('[data-slot="jira-issue-agent-invocation-handoff"] > span');
			const puzzle = avatar?.querySelector<HTMLElement>('[data-slot="jira-issue-agent-puzzle-transition"]');
			const front = card?.querySelector<HTMLElement>('[data-agent-loading-slot="front"]');
			if (avatar && puzzle && front) {
				start ||= performance.now();
				const style = getComputedStyle(avatar);
				const loading = front.closest<HTMLElement>('[data-slot="jira-issue-agent-avatar-handoff"]');
				samples.push({ time: performance.now() - start, opacity: Number(style.opacity), scale: new DOMMatrixReadOnly(getComputedStyle(puzzle).transform).a, loadingOpacity: loading ? Number(getComputedStyle(loading).opacity) : -1 });
			} else if (start) break;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return samples;
	});
	await option.click();
	const samples = await observations;
	expect(samples.some((sample) => sample.time < 150 && sample.opacity < 0.9)).toBe(true);
	expect(samples.some((sample) => sample.time > 200 && sample.time < 500 && sample.opacity > 0.95 && sample.scale > 0.98 && sample.loadingOpacity < 0.05), JSON.stringify(samples.filter((_, index) => index % 8 === 0))).toBe(true);
	expect(samples.some((sample) => sample.time > 550 && sample.scale < 0.95)).toBe(true);
	expect(samples.some((sample) => sample.loadingOpacity > 0.1 && sample.loadingOpacity < 0.95)).toBe(true);
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toHaveCount(0);
	await expect(card.locator('[data-agent-loading-slot="front"]')).toHaveAttribute("data-agent-id", /jira-coding$/);
});

test("reduced motion still replaces the preview and shows Working", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-105" }).focus();
	await page.keyboard.press("Enter");
	await page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("option", { name: /^Jira Coding Agent/ }).click();
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveCount(0);
	await expect(card.getByRole("button", { name: "2 agents: Working" })).toBeVisible();
	await expect(card.locator('[data-jira-linking-glow-halo]')).toHaveCount(0);
});
