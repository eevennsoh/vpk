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

// A new session briefly holds focus in the card's chin, so retry until the Add agent trigger takes it.
async function openAgentPicker(page: Page, card: Locator, key: string) {
	const addAgent = card.getByRole("button", { name: `Add agent to ${key}` });
	await expect(async () => {
		await addAgent.focus();
		await expect(addAgent).toBeFocused({ timeout: 100 });
	}).toPass({ timeout: 5_000 });
	await page.keyboard.press("Enter");
}

test("Butter v1 cycles the selected agent into Working", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
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
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	const card = page.locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-118" }).focus();
	await page.keyboard.press("Enter");
	await page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true }).click();
	await expect(card.getByRole("button", { name: "Claude: Working" })).toBeVisible();
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toHaveCount(0);
	await expect(card.locator(".agent-loading-intro-front")).toHaveCount(0);
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-actual"] [data-slot="human-agent-avatar"] [data-avatar-role="human"]')).toHaveCSS("opacity", "1");
});

test("the session owner appears during the agent handoff", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	const card = page.locator('[data-issue-key="PAY-203"][data-board-column-title]');
	await openAgentPicker(page, card, "PAY-203");
	const agent = page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true });
	const samples = page.evaluate(async () => {
		const button = document.querySelector<HTMLButtonElement>('[role="dialog"][aria-label="Agents"] button[data-agent-id="claude-code"]');
		if (!button) throw new Error("Agent button not found");
		await new Promise<void>((resolve) => button.addEventListener("click", () => resolve(), { once: true, capture: true }));
		const values: { opacity: number; radius: number }[] = [];
		const start = performance.now();
		while (performance.now() - start < 600) {
			const badge = document.querySelector<HTMLElement>('[data-issue-key="PAY-203"][data-board-column-title] [data-slot="jira-issue-agent-invocation-handoff"] [data-avatar-role="human"]');
			const agent = document.querySelector<HTMLElement>('[data-issue-key="PAY-203"][data-board-column-title] [data-slot="jira-issue-agent-invocation-handoff"] [data-avatar-role="agent"]');
			const radius = agent ? getComputedStyle(agent).maskImage.match(/rgba\(0, 0, 0, 0\)\s+([\d.]+)px/u)?.[1] : undefined;
			if (badge && radius !== undefined) values.push({ opacity: Number(getComputedStyle(badge).opacity), radius: Number(radius) });
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return values;
	});
	await agent.click();
	const frames = await samples;
	expect(frames.some((frame) => frame.opacity > 0 && frame.opacity < 1 && frame.radius > 0 && frame.radius < 7.5 && Math.abs(frame.opacity - frame.radius / 7.5) < 0.12), JSON.stringify(frames)).toBe(true);
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-actual"] [data-slot="human-agent-avatar"] [data-avatar-role="human"]')).toHaveCSS("opacity", "1");
});

test("the journey board animates the human badge and its cutout when adding Claude", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const card = page.locator('[data-issue-key="PAY-115"][data-board-column-title]');
	await openAgentPicker(page, card, "PAY-115");
	const agent = page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true });
	await agent.hover();
	const samples = page.evaluate(async () => {
		const button = document.querySelector<HTMLButtonElement>('[role="dialog"][aria-label="Agents"] button[data-agent-id="claude-code"]');
		if (!button) throw new Error("Agent button not found");
		await new Promise<void>((resolve) => button.addEventListener("click", () => resolve(), { once: true, capture: true }));
		const frames: { opacity: number; mask: string; scale: number; actual: string }[] = [];
		const start = performance.now();
		while (performance.now() - start < 1200) {
			const handoff = document.querySelector('[data-issue-key="PAY-115"][data-board-column-title] [data-slot="jira-issue-agent-invocation-handoff"]');
			const human = handoff?.querySelector<HTMLElement>('[data-avatar-role="human"]');
			const agent = handoff?.querySelector<HTMLElement>('[data-avatar-role="agent"]');
			const actual = document.querySelector<HTMLElement>('[data-issue-key="PAY-115"][data-board-column-title] [data-slot="jira-issue-agent-avatar-handoff"]');
			if (human && agent) frames.push({ opacity: Number(getComputedStyle(human).opacity), scale: new DOMMatrixReadOnly(getComputedStyle(human).transform).a, mask: getComputedStyle(agent).maskImage, actual: actual ? getComputedStyle(actual).opacity : "missing" });
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return frames;
	});
	await agent.click();
	const frames = await samples;
	expect(frames.some(({ opacity, scale, actual }) => opacity > 0 && opacity < 1 && scale < 1 && actual === "0"), JSON.stringify(frames)).toBe(true);
	expect(new Set(frames.map(({ mask }) => mask)).size).toBeGreaterThan(1);
	await expect(card.getByRole("button", { name: /Working/u })).toBeVisible();
	const identity = card.getByRole("img", { name: "Claude, used by Venn" });
	await expect(identity).toBeVisible();
	await expect(identity.locator('img[src="/avatar-user/venn/venn.png"]')).toBeVisible();
});

test("the human badge waits for its photo instead of flashing initials", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	let releasePhoto: () => void = () => {};
	const photoReady = new Promise<void>((resolve) => { releasePhoto = resolve; });
	await page.route("**/avatar-user/venn/venn.png", async (route) => {
		await photoReady;
		await route.continue();
	});
	try {
		await page.goto(appUrl("/butter-v1"), { waitUntil: "domcontentloaded" });
		await page.getByRole("button", { name: "Select Board", exact: true }).click();
		const card = page.locator('[data-issue-key="PAY-203"][data-board-column-title]');
		await openAgentPicker(page, card, "PAY-203");
		await page.getByRole("dialog", { name: "Agents", exact: true }).getByRole("button", { name: "Claude (Recommended)", exact: true }).click();
		const badge = card.locator('[data-slot="jira-issue-agent-invocation-handoff"] [data-avatar-role="human"]');
		await expect(badge).toBeAttached();
		await expect(badge).toHaveCSS("opacity", "0");
		await expect(card.locator('[data-slot="jira-issue-agent-invocation-handoff"] [data-avatar-role="agent"]')).toHaveCSS("mask-image", /rgba\(0, 0, 0, 0\) 0px/u);
		await expect(badge.locator('[data-slot="avatar-fallback"]')).toHaveCount(0);
		const start = Date.now();
		await expect.poll(async () => Date.now() - start >= 900 && await badge.count() === 1, { timeout: 2500 }).toBe(true);
		const samples = page.evaluate(async () => {
			const values: number[] = [];
			const start = performance.now();
			while (performance.now() - start < 1000) {
				const badge = document.querySelector<HTMLElement>('[data-issue-key="PAY-203"][data-board-column-title] [data-slot="jira-issue-agent-invocation-handoff"] [data-avatar-role="human"]');
				if (badge) values.push(Number(getComputedStyle(badge).opacity));
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			}
			return values;
		});
		releasePhoto();
		const opacity = await samples;
		expect(opacity.some((value) => value > 0 && value < 1), JSON.stringify(opacity)).toBe(true);
		await expect(card.locator('[data-slot="human-agent-avatar"] img[src="/avatar-user/venn/venn.png"]').first()).toBeVisible();
	} finally {
		releasePhoto();
	}
});

test("Butter v1 cycles one avatar for three working agents in the board chin", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	for (const name of ["Claude (Recommended)", "Jira Coding Agent"]) {
		await openAgentPicker(page, card, "PAY-105");
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
		await page.getByRole("button", { name: "Select Board", exact: true }).click();
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
// Once the card has a Jira Coding Agent session, choosing the agent again opens a submenu that asks
// whether to continue that session or start a new one, so a repeated selection starts a new session.
async function selectCodingAgent(page: Page, key: string, { repeat = false } = {}) {
	const card = page.locator(`[data-issue-key="${key}"][data-board-column-title]`);
	await openAgentPicker(page, card, key);
	const picker = page.getByRole("dialog", { name: "Agents", exact: true });
	// Once a card has a Jira Coding Agent session, "Other agents" also lists that session under the same name, so pick the directory row.
	const option = picker.locator('[role="option"][data-value="jira-coding"]');
	await option.hover();
	const observations = page.evaluate(async ({ issueKey, repeatSelection }) => {
		const results = { glow: false, handoff: false, overlap: false, agentScaled: false, dotScaled: false, status: "", shadow: "" };
		await new Promise<void>((resolve) => {
			const onClick = (event: MouseEvent) => {
				const target = event.target instanceof Element ? event.target : null;
				const selected = repeatSelection ? target?.closest('[role="menuitem"]')?.textContent?.includes("Start a new session") : target?.closest('[role="option"][data-value="jira-coding"]');
				if (!selected) return;
				document.removeEventListener("click", onClick, true);
				resolve();
			};
			document.addEventListener("click", onClick, true);
		});
		const start = performance.now();
		while (performance.now() - start < 3000) {
			const card = document.querySelector<HTMLElement>(`[data-issue-key="${issueKey}"][data-board-column-title]`);
			const handoff = card?.querySelector('[data-slot="jira-issue-agent-invocation-handoff"][data-agent-id="jira-coding"]');
			const preview = card?.querySelector('[data-slot="jira-issue-agent-invocation-preview"]');
			results.handoff ||= Boolean(handoff);
			// The handoff keeps the agent at its browsing size; only the invoker's dot scales in (project-butter-invocation-chin.tsx).
			const avatar = handoff?.querySelector<HTMLElement>('[data-slot="jira-issue-agent-invocation-handoff-avatar"]');
			if (avatar) results.agentScaled ||= new DOMMatrixReadOnly(getComputedStyle(avatar).transform).a < 0.99;
			const dot = avatar?.querySelector<HTMLElement>('[data-avatar-role="human"]');
			if (dot) { const style = getComputedStyle(dot); results.dotScaled ||= Number(style.opacity) < 1 || (style.transform !== "none" && new DOMMatrixReadOnly(style.transform).a < 0.99); }
			results.overlap ||= Boolean(handoff && preview);
			const halo = card?.querySelector<HTMLElement>('[data-jira-linking-glow-halo]');
			results.glow ||= Boolean(halo);
			if (halo) results.shadow = halo.style.boxShadow;
			results.status = card?.querySelector('[data-jira-issue-agent-row-handle]')?.textContent ?? "";
			if (results.glow && results.status.includes("Needs input") && performance.now() - start > 500) break;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return results;
	}, { issueKey: key, repeatSelection: repeat });
	await option.click();
	if (repeat) await page.getByRole("menuitem", { name: "Start a new session" }).click();
	const result = await observations;
	await expect(picker).toHaveCount(0);
	await expect(card.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toHaveCount(0);
	return { card, result };
}

test("the first selection hands off with only the invoker dot scaling in; repeated selections start a new session with the avatar-colored glow", { tag: "@smoke" }, async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	const { card, result } = await selectCodingAgent(page, "PAY-105");
	expect(result).toMatchObject({ glow: true, handoff: true, overlap: false, agentScaled: false, dotScaled: true });
	expect(result.status).toContain("Needs input");
	expect(result.shadow).toContain("rgb(148, 199, 72)");
	await expect(card.getByRole("button", { name: "2 agents: Needs input" }).getByRole("img", { name: "Jira Coding Agent" })).toBeVisible();
	await expect(card.locator('[data-jira-linking-glow-halo]')).toHaveCount(0);
	// A second session for an agent the card already shows joins the avatar puzzle instead of the single-agent handoff.
	const second = await selectCodingAgent(page, "PAY-105", { repeat: true });
	expect(second.result).toMatchObject({ glow: true, handoff: false, overlap: false });
	expect(second.result.status).toContain("Needs input");
	expect(second.result.shadow).toContain("rgb(148, 199, 72)");
	await expect(card.getByRole("button", { name: "3 agents: Needs input" })).toBeVisible();
	await expect(card.locator('[data-jira-linking-glow-halo]')).toHaveCount(0);
	await openAgentPicker(page, card, "PAY-105");
	const picker = page.getByRole("dialog", { name: "Agents", exact: true });
	await picker.getByRole("combobox", { name: "Search agents" }).fill("Figma");
	await picker.getByRole("option", { name: /^Figma/ }).click();
	await expect(card.getByRole("button", { name: "4 agents: Needs input" })).toBeVisible();
	await expect(card.locator('[data-jira-linking-glow-halo]')).toHaveCount(0);
	const repeated = await selectCodingAgent(page, "PAY-105", { repeat: true });
	expect(repeated.result.glow).toBe(true);
	await expect(card.getByRole("button", { name: "5 agents: Needs input" })).toBeVisible();
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
