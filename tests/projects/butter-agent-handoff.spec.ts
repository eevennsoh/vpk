import { expect, test, type Locator, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

/** Waits until an element stops moving, e.g. while the board and its picker settle after a gallery switch. */
async function expectSettled(locator: Locator) {
	let previous = "";
	await expect.poll(async () => {
		const box = await locator.boundingBox();
		const current = box ? `${Math.round(box.x)},${Math.round(box.y)}` : "";
		const settled = current !== "" && current === previous;
		previous = current;
		return settled;
	}).toBe(true);
}

test("Butter v1 cycles the selected agent into Working", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	for (const { key, name, option, agentId } of [{ key: "PAY-105", name: "Claude", option: "Claude (Recommended)", agentId: "claude-code" }, { key: "PAY-105", name: "Cursor", option: "Cursor", agentId: "test-agent" }]) {
		const card = page.locator(`[data-issue-key="${key}"][data-board-column-title]`);
		// The gallery selection motion can move the board under a hover, so open the picker from the keyboard.
		await card.getByRole("button", { name: `Add agent to ${key}` }).focus();
		await page.keyboard.press("Enter");
		const agent = page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("button", { name: option, exact: true });
		await agent.hover();
		const samplesPromise = page.evaluate(async ({ issueKey, selectedAgentId }) => {
			const button = document.querySelector<HTMLButtonElement>(`[role="dialog"][aria-label="Agents"] button[data-agent-id="${selectedAgentId}"]`);
			if (!button) throw new Error("Agent button not found");
			await new Promise<void>((resolve) => button.addEventListener("click", () => resolve(), { once: true, capture: true }));
			const samples: { time: number; outgoing: string; incoming: string; incomingOpacity: number }[] = [];
			const start = performance.now();
			while (performance.now() - start < 1600) {
				const card = document.querySelector(`[data-issue-key="${issueKey}"][data-board-column-title]`);
				const outgoing = card?.querySelector('[data-handoff-label="outgoing"]')?.textContent ?? "";
				const incomingElement = card?.querySelector<HTMLElement>('[data-handoff-label="incoming"]');
				const incoming = incomingElement?.textContent ?? "";
				samples.push({ time: performance.now() - start, outgoing, incoming, incomingOpacity: incomingElement ? Number(getComputedStyle(incomingElement).opacity) : -1 });
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			}
			return samples;
		}, { issueKey: key, selectedAgentId: agentId });
		await agent.click();
		const samples = await samplesPromise;
		expect(samples.some((sample) => sample.outgoing === `Add ${name}` && sample.incoming === "Working"), JSON.stringify(samples)).toBe(true);
		expect(samples.some((sample) => sample.incoming === "Working" && sample.incomingOpacity > 0 && sample.incomingOpacity < 1), JSON.stringify(samples)).toBe(true);
		await expect(card.getByRole("button", { name: /Working/ })).toBeVisible();
		await expect(card.locator("[data-handoff-label]")).toHaveCount(0);
	}
});

test("Butter v1 starts a working session with reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const card = page.locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-118" }).focus();
	await page.keyboard.press("Enter");
	await page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true }).click();
	await expect(card.getByRole("button", { name: "Claude: Working" })).toBeVisible();
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toHaveCount(0);
	await expect(card.locator(".agent-loading-intro-front")).toHaveCount(0);
});

test("Butter v1 cycles one avatar for three working agents in the board chin", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	for (const name of ["Claude (Recommended)", "Jira Coding Agent"]) {
		await card.getByRole("button", { name: "Add agent to PAY-105" }).focus();
		await page.keyboard.press("Enter");
		await page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("button", { name, exact: true }).click();
	}
	const chin = card.getByRole("button", { name: "3 agents: Working" });
	await expect(chin).toBeVisible();
	const avatar = chin.locator(".agent-loading-vertical [data-agent-id]");
	await expect(avatar).toHaveCount(1);
	await expect(avatar).toBeVisible();
	const bounds = await avatar.boundingBox();
	expect(bounds?.width).toBeCloseTo(24, 0);
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
		const claude = picker.getByRole("button", { name: "Claude (Recommended)", exact: true });
		// A row that moves under a still pointer is not a hover change, so let the board and picker settle first.
		await expectSettled(claude);
		await claude.hover();
		const preview = card.locator('[data-slot="jira-issue-agent-invocation-preview"]');
		await expect(preview).toHaveAttribute("data-agent-id", "claude-code");
		const box = await claude.boundingBox();
		if (!box) throw new Error("Claude row is not visible");
		const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		await page.mouse.wheel(0, 120);
		const agentUnderPointer = () => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest<HTMLButtonElement>("button[data-agent-id]")?.dataset.agentId ?? "", point);
		// Wait for the scroll to settle on another agent row, then the preview must follow that row.
		await expect.poll(async () => {
			const hovered = await agentUnderPointer();
			return hovered && hovered !== "claude-code" && hovered === await preview.getAttribute("data-agent-id");
		}).toBe(true);
		const hovered = await agentUnderPointer();
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

// Butter v0 starts a card's cloud session as "Needs input" while it waits for the first prompt.
async function selectCodingAgent(page: Page, key: string) {
	const card = page.locator(`[data-issue-key="${key}"][data-board-column-title]`);
	await card.getByRole("button", { name: `Add agent to ${key}` }).focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents", exact: true });
	const option = picker.getByRole("option", { name: /^Jira Coding Agent/ });
	await option.hover();
	const observations = page.evaluate(async (issueKey) => {
		const results = { glow: false, handoff: false, overlap: false, status: "", shadow: "" };
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
			results.overlap ||= Boolean(handoff && preview);
			const halo = card?.querySelector<HTMLElement>('[data-jira-linking-glow-halo]');
			results.glow ||= Boolean(halo);
			if (halo) results.shadow = halo.style.boxShadow;
			results.status = card?.querySelector('[data-jira-issue-agent-row-handle]')?.textContent ?? "";
			if (results.glow && results.status.includes("Needs input") && performance.now() - start > 500) break;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return results;
	}, key);
	await option.click();
	const result = await observations;
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toHaveCount(0);
	return { card, result };
}

test("new and repeated selections replace the preview and each show the avatar-colored glow", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	for (let iteration = 0; iteration < 2; iteration++) {
		const { card, result } = await selectCodingAgent(page, "PAY-105");
		expect(result).toMatchObject({ glow: true, handoff: true, overlap: false });
		expect(result.status).toContain("Needs input");
		expect(result.shadow).toContain("rgb(148, 199, 72)");
		await expect(card.getByRole("button", { name: "2 agents: Needs input" }).getByRole("img", { name: "Jira Coding Agent" })).toBeVisible();
		await expect(card.locator('[data-jira-linking-glow-halo]')).toHaveCount(0);
	}
	const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-105" }).focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents", exact: true });
	await picker.getByRole("combobox", { name: "Search agents" }).fill("Figma");
	await picker.getByRole("option", { name: /^Figma/ }).click();
	await expect(card.getByRole("button", { name: "3 agents: Needs input" })).toBeVisible();
	await expect(card.locator('[data-jira-linking-glow-halo]')).toHaveCount(0);
	const repeated = await selectCodingAgent(page, "PAY-105");
	expect(repeated.result.glow).toBe(true);
	await expect(card.getByRole("button", { name: /agents: Needs input$/ }).getByRole("img", { name: "Jira Coding Agent" })).toBeVisible();
});

test("the handoff and glow survive a card moving into In progress", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	const { card, result } = await selectCodingAgent(page, "PAY-118");
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	expect(result.glow).toBe(true);
	expect(result.handoff).toBe(true);
	expect(result.status).toContain("Needs input");
	expect(result.overlap).toBe(false);
	await expect(card.getByRole("button", { name: "Jira Coding Agent: Needs input" })).toBeVisible();
});

test("reduced motion still replaces the preview and shows the new session", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-105" }).focus();
	await page.keyboard.press("Enter");
	await page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("option", { name: /^Jira Coding Agent/ }).click();
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveCount(0);
	await expect(card.getByRole("button", { name: "2 agents: Needs input" })).toBeVisible();
	await expect(card.locator('[data-jira-linking-glow-halo]')).toHaveCount(0);
});
