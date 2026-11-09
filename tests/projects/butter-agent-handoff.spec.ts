import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

test("Butter v1 cycles the selected agent into Working and scales its avatar", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	for (const { key, name, agentId } of [{ key: "PAY-105", name: "Claude", agentId: "claude-code" }, { key: "PAY-105", name: "Cursor", agentId: "test-agent" }]) {
		const card = page.locator(`[data-issue-key="${key}"][data-board-column-title]`);
		await card.hover();
		await card.getByRole("button", { name: `Add agent to ${key}` }).click();
		const agent = page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("button", { name, exact: true });
		await agent.hover();
		const samplesPromise = page.evaluate(async ({ issueKey, selectedAgentId }) => {
			const button = document.querySelector<HTMLButtonElement>(`[role="dialog"][aria-label="Agents"] button[data-agent-id="${selectedAgentId}"]`);
			if (!button) throw new Error("Agent button not found");
			await new Promise<void>((resolve) => button.addEventListener("click", () => resolve(), { once: true, capture: true }));
			const samples: { time: number; outgoing: string; incoming: string; incomingOpacity: number; avatarScale: number }[] = [];
			const start = performance.now();
			while (performance.now() - start < 1600) {
				const card = document.querySelector(`[data-issue-key="${issueKey}"][data-board-column-title]`);
				const outgoing = card?.querySelector('[data-handoff-label="outgoing"]')?.textContent ?? "";
				const incomingElement = card?.querySelector<HTMLElement>('[data-handoff-label="incoming"]');
				const incoming = incomingElement?.textContent ?? "";
				const avatar = card?.querySelector<HTMLElement>('.agent-loading-intro-front, [data-slot="jira-issue-agent-invocation-handoff"] > span');
				samples.push({ time: performance.now() - start, outgoing, incoming, incomingOpacity: incomingElement ? Number(getComputedStyle(incomingElement).opacity) : -1, avatarScale: avatar ? new DOMMatrixReadOnly(getComputedStyle(avatar).transform).a : 0 });
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			}
			return samples;
		}, { issueKey: key, selectedAgentId: agentId });
		await agent.click();
		const samples = await samplesPromise;
		expect(samples.some((sample) => sample.outgoing === `Add ${name}` && sample.incoming === "Working"), JSON.stringify(samples)).toBe(true);
		expect(samples.some((sample) => sample.avatarScale !== 0 && sample.avatarScale !== 1), JSON.stringify(samples)).toBe(true);
		if (samples.some((sample) => sample.avatarScale > 0.8 && sample.avatarScale < 0.9)) {
			expect(samples.some((sample) => sample.incomingOpacity > 0.9 && sample.avatarScale > 0.9 && sample.avatarScale < 1)).toBe(true);
		}
		await expect(card.getByRole("button", { name: /Working/ })).toBeVisible();
	}
});

test("Butter v1 starts a working session with reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const card = page.locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-118" }).focus();
	await page.keyboard.press("Enter");
	await page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("button", { name: "Claude", exact: true }).click();
	await expect(card.getByRole("button", { name: "Claude: Working" })).toBeVisible();
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toHaveCount(0);
	await expect(card.locator(".agent-loading-intro-front")).toHaveCount(0);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Butter v1 previews the agent under the pointer while scrolling (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Board" }).click();
		const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
		await card.getByRole("button", { name: "Add agent to PAY-105" }).focus();
		await page.keyboard.press("Enter");
		const picker = page.getByRole("dialog", { name: "Agents", exact: true });
		const claude = picker.getByRole("button", { name: "Claude", exact: true });
		await claude.hover();
		const preview = card.locator('[data-slot="jira-issue-agent-invocation-preview"]');
		await expect(preview).toHaveAttribute("data-agent-id", "claude-code");
		const box = await claude.boundingBox();
		if (!box) throw new Error("Claude row is not visible");
		const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		await page.mouse.wheel(0, 120);
		await expect.poll(async () => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest<HTMLButtonElement>("button[data-agent-id]")?.dataset.agentId ?? "", point)).not.toBe("claude-code");
		const hovered = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest<HTMLButtonElement>("button[data-agent-id]")?.dataset.agentId, point);
		if (!hovered) throw new Error("Scrolling did not move another agent beneath the pointer");
		await expect(preview).toHaveAttribute("data-agent-id", hovered);
		await expect(preview).toHaveAttribute("data-direction", "forward");
		await expect(preview.locator("[data-preview-layer]")).toHaveCount(reducedMotion === "reduce" ? 0 : 2);
		await page.mouse.wheel(0, -120);
		await expect(preview).toHaveAttribute("data-agent-id", "claude-code");
		await expect(preview).toHaveAttribute("data-direction", "backward");
		await card.getByRole("button", { name: "Add agent to PAY-105" }).click();
		await expect(preview).toHaveCount(0);
	});
}

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
