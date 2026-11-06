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
		const results = { glow: false, handoff: false, overlap: false, scaled: false, selectedFront: false, working: false, shadow: "" };
		const start = performance.now();
		await new Promise<void>((resolve) => {
			const target = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) => element.textContent?.includes("Jira Coding Agent"));
			if (!target) return resolve();
			target.addEventListener("click", () => resolve(), { once: true, capture: true });
		});
		while (performance.now() - start < 3000) {
			const card = document.querySelector<HTMLElement>(`[data-issue-key="${issueKey}"][data-board-column-title]`);
			const handoff = card?.querySelector('[data-slot="jira-issue-agent-invocation-handoff"][data-agent-id="jira-coding"]');
			const intro = card?.querySelector<HTMLElement>('[data-agent-loading-slot="front"][data-agent-id$="jira-coding"] .agent-loading-intro-front');
			const preview = card?.querySelector('[data-slot="jira-issue-agent-invocation-preview"]');
			results.handoff ||= Boolean(handoff || intro);
			results.selectedFront ||= Boolean(intro);
			const avatar = handoff?.querySelector<HTMLElement>("span");
			if (avatar) results.scaled ||= new DOMMatrixReadOnly(getComputedStyle(avatar).transform).a < 0.99;
			if (intro) results.scaled ||= new DOMMatrixReadOnly(getComputedStyle(intro).transform).a > 1.01;
			results.overlap ||= Boolean((handoff || intro) && preview);
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
	const result = await observations;
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toHaveCount(0);
	await expect(card.locator('.agent-loading-intro-front')).toHaveCount(0);
	return { card, result };
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
	await expect(card.locator('.agent-loading-intro-front')).toHaveCount(0);
	const repeated = await selectCodingAgent(page, "PAY-105");
	expect(repeated.result.glow).toBe(true);
	expect(repeated.result.selectedFront).toBe(true);
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

test("Claude stays visible as the label rolls into Working and the avatar joins the puzzle", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-105" }).focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents", exact: true });
	await picker.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await picker.getByRole("option", { name: /^Claude/ }).click();
	const preview = await card.locator('[data-slot="jira-issue-agent-invocation-preview"] > span:first-child').boundingBox();
	if (!preview) throw new Error("The selected agent preview is not visible");
	const previewGlyph = await card.locator('[data-slot="jira-issue-agent-invocation-preview"] svg').first().boundingBox();
	if (!previewGlyph) throw new Error("The selected agent glyph is not visible");
	const observations = page.evaluate(async () => {
		const samples: { time: number; opacity: number; width: number; glyphWidth: number; centerX: number; centerY: number; backOpacity: number; outgoing: string; incoming: string; outgoingOpacity: number; incomingOpacity: number }[] = [];
		let start = 0;
		let original: HTMLElement | null = null;
		const deadline = performance.now() + 4000;
		while (performance.now() < deadline) {
			const card = document.querySelector('[data-issue-key="PAY-105"][data-board-column-title]');
			const front = card?.querySelector<HTMLElement>('[data-agent-loading-slot="front"][data-agent-id$="claude-code"] > span');
			const back = card?.querySelector<HTMLElement>('[data-agent-loading-slot="back"] > span');
			if (front?.classList.contains("agent-loading-intro-front") && back) {
				start ||= performance.now();
				original ??= front;
				const rect = front.getBoundingClientRect();
				const outgoing = card?.querySelector<HTMLElement>('[data-handoff-label="outgoing"]');
				const incoming = card?.querySelector<HTMLElement>('[data-handoff-label="incoming"]');
				samples.push({ time: performance.now() - start, opacity: Number(getComputedStyle(front).opacity), width: rect.width, glyphWidth: front.querySelector("svg")?.getBoundingClientRect().width ?? 0, centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2, backOpacity: Number(getComputedStyle(back).opacity), outgoing: outgoing?.textContent ?? "", incoming: incoming?.textContent ?? "", outgoingOpacity: outgoing ? Number(getComputedStyle(outgoing).opacity) : -1, incomingOpacity: incoming ? Number(getComputedStyle(incoming).opacity) : -1 });
			} else if (start && front) {
				return { samples, sameElement: front === original, finalWidth: front.getBoundingClientRect().width };
			}
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return { samples, sameElement: false, finalWidth: 0 };
	});
	await page.getByText("Run on cloud", { exact: true }).click();
	const { samples, sameElement, finalWidth } = await observations;
	expect(samples.length).toBeGreaterThan(0);
	expect(samples.every((sample) => sample.opacity > 0.95), JSON.stringify(samples)).toBe(true);
	expect(samples[0].centerX).toBeCloseTo(preview.x + preview.width / 2, 0);
	expect(samples[0].centerY).toBeCloseTo(preview.y + preview.height / 2, 0);
	expect(samples[0].glyphWidth).toBeCloseTo(previewGlyph.width, 0);
	expect(samples.some((sample) => sample.outgoing === "Add Claude" && sample.incoming === "Working" && sample.outgoingOpacity > 0 && sample.incomingOpacity < 1)).toBe(true);
	expect(samples.some((sample) => sample.outgoingOpacity < 0.05 && sample.incomingOpacity > 0.95)).toBe(true);
	expect(samples.some((sample) => sample.time > 200 && sample.time < 500 && sample.opacity > 0.95 && sample.width > 19 && sample.backOpacity < 0.05), JSON.stringify(samples)).toBe(true);
	expect(samples.some((sample) => sample.time > 700 && sample.time < 900 && sample.width > 19 && sample.backOpacity < 0.05)).toBe(true);
	expect(samples.some((sample) => sample.time > 1100 && sample.width > 16.05 && sample.width < 19.95)).toBe(true);
	expect(sameElement).toBe(true);
	expect(finalWidth).toBeCloseTo(16, 0);
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toHaveCount(0);
	await expect(card.locator('[data-agent-loading-slot="front"]')).toHaveAttribute("data-agent-id", /claude-code$/);
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
