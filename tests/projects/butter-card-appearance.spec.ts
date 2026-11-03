import { expect, test, type Locator, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("Butter directory picker can be dismissed without trapping focus", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").getByRole("button", { name: "Add agent to PAY-118" }).focus();
	await page.keyboard.press("Enter");
	await page.getByRole("option", { name: /Claude/u }).hover();
	const submenu = page.getByRole("dialog", { name: "Run Claude on" });
	const configure = submenu.getByRole("button", { name: "Configure directory" });
	await configure.click();
	const field = submenu.getByRole("textbox", { name: "Choose your directory" });
	const dropdown = page.getByRole("dialog", { name: "Codebase workspaces" });
	await field.click();
	await expect(dropdown).toBeVisible();
	await field.press("Escape");
	await expect(dropdown).toBeHidden();
	await expect(configure).toBeFocused();
	await field.click();
	await submenu.locator('[data-slot="input-group-addon"]').click();
	await expect(dropdown).toBeHidden();
	await expect(configure).toBeFocused();
	await field.click();
	await field.press("ArrowDown");
	await expect(dropdown.getByRole("button", { name: "Add workspace" })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(dropdown).toBeHidden();
	await expect(configure).toBeFocused();
	await field.click();
	await page.getByRole("combobox", { name: "Search agents" }).click();
	await expect(dropdown).toBeHidden();
	await expect(page.getByRole("combobox", { name: "Search agents" })).toBeFocused();
});

test("Butter add-agent tooltip follows rapid pointer re-entry", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const issue = card(page, "PAY-118");
	const add = issue.getByRole("button", { name: "Add agent to PAY-118" });
	await issue.getByText("Carry card-artwork metadata into the next wallet epic", { exact: true }).hover();
	await add.hover();
	const tooltip = page.getByRole("tooltip", { name: "Add agent", exact: true });
	await expect(tooltip).toBeVisible();
	const addBox = await add.boundingBox();
	if (!addBox) throw new Error("Missing add-agent trigger");
	await page.mouse.move(addBox.x + addBox.width + 8, addBox.y + addBox.height / 2);
	await page.waitForTimeout(60);
	await page.mouse.move(addBox.x + addBox.width / 2, addBox.y + addBox.height / 2);
	await page.waitForTimeout(350);
	await expect(tooltip).toBeVisible();
	await page.mouse.move(addBox.x - 100, addBox.y - 100);
	await expect(tooltip).not.toBeVisible();
	const issueBox = await issue.boundingBox();
	if (!issueBox) throw new Error("Missing issue card");
	await page.mouse.move(issueBox.x + issueBox.width + 40, addBox.y - 20, { steps: 8 });
	await page.waitForTimeout(50);
	await page.mouse.move(addBox.x + addBox.width + 15, addBox.y + addBox.height / 2, { steps: 8 });
	await page.mouse.move(addBox.x + addBox.width / 2, addBox.y + addBox.height / 2, { steps: 8 });
	await page.waitForTimeout(350);
	await expect(tooltip).toBeVisible();
});

test("Butter add-agent tooltip does not cover its trigger while entering", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const issue = card(page, "PAY-118");
	await issue.getByText("Carry card-artwork metadata into the next wallet epic", { exact: true }).hover();
	const add = issue.getByRole("button", { name: "Add agent to PAY-118" });
	const box = await add.boundingBox();
	if (!box) throw new Error("Missing add-agent trigger");
	const samples = page.evaluate(async () => {
		const button = document.querySelector<HTMLElement>('[aria-label="Add agent to PAY-118"]');
		if (!button) throw new Error("Missing add-agent trigger");
		await new Promise<void>((resolve) => button.addEventListener("pointerenter", () => resolve(), { once: true }));
		const frames: { overlap: number; offset: number }[] = [];
		for (let i = 0; i < 20; i++) {
			const tooltip = [...document.querySelectorAll<HTMLElement>('[role="tooltip"]')].find((node) => node.textContent === "Add agent");
			if (tooltip) {
				const tooltipBox = tooltip.getBoundingClientRect();
				const buttonBox = button.getBoundingClientRect();
				frames.push({ overlap: tooltipBox.bottom - buttonBox.top, offset: (tooltipBox.left + tooltipBox.width / 2) - (buttonBox.left + buttonBox.width / 2) });
			}
			await new Promise<number>((resolve) => requestAnimationFrame(resolve));
		}
		return frames;
	});
	await page.mouse.move(box.x + box.width / 2, box.y + 1);
	const frames = await samples;
	expect(frames.length).toBeGreaterThan(0);
	expect(frames.every((frame) => frame.overlap <= 0 && Math.abs(frame.offset) < 0.5), JSON.stringify(frames)).toBe(true);
	await expect(page.getByRole("tooltip", { name: "Add agent", exact: true })).toBeVisible();
});

test("Butter aligns directory chevron and selected workspace checkmarks", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const add = card(page, "PAY-118").getByRole("button", { name: "Add agent to PAY-118" });
	await add.focus();
	await page.keyboard.press("Enter");
	await page.getByRole("option", { name: /Claude/u }).hover();
	const submenu = page.getByRole("dialog", { name: "Run Claude on" });
	await submenu.getByRole("button", { name: "Configure directory" }).click();
	const field = submenu.getByRole("textbox", { name: "Choose your directory" });
	await field.click();
	const dropdown = page.getByRole("dialog", { name: "Codebase workspaces" });
	const inputGroup = submenu.locator('[data-slot="input-group"]');
	const chevron = inputGroup.locator('[data-slot="input-group-addon"] svg');
	const expectAligned = async (row: Locator) => {
		const [chevronBox, inputBox, checkBox, rowBox] = await Promise.all([
			chevron.boundingBox(), inputGroup.boundingBox(), row.locator("svg").last().boundingBox(), row.boundingBox(),
		]);
		if (!chevronBox || !inputBox || !checkBox || !rowBox) throw new Error("Missing directory picker geometry");
		expect(Math.abs((chevronBox.x + chevronBox.width / 2) - (checkBox.x + checkBox.width / 2))).toBeLessThan(0.5);
		expect(Math.abs((chevronBox.y + chevronBox.height / 2) - (inputBox.y + inputBox.height / 2))).toBeLessThan(0.5);
		expect(Math.abs((checkBox.y + checkBox.height / 2) - (rowBox.y + rowBox.height / 2))).toBeLessThan(0.5);
	};
	await expectAligned(dropdown.getByRole("button", { name: "No workspace" }));
	await field.fill("~/dev/alignment-check");
	await field.press("Enter");
	const selected = dropdown.getByRole("button", { name: "~/dev/alignment-check", exact: true });
	await expect(selected).toHaveAttribute("aria-current", "true");
	await expectAligned(selected);
});

test("Butter's agent preview matches the finished agent avatar", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const issue = card(page, "PAY-118");
	await issue.getByRole("button", { name: "Add agent to PAY-118" }).focus();
	await page.keyboard.press("Enter");
	await page.getByRole("dialog", { name: "Agents" }).locator('[data-slot="command-item"][data-value="claude-code"]').hover();
	const preview = issue.locator('[data-slot="jira-issue-agent-invocation-preview"]');
	await expect(preview).toHaveAttribute("data-agent-id", "claude-code");
	const previewAvatar = preview.locator('[data-slot="avatar"]');
	const finishedAvatar = card(page, "PAY-101").locator('[data-jira-issue-agent-row-handle] [data-slot="avatar"]').first();
	await expect(previewAvatar).toBeVisible();
	await expect(finishedAvatar).toBeVisible();
	const [previewBox, finishedBox] = await Promise.all([previewAvatar.boundingBox(), finishedAvatar.boundingBox()]);
	expect(previewBox?.width).toBe(finishedBox?.width);
	expect(previewBox?.height).toBe(finishedBox?.height);
	const offsetFromCard = (element: Element, selector: string) => {
		const cardElement = element.closest('[data-issue-key][data-board-column-title]');
		const target = element.querySelector(selector);
		if (!cardElement || !target) throw new Error(`Missing card or ${selector}`);
		return target.getBoundingClientRect().left - cardElement.getBoundingClientRect().left;
	};
	for (const [previewSelector, finishedSelector] of [
		['[data-slot="jira-issue-agent-invocation-preview"] > span:first-child', '[data-jira-issue-agent-row-handle] > div > span:first-child'],
		['[data-slot="jira-issue-agent-invocation-preview"] > span:nth-child(2)', '[data-jira-issue-agent-row-handle] > div > span:nth-child(2)'],
	] as const) {
		const [previewOffset, finishedOffset] = await Promise.all([
			issue.evaluate(offsetFromCard, previewSelector),
			card(page, "PAY-101").evaluate(offsetFromCard, finishedSelector),
		]);
		expect(Math.abs(previewOffset - finishedOffset)).toBeLessThan(0.5);
	}
	const previewBackground = previewAvatar.locator('[data-slot="avatar-hexagon-artwork"] > span').first();
	const finishedBackground = finishedAvatar.locator('[data-slot="avatar-hexagon-artwork"] > span').first();
	await expect(previewBackground).toHaveCSS("background-color", await finishedBackground.evaluate((element) => getComputedStyle(element).backgroundColor));
});

test("Butter keeps the board visible until the agent directory loads", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const add = card(page, "PAY-118").getByRole("button", { name: "Add agent to PAY-118", exact: true });
	await add.focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents", exact: true }).filter({ has: page.getByRole("listbox") });
	let releaseChunks!: () => void;
	const chunksReady = new Promise<void>((resolve) => { releaseChunks = resolve; });
	let markChunkRequested!: () => void;
	const chunkRequested = new Promise<void>((resolve) => { markChunkRequested = resolve; });
	await page.route("**/_next/static/chunks/**", async (route) => {
		markChunkRequested();
		await chunksReady;
		await route.continue();
	});
	try {
		await picker.getByRole("button", { name: "Browse agents" }).click();
		await chunkRequested;
		await expect(card(page, "PAY-118")).toBeVisible();
		await expect(page.getByText("Loading agent directory")).toHaveCount(0);
		const directory = page.getByRole("dialog", { name: "Agents", exact: true }).filter({ has: page.getByRole("tab", { name: "Recommended" }) });
		await expect(directory).toHaveCount(0);
		releaseChunks();
		await expect(directory).toBeVisible();
		await directory.getByRole("button", { name: "Close" }).click();
		await expect(directory).toBeHidden();
		await add.focus();
		await page.keyboard.press("Enter");
		await picker.getByRole("button", { name: "Browse agents" }).click();
		await expect(directory).toBeVisible();
	} finally {
		releaseChunks();
	}
});

test("Butter previews an assigned agent from its session avatar", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").getByRole("button", { name: "Cursor: Working" }).click();
	const assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await assignment.getByRole("button", { name: "Cursor", exact: true }).click();
	await expect(page.getByRole("menu", { name: /Cursor/ })).toBeVisible();
	await page.keyboard.press("Escape");
	const avatar = assignment.getByRole("button", { name: "Preview Cursor" });
	await avatar.hover();
	const lanyard = page.getByRole("article", { name: "Cursor agent" });
	await expect(lanyard).toBeVisible();
	await lanyard.hover();
	await expect(assignment).toBeVisible();
	await expect(lanyard.getByRole("button", { name: "Chat with Cursor" })).toBeVisible();
	await lanyard.getByRole("button", { name: "More actions for Cursor" }).click();
	await expect(page.getByRole("menu", { name: "Actions for Cursor" })).toBeVisible();
	await expect(assignment).toBeVisible();
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");
	await avatar.focus();
	await expect(lanyard).toBeVisible();
	await expect(avatar.locator("xpath=ancestor::button")).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(lanyard).toBeHidden();
	await expect(assignment).toBeVisible();
});

test("Butter List agent picker keeps directory actions available", async ({ page }) => {
	await page.goto(appUrl("/preview/projects/butter?embedded=1"));
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const add = page.getByRole("button", { name: "Add agent to PAY-118", exact: true });
	await add.click();
	const picker = page.getByRole("dialog", { name: "Agents", exact: true });
	const browse = picker.getByRole("button", { name: "Browse agents" });
	const create = picker.getByRole("button", { name: "Create agent" });
	await expect(browse).toBeVisible();
	await expect(create).toBeVisible();
	const before = await browse.boundingBox();
	const list = picker.getByRole("listbox");
	await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
	await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await expect(browse).toBeVisible();
	await expect(create).toBeVisible();
	expect((await browse.boundingBox())?.y).toBe(before?.y);
	await browse.click();
	const directory = page.getByRole("dialog", { name: "Agents", exact: true }).filter({ has: page.getByRole("tab", { name: "Recommended" }) });
	await expect(directory).toBeVisible();
	await directory.getByRole("button", { name: "Close" }).click();
	await add.click();
	await picker.getByRole("button", { name: "Create agent" }).click();
	await expect(page).toHaveURL(/\/studio$/u, { timeout: 20_000 });
});

test("Butter's agent picker keeps directory actions visible while scrolling", async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto(appUrl("/butter"));
	const issue = card(page, "PAY-118");
	const add = issue.getByRole("button", { name: "Add agent to PAY-118", exact: true });
	await add.focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents", exact: true }).filter({ has: page.getByRole("listbox") });
	const browse = picker.getByRole("button", { name: "Browse agents" });
	const create = picker.getByRole("button", { name: "Create agent" });
	await expect(browse).toBeVisible();
	await expect(create).toBeVisible();
	const before = await browse.boundingBox();
	const list = picker.getByRole("listbox");
	await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
	await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await expect(browse).toBeVisible();
	await expect(create).toBeVisible();
	expect((await browse.boundingBox())?.y).toBe(before?.y);
	await browse.click();
	const directory = page.getByRole("dialog", { name: "Agents", exact: true }).filter({ has: page.getByRole("tab", { name: "Recommended" }) });
	await expect(directory).toBeVisible();
	await expect(directory.getByRole("tab", { name: "Recommended" })).toBeVisible();
	await expect(directory.getByRole("heading", { name: "Jira Coding Agent", exact: true })).toBeVisible();
	for (const name of ["Claude", "Cursor", "Codex", "GitHub Copilot"]) {
		await expect(directory.getByRole("heading", { name, exact: true })).toHaveCount(1);
	}
	await directory.getByRole("tab", { name: "Verified" }).click();
	for (const name of ["Jira Coding Agent", "Claude", "Cursor", "Codex", "GitHub Copilot"]) {
		await expect(directory.getByRole("button", { name: `View ${name}`, exact: true })).toHaveCount(1);
	}
	await directory.getByRole("tab", { name: "Templates" }).click();
	const templateAvatar = directory.locator('[data-agent-id="okr-generator"] [data-slot="agent-lanyard-template-avatar"]');
	await expect(templateAvatar.locator('img[src*="/avatar-agent/"]')).toHaveCount(0);
	const glyph = templateAvatar.locator("svg");
	await expect(glyph).toBeVisible();
	expect((await glyph.boundingBox())?.width).toBeGreaterThan(20);
	await directory.getByRole("tab", { name: "All agents" }).click();
	await directory.getByRole("button", { name: "View Feedback Analyzer" }).click();
	await expect(directory).toBeHidden();
	await add.focus();
	await page.keyboard.press("Enter");
	await picker.getByRole("button", { name: "Browse agents" }).click();
	await expect(directory).toBeVisible();
	await directory.getByRole("button", { name: "Close" }).click();
	await expect(directory).toBeHidden();
	await add.focus();
	await page.keyboard.press("Enter");
	await picker.getByRole("button", { name: "Create agent" }).click();
	await expect(page).toHaveURL(/\/studio$/u, { timeout: 20_000 });
});

for (const example of [
	{ route: "/butter", key: "PAY-118", type: "task" },
	{ route: "/components/blocks/jira-issue#project-butter", key: "PD-40", type: "story" },
]) {
	test(`Butter centers the ${example.type} icon with its key`, async ({ page }) => {
		await page.goto(appUrl(example.route), { waitUntil: "domcontentloaded" });
		const issue = example.type === "task"
			? card(page, example.key)
			: page.getByRole("region", { name: "Project butter playground" });
		const icon = issue.getByRole("img", { name: example.type, exact: true }).locator("svg");
		const key = issue.getByText(example.key, { exact: true });
		await expect(icon).toBeVisible();
		const [iconBox, keyBox] = await Promise.all([icon.boundingBox(), key.boundingBox()]);
		if (!iconBox || !keyBox) throw new Error(`Missing ${example.key} icon or key`);
		expect(Math.abs((iconBox.y + iconBox.height / 2) - (keyBox.y + keyBox.height / 2))).toBeLessThan(0.5);
	});
}

test("Butter aligns footer icons with the agent row", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	for (const key of ["PAY-105", "PAY-107", "PAY-112", "PAY-123", "PAY-101"]) {
		const issue = card(page, key);
		const centers = await issue.evaluate((node) => {
			const center = (selector: string) => {
				const bounds = node.querySelector(selector)?.getBoundingClientRect();
				return bounds ? bounds.left + bounds.width / 2 : null;
			};
			return {
				metadata: center('[aria-label^="Pull request"] svg') ?? center('[aria-label$="priority"] svg'),
				agent: center('[data-jira-issue-agent-row-handle] > div > span:first-child'),
				assignee: center('[data-slot="jira-issue-project-butter"] [data-slot="jira-issue-assignee-slot"]'),
				status: center('[data-slot="jira-issue-agent-status-affordance"]'),
			};
		});
		for (const value of Object.values(centers)) expect(value, `${key}: ${JSON.stringify(centers)}`).not.toBeNull();
		expect(Math.abs(centers.metadata! - centers.agent!), key).toBeLessThan(0.5);
		expect(Math.abs(centers.assignee! - centers.status!), key).toBeLessThan(0.5);
	}
});

test("Butter keeps card activation separate from its controls", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const issue = card(page, "PAY-118");
	const title = issue.getByText("Carry card-artwork metadata into the next wallet epic", { exact: true });
	const workItem = page.getByRole("dialog", { name: "Project butter", exact: true });
	const activation = issue.getByRole("button", { name: "PAY-118: Carry card-artwork metadata into the next wallet epic", exact: true });
	await activation.focus();
	await page.keyboard.press("Enter");
	await expect(workItem).toBeVisible();
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(workItem).toHaveCount(0);

	await issue.getByText("wallet", { exact: true }).click();
	await expect(workItem).toHaveCount(0);
	const pullRequest = card(page, "PAY-119").getByRole("button", { name: "Pull request #1880: Publish rollback guide", exact: true });
	await pullRequest.hover();
	const preview = page.locator('[data-slot="hover-card-content"]').filter({ hasText: "Publish rollback guide" });
	await expect(preview).toBeVisible();
	await preview.getByText("Publish rollback guide", { exact: true }).click();
	await expect(workItem).toHaveCount(0);
	await title.hover();
	await issue.getByRole("button", { name: "More actions for PAY-118" }).click();
	const actions = page.getByRole("menu");
	await expect(actions).toBeVisible();
	await actions.locator('[role="separator"]').first().click();
	await expect(workItem).toHaveCount(0);
	await page.keyboard.press("Escape");

	await title.hover();
	await issue.getByRole("button", { name: "Add agent to PAY-118" }).click();
	const agents = page.getByRole("dialog", { name: "Agents", exact: true });
	await expect(agents).toBeVisible();
	await expect(workItem).toHaveCount(0);
	await agents.getByRole("option", { name: /^Claude/u }).click();
	await expect(issue).toHaveAttribute("data-board-column-title", "In progress");
	await expect(issue.locator("[data-jira-issue-agent-row-handle]")).toHaveAttribute("aria-label", "Claude: Working");
	await expect(workItem).toHaveCount(0);
	await title.click();
	await expect(workItem).toBeVisible();
	await expect(workItem.getByRole("heading", { name: "Carry card-artwork metadata into the next wallet epic" })).toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Butter's inset keeps card content still and uses one raised edge (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		await page.evaluate(() => document.fonts.ready);
		const issue = card(page, "PAY-118");
		const summary = issue.getByText("Carry card-artwork metadata into the next wallet epic", { exact: true });
		await summary.hover();
		const add = issue.getByRole("button", { name: "Add agent to PAY-118", exact: true });
		const surface = issue.locator('[data-slot="jira-issue-surface"]');
		const baseline = await issue.evaluate((node) => {
			const host = node.querySelector("article")!.getBoundingClientRect();
			return ["[data-slot='jira-issue-project-butter']", "p", "[data-slot='jira-issue-assignee-slot']"].map((selector) => {
				const bounds = node.querySelector(selector)!.getBoundingClientRect();
				return [bounds.x - host.x, bounds.y - host.y, bounds.width, bounds.height];
			});
		});
		const framesPromise = issue.evaluate(async (node) => {
			const trigger = node.querySelector<HTMLButtonElement>("[aria-label='Add agent to PAY-118']")!;
			await new Promise<void>((resolve) => trigger.addEventListener("click", () => resolve(), { once: true, capture: true }));
			const frames: number[][][] = [];
			for (let i = 0; i < 32; i++) {
				const host = node.querySelector("article")!.getBoundingClientRect();
				frames.push(["[data-slot='jira-issue-project-butter']", "p", "[data-slot='jira-issue-assignee-slot']"].map((selector) => {
					const bounds = node.querySelector(selector)!.getBoundingClientRect();
					return [bounds.x - host.x, bounds.y - host.y, bounds.width, bounds.height];
				}));
				await new Promise<number>((resolve) => requestAnimationFrame(resolve));
			}
			return frames;
		});
		await add.click();
		const frames = await framesPromise;
		expect(frames.every((frame) => frame.every((box, index) => box.every((value, axis) =>
			Math.abs(value - baseline[index][axis]) < 0.5))), JSON.stringify({ baseline, frames })).toBe(true);
		await expect(page.getByRole("dialog", { name: "Agents", exact: true })).toBeVisible();
		await expect(surface).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
		await expect(surface).not.toHaveCSS("box-shadow", "none");
		await page.keyboard.press("Escape");
		await expect(add).toBeFocused();
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Butter's card picker keeps keyboard focus through assignment (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		const issue = card(page, "PAY-118");
		await expect(issue.locator('[data-slot="jira-issue-project-butter"]')).toBeVisible();
		const add = issue.getByRole("button", { name: "Add agent to PAY-118", exact: true });
		await add.focus();
		await page.keyboard.press("Enter");
		const menu = page.getByRole("dialog", { name: "Agents", exact: true });
		const search = menu.getByRole("combobox", { name: "Search agents" });
		await expect(search).toBeFocused();
		await menu.locator('[data-slot="command-item"][data-value="github-copilot"]').hover();
		await expect(issue.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveAttribute("data-agent-id", "github-copilot");
		await search.fill("no matching agent");
		await expect(issue.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveAttribute("data-agent-id", "default");
		await search.fill("Claude");
		await expect(issue.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveAttribute("data-agent-id", "claude-code");
		await page.keyboard.press("Escape");
		await expect(add).toBeFocused();
		await expect(issue.locator('[data-jira-issue-agent-row-handle]')).toHaveCount(0);
		await page.keyboard.press("Enter");
		await search.fill("Claude");
		await expect(menu.getByRole("option", { name: /^Claude/u })).toHaveAttribute("aria-selected", "true");
		await page.keyboard.press("Enter");
		await expect(issue).toHaveAttribute("data-board-column-title", "In progress");
		const activity = issue.locator('[data-jira-issue-agent-row-handle]');
		await expect(activity).toHaveCount(1);
		await expect(activity).toHaveAttribute("aria-label", "Claude: Working");
		await expect(activity).toBeFocused();
		await expect(issue.getByRole("button", { name: "Add agent to PAY-118", exact: true })).toHaveCount(0);
	});
}

test("Butter retains the new cards across Board/List and content presets", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await expect(page.locator('[data-slot="jira-issue-project-butter"]')).toHaveCount(20);
	const issue = card(page, "PAY-118");
	await issue.locator('[data-slot="jira-issue-project-butter"] p').first().click({ modifiers: ["Shift"] });
	await expect(issue.locator('[data-jira-issue-activation-control]')).toHaveAttribute("aria-pressed", "true");
	await page.keyboard.press("Escape");
	await expect(issue.locator('[data-jira-issue-activation-control]')).toHaveAttribute("aria-pressed", "false");
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 migration work items list", exact: true })).toBeVisible();
	await page.getByRole("tab", { name: "Board", exact: true }).click();
	await expect(issue.locator('[data-slot="jira-issue-project-butter"]')).toBeVisible();
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Checkout roadmap", exact: true })).toBeVisible();
	await expect(page.locator('[data-slot="jira-issue-project-butter"]')).toHaveCount(11);
});

test("Butter's new card still moves through the board's native drag path", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const source = card(page, "PAY-124").locator('[draggable]').first();
	const origin = await source.boundingBox();
	if (!origin) throw new Error("Source card is missing");
	await page.mouse.move(origin.x + 70, origin.y + 42);
	await page.mouse.down();
	await page.mouse.move(origin.x + 95, origin.y + 45, { steps: 5 });
	await expect(source).toHaveAttribute("data-dragging", "true");
	const target = page.locator('[data-jira-kanban-column="In progress"] [data-issue-status-zone="In progress"]');
	await expect(target).toBeVisible();
	const destination = await target.boundingBox();
	if (!destination) throw new Error("Destination column is missing");
	await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 5 });
	await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2);
	await expect(page.locator('[data-issue-drop-entered="In progress"]')).toBeVisible();
	await page.mouse.up();
	await expect(card(page, "PAY-124")).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card(page, "PAY-124").locator('[data-slot="jira-issue-project-butter"]')).toBeVisible();
});

test("the Team EU26 board retains its existing card appearance", async ({ page }) => {
	await page.goto(appUrl("/jira-team-eu26"));
	await expect(card(page, "PAY-118")).toBeVisible();
	await expect(page.locator('[data-slot="jira-issue-project-butter"]')).toHaveCount(0);
});

test("Team EU26 retains its original session avatar controls", async ({ page }) => {
	await page.goto(appUrl("/jira-team-eu26"));
	await card(page, "PAY-105").getByRole("button", { name: "Cursor: Working" }).click();
	const assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByRole("button", { name: /Cursor, used by Venn/ })).toBeVisible();
	await expect(assignment.getByRole("button", { name: "Preview Cursor" })).toHaveCount(0);
});

test("Butter list editing preserves row geometry and keeps inset sticky actions", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await page.evaluate(() => document.fonts.ready);
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list", exact: true });
	const summary = list.locator('[data-summary-trigger="PAY-118"]');
	const baseline = await summary.evaluate((node) => {
		const row = node.closest("tr")!;
		const bounds = node.getBoundingClientRect();
		return {
			x: bounds.x,
			cells: Array.from(row.cells, (cell) => {
				const box = cell.getBoundingClientRect();
				return [box.x, box.y, box.width, box.height];
			}),
		};
	});
	await summary.click();
	const input = list.getByRole("textbox", { name: "Summary for PAY-118", exact: true });
	await expect(input).toBeFocused();
	const layout = () => input.evaluate((node) => {
		const row = node.closest("tr")!;
		const region = row.closest('[data-testid="jira-list"]')!;
		const scroll = region.querySelector('[data-testid="jira-list-table-scroll"]')!;
		const actions = region.querySelector('[data-slot="jira-list-summary-actions"]')!;
		const bounds = node.getBoundingClientRect();
		const rowBounds = row.getBoundingClientRect();
		return {
			x: bounds.x,
			height: bounds.height,
			centerDelta: Math.abs(bounds.y + bounds.height / 2 - rowBounds.y - rowBounds.height / 2),
			rightGap: scroll.getBoundingClientRect().right - actions.getBoundingClientRect().right,
			actionsPosition: getComputedStyle(actions).position,
			actionsBackground: getComputedStyle(actions).backgroundColor,
			dividersHidden: Array.from(row.cells).every((cell) => getComputedStyle(cell).borderRightColor === "rgba(0, 0, 0, 0)"),
			metadataHidden: Array.from(row.cells).slice(2).every((cell) => cell.inert && getComputedStyle(cell.firstElementChild!).opacity === "0"),
			surface: Array.from(row.cells).every((cell) => getComputedStyle(cell).backgroundColor === getComputedStyle(region).backgroundColor),
			cells: Array.from(row.cells, (cell) => {
				const box = cell.getBoundingClientRect();
				return [box.x, box.y, box.width, box.height];
			}),
		};
	});
	const editing = await layout();
	expect(editing.cells).toEqual(baseline.cells);
	expect(editing.x).toBeCloseTo(baseline.x, 1);
	expect(editing.height).toBe(24);
	expect(editing.centerDelta).toBeLessThan(1);
	expect(editing.dividersHidden).toBe(true);
	expect(editing.metadataHidden).toBe(true);
	expect(editing.surface).toBe(true);
	expect(editing.actionsPosition).toBe("sticky");
	expect(editing.actionsBackground).toBe("rgba(0, 0, 0, 0)");
	await input.fill("Temporary layout check");
	expect((await layout()).cells).toEqual(baseline.cells);
	for (const width of [1280, 1800]) {
		await page.setViewportSize({ width, height: 1100 });
		await expect.poll(async () => Math.abs((await layout()).rightGap - 12)).toBeLessThan(1);
		await list.locator('[data-testid="jira-list-table-scroll"]').evaluate((node) => { node.scrollLeft = 100; });
		await expect.poll(async () => Math.abs((await layout()).rightGap - 12)).toBeLessThan(1);
	}
	await input.press("Escape");
	await expect(summary).toBeFocused();
	await expect(summary).toHaveText("Carry card-artwork metadata into the next wallet epic");
});

test("Butter points chevrons stay centered in their hover and focus shapes", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list", exact: true });
	await list.getByRole("button", { name: "Edit story points for PAY-118, no estimate", exact: true }).click();
	const input = list.getByRole("spinbutton", { name: "Story points for PAY-118", exact: true });
	await input.fill("4");
	await input.press("Enter");
	const up = list.getByRole("button", { name: "Increase story points for PAY-118", exact: true });
	const down = list.getByRole("button", { name: "Decrease story points for PAY-118", exact: true });

	for (const button of [up, down]) {
		await button.hover();
		await expect.poll(() => button.evaluate((node) => {
			const shape = node.querySelector('[data-slot="jira-list-points-stepper-visual"]') ?? node;
			return getComputedStyle(shape).backgroundColor;
		})).not.toBe("rgba(0, 0, 0, 0)");
		const layout = await button.evaluate((node) => {
			const shape = node.querySelector('[data-slot="jira-list-points-stepper-visual"]') ?? node;
			const shapeBox = shape.getBoundingClientRect();
			const svg = node.querySelector("svg")!;
			const iconBox = svg.getBoundingClientRect();
			const path = svg.querySelector("path")!;
			const pathBox = path.getBBox();
			const pathCenter = svg.createSVGPoint();
			pathCenter.x = pathBox.x + pathBox.width / 2;
			pathCenter.y = pathBox.y + pathBox.height / 2;
			const screenTransform = path.getScreenCTM();
			if (!screenTransform) throw new Error("Points chevron has no screen transform");
			return {
				centerDelta: Math.abs(shapeBox.top + shapeBox.height / 2 - iconBox.top - iconBox.height / 2),
				strokeCenterDelta: Math.abs(shapeBox.top + shapeBox.height / 2 - pathCenter.matrixTransform(screenTransform).y),
				rowHeight: node.closest("tr")!.getBoundingClientRect().height,
			};
		});
		expect(layout.centerDelta).toBeLessThan(0.5);
		expect(layout.strokeCenterDelta).toBeLessThan(1);
		expect(layout.rowHeight).toBe(40);
	}
	const upper = await up.locator("svg").boundingBox();
	const lower = await down.locator("svg").boundingBox();
	if (!upper || !lower) throw new Error("Points chevrons are missing");
	expect(Math.abs(lower.y - upper.y - upper.height)).toBeLessThan(0.5);

	await up.click();
	await expect(list.getByRole("button", { name: "Edit story points for PAY-118, 5", exact: true })).toBeVisible();
	await down.click();
	await expect(list.getByRole("button", { name: "Edit story points for PAY-118, 4", exact: true })).toBeVisible();
	await page.keyboard.press("Tab");
	await up.focus();
	await expect(up).toBeFocused();
	await expect.poll(() => up.evaluate((node) => {
		const shape = node.querySelector('[data-slot="jira-list-points-stepper-visual"]') ?? node;
		return getComputedStyle(shape).boxShadow;
	})).not.toBe("none");
});
