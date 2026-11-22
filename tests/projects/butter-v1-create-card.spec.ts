import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("list row create marker matches the board gap control", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	const cards = page.getByRole("region", { name: "To do work items" }).locator('[data-board-agent-session-drop-zone="issue"]');
	await expect(cards.nth(1)).toBeVisible({ timeout: 30_000 });
	const before = await cards.nth(0).boundingBox();
	const after = await cards.nth(1).boundingBox();
	const afterKey = await cards.nth(1).getAttribute("data-issue-key");
	if (!before || !after || !afterKey) throw new Error("Expected two measurable board cards");
	await page.mouse.move(after.x + 20, (before.y + before.height + after.y) / 2);
	const boardControl = page.getByRole("button", { name: `Create work item before ${afterKey}` });
	await expect(boardControl).toBeVisible();
	const boardSize = await boardControl.evaluate((element) => {
		const { width, height } = element.getBoundingClientRect();
		return { width, height };
	});

	await page.getByRole("tab", { name: "List", exact: true }).click();
	const listControl = page.getByRole("button", { name: "Create work item after PAY-125" });
	await listControl.focus();
	const marker = listControl.locator("span.rounded-full");
	await expect(marker).toBeVisible();
	const listSize = await marker.evaluate((element) => {
		const { width, height } = element.getBoundingClientRect();
		return { width, height };
	});
	expect(listSize).toEqual(boardSize);
	expect(listSize).toEqual({ width: 20, height: 20 });
	await listControl.press("Enter");
	await expect(page.getByRole("textbox", { name: "New work item summary" })).toBeFocused();
});

test("hovering a board gap keeps its create button opaque and opens the editor in place", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	const list = page.getByRole("region", { name: "To do work items" });
	const cards = list.locator('[data-board-agent-session-drop-zone="issue"]');
	await expect(cards.nth(1)).toBeVisible({ timeout: 30_000 });
	await cards.nth(1).scrollIntoViewIfNeeded();
	const before = await cards.nth(0).boundingBox();
	const after = await cards.nth(1).boundingBox();
	const afterKey = await cards.nth(1).getAttribute("data-issue-key");
	if (!before || !after || !afterKey) throw new Error("Expected two measurable board cards");
	await page.mouse.move(after.x + 20, (before.y + before.height + after.y) / 2);
	const create = page.getByRole("button", { name: `Create work item before ${afterKey}` });
	await expect(create).toBeVisible();
	await create.hover();
	await expect(create).toBeVisible();
	const chrome = await create.evaluate((element) => {
		const box = element.getBoundingClientRect();
		const probe = document.createElement("span");
		probe.style.backgroundColor = "var(--ds-background-neutral-subtle-hovered)";
		element.append(probe);
		const expectedTint = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return {
			width: box.width,
			height: box.height,
			background: getComputedStyle(element).backgroundColor,
			hoverTint: getComputedStyle(element, "::before").backgroundColor,
			expectedTint,
		};
	});
	expect(chrome.width).toBe(20);
	expect(chrome.height).toBe(20);
	expect(chrome.background).toMatch(/^rgb\(/);
	expect(chrome.hoverTint).toBe(chrome.expectedTint);
	await page.mouse.down();
	const pressed = await create.evaluate((element) => {
		const probe = document.createElement("span");
		probe.style.backgroundColor = "var(--ds-background-neutral-subtle-pressed)";
		element.append(probe);
		const expected = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return { background: getComputedStyle(element).backgroundColor, tint: getComputedStyle(element, "::before").backgroundColor, expected };
	});
	expect(pressed.background).toMatch(/^rgb\(/);
	expect(pressed.tint).toBe(pressed.expected);
	await page.mouse.move(after.x + 60, after.y + 40);
	await page.mouse.up();
	await page.mouse.move(after.x + 20, (before.y + before.height + after.y) / 2);
	await expect(create).toBeVisible();
	await create.hover();
	await create.click();
	const draft = page.locator('[data-jira-inline-create]');
	const summary = draft.getByRole("textbox", { name: "Work item summary" });
	await expect(summary).toBeFocused();
	await expect.poll(() => draft.evaluate((element, key) => {
		const anchor = document.querySelector(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${key}"]`);
		return Boolean(anchor && element.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING);
	}, afterKey)).toBe(true);
	await summary.fill("Gap-created work item");
	await summary.press("Enter");
	await expect(draft).toHaveCount(0);
	await expect.poll(() => list.locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes, key) => {
		const index = nodes.findIndex((node) => node.getAttribute("data-issue-key") === key);
		return index > 0 ? nodes[index - 1].textContent : null;
	}, afterKey)).toContain("Gap-created work item");
});

test("subtask count shows hover and open states", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	const trigger = page.locator('[data-issue-key="PAY-118"]').getByRole("button", { name: "0 of 3 subtasks complete" });
	await expect(trigger).toBeVisible({ timeout: 20_000 });
	const tag = trigger.locator('[data-slot="tag"]');
	const background = () => tag.evaluate((element) => getComputedStyle(element).backgroundColor);
	const resting = await background();
	await trigger.hover();
	await expect.poll(background).not.toBe(resting);
	await trigger.click();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await expect(tag).toHaveClass(/bg-bg-selected/);
	await page.keyboard.press("Escape");
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	await expect(tag).not.toHaveClass(/bg-bg-selected/);
});

test("inline picker search headers match Labels and Epic", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await expect(header).toBeAttached({ timeout: 20_000 });
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	const draft = page.locator('[data-jira-inline-create]');
	const measureSearch = () => page.locator('[data-slot="dropdown-menu-search"]').evaluate((field) => {
		const popup = field.closest('[data-slot="popover-content"], [data-slot="dropdown-menu-content"]');
		const input = field.querySelector("input");
		const icon = field.querySelector("svg");
		if (!popup || !input || !icon) throw new Error("Picker search must have a popup, input and icon");
		const popupBox = popup.getBoundingClientRect();
		const fieldBox = field.getBoundingClientRect();
		const inputBox = input.getBoundingClientRect();
		const iconBox = icon.getBoundingClientRect();
		return {
			height: fieldBox.height,
			left: fieldBox.left - popupBox.left,
			top: fieldBox.top - popupBox.top,
			inputLeft: inputBox.left - popupBox.left,
			inputHeight: inputBox.height,
			fontSize: getComputedStyle(input).fontSize,
			iconWidth: iconBox.width,
			iconHeight: iconBox.height,
		};
	});
	await draft.getByRole("button", { name: "Add labels" }).click();
	await expect(page.getByRole("textbox", { name: "Search labels" })).toBeFocused();
	const reference = await measureSearch();
	await page.keyboard.press("Escape");
	for (const [trigger, search] of [["Add epic", "Search work items"], ["Add subtasks", "Search subtasks"]]) {
		await draft.getByRole("button", { name: trigger, exact: true }).click();
		await expect(page.getByRole("textbox", { name: search })).toBeFocused();
		await expect.poll(measureSearch).toEqual(reference);
		await expect.poll(() => page.getByRole("textbox", { name: search }).evaluate((input) => {
			const popup = input.closest('[data-slot="popover-content"], [data-slot="dropdown-menu-content"]');
			if (!popup) throw new Error("Missing picker popup");
			const style = getComputedStyle(input);
			const textLeft = input.getBoundingClientRect().left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft);
			return [...popup.querySelectorAll('.menu-row-title, [data-slot="subtask-key"]')].every((label) => Math.abs(label.getBoundingClientRect().left - textLeft) < 0.1);
		})).toBe(true);
		await expect.poll(() => page.locator('[data-slot="dropdown-menu-search"]').evaluate((field) => {
			const popup = field.closest('[data-slot="popover-content"], [data-slot="dropdown-menu-content"]');
			const searchIcon = field.querySelector("svg");
			const rowIcon = popup?.querySelector('[role="option"] svg, [role="menuitemcheckbox"] svg');
			if (!searchIcon || !rowIcon) throw new Error("Picker must show search and row icons");
			const searchBox = searchIcon.getBoundingClientRect();
			const rowBox = rowIcon.getBoundingClientRect();
			return rowBox.left + rowBox.width / 2 - searchBox.left - searchBox.width / 2;
		})).toBe(0);
		const row = page.getByRole(trigger === "Add epic" ? "option" : "menuitemcheckbox").first();
		await expect(row.locator('[data-slot="icon-tile"]')).toHaveCount(0);
		const visual = row.locator(trigger === "Add epic" ? '[data-slot="icon"]' : '[data-slot="progress-circle"]').first();
		await expect.poll(() => visual.evaluate((element) => {
			const box = element.getBoundingClientRect();
			return { width: box.width, height: box.height };
		})).toEqual({ width: 12, height: 12 });
		await expect.poll(() => visual.evaluate((element) => {
			const frame = element.closest(".rich-text-command-menu-avatar") ?? element.parentElement;
			if (!frame) throw new Error("Missing icon container");
			const box = frame.getBoundingClientRect();
			return { width: box.width, height: box.height };
		})).toEqual({ width: 16, height: 16 });
		if (trigger === "Add subtasks") {
			await expect(row.locator('[aria-label$=" priority"]')).toBeVisible();
			await expect(row.locator('[data-slot="avatar"]')).toBeVisible();
		}
		await page.keyboard.press("Escape");
		await expect(draft.getByRole("textbox", { name: "Work item summary" })).toBeVisible();
	}
});

test("card subtask rows use 12px icons and retain assignee avatars", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const trigger = page.locator('[data-issue-key="PAY-118"]').getByRole("button", { name: "0 of 3 subtasks complete" });
	await expect(trigger).toBeAttached({ timeout: 20_000 });
	await trigger.click();
	const menu = page.getByRole("menu", { name: "Subtasks", exact: true });
	await expect(menu).toBeVisible();
	await expect.poll(() => menu.getByRole("menuitem").first().evaluate((row) => {
		const measure = (selector: string) => {
			const element = row.querySelector(selector);
			if (!element) throw new Error(`Missing subtask visual: ${selector}`);
			const box = element.getBoundingClientRect();
			return { width: box.width, height: box.height };
		};
		return {
			status: measure('[data-slot="subtask-status"] svg'),
			statusContainer: measure('[data-slot="subtask-status"]'),
			priority: measure('[data-slot="subtask-priority"] svg'),
			priorityContainer: measure('[data-slot="subtask-priority"]'),
			assignee: measure('[data-slot="avatar"]'),
		};
	})).toEqual({ status: { width: 12, height: 12 }, statusContainer: { width: 16, height: 16 }, priority: { width: 12, height: 12 }, priorityContainer: { width: 16, height: 16 }, assignee: { width: 16, height: 16 } });
	await page.keyboard.press("Escape");
	await expect(menu).toHaveCount(0);
});

test("card and picker subtask rows share the same presentation", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const presentation = (row: Locator) => row.evaluate((element) => {
		const rowBox = element.getBoundingClientRect();
		const measure = (selector: string) => {
			const visual = element.querySelector(selector);
			if (!visual) throw new Error(`Missing subtask content: ${selector}`);
			const box = visual.getBoundingClientRect();
			const style = getComputedStyle(visual);
			return { height: box.height, left: box.left - rowBox.left, fontSize: style.fontSize, lineHeight: style.lineHeight, color: style.color };
		};
		return {
			height: rowBox.height,
			status: measure('[data-slot="subtask-status"]'),
			key: measure('[data-slot="subtask-key"]'),
			summary: measure('[data-slot="subtask-summary"]'),
			priority: element.querySelector('[data-slot="subtask-priority"]')?.getBoundingClientRect().width,
			avatar: element.querySelector('[data-slot="avatar"]')?.getBoundingClientRect().width,
		};
	});
	const cardTrigger = page.locator('[data-issue-key="PAY-118"]').getByRole("button", { name: "0 of 3 subtasks complete" });
	await expect(cardTrigger).toBeAttached({ timeout: 20_000 });
	await cardTrigger.click();
	const summary = "PAY-201 List v1 card-artwork fields still emitted at checkout";
	const cardRow = page.getByRole("menuitem", { name: `Open ${summary.replace("PAY-201 ", "PAY-201: ")}` });
	await expect(cardRow).toBeVisible();
	const reference = await presentation(cardRow);
	await page.keyboard.press("Escape");
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	await page.getByRole("button", { name: "Add subtasks", exact: true }).click();
	const pickerRow = page.getByRole("menuitemcheckbox", { name: summary, exact: true });
	await expect.poll(() => presentation(pickerRow)).toEqual(reference);
	await pickerRow.click();
	await expect(pickerRow).toHaveAttribute("aria-checked", "true");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("textbox", { name: "Work item summary" })).toBeVisible();
});

test("priority colors stay visible in subtask menus and reveal on card hover", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const card = page.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await expect(card).toBeAttached({ timeout: 20_000 });
	const closeGallery = page.getByRole("button", { name: "Close gallery", exact: true });
	if (await closeGallery.isVisible()) await closeGallery.click();
	const colors = await page.evaluate(() => {
		const resolve = (name: string) => {
			const probe = document.createElement("span");
			probe.style.color = `var(--ds-icon-${name})`;
			document.body.append(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		};
		return { subtle: resolve("subtle"), danger: resolve("danger"), information: resolve("information"), success: resolve("success") };
	});
	const priority = card.locator('[aria-label="major priority"] svg');
	await page.mouse.move(0, 0);
	await expect(priority).toHaveCSS("color", colors.subtle);
	await card.locator('[data-slot="jira-issue-project-butter"]').hover();
	await expect(priority).toHaveCSS("color", colors.danger);
	await card.screenshot({ path: "output/agent-browser/vpk-verify/priority-colors/card-hover-proof.png" });
	await page.getByRole("heading", { name: "Project Butter v1", exact: true }).hover();
	await expect(priority).toHaveCSS("color", colors.subtle);
	await card.getByRole("button", { name: "More actions for PAY-105", exact: true }).focus();
	await expect(priority).toHaveCSS("color", colors.danger);
	await page.locator('[data-issue-key="PAY-118"]').getByRole("button", { name: "0 of 3 subtasks complete" }).click();
	const menu = page.getByRole("menu", { name: "Subtasks", exact: true });
	await expect(menu.getByRole("menuitem").first().locator('[data-slot="subtask-priority"] svg')).toHaveCSS("color", colors.danger);
	await expect(menu.getByRole("menuitem").nth(1).locator('[data-slot="subtask-priority"] svg')).toHaveCSS("color", colors.information);
	await page.keyboard.press("Escape");
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	await page.getByRole("button", { name: "Add subtasks", exact: true }).click();
	for (const [key, color] of [["PAY-201", colors.danger], ["PAY-202", colors.information], ["PAY-211", colors.success]]) {
		const row = page.getByRole("menuitemcheckbox", { name: new RegExp(`^${key} `) });
		await expect(row.locator('[data-slot="subtask-priority"] svg')).toHaveCSS("color", color);
	}
	await page.getByRole("dialog", { name: "Choose subtasks" }).screenshot({ path: "output/agent-browser/vpk-verify/priority-colors/subtask-priorities-proof.png" });
});

test("inline type and priority menus keep compact widths without search", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await expect(header).toBeAttached({ timeout: 20_000 });
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	const draft = page.locator('[data-jira-inline-create]');
	const summary = draft.getByRole("textbox", { name: "Work item summary" });
	await summary.fill("Keep this type draft");
	await draft.getByRole("button", { name: "Work item type: task" }).click();
	const menu = page.getByRole("menu", { name: "Choose work item type", exact: true });
	await expect(menu.getByRole("textbox")).toHaveCount(0);
	await expect(menu.getByRole("menuitem")).toHaveCount(4);
	await expect.poll(() => page.getByRole("dialog", { name: "Choose work item type", exact: true }).evaluate((element) => element.getBoundingClientRect().width)).toBe(224);
	const story = page.getByRole("menuitem", { name: "Story", exact: true });
	const typeRowHeight = await story.evaluate((element) => element.getBoundingClientRect().height);
	await story.hover();
	await expect(draft.getByRole("button", { name: "Work item type: task" }).getByRole("img", { name: "story", exact: true })).toBeVisible();
	await story.focus();
	await expect(story).toBeFocused();
	await story.press("Enter");
	await expect(draft.getByRole("button", { name: "Work item type: story" })).toBeVisible();
	await expect(summary).toHaveValue("Keep this type draft");
	await draft.getByRole("button", { name: "Work item type: story" }).click();
	await expect(page.getByRole("menuitem", { name: "Story", exact: true })).toHaveAttribute("data-selected", "true");
	await page.keyboard.press("Escape");
	await expect(menu).toHaveCount(0);
	await expect(summary).toHaveValue("Keep this type draft");
	await draft.getByRole("button", { name: "Priority: Medium", exact: true }).click();
	const priorities = page.getByRole("menu", { name: "Priorities", exact: true });
	await expect(priorities.getByRole("textbox")).toHaveCount(0);
	await expect(priorities.getByRole("menuitem")).toHaveCount(5);
	await expect.poll(() => page.getByRole("dialog", { name: "Choose priority", exact: true }).evaluate((element) => element.getBoundingClientRect().width)).toBe(224);
	await expect(priorities.locator('[data-slot="icon-tile"]')).toHaveCount(0);
	const colors: string[] = [];
	for (const option of ["Highest", "High", "Medium", "Low", "Lowest"]) {
		const row = priorities.getByRole("menuitem", { name: option, exact: true });
		const metrics = await row.evaluate((element) => {
			const frame = element.querySelector('[data-slot="priority-option-icon"]');
			const icon = frame?.querySelector("svg");
			if (!frame || !icon) throw new Error("Missing priority icon");
			const frameBox = frame.getBoundingClientRect();
			const iconBox = icon.getBoundingClientRect();
			return { rowHeight: element.getBoundingClientRect().height, frame: [frameBox.width, frameBox.height], icon: [iconBox.width, iconBox.height], color: getComputedStyle(icon).color };
		});
		expect(metrics.rowHeight).toBe(typeRowHeight);
		expect(metrics.frame).toEqual([16, 16]);
		expect(metrics.icon).toEqual([12, 12]);
		colors.push(metrics.color);
	}
	expect(colors[0]).toBe(colors[1]);
	expect(colors[3]).toBe(colors[4]);
	expect(new Set(colors).size).toBe(3);
	await priorities.getByRole("menuitem", { name: "Lowest", exact: true }).click();
	await expect(draft.getByRole("button", { name: "Priority: Lowest", exact: true })).toBeVisible();
	await expect(summary).toHaveValue("Keep this type draft");
});

test("inline work item type trigger previews icon colors without committing", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await expect(header).toBeAttached({ timeout: 20_000 });
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	const draft = page.locator('[data-jira-inline-create]');
	const summary = draft.getByRole("textbox", { name: "Work item summary" });
	await summary.fill("Keep this type preview draft");
	const trigger = draft.getByRole("button", { name: "Work item type: task", exact: true });
	await page.mouse.move(0, 0);
	const neutral = await trigger.locator('svg').first().evaluate((element) => getComputedStyle(element).color);
	await trigger.hover();
	await expect(trigger.locator('svg').first()).toHaveCSS("color", neutral);
	await trigger.click();
	const menu = page.getByRole("menu", { name: "Choose work item type", exact: true });
	for (const type of ["Story", "Epic", "Bug", "Task"]) {
		const row = menu.getByRole("menuitem", { name: type, exact: true });
		await row.hover();
		const color = await row.locator('[data-slot="work-item-type-icon"] svg').evaluate((element) => getComputedStyle(element).color);
		await expect(trigger.getByRole("img", { name: type.toLowerCase(), exact: true }).locator("svg")).toHaveCSS("color", color);
		await expect(menu.getByRole("menuitem", { name: "Task", exact: true })).toHaveAttribute("data-selected", "true");
	}
	await menu.getByRole("menuitem", { name: "Bug", exact: true }).hover();
	await page.keyboard.press("Escape");
	await expect(trigger.getByRole("img", { name: "task", exact: true }).locator("svg")).toHaveCSS("color", neutral);
	await trigger.click();
	const bug = menu.getByRole("menuitem", { name: "Bug", exact: true });
	await bug.focus();
	const bugColor = await bug.locator('[data-slot="work-item-type-icon"] svg').evaluate((element) => getComputedStyle(element).color);
	await expect(trigger.getByRole("img", { name: "bug", exact: true }).locator("svg")).toHaveCSS("color", bugColor);
	await bug.press("Enter");
	const selected = draft.getByRole("button", { name: "Work item type: bug", exact: true });
	await expect(selected.getByRole("img", { name: "bug", exact: true }).locator("svg")).toHaveCSS("color", neutral);
	await expect(summary).toHaveValue("Keep this type preview draft");
});

test("inline priority trigger previews rows without committing until selection", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await expect(header).toBeAttached({ timeout: 20_000 });
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	const draft = page.locator('[data-jira-inline-create]');
	await draft.getByRole("textbox", { name: "Work item summary" }).fill("Keep this priority draft");
	const trigger = draft.getByRole("button", { name: "Priority: Medium", exact: true });
	const icon = trigger.locator("svg");
	const mediumGlyph = await icon.innerHTML();
	const subtle = await page.evaluate(() => {
		const probe = document.createElement("span");
		probe.style.color = "var(--ds-icon-subtle)";
		document.body.append(probe);
		const color = getComputedStyle(probe).color;
		probe.remove();
		return color;
	});
	await expect(icon).toHaveCSS("color", subtle);
	await trigger.hover();
	await expect(icon).toHaveCSS("color", subtle);
	await trigger.click();
	const menu = page.getByRole("menu", { name: "Priorities", exact: true });
	const medium = menu.getByRole("menuitem", { name: "Medium", exact: true });
	const mediumColor = await medium.locator('[data-slot="priority-option-icon"] svg').evaluate((element) => getComputedStyle(element).color);
	await expect(icon).toHaveCSS("color", mediumColor);
	const low = menu.getByRole("menuitem", { name: "Low", exact: true });
	await low.hover();
	const lowIcon = low.locator('[data-slot="priority-option-icon"] svg');
	const lowColor = await lowIcon.evaluate((element) => getComputedStyle(element).color);
	await expect.poll(() => icon.innerHTML()).toBe(await lowIcon.innerHTML());
	await expect(icon).toHaveCSS("color", lowColor);
	await expect(medium).toHaveAttribute("data-selected", "true");
	await expect(low).not.toHaveAttribute("data-selected", "true");
	await page.keyboard.press("Escape");
	await expect(trigger).toBeVisible();
	await expect(icon).toHaveCSS("color", subtle);
	expect(await icon.innerHTML()).toBe(mediumGlyph);
	await trigger.click();
	const lowest = menu.getByRole("menuitem", { name: "Lowest", exact: true });
	await lowest.hover();
	await lowest.click();
	const selected = draft.getByRole("button", { name: "Priority: Lowest", exact: true });
	await expect(selected).toBeVisible();
	await expect(selected.locator("svg")).toHaveCSS("color", subtle);
	await expect(draft.getByRole("textbox", { name: "Work item summary" })).toHaveValue("Keep this priority draft");
});

test("switching pickers keeps the inline draft open", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await expect(header).toBeAttached({ timeout: 20_000 });
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	const draft = page.locator('[data-jira-inline-create]');
	await draft.getByRole("textbox", { name: "Work item summary" }).fill("Keep this draft");
	await draft.getByRole("button", { name: "Priority: Medium" }).click();
	const calendar = draft.getByRole("button", { name: "Set due date" });
	const calendarBox = await calendar.boundingBox();
	expect(calendarBox).not.toBeNull();
	await page.mouse.click(calendarBox!.x + calendarBox!.width / 2, calendarBox!.y + calendarBox!.height / 2);
	await expect(page.getByRole("dialog", { name: "Due date" })).toBeVisible();
	await expect(draft.getByRole("textbox", { name: "Work item summary" })).toHaveValue("Keep this draft");
	await draft.getByRole("button", { name: "Work item type: task" }).click();
	await page.keyboard.press("Escape");
	await draft.getByRole("button", { name: "Set assignee" }).click();
	await expect(page.getByRole("textbox", { name: "Search people" })).toBeVisible();
	await expect(draft.getByRole("textbox", { name: "Work item summary" })).toHaveValue("Keep this draft");
	await page.keyboard.press("Escape");
	await expect(draft).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(draft).toHaveCount(0);
});

test("column header creates an inline work item with editable fields", async ({ page }) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await expect(header).toBeAttached({ timeout: 20_000 });
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	const draft = page.locator('[data-jira-inline-create]');
	await expect(draft.getByRole("textbox", { name: "Work item summary" })).toBeFocused();
	await expect(page.locator('[aria-label="To do work items"] [inert]')).toBeAttached();
	await expect(page.locator('[aria-label="In progress work items"]')).toHaveAttribute("aria-hidden", "true");
	await expect(page.locator('[aria-label="To do work items"]')).not.toHaveAttribute("aria-hidden", "true");
	await draft.getByRole("textbox", { name: "Work item summary" }).fill("New checkout task");
	await draft.getByRole("button", { name: "Work item type: task" }).click();
	await page.getByRole("menu", { name: "Choose work item type", exact: true }).evaluate((menu) => Promise.all(menu.getAnimations({ subtree: true }).map((animation) => animation.finished)));
	await page.getByRole("menuitem", { name: "Story" }).hover();
	await expect(draft.getByRole("button", { name: "Work item type: task" }).getByRole("img", { name: "story", exact: true })).toBeVisible();
	await page.getByRole("menuitem", { name: "Story" }).click();
	await draft.getByRole("button", { name: "Add subtasks" }).click();
	await page.getByRole("textbox", { name: "Search subtasks" }).fill("PAY-201");
	await page.getByRole("menuitemcheckbox", { name: /PAY-201/ }).click();
	await draft.getByRole("button", { name: "Add epic" }).click();
	await page.getByRole("textbox", { name: "Search work items" }).fill("PAY-999");
	await page.getByRole("option", { name: /Improve merchant onboarding/ }).click();
	await draft.getByRole("button", { name: "Add labels" }).click();
	await page.getByRole("textbox", { name: "Search labels" }).fill("proof-tag");
	await page.getByRole("textbox", { name: "Search labels" }).press("Enter");
	await page.keyboard.press("Escape");
	await expect(draft).toContainText("0/1");
	await expect(draft).toContainText("proof-tag");
	await draft.getByRole("button", { name: "Priority: Medium" }).click();
	await page.getByRole("menuitem", { name: "Lowest", exact: true }).click();
	await expect(draft.getByRole("button", { name: "Priority: Lowest" })).toBeVisible();
	await draft.getByRole("button", { name: "Set assignee" }).click();
	await page.getByRole("option", { name: "Venn", exact: true }).click();
	await expect(draft.getByRole("button", { name: "Assignee: Venn" })).toBeVisible();
	await draft.getByRole("button", { name: "Set due date" }).click();
	const today = await page.evaluate(() => {
		const date = new Date();
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	});
	await page.locator(`[aria-label="Due date"] button[data-day="${today}"]`).click();
	await expect(draft.getByRole("button", { name: `Due date: ${today}` })).toBeVisible();
	await draft.getByRole("button", { name: "Save work item" }).click();
	const created = page.getByRole("region", { name: "To do work items" }).getByText("New checkout task", { exact: true });
	await expect(created).toBeVisible();
	await expect(page.getByRole("region", { name: "To do work items" })).toContainText("proof-tag");
	await page.getByRole("button", { name: "Close gallery" }).click();
	const createdCard = page.locator('[data-board-column-title="To do"][data-issue-key]').filter({ hasText: "New checkout task" });
	await expect(createdCard.getByRole("img", { name: "Venn" })).toBeVisible();
	await createdCard.getByRole("button", { name: "0 of 1 subtasks complete" }).click();
	await page.getByRole("menuitem", { name: /Open PAY-201:/ }).click();
	const subtask = page.getByRole("dialog", { name: "Project butter" });
	await expect(subtask).toContainText("PAY-201");
	await subtask.getByRole("button", { name: "Close Project butter work item" }).click();
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	await page.getByRole("button", { name: "Open gallery" }).click();
	await expect(draft).toHaveCount(0);
	await expect(page.getByRole("tab", { name: "Board", exact: true })).toHaveAttribute("aria-selected", "true");
	await expect(page.getByRole("button", { name: "Open gallery" })).toBeVisible();
});

test("inline draft remains visible and restores the previous gallery state", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await expect(header).toBeAttached({ timeout: 20_000 });
	const create = async () => {
		await header.hover();
		await header.getByRole("button", { name: "Create work item in To do" }).click();
	};
	await create();
	await expect(page.locator('[data-gallery-strip]')).toHaveCount(0);
	const draft = page.locator('[data-jira-inline-create]');
	await expect(draft).toBeInViewport({ ratio: 1 });
	const cardBox = await draft.boundingBox();
	const listBox = await page.getByRole("region", { name: "To do work items" }).boundingBox();
	expect(cardBox?.y).toBeGreaterThanOrEqual(listBox?.y ?? 0);
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "Close gallery" })).toBeVisible();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await create();
	await expect(draft).toBeInViewport({ ratio: 1 });
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "Open gallery" })).toBeVisible();
});
