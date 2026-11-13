import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("board chin avatars fit a 24px slot without shrinking list avatars", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	for (const label of ["Cursor: Working", "2 agents: Working"]) {
		const row = page.getByRole("button", { name: label, exact: true });
		const avatar = row.locator('[data-slot="avatar"]').first();
		await expect(avatar).toBeVisible();
		const bounds = await avatar.boundingBox();
		const slot = await row.locator('[data-slot="jira-issue-agent-avatar-handoff"] > span').boundingBox();
		if (!bounds || !slot) throw new Error("Board agent avatar is unavailable");
		expect(bounds.width).toBeCloseTo(20, 1);
		expect(bounds.height).toBeCloseTo(20, 1);
		expect(slot.width).toBeCloseTo(24, 1);
		expect(slot.height).toBeCloseTo(24, 1);
	}
	await page.getByRole("button", { name: "Select List" }).click();
	const avatar = page.getByRole("button", { name: "Add agent to PAY-123" }).locator("xpath=ancestor::td").locator('.agent-loading-vertical [data-slot="avatar"]').first();
	await expect(avatar).toBeVisible();
	const listBounds = await avatar.boundingBox();
	if (!listBounds) throw new Error("List agent avatar is unavailable");
	expect(listBounds.width).toBeCloseTo(24, 1);
	expect(listBounds.height).toBeCloseTo(24, 1);
});

test("list agent add stays the same size as the agent avatar", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const add = page.getByRole("button", { name: "Add agent to PAY-123" });
	const cell = add.locator("xpath=ancestor::td");
	const visual = add.locator('[data-slot="jira-issue-add-agent-visual"]');
	const avatar = cell.locator('.agent-loading-vertical [data-slot="avatar"]').first();
	await page.mouse.move(0, 0);
	await expect(avatar).toBeVisible();
	for (const state of ["rest", "focus"] as const) {
		if (state === "focus") await add.focus();
		const addBounds = await visual.boundingBox();
		const avatarBounds = await avatar.boundingBox();
		if (!addBounds || !avatarBounds) throw new Error("Agent controls are unavailable");
		expect(addBounds.width, state).toBeCloseTo(24, 1);
		expect(addBounds.height, state).toBeCloseTo(24, 1);
		expect(addBounds.width, state).toBeCloseTo(avatarBounds.width, 1);
		expect(addBounds.height, state).toBeCloseTo(avatarBounds.height, 1);
	}
	await add.press("Enter");
	await expect(page.getByRole("dialog", { name: "Agents" })).toBeVisible();
});

test("due date text and calendar icon are vertically centered", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const dueDate = page.getByRole("button", { name: /^Edit due date for PAY-124:/ });
	await expect(dueDate).toBeVisible();
	const centers = await dueDate.evaluate((button) => {
		const icon = button.querySelector("svg");
		const text = button.lastElementChild;
		if (!icon || !text) throw new Error("Due date icon or text is missing");
		const center = (element: Element) => {
			const rect = element.getBoundingClientRect();
			return rect.top + rect.height / 2;
		};
		return { icon: center(icon), text: center(text) };
	});
	expect(Math.abs(centers.icon - centers.text)).toBeLessThanOrEqual(0.5);
});

test("the whole story points cell acts as the editable field", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const input = page.getByRole("spinbutton", { name: "Story points for PAY-118" });
	// The list seeds every work item with an estimate; clear PAY-118's so the cell starts empty.
	await page.getByRole("button", { name: "Edit story points for PAY-118, 3" }).click();
	await input.fill("");
	await input.press("Enter");
	const edit = page.getByRole("button", { name: "Edit story points for PAY-118, no estimate" });
	await edit.scrollIntoViewIfNeeded();
	await page.mouse.move(0, 0);
	const cell = edit.locator("xpath=ancestor::td");
	const cellBounds = await cell.boundingBox();
	if (!cellBounds) throw new Error("Story points cell is unavailable");
	const header = page.getByRole("columnheader", { name: /Points More actions for Points/ });
	const headerTextX = await header.evaluate((element) => {
		const label = Array.from(element.querySelectorAll("div")).find((div) => div.textContent === "Points");
		return label?.getBoundingClientRect().x;
	});
	if (headerTextX === undefined) throw new Error("Points header is unavailable");
	const originalBackground = await edit.evaluate((element) => getComputedStyle(element, "::before").backgroundColor);
	await page.mouse.move(cellBounds.x + cellBounds.width - 4, cellBounds.y + cellBounds.height / 2);
	await expect.poll(() => edit.evaluate((element) => getComputedStyle(element, "::before").backgroundColor)).not.toBe(originalBackground);
	const hoverBounds = await edit.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const visual = getComputedStyle(element, "::before");
		return { x: bounds.x + Number.parseFloat(visual.left), right: bounds.right - Number.parseFloat(visual.right) };
	});
	expect(hoverBounds.x).toBeCloseTo(headerTextX, 0);
	await page.mouse.click(cellBounds.x + cellBounds.width - 4, cellBounds.y + cellBounds.height / 2);
	await expect(input).toBeFocused();
	await expect(input).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(input).toHaveCSS("border-width", "0px");
	const inputBounds = await input.boundingBox();
	if (!inputBounds) throw new Error("Story points editor is unavailable");
	expect(inputBounds.x).toBeGreaterThan(cellBounds.x);
	expect(inputBounds.x + inputBounds.width).toBeLessThan(cellBounds.x + cellBounds.width);
	expect(inputBounds.height).toBeLessThan(cellBounds.height);
	expect(inputBounds.y + inputBounds.height / 2).toBeCloseTo(cellBounds.y + cellBounds.height / 2, 0);
	expect(inputBounds.x).toBeCloseTo(headerTextX, 0);
	expect(inputBounds.x + inputBounds.width).toBeCloseTo(hoverBounds.right, 0);
	const increase = page.getByRole("button", { name: "Increase story points for PAY-118" });
	const decrease = page.getByRole("button", { name: "Decrease story points for PAY-118" });
	await expect(decrease).toBeDisabled();
	await increase.click();
	await expect(input).toHaveValue("1");
	await expect(input).toBeFocused();
	await decrease.click();
	await expect(input).toHaveValue("0");
	await expect(decrease).toBeDisabled();
	await input.fill("3");
	await input.press("Enter");
	await increase.click();
	await expect(page.getByRole("button", { name: "Edit story points for PAY-118, 4" })).toBeVisible();
	await page.getByRole("button", { name: "Edit story points for PAY-118, 4" }).click();
	await input.press("Tab");
	await expect(increase).toBeFocused();
	await increase.press("Enter");
	await expect(input).toHaveValue("5");
	await decrease.press("Tab");
	await expect(page.getByRole("button", { name: "Edit story points for PAY-118, 5" })).toBeVisible();
});

test("attachment piles stay settled as Related work opens in the Work item and remain interactive", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	await page.getByRole("button", { name: "Select Work item" }).click();
	// Attachments live in the Related work section, which the gallery work item starts collapsed; the piles first appear when it opens.
	const button = page.getByRole("region", { name: "Work item full screen view" }).getByRole("button", { name: "Expand Related work" });
	const samples = await button.evaluate(async (element) => {
		const frames: Record<string, number>[] = [];
		(element as HTMLButtonElement).click();
		const start = performance.now();
		await new Promise<void>((resolve) => {
			const sample = () => {
				const workItem = document.querySelector('[aria-label="Work item full screen view"]');
				if (workItem) {
					const origin = workItem.getBoundingClientRect();
					const positions: Record<string, number> = {};
					for (const type of ["documents", "videos"]) {
						const stack = workItem.querySelector(`[data-attachment-stack="${type}"]`);
						if (stack) positions[type] = stack.getBoundingClientRect().top - origin.top;
					}
					if (Object.keys(positions).length === 2) frames.push(positions);
				}
				if (performance.now() - start < 1000) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return frames;
	});
	expect(samples.length).toBeGreaterThan(2);
	for (const type of ["documents", "videos"]) {
		const positions = samples.map((sample) => sample[type] ?? Infinity);
		expect(Math.max(...positions) - Math.min(...positions), `${type} moved as Related work opened`).toBeLessThanOrEqual(1);
	}
	const documents = page.getByRole("button", { name: "Documents, 4 attachments" });
	const front = page.locator('[data-attachment-stack="documents"] [data-attachment-card]').first().locator(":scope > div").first();
	await documents.hover();
	await expect.poll(() => front.evaluate((node) => {
		const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
		return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
	})).toBeLessThan(-1);
	await documents.click();
	await expect(page.getByRole("button", { name: "Close documents" })).toHaveAttribute("aria-expanded", "true");
});

test("the empty agent field stays in place when its picker opens", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const field = page.getByRole("group", { name: "Agents field" });
	const position = () => field.evaluate((element) => {
		const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
		let label: Node | null = null;
		while (walker.nextNode()) { if (walker.currentNode.textContent?.startsWith("Add")) { label = walker.currentNode; break; } }
		const icon = element.querySelector("svg");
		if (!label || !icon) throw new Error("Missing empty agent field content");
		const range = document.createRange();
		range.setStart(label, 0);
		range.setEnd(label, 3);
		const bounds = (rect: DOMRect) => { const { x, y, width, height } = rect; return { x, y, width, height }; };
		return { label: bounds(range.getBoundingClientRect()), icon: bounds(icon.getBoundingClientRect()) };
	});
	const before = await position();
	await field.getByRole("button", { name: "Add agent" }).click();
	await expect(page.getByRole("dialog", { name: "Add agent" })).toBeVisible();
	const after = await position();
	for (const part of ["label", "icon"] as const) {
		for (const dimension of ["x", "y", "width", "height"] as const) {
			expect(after[part][dimension], `${part} ${dimension}`).toBeCloseTo(before[part][dimension], 0);
		}
	}
});

test("the work item shows automation rules and recent runs in the card", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const details = page.getByRole("complementary", { name: "Work item details" });
	await details.getByRole("button", { name: "Automation", exact: true }).click();
	const automation = details.getByRole("region", { name: "Automation" });
	const ruleRows = automation.getByRole("list", { name: "Available automations" }).getByRole("listitem");
	await expect(ruleRows).toHaveCount(8);
	const rule = ruleRows.first().locator("div").first();
	const ruleBackground = await rule.evaluate((element) => getComputedStyle(element).backgroundColor);
	await rule.hover();
	await expect.poll(() => rule.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(ruleBackground);
	const recentButton = automation.getByRole("button", { name: "Recent run rules" });
	await expect.poll(async () => {
		const card = await automation.boundingBox();
		const row = await automation.getByRole("button", { name: "Set to recur" }).boundingBox();
		return card && row ? card.y + card.height - (row.y + row.height) - (row.x - card.x) : null;
	}).toBeCloseTo(0, 0);
	const buttonBounds = await recentButton.boundingBox();
	const labelBounds = await recentButton.locator("span").first().boundingBox();
	const recurBounds = await automation.getByRole("button", { name: "Set to recur" }).boundingBox();
	const automationBounds = await automation.boundingBox();
	const repositoryBounds = await details.getByRole("button", { name: "Start coding" }).boundingBox();
	if (!buttonBounds || !labelBounds || !recurBounds || !automationBounds || !repositoryBounds) throw new Error("Action button bounds are unavailable");
	expect(automationBounds.y + automationBounds.height - (recurBounds.y + recurBounds.height)).toBeCloseTo(recurBounds.x - automationBounds.x, 0);
	expect(automationBounds.x + automationBounds.width - (recurBounds.x + recurBounds.width)).toBeCloseTo(recurBounds.x - automationBounds.x, 0);
	for (const bounds of [buttonBounds, recurBounds]) {
		expect(bounds.width).toBeCloseTo(repositoryBounds.width, 0);
		expect(bounds.height).toBeCloseTo(repositoryBounds.height, 0);
	}
	expect(labelBounds.x - buttonBounds.x).toBeGreaterThanOrEqual(8);
	await recentButton.click();
	const recentRows = automation.getByRole("list", { name: "Recent automation runs" }).getByRole("listitem");
	await expect(recentRows).toHaveCount(4);
	await expect.poll(async () => {
		const card = await automation.boundingBox();
		const row = await recentRows.last().boundingBox();
		return card && row ? card.y + card.height - (row.y + row.height) - (row.x - card.x) : null;
	}).toBeCloseTo(0, 0);
	const recentCardBounds = await automation.boundingBox();
	const lastRunBounds = await recentRows.last().boundingBox();
	if (!recentCardBounds || !lastRunBounds) throw new Error("Recent runs bounds are unavailable");
	expect(recentCardBounds.y + recentCardBounds.height - (lastRunBounds.y + lastRunBounds.height)).toBeCloseTo(lastRunBounds.x - recentCardBounds.x, 0);
	expect(recentCardBounds.x + recentCardBounds.width - (lastRunBounds.x + lastRunBounds.width)).toBeCloseTo(lastRunBounds.x - recentCardBounds.x, 0);
	const recentHeaderBounds = await automation.getByRole("heading", { name: "Recent run rules" }).locator("..").boundingBox();
	if (!recentHeaderBounds) throw new Error("Recent runs header bounds are unavailable");
	expect(recentHeaderBounds.height).toBeCloseTo(repositoryBounds.height, 0);
	for (const row of await recentRows.all()) {
		const bounds = await row.boundingBox();
		if (!bounds) throw new Error("Recent run row bounds are unavailable");
		expect(bounds.width).toBeCloseTo(repositoryBounds.width, 0);
		expect(bounds.height).toBeCloseTo(repositoryBounds.height, 0);
	}
	const backIcon = await automation.getByRole("button", { name: "Back to automation" }).locator("svg").boundingBox();
	const statusIcon = await recentRows.first().locator("svg").boundingBox();
	if (!backIcon || !statusIcon) throw new Error("Recent run icon bounds are unavailable");
	expect(backIcon.x + backIcon.width / 2).toBeCloseTo(statusIcon.x + statusIcon.width / 2, 0);
	const recentBackground = await recentRows.first().evaluate((element) => getComputedStyle(element).backgroundColor);
	await recentRows.first().hover();
	await expect.poll(() => recentRows.first().evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(recentBackground);
	await automation.getByRole("button", { name: "Back to automation" }).click();
	await expect(automation.getByRole("button", { name: "Set to recur" })).toBeVisible();
	await automation.getByRole("button", { name: "Automation", exact: true }).click();
	await automation.getByRole("button", { name: "More automation actions" }).click();
	await page.getByRole("menuitem", { name: "Recent run rules" }).click();
	await expect(automation.getByRole("list", { name: "Recent automation runs" })).toBeVisible();
});

test("the work item Agents popup matches the Assignee picker", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const item = page.getByRole("region", { name: "Work item full screen view" });
	await item.getByRole("button", { name: "Change assignee" }).click();
	const assignee = page.getByRole("dialog").filter({ has: page.getByRole("textbox", { name: "Search people" }) });
	const assigneeBounds = await assignee.boundingBox();
	const assigneeShadow = await assignee.locator(".rich-text-command-menu").evaluate((element) => getComputedStyle(element).boxShadow);
	await page.keyboard.press("Escape");
	await item.getByRole("group", { name: "Agents field" }).getByRole("button", { name: "2 agents" }).click();
	const agents = page.getByRole("dialog", { name: "Add agent" });
	const agentBounds = await agents.boundingBox();
	if (!assigneeBounds || !agentBounds) throw new Error("Picker bounds are unavailable");
	expect(agentBounds.x).toBeCloseTo(assigneeBounds.x, 0);
	expect(agentBounds.width).toBeCloseTo(assigneeBounds.width, 0);
	expect((await agents.locator("[data-overlay-surface]").evaluate((element) => getComputedStyle(element).boxShadow)).endsWith(assigneeShadow)).toBe(true);
});

test("start coding opens the development dropdown in a work item", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	await board.locator('[data-issue-key="PAY-105"] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: "Start coding" }).click();
	const menu = page.getByRole("menu", { name: "Start coding" });
	await expect(menu).toHaveCSS("border-radius", "8px");
	for (const name of ["Bitbucket Cloud", "GitHub", "Copy create branch command", "Copy create commit command", "Copy work item key"]) {
		await expect(menu.getByRole("menuitem", { name, exact: true })).toBeVisible();
	}
	await expect(menu.getByRole("menuitem", { name: "Branch name settings" })).toBeVisible();
	await expect(item.locator('[data-rovo-chat-placement="floating"]')).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(item.getByRole("button", { name: "Start coding" })).toBeFocused();
});

test("Escape closes the local-agent picker without closing the work item", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.locator('[data-issue-key="PAY-105"] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await expect(item).toBeVisible();
	const trigger = item.getByRole("button", { name: "Open in", exact: true });
	await trigger.click();
	const picker = page.getByRole("dialog", { name: "Local software agents" });
	await expect(picker).toBeVisible();
	await expect(picker).toHaveCSS("border-radius", "8px");
	await picker.getByRole("button", { name: "Copy prompt" }).focus();
	await page.keyboard.press("Escape");
	await expect(picker).toBeHidden();
	await expect(item).toBeVisible();
	await expect(trigger).toBeFocused();
});
