import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("board chin avatars fit a 24px slot without shrinking list avatars", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	for (const label of ["Claude: Working", "2 agents: Working"]) {
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
	await page.getByRole("button", { name: "Add due date for PAY-124" }).click();
	await page.getByRole("button", { name: /^Today,/ }).click();
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
	const edit = page.getByRole("button", { name: "Edit story points for PAY-118, no estimate" });
	await edit.scrollIntoViewIfNeeded();
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
	const input = page.getByRole("spinbutton", { name: "Story points for PAY-118" });
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

test("selecting a gallery item animates its highlight", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const button = page.getByRole("button", { name: "Select Work item" });
	await expect(button).toBeVisible();
	const sizes = await button.evaluate(async (element) => {
		const samples: number[] = [];
		const start = performance.now();
		(element as HTMLButtonElement).click();
		await new Promise<void>((resolve) => {
			const sample = () => {
				const surface = element.querySelector<HTMLElement>("[style*='mask-image']");
				if (surface) samples.push(Number.parseFloat(getComputedStyle(surface).maskSize));
				if (performance.now() - start < 1000) requestAnimationFrame(sample);
				else resolve();
			};
			requestAnimationFrame(sample);
		});
		return samples;
	});
	expect(new Set(sizes).size).toBeGreaterThan(2);
});

test("attachment piles stay settled when entering Work item and remain interactive", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
	const button = page.getByRole("button", { name: "Select Work item" });
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
		expect(Math.max(...positions) - Math.min(...positions), `${type} moved on entry`).toBeLessThanOrEqual(1);
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

test("the e2e journey starts and resets with a complete ticket ready to invoke", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const steps = page.getByRole("group", { name: "Merchant onboarding journey steps" });
	const invoke = steps.getByRole("button", { name: "Invoke", exact: true });
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	const item = page.getByRole("dialog", { name: "Project butter" });
	await expect(invoke).toHaveAttribute("aria-pressed", "true");
	await expect(card.getByText("onboarding", { exact: true })).toBeVisible();
	await card.locator('[data-slot="jira-issue-card"]').click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: /suggestions$/ })).toHaveCount(0);
	await expect(item.getByText("Merchant onboarding brief", { exact: true })).toBeVisible();
	await expect(item.getByText("Write the Payments SDK v2 sandbox quickstart", { exact: true })).toBeVisible();
	await expect(item.getByText("Confirm the English-only account allow-list", { exact: true })).toBeVisible();
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("Start with the English-only pilot");
	await item.getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("dialog", { name: "Add agent", exact: true }).getByRole("button", { name: "Claude", exact: true }).click();
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("Venn added Claude");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card.getByText("onboarding", { exact: true })).toBeVisible();
	await invoke.click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("region", { name: "Activity" })).not.toContainText("Venn added Claude");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "To do");
	await expect(card.getByText("onboarding", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(invoke).toHaveAttribute("aria-pressed", "true");
	await expect(card).toHaveAttribute("data-board-column-title", "To do");
	await card.locator('[data-slot="jira-issue-card"]').click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.getByRole("button", { name: /suggestions$/ })).toHaveCount(0);
	await expect(item.getByText("Write the Payments SDK v2 sandbox quickstart", { exact: true })).toBeVisible();
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
	const repositoryBounds = await details.getByRole("button", { name: "Configure repository" }).boundingBox();
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

test("the List gallery item shows the interactive Jira list", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select List" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	await expect(list).toBeVisible();
	for (const edge of ["top", "right", "bottom", "left"]) {
		await expect(list).toHaveCSS(`border-${edge}-width`, "0px");
	}
	const headerCells = list.locator("thead th");
	await expect(headerCells.first()).toHaveCSS("border-top-left-radius", "12px");
	await expect(headerCells.first()).toHaveCSS("border-bottom-left-radius", "12px");
	await expect(headerCells.last()).toHaveCSS("border-top-right-radius", "12px");
	await expect(headerCells.last()).toHaveCSS("border-bottom-right-radius", "12px");
	await expect(list.getByTestId("jira-list-sticky-footer")).toHaveCSS("border-top-width", "1px");
	await expect(list.getByRole("button", { name: "PAY-118", exact: true })).toBeVisible();
	await list.getByRole("button", { name: "PAY-118", exact: true }).click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await gallery.getByRole("button", { name: "Select Board" }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select List" }).click();
	await expect(list).toBeVisible();
});

test("list work items align around the subtask expand control", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	const leaf = list.getByRole("button", { name: "PAY-118", exact: true });
	const parent = list.getByRole("button", { name: "PAY-101", exact: true });
	const expand = list.getByRole("button", { name: "Expand PAY-101" });
	await expect(expand).toHaveAttribute("aria-expanded", "false");
	await expect(list.getByRole("button", { name: "Expand PAY-118" })).toHaveCount(0);
	const leafBounds = await leaf.boundingBox();
	const parentBounds = await parent.boundingBox();
	if (!leafBounds || !parentBounds) throw new Error("Work item bounds are unavailable");
	expect(leafBounds.x).toBeCloseTo(parentBounds.x, 1);
	const selectBounds = await list.getByRole("checkbox", { name: "Select PAY-101" }).boundingBox();
	const expandBounds = await expand.boundingBox();
	const expandAllBounds = await list.getByRole("button", { name: "Expand all subtasks" }).boundingBox();
	const selectAll = list.getByRole("checkbox", { name: "Select all work items" });
	const selectAllBounds = await selectAll.boundingBox();
	if (!selectBounds || !expandBounds || !expandAllBounds || !selectAllBounds) throw new Error("Hierarchy control bounds are unavailable");
	const headerBounds = await selectAll.locator("xpath=ancestor::th").boundingBox();
	if (!headerBounds) throw new Error("Selection header bounds are unavailable");
	expect(selectAllBounds.x - headerBounds.x).toBeCloseTo(selectAllBounds.y - headerBounds.y, 1);
	expect(selectAllBounds.x - headerBounds.x).toBeCloseTo(headerBounds.y + headerBounds.height - selectAllBounds.y - selectAllBounds.height, 1);
	expect(selectAllBounds.x).toBeCloseTo(selectBounds.x, 1);
	expect(expandBounds.x - (selectBounds.x + selectBounds.width)).toBeGreaterThanOrEqual(4);
	expect(expandBounds.x).toBeCloseTo(expandAllBounds.x, 1);
	const expectCompactGap = async (name: string) => {
		for (const width of [1200, 1800]) {
			await page.setViewportSize({ width, height: 1300 });
			const chevron = await list.getByRole("button", { name }).boundingBox();
			const work = await list.getByRole("columnheader", { name: /Work/u }).boundingBox();
			if (!chevron || !work) throw new Error("Column bounds are unavailable");
			expect(work.x - (chevron.x + chevron.width)).toBeGreaterThanOrEqual(0);
			expect(work.x - (chevron.x + chevron.width)).toBeLessThanOrEqual(8);
		}
	};
	await expectCompactGap("Expand all subtasks");
	await expand.click();
	const collapse = list.getByRole("button", { name: "Collapse PAY-101" });
	await expect(collapse).toHaveAttribute("aria-expanded", "true");
	await expect(list.getByRole("button", { name: "PAY-102", exact: true })).toBeVisible();
	await expectCompactGap("Collapse all subtasks");
	await collapse.click();
	await expect(list.getByRole("button", { name: "PAY-102", exact: true })).toHaveCount(0);
});

test("selection checkboxes leave issue icons visible without shifting work items", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	const firstRow = list.getByRole("button", { name: "PAY-118", exact: true }).locator("xpath=ancestor::tr");
	const secondRow = list.getByRole("button", { name: "PAY-999", exact: true }).locator("xpath=ancestor::tr");
	const first = firstRow.getByRole("checkbox", { name: "Select PAY-118" });
	const second = secondRow.getByRole("checkbox", { name: "Select PAY-999" });
	const icon = firstRow.getByRole("img", { name: "task" });
	const selectAll = list.getByRole("checkbox", { name: "Select all work items" });
	await page.mouse.move(0, 0);
	await expect(first).toBeVisible();
	await expect(icon).toBeVisible();
	const before = await firstRow.getByRole("button", { name: "PAY-118", exact: true }).boundingBox();
	const iconBounds = await icon.boundingBox();
	const checkboxBounds = await first.boundingBox();
	if (!before || !iconBounds || !checkboxBounds) throw new Error("Issue control bounds are unavailable");
	expect(iconBounds.width).toBeCloseTo(checkboxBounds.width, 0);
	await first.hover();
	await expect(icon).toBeVisible();
	await expect(second).toBeVisible();
	await first.click();
	await page.mouse.move(0, 0);
	await expect(first).toBeChecked();
	await expect(icon).toBeVisible();
	await expect(selectAll).toHaveAttribute("aria-checked", "mixed");
	await page.getByRole("heading", { name: "Project Butter v1" }).click();
	await page.mouse.move(0, 0);
	const rowBackgrounds = (row: typeof firstRow) => row.locator("td").evaluateAll((cells) => cells.map((cell, index) => (
		getComputedStyle(cell, index === 0 ? "::before" : null).backgroundColor
	)));
	await expect.poll(() => rowBackgrounds(firstRow)).toEqual(await rowBackgrounds(secondRow));
	const after = await firstRow.getByRole("button", { name: "PAY-118", exact: true }).boundingBox();
	if (!after) throw new Error("Selected work item bounds are unavailable");
	expect(after.x).toBeCloseTo(before.x, 1);
	await first.click();
	await page.mouse.move(0, 0);
	await expect(second).toBeVisible();
	await page.keyboard.press("Tab");
	await second.focus();
	await expect(second).toBeVisible();
	await second.press("Space");
	await expect(second).toBeChecked();
	await selectAll.click();
	await expect(first).toBeChecked();
	await expect(second).toBeChecked();
	await selectAll.click();
	await expect(first).not.toBeChecked();
	await expect(second).not.toBeChecked();
});

test("issue selection is available without hover", async ({ browser }) => {
	const context = await browser.newContext({ hasTouch: true, ignoreHTTPSErrors: true, viewport: { width: 1800, height: 1300 } });
	try {
		const page = await context.newPage();
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select List" }).click();
		const checkbox = page.getByRole("checkbox", { name: "Select PAY-118" });
		await expect(checkbox).toHaveCSS("opacity", "1");
		await checkbox.tap();
		await expect(checkbox).toBeChecked();
	} finally {
		await context.close();
	}
});

test("hovered and selected work item rows match the header corners", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	const headerCells = list.locator("thead th");
	const leftRadius = await headerCells.first().evaluate((cell) => getComputedStyle(cell).borderTopLeftRadius);
	const rightRadius = await headerCells.last().evaluate((cell) => getComputedStyle(cell).borderTopRightRadius);
	for (const key of ["PAY-118", "PAY-105"]) {
		const row = list.getByRole("button", { name: key, exact: true }).locator("xpath=ancestor::tr");
		const firstCell = row.locator("td").first();
		const lastCell = row.locator("td").last();
		await row.hover({ position: { x: 200, y: 20 } });
		await expect(firstCell).toHaveCSS("border-top-left-radius", leftRadius);
		await expect(firstCell).toHaveCSS("border-bottom-left-radius", leftRadius);
		await expect(lastCell).toHaveCSS("border-top-right-radius", rightRadius);
		await expect(lastCell).toHaveCSS("border-bottom-right-radius", rightRadius);
		expect(await firstCell.evaluate((cell) => getComputedStyle(cell, "::before").borderTopLeftRadius)).toBe(leftRadius);
		await expect.poll(() => row.evaluate((element) => {
			const cells = element.querySelectorAll("td");
			const leading = getComputedStyle(cells[0], "::before").backgroundColor;
			const trailing = getComputedStyle(cells[cells.length - 1]).backgroundColor;
			return leading !== "rgba(0, 0, 0, 0)" && leading === trailing;
		})).toBe(true);
	}
	const selected = list.getByRole("checkbox", { name: "Select PAY-118" });
	await selected.click();
	await expect(selected).toBeChecked();
	const selectedRow = selected.locator("xpath=ancestor::tr");
	await expect(selectedRow.locator("td").first()).toHaveCSS("border-bottom-left-radius", leftRadius);
	await expect(selectedRow.locator("td").last()).toHaveCSS("border-bottom-right-radius", rightRadius);
});

test("the Work header expands and collapses all subtasks", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	const expandAll = list.getByRole("button", { name: "Expand all subtasks" });
	await expect(expandAll).toHaveAttribute("aria-expanded", "false");
	await expandAll.focus();
	await expandAll.press("Enter");
	const collapseAll = list.getByRole("button", { name: "Collapse all subtasks" });
	await expect(collapseAll).toHaveAttribute("aria-expanded", "true");
	await expect(collapseAll).toBeFocused();
	expect(await collapseAll.evaluate((button) => getComputedStyle(button).boxShadow)).not.toBe("none");
	await expect(list.getByRole("button", { name: "PAY-102", exact: true })).toBeVisible();
	await expect(list.getByRole("button", { name: "PAY-104", exact: true })).toBeVisible();
	const parentBounds = await list.getByRole("button", { name: "PAY-101", exact: true }).boundingBox();
	const subtaskBounds = await list.getByRole("button", { name: "PAY-102", exact: true }).boundingBox();
	if (!parentBounds || !subtaskBounds) throw new Error("Hierarchy bounds are unavailable");
	expect(subtaskBounds.x).toBeGreaterThan(parentBounds.x);
	await collapseAll.press("Space");
	await expect(expandAll).toHaveAttribute("aria-expanded", "false");
	await expect(list.getByRole("button", { name: "PAY-102", exact: true })).toHaveCount(0);
	await list.getByRole("button", { name: "Expand PAY-101" }).click();
	await expect(collapseAll).toHaveAttribute("aria-expanded", "true");
	await collapseAll.click();
	await expect(list.getByRole("button", { name: "PAY-104", exact: true })).toHaveCount(0);
});

test("expanded hierarchy chevrons do not look selected", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	const styles = (element: Element) => {
		const button = getComputedStyle(element);
		const icon = element.querySelector("svg");
		return { background: button.backgroundColor, border: button.borderColor, icon: icon ? getComputedStyle(icon).color : null };
	};
	const expandAll = list.getByRole("button", { name: "Expand all subtasks" });
	const expandRow = list.getByRole("button", { name: "Expand PAY-101" });
	const collapsedHeader = await expandAll.evaluate(styles);
	const collapsedRow = await expandRow.evaluate(styles);
	await expandAll.click();
	await page.mouse.move(0, 0);
	await expect(list.getByRole("button", { name: "Collapse all subtasks" })).toHaveAttribute("aria-expanded", "true");
	expect(await list.getByRole("button", { name: "Collapse all subtasks" }).evaluate(styles)).toEqual(collapsedHeader);
	expect(await list.getByRole("button", { name: "Collapse PAY-101" }).evaluate(styles)).toEqual(collapsedRow);
});

test("the list create line appears only when its control is hovered or focused", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByTestId("jira-list");
	const upper = list.getByRole("button", { name: "PAY-118", exact: true }).locator("xpath=ancestor::tr");
	const lower = list.getByRole("button", { name: "PAY-999", exact: true }).locator("xpath=ancestor::tr");
	const upperBox = (await upper.boundingBox())!;
	const lowerBox = (await lower.boundingBox())!;
	const x = upperBox.x + 200;
	await page.mouse.move(x, upperBox.y + upperBox.height - 3);
	const createAfter = list.getByRole("button", { name: "Create work item after PAY-118" });
	await expect(createAfter).toHaveCSS("opacity", "1");
	await expect(list.locator("[data-insertion-line]")).toHaveCount(0);
	await createAfter.hover();
	await expect(lower.locator('[data-insertion-line="before"]')).not.toHaveCount(0);
	const line = await list.locator("[data-insertion-line]").first().elementHandle();
	const lineTop = await line!.evaluate((cell) => {
		const bounds = cell.getBoundingClientRect();
		const style = getComputedStyle(cell, "::after");
		return bounds.top + (style.top === "auto" ? bounds.height - parseFloat(style.bottom) - parseFloat(style.height) : parseFloat(style.top));
	});
	await page.mouse.move(x, lowerBox.y + 3);
	await expect(list.locator("[data-insertion-line]")).toHaveCount(0);
	const createBefore = list.getByRole("button", { name: "Create work item before PAY-999" });
	await expect(createBefore).toHaveCSS("opacity", "1");
	await createBefore.hover();
	await expect(lower.locator('[data-insertion-line="before"]')).not.toHaveCount(0);
	const newLine = list.locator("[data-insertion-line]").first();
	expect(await newLine.evaluate((cell, previous) => cell === previous, line)).toBe(true);
	expect(await newLine.evaluate((cell) => cell.getBoundingClientRect().top + parseFloat(getComputedStyle(cell, "::after").top))).toBeCloseTo(lineTop, 2);
	await page.mouse.move(0, 0);
	await expect(list.locator("[data-insertion-line]")).toHaveCount(0);
	await createAfter.focus();
	await expect(lower.locator('[data-insertion-line="before"]')).not.toHaveCount(0);
	await createAfter.press("Enter");
	await expect(upper.locator("xpath=following-sibling::tr[1]").getByRole("textbox", { name: "New work item summary" })).toBeVisible();
});

test("the gallery list hugs its content and centers when space permits", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByTestId("jira-list");
	const scrollport = page.getByTestId("jira-list-table-scroll");
	await expect(list).toBeVisible();
	await expect.poll(() => scrollport.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
	const bounds = await list.boundingBox();
	if (!bounds) throw new Error("List has no bounds");
	expect(bounds.y - 48).toBeCloseTo(1300 - bounds.y - bounds.height, 0);

	await page.setViewportSize({ width: 1800, height: 600 });
	await expect.poll(() => scrollport.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
	await expect(list.getByRole("button", { name: "Refresh work items" })).toBeVisible();
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
	await item.getByRole("group", { name: "Agents field" }).getByRole("button").click();
	const agents = page.getByRole("dialog", { name: "Add agent" });
	const agentBounds = await agents.boundingBox();
	if (!assigneeBounds || !agentBounds) throw new Error("Picker bounds are unavailable");
	expect(agentBounds.x).toBeCloseTo(assigneeBounds.x, 0);
	expect(agentBounds.width).toBeCloseTo(assigneeBounds.width, 0);
	expect((await agents.locator("[data-overlay-surface]").evaluate((element) => getComputedStyle(element).boxShadow)).endsWith(assigneeShadow)).toBe(true);
});

test("Butter v1 keeps the journey while browsing the gallery placeholders", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await expect.poll(() => gallery.getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")))).toEqual([
		"Select Agent selector",
		"Select Duplicative sessions",
		"Select Board",
		"Select Work item",
		"Select List",
		"Select Pull request",
		"Select Development panel",
		"Select e2e Journey",
	]);
	for (const name of ["Board", "Agent selector", "Work item", "List", "Pull request", "e2e Journey"]) {
		await expect(gallery.getByRole("button", { name: `Select ${name}` })).toBeVisible();
	}
	await expect(gallery.getByRole("button", { name: "Select Agent selector" })).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("region", { name: "Project Butter agent selector" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	const boardTile = await gallery.getByRole("button", { name: "Select Board" }).boundingBox();
	const agentTile = await gallery.getByRole("button", { name: "Select Agent selector" }).boundingBox();
	if (!boardTile || !agentTile) throw new Error("Gallery tiles have no bounds");
	expect(agentTile.height).toBeGreaterThan(boardTile.height);
	await expect(gallery.getByRole("button", { name: "Select e2e Journey" })).toHaveAttribute("aria-pressed", "true");
	const selectedTile = gallery.getByRole("button", { name: "Select e2e Journey" });
	await expect(selectedTile.locator("canvas")).toHaveCount(0);
	const textColor = await gallery.getByRole("button", { name: "Select Board" }).locator(".text-text").evaluate((element) => getComputedStyle(element).color);
	await expect.poll(() => selectedTile.locator("div").evaluateAll((elements, color) => elements.some((element) => getComputedStyle(element).backgroundColor === color), textColor)).toBe(true);
	await expect(page.getByRole("group", { name: "Merchant onboarding journey steps" })).toBeVisible();
	const journeyColumn = page.locator('[data-butter-board-surface] [data-jira-kanban-column="To do"]');
	await expect(journeyColumn).toBeVisible();
	const journeyColumnBounds = await journeyColumn.boundingBox();
	if (!journeyColumnBounds) throw new Error("Journey column has no bounds");
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByRole("tab", { name: "List", exact: true })).toHaveAttribute("aria-selected", "true");
	await gallery.getByRole("button", { name: "Select Board" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	await expect(board).toBeVisible();
	const boardBounds = await board.boundingBox();
	const boardColumnBounds = await board.locator('[data-jira-kanban-column="To do"]').boundingBox();
	if (!boardBounds || !boardColumnBounds) throw new Error("Board has no bounds");
	expect(boardColumnBounds.width).toBeCloseTo(journeyColumnBounds.width, 0);
	expect(boardColumnBounds.y - boardBounds.y).toBeGreaterThanOrEqual(20);
	for (const name of ["To do", "In progress", "In review", "Done"]) {
		await expect(board.getByRole("button", { name: `Collapse ${name} column` })).toBeVisible();
	}
	await expect(board.getByText("Improve merchant onboarding for Payments SDK v2", { exact: true })).toBeVisible();
	await expect(page.getByRole("region", { name: /Unlink sessions/ })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Open Rovo chat" })).toBeHidden();
	await expect(page.getByRole("tab", { name: "List", exact: true })).toBeHidden();
	await expect(page.getByRole("group", { name: "Merchant onboarding journey steps" })).toHaveCount(0);
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(page.getByRole("tab", { name: "List", exact: true })).toHaveAttribute("aria-selected", "true");
	await gallery.getByRole("button", { name: "Select Board" }).click();
	await board.locator('[data-jira-kanban-column="To do"]').hover();
	await board.getByRole("button", { name: "Collapse To do column" }).click();
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(page.getByRole("tab", { name: "List", exact: true })).toHaveAttribute("aria-selected", "true");
	await gallery.getByRole("button", { name: "Select Board" }).click();
	await expect(board.getByRole("button", { name: "Expand To do column" })).toBeVisible();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(board.getByRole("button", { name: "Collapse To do column" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(page.getByRole("tab", { name: "Board", exact: true })).toHaveAttribute("aria-selected", "true");
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.locator('[data-butter-board-surface] [data-issue-key="PAY-118"] [data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(workItem).toBeHidden();
	await page.getByRole("button", { name: "Open gallery" }).click();
	await expect(gallery.getByRole("button", { name: "Select e2e Journey" })).toBeVisible();
});

test("the Development panel gallery item shows the populated interactive panel", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.clock.install();
	await page.getByRole("button", { name: "Select Development panel" }).click();
	const panel = page.getByRole("region", { name: "Pull request development" });
	await expect(panel).toHaveAttribute("data-project-butter-development", "failed");
	await expect(panel.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ })).toBeVisible();
	const initial = await panel.boundingBox();
	if (!initial) throw new Error("Development panel has no bounds");
	for (const phase of ["fixing", "passed", "merged"]) {
		await page.clock.fastForward(5000);
		await expect(panel).toHaveAttribute("data-project-butter-development", phase);
		const current = await panel.boundingBox();
		if (!current) throw new Error(`Development panel has no bounds in ${phase}`);
		expect(Math.abs(current.x - initial.x)).toBeLessThanOrEqual(1);
		expect(Math.abs(current.y - initial.y)).toBeLessThanOrEqual(1);
	}
	await panel.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ }).click();
	await expect(page.getByText("payments-platform/payments").first()).toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`CI summary resolves to a filled success check with ${reducedMotion} motion`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Development panel" }).click();
		const panel = page.getByRole("region", { name: "Pull request development" });
		await expect(panel).toHaveAttribute("data-project-butter-development", "failed");
		await panel.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ }).click();
		const flyout = page.getByRole("group", { name: "Pull request #284: Add merchant onboarding quickstart" });
		const indicator = flyout.locator('[data-slot="progress-circle"]').first();
		await expect(indicator.locator("circle")).not.toHaveCount(0);
		await expect(indicator.locator("circle.text-icon-danger")).toHaveCount(1);
		const completionFrames = flyout.evaluate((element) => new Promise<{ time: number; fraction: number; successOpacity: number; successScale: number }[]>((resolve) => {
			const frames: { time: number; fraction: number; successOpacity: number; successScale: number }[] = [];
			let started = 0;
			const sample = (time: number) => {
				if (document.querySelector('[data-project-butter-development="passed"]')) {
					started ||= time;
					const arc = element.querySelector("circle.text-icon-accent-lime");
					const values = arc ? getComputedStyle(arc).strokeDasharray.match(/[\d.]+/gu)?.map(Number) : undefined;
					const icon = element.querySelector("svg:has(path.text-icon-success)");
					const iconLayer = icon?.parentElement?.parentElement;
					const successOpacity = icon && iconLayer ? Number.parseFloat(getComputedStyle(icon).opacity) * Number.parseFloat(getComputedStyle(iconLayer).opacity) : 0;
					const successScale = iconLayer ? new DOMMatrixReadOnly(getComputedStyle(iconLayer).transform).a : 1;
					frames.push({ time, fraction: values && values.length >= 2 ? values[0] / (values[0] + values[1]) : 0, successOpacity, successScale });
					if (time - started >= 1000) return resolve(frames);
				}
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		}));
		const failureOpacities = indicator.evaluate((element) => new Promise<number[]>((resolve) => {
			const samples: number[] = [];
			const sample = () => {
				const failed = element.querySelector("circle.text-icon-danger");
				if (!failed) return resolve(samples);
				samples.push(Number.parseFloat(getComputedStyle(failed).opacity));
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		}));
		const completionOpacities = flyout.evaluate((element) => new Promise<number[]>((resolve) => {
			const samples: number[] = [];
			let started = 0;
			const sample = (time: number) => {
				const icon = element.querySelector("svg:has(path.text-icon-success)");
				if (icon) {
					started ||= time;
					const iconLayer = icon.parentElement?.parentElement;
					samples.push(iconLayer ? Number.parseFloat(getComputedStyle(iconLayer).opacity) : 0);
					if (time - started >= 800) return resolve(samples);
				}
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		}));
		await expect(panel).toHaveAttribute("data-project-butter-development", "fixing", { timeout: 10_000 });
		const failed = await failureOpacities;
		if (reducedMotion === "reduce") expect(failed.every((opacity) => opacity === 1)).toBe(true);
		else expect(failed.some((opacity) => opacity < 0.99)).toBe(true);
		await expect(panel).toHaveAttribute("data-project-butter-development", "passed", { timeout: 15_000 });
		await expect(flyout.getByRole("button", { name: /3\/3 builds passed/ })).toBeVisible();
		await expect(flyout.locator('[data-slot="progress-circle"] path.text-icon-success')).toBeVisible();
		await expect(indicator.locator("circle.text-icon-accent-lime")).toHaveCount(1);
		const opacities = await completionOpacities;
		const frames = await completionFrames;
		if (reducedMotion === "reduce") {
			expect(opacities.every((opacity) => opacity === 1)).toBe(true);
			expect(frames.every(({ successScale }) => successScale === 1)).toBe(true);
		}
		else {
			expect(opacities.some((opacity) => opacity < 0.99)).toBe(true);
			expect(frames.some(({ successOpacity, successScale }) => successOpacity > 0.01 && successScale < 0.9)).toBe(true);
			expect(frames.some(({ fraction, successOpacity }) => fraction > 0.99 && successOpacity < 0.01)).toBe(true);
			const ringCompleted = frames.find(({ fraction }) => fraction > 0.999);
			const checkAppeared = frames.find(({ successOpacity }) => successOpacity > 0.01);
			if (!ringCompleted || !checkAppeared) throw new Error("Completion sequence did not finish");
			expect(checkAppeared.time - ringCompleted.time).toBeGreaterThanOrEqual(180);
		}
	});
}

test("switching between the board and journey does not produce runtime errors", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(message.text()); });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(page.getByRole("region", { name: /Unlink sessions/ })).toBeVisible();
	await gallery.getByRole("button", { name: "Select Board" }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await gallery.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(page.getByRole("region", { name: /Unlink sessions/ })).toBeVisible();
	expect(errors).toEqual([]);
});

test("the standalone board hides an open sidebar chat and restores its draft", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.getByRole("button", { name: "Ask Rovo", exact: true }).click();
	const composer = page.getByRole("textbox", { name: "Chat message input", exact: true });
	await composer.fill("Keep this draft");
	await page.getByRole("button", { name: "Select Board" }).click();
	await expect(composer).toBeHidden();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(composer).toBeVisible();
	await expect(composer).toContainText("Keep this draft");
});

test("the standalone board is centered and remains scrollable on narrow screens", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const first = board.locator('[data-jira-kanban-column="To do"]');
	const last = board.locator('[data-jira-kanban-column="Done"]');
	await expect(first).toBeVisible();
	const [viewport, firstBounds, lastBounds] = await Promise.all([board.boundingBox(), first.boundingBox(), last.boundingBox()]);
	if (!viewport || !firstBounds || !lastBounds) throw new Error("Board columns have no bounds");
	expect(Math.abs((firstBounds.x - viewport.x) - (viewport.x + viewport.width - lastBounds.x - lastBounds.width))).toBeLessThan(2);
	await page.setViewportSize({ width: 700, height: 900 });
	await expect.poll(() => board.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
	const start = await first.boundingBox();
	const narrowViewport = await board.boundingBox();
	if (!start || !narrowViewport) throw new Error("Narrow board has no bounds");
	expect(start.x).toBeGreaterThanOrEqual(narrowViewport.x);
	await board.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
	await expect.poll(async () => {
		const end = await last.boundingBox();
		const visible = await board.boundingBox();
		return end && visible ? end.x + end.width - (visible.x + visible.width) : Infinity;
	}).toBeLessThanOrEqual(1);
});

test("the Board and e2e Journey share work-item changes", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const card = board.locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await expect(card.getByRole("button", { name: "Add agent to PAY-118" })).toBeAttached();
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: "Change assignee" }).click();
	await page.getByRole("option", { name: "Unassigned", exact: true }).click();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card.getByRole("img", { name: "Unassigned person" })).toBeVisible();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const journeyCard = page.locator('[data-butter-board-surface] [data-issue-key="PAY-118"][data-board-column-title]');
	await expect(journeyCard.getByRole("img", { name: "Unassigned person" })).toBeVisible();
	await page.getByRole("group", { name: "Merchant onboarding journey steps" }).getByRole("button", { name: "In progress", exact: true }).click();
	await page.getByRole("button", { name: "Select Board" }).click();
	await expect(board.locator('[data-issue-key="PAY-999"][data-board-column-title="In progress"]')).toBeVisible();
});

test("journey board filters survive switching gallery tiles", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const filter = page.getByRole("button", { name: "Filter board by Venn" });
	await filter.click();
	await expect(filter).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Select Board" }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(filter).toHaveAttribute("aria-pressed", "true");
});

test("Butter session menus name the work instead of the agent", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const issue = board.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await issue.getByRole("button", { name: "Cursor: Working" }).click();
	const assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await expect(assignment.getByText("Cursor", { exact: true })).toBeVisible();
	await expect(assignment.getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const journeyCard = page.locator('[data-butter-board-surface] [data-issue-key="PAY-105"][data-board-column-title]');
	await journeyCard.getByRole("button", { name: "Cursor: Working" }).click();
	const journeyAssignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(journeyAssignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await expect(journeyAssignment.getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
});

test("board session flyout reveals more actions when hovering the status", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const issue = page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await issue.getByRole("button", { name: "Cursor: Working" }).click();
	const flyout = page.getByRole("dialog", { name: "Agent assignment" });
	const row = flyout.locator("article").filter({ hasText: "Replaying 3-D Secure fixtures" });
	await expect(row).toBeVisible();
	await page.mouse.move(0, 0);
	const status = row.getByRole("button", { name: "Working" });
	await expect(status).toBeVisible();
	const statusBounds = await status.boundingBox();
	if (!statusBounds) throw new Error("Session status is not rendered");
	await page.mouse.move(statusBounds.x + statusBounds.width / 2, statusBounds.y + statusBounds.height / 2);
	const more = row.getByRole("button", { name: "More actions for Replaying 3-D Secure fixtures" });
	await expect(more).toBeVisible();
	await expect(status).toBeHidden();
	await expect(more.locator("[data-slot=icon]")).toBeVisible();
	await more.click();
	await expect(page.getByRole("menu")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(more).toBeFocused();
});

test("the original Butter session menu still offers Add agent", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-105"][data-board-column-title]').getByRole("button", { name: "Cursor: Working" }).click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByRole("button", { name: "Add agent", exact: true })).toBeVisible();
});

test("session titles describe their work in grouped, review, and List views", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const unlinked = page.getByRole("region", { name: /Unlink sessions/ });
	await expect(unlinked.getByText("Keep or delete the adapter", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Select Board" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const grouped = board.locator('[data-issue-key="PAY-123"][data-board-column-title]');
	await grouped.getByRole("button", { name: "2 agents: Working" }).click();
	let assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Recording decline-code fixtures", { exact: true })).toBeVisible();
	await expect(assignment.getByText("Wiring recorded fixtures into the v2 client", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	const review = board.locator('[data-issue-key="PAY-112"][data-board-column-title]');
	await review.getByRole("button", { name: "Codex: Needs input" }).click();
	assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Review sandbox key retention", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Open gallery" }).click();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const row = page.getByRole("region", { name: "Payments SDK v2 migration work items list" }).locator("tr").filter({ hasText: "PAY-105" });
	await row.getByRole("button", { name: "Cursor: Working" }).click();
	const picker = page.getByRole("dialog", { name: "Add agent" });
	await expect(picker.getByRole("button", { name: "Claude", exact: true })).toBeVisible();
	await picker.getByRole("button", { name: "Claude", exact: true }).click();
	await expect(row.getByRole("button", { name: "2 agents: Working" })).toBeVisible();
	await row.getByRole("button", { name: "2 agents: Working" }).focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "Claude", exact: true })).toBeVisible();
	await expect(picker.getByRole("textbox", { name: "Search agents" })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(picker).toBeHidden();
});

test("a new board session uses the work-item summary as its title", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const card = page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-118" }).focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents" });
	const search = picker.getByRole("textbox", { name: "Search agents" });
	await search.fill("Cursor");
	const cursor = picker.getByRole("button", { name: "Cursor", exact: true });
	await cursor.click();
	await expect(picker).toBeHidden();
	await card.getByRole("button", { name: /^Cursor: / }).click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByText("Carry card-artwork metadata into the next wallet epic", { exact: true })).toBeVisible();
});

test("configure repository opens the development dropdown in a work item", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	await board.locator('[data-issue-key="PAY-105"] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: "Configure repository" }).click();
	const menu = page.getByRole("menu", { name: "Configure repository" });
	await expect(menu).toHaveCSS("border-radius", "12px");
	for (const name of ["Bitbucket Cloud", "GitHub", "Copy create branch command", "Copy create commit command", "Copy work item key"]) {
		await expect(menu.getByRole("menuitem", { name, exact: true })).toBeVisible();
	}
	await expect(menu.getByRole("menuitem", { name: "Branch name settings" })).toBeVisible();
	await expect(item.locator('[data-rovo-chat-placement="floating"]')).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(item.getByRole("button", { name: "Configure repository" })).toBeFocused();
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
	await expect(picker).toHaveCSS("border-radius", "12px");
	await picker.getByRole("button", { name: "Copy prompt" }).focus();
	await page.keyboard.press("Escape");
	await expect(picker).toBeHidden();
	await expect(item).toBeVisible();
	await expect(trigger).toBeFocused();
});
