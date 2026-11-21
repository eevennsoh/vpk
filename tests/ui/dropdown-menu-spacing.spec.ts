import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("menu rows use consistent padding and grow with their content", async ({ page }) => {
	await page.goto(appUrl("/preview/ui/dropdown-menu"));
	await page.getByRole("button", { name: "Menu items", exact: true }).first().click();
	const row = page.getByRole("menu", { name: "Menu items" }).getByRole("menuitem", { name: "Dashboard", exact: true });
	await expect(row).toHaveCSS("padding-top", "6px");
	await expect(row).toHaveCSS("padding-bottom", "6px");
	const textHeight = await row.evaluate((element) => element.getBoundingClientRect().height);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "24px avatars", exact: true }).first().click();
	const avatarRow = page.getByRole("menuitem", { name: "Venn", exact: true });
	await expect(avatarRow).toHaveCSS("padding-top", "6px");
	await expect(avatarRow).toHaveCSS("padding-bottom", "6px");
	expect(await avatarRow.evaluate((row) => row.getBoundingClientRect().height)).toBeGreaterThan(textHeight);
});

test("checkbox and radio examples share menu spacing and remain interactive", async ({ page }) => {
	await page.goto(appUrl("/components/ui/dropdown-menu"));
	await page.locator('[data-slot="dropdown-menu-trigger"]').filter({ hasText: "Controlled menu" }).scrollIntoViewIfNeeded();
	await expect(page.getByRole("menu", { name: "Controlled menu" })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Menu items", exact: true }).first().click();
	const menu = page.getByRole("menu", { name: "Menu items" });
	const menuRow = menu.getByRole("menuitem", { name: "Dashboard" });
	const surfaceStyle = await menu.evaluate((element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, radius: style.borderRadius, shadow: style.boxShadow, border: style.borderTopWidth };
	});
	const rowStyle = await menuRow.evaluate((element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, radius: style.borderRadius };
	});
	await page.keyboard.press("Escape");
	for (const trigger of ["View options", "View: list"]) {
		await page.getByRole("button", { name: trigger, exact: true }).click();
		const popup = page.locator('[data-slot="popover-content"][data-open]');
		await expect(popup).toHaveCSS("padding", surfaceStyle.padding);
		await expect(popup).toHaveCSS("border-radius", surfaceStyle.radius);
		await expect(popup).toHaveCSS("box-shadow", surfaceStyle.shadow);
		await expect(popup).toHaveCSS("border-top-width", surfaceStyle.border);
		const rows = popup.locator('[data-menu-row]');
		await expect(rows).toHaveCount(3);
		for (const row of await rows.all()) {
			await expect(row).toHaveCSS("padding", rowStyle.padding);
			await expect(row).toHaveCSS("border-radius", rowStyle.radius);
		}
		await expect(rows.nth(1)).toHaveCSS("margin-top", "2px");
		if (trigger === "View options") {
			const checkbox = popup.getByRole("checkbox", { name: "Show activity panel" });
			await checkbox.check();
			await expect(checkbox).toBeChecked();
		} else {
			const radio = popup.getByRole("radio", { name: "Board" });
			await radio.check();
			await expect(radio).toBeChecked();
		}
		await page.keyboard.press("Escape");
	}
});

test("agent selector subheadings match dropdown subheadings", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector#standalone-picker"));
	const selectorHeading = page.getByText("Switch to another agent", { exact: true });
	await expect(selectorHeading).toBeVisible();
	const measure = (element: Element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight, color: style.color };
	};
	const selectorStyle = await selectorHeading.evaluate(measure);
	await expect(selectorHeading).toHaveCSS("padding", "6px 8px");
	await page.goto(appUrl("/components/ui/dropdown-menu#subheading"));
	await page.locator('[data-slot="dropdown-menu-trigger"]').filter({ hasText: "Controlled menu" }).scrollIntoViewIfNeeded();
	await expect(page.getByRole("menu", { name: "Controlled menu" })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "View settings", exact: true }).click();
	const dropdownHeading = page.getByRole("menu", { name: "View settings" }).getByText("Layout", { exact: true });
	await expect(dropdownHeading).toBeVisible();
	expect(await dropdownHeading.evaluate(measure)).toEqual(selectorStyle);
});

test("pinned filter subheading follows dropdown spacing", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/jira-filter#project-butter"));
	await page.locator("#project-butter").getByRole("button", { name: "Filter", exact: true }).click();
	const heading = page.getByRole("menu", { name: "Filter options" }).getByText("Pinned", { exact: true });
	await expect(heading).toBeVisible();
	await expect(heading).toHaveCSS("padding", "6px 8px");
	await expect(heading).toHaveCSS("margin-top", "0px");
});

test("pinned filter action has a centered compact icon", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Needs input" }).hover();
	const pin = page.getByRole("menuitem", { name: "Unpin Needs input" });
	await expect(pin).toBeVisible();
	const geometry = await pin.evaluate((element) => {
		const button = element.getBoundingClientRect();
		const icon = element.querySelector("svg")!.getBoundingClientRect();
		return { button: [button.width, button.height], icon: [icon.width, icon.height], inset: [icon.left - button.left, icon.top - button.top] };
	});
	expect(geometry).toEqual({ button: [24, 24], icon: [12, 12], inset: [6, 6] });
});

test("board filter pills edit and remove the applied conditions", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Needs input", exact: true }).click();
	await page.keyboard.press("Escape");
	const pills = page.getByRole("group", { name: "Applied filters" });
	await expect(pills.getByRole("group", { name: "Agent status is Needs input" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Clear all filters" })).toHaveCSS("background-color", "rgba(5, 21, 36, 0.06)");
	await expect(page.getByRole("button", { name: "Filter board (1)" })).toHaveCSS("background-color", "rgba(5, 21, 36, 0.06)");
	await pills.getByRole("button", { name: "Change Agent status operator" }).click();
	const openChip = pills.getByRole("group", { name: "Agent status is Needs input" });
	await expect(openChip).toHaveCSS("border-color", "rgb(41, 42, 46)");
	await expect(openChip).toHaveCSS("background-color", "rgba(5, 21, 36, 0.06)");
	await expect(openChip.getByRole("button", { name: "Change Agent status operator" })).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
	for (const name of ["Change Agent status field", "Change Agent status operator", "Change Agent status values"]) {
		await expect(openChip.getByRole("button", { name })).toHaveCSS("color", "rgb(41, 42, 46)");
	}
	await page.getByRole("menuitemcheckbox", { name: "is not", exact: true }).click();
	await expect(pills.getByRole("group", { name: "Agent status is not Needs input" })).toBeVisible();
	await pills.getByRole("button", { name: "Change Agent status values" }).click();
	await expect(pills.getByRole("button", { name: "Change Agent status values" })).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
	await page.getByRole("menuitemcheckbox", { name: "Working", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(pills.getByRole("group", { name: "Agent status is not Needs input +1" })).toBeVisible();
	await pills.getByRole("button", { name: "Add filter condition" }).click();
	await page.getByRole("menu", { name: "Add filter condition" }).getByRole("menuitem").filter({ hasText: "Pull request" }).hover();
	await page.getByRole("menu", { name: "Pull request filter options" }).getByRole("menuitem", { name: "Open", exact: true }).click();
	await expect(pills.getByRole("group", { name: "Pull request is Open" })).toBeVisible();
	await pills.getByRole("button", { name: "Remove Agent status filter" }).click();
	await expect(pills.getByRole("group", { name: "Pull request is Open" })).toBeVisible();
	await pills.getByRole("button", { name: "Remove Pull request filter" }).click();
	await expect(pills).toHaveCount(0);
});

test("filter condition fields use the same icons as the board filter menu", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	const fieldNames = ["Pull request", "Assignee", "Sprint", "Work type", "Labels", "Status"];
	const readIcons = async (menuName: string) => {
		const menu = page.getByRole("menu", { name: menuName });
		return Promise.all(fieldNames.map((name) => menu.getByRole("menuitem", { name: `${name} Open submenu`, exact: true }).evaluate((row) => row.querySelector("svg")?.innerHTML ?? "")));
	};
	const filterIcons = await readIcons("Filter options");
	await page.getByRole("menuitemcheckbox", { name: "Needs input", exact: true }).click();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Add filter condition" }).click();
	const conditionIcons = await readIcons("Add filter condition");
	const conditionRows = page.getByRole("menu", { name: "Add filter condition" }).locator('[data-slot="dropdown-menu-sub-trigger"]');
	await expect(conditionRows).not.toHaveCount(0);
	for (const row of await conditionRows.all()) {
		const iconSlot = row.locator(":scope > span").first();
		await expect(iconSlot).toHaveCSS("width", "16px");
		await expect(iconSlot).toHaveCSS("height", "16px");
		const iconTile = iconSlot.locator('[data-slot="icon-tile"]');
		await expect(iconTile).toHaveAttribute("data-variant", "transparent");
		await expect(iconTile).toHaveCSS("width", "16px");
		await expect(iconTile).toHaveCSS("height", "16px");
		await expect(iconTile.locator("svg")).toHaveCSS("width", "12px");
		await expect(iconTile.locator("svg")).toHaveCSS("height", "12px");
	}
	expect(filterIcons.every(Boolean)).toBe(true);
	expect(new Set(filterIcons).size).toBe(fieldNames.length);
	expect(conditionIcons).toEqual(filterIcons);
});

test("board filter rows use 16px leading icon slots", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	const menu = page.getByRole("menu", { name: "Filter options" });
	const rows = menu.locator('[data-slot="dropdown-menu-sub-trigger"]');
	await expect(rows).not.toHaveCount(0);
	for (const row of await rows.all()) {
		const icon = row.locator(":scope > span").first();
		await expect(icon).toHaveCSS("width", "16px");
		await expect(icon).toHaveCSS("height", "16px");
		const tile = icon.locator('[data-slot="icon-tile"]');
		await expect(tile).toHaveAttribute("data-variant", "transparent");
		await expect(tile).toHaveCSS("width", "16px");
		await expect(tile).toHaveCSS("height", "16px");
		await expect(tile.locator("svg")).toHaveCSS("width", "12px");
		await expect(tile.locator("svg")).toHaveCSS("height", "12px");
	}
	const pinned = menu.getByRole("menuitemcheckbox", { name: "Needs input", exact: true });
	const pinnedIcon = pinned.locator('[aria-hidden="true"]').first();
	await expect(pinnedIcon).toHaveCSS("width", "16px");
	await expect(pinnedIcon).toHaveCSS("height", "16px");
	const pinnedText = await pinned.locator(".truncate").evaluate((element) => element.getBoundingClientRect().left);
	const savedText = await menu.getByRole("menuitem", { name: "Saved Open submenu" }).locator(":scope > span").nth(1).evaluate((element) => element.getBoundingClientRect().left);
	expect(Math.abs(pinnedText - savedText)).toBeLessThan(1);
	await page.getByRole("textbox", { name: "Add filter" }).fill("project");
	const result = menu.getByRole("menuitem", { name: "Atlassian Project", exact: true });
	const resultIcon = result.locator(":scope > span").first();
	await expect(resultIcon).toHaveCSS("width", "16px");
	await expect(resultIcon).toHaveCSS("height", "16px");
	await expect(resultIcon.locator('[data-slot="icon-tile"] svg')).toHaveCSS("width", "12px");
	await expect(resultIcon.locator('[data-slot="icon-tile"] svg')).toHaveCSS("height", "12px");
});

test("board filters collapse empty columns and restore the viewer's layout", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	const todo = page.locator('[data-jira-kanban-column="To do"]');
	const done = page.locator('[data-jira-kanban-column="Done"]');
	const progress = page.locator('[data-jira-kanban-column="In progress"]');
	await done.getByRole("button", { name: "Collapse Done column" }).press("Enter");
	await expect(done).toHaveAttribute("data-collapsed", "true");
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Needs input", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(todo).toHaveAttribute("data-collapsed", "true");
	await expect(done).toHaveAttribute("data-collapsed", "true");
	await expect(progress).not.toHaveAttribute("data-collapsed", "true");
	await todo.getByRole("button", { name: "Expand To do column" }).press("Enter");
	await expect(todo).not.toHaveAttribute("data-collapsed", "true");
	await page.getByRole("button", { name: "Change Agent status values" }).click();
	await page.getByRole("menuitemcheckbox", { name: "Working", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(todo).toHaveAttribute("data-collapsed", "true");
	await page.getByRole("button", { name: "Clear all filters" }).click();
	await expect(todo).not.toHaveAttribute("data-collapsed", "true");
	await expect(done).toHaveAttribute("data-collapsed", "true");
});

test("Filter Chip demo edits and restores a condition", async ({ page }) => {
	await page.goto(appUrl("/components/ui-custom/filter-chip"));
	const chip = page.getByRole("group", { name: "Agent status is Needs input" });
	await expect(chip).toBeVisible({ timeout: 20_000 });
	const spacing = await chip.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const border = Number.parseFloat(getComputedStyle(element).borderLeftWidth);
		const parts = [...element.querySelectorAll(":scope > button")].map((part) => part.getBoundingClientRect());
		return {
			gaps: parts.slice(1).map((part, index) => part.left - parts[index].right),
			insets: parts.map((part) => [part.top - bounds.top - border, bounds.bottom - border - part.bottom]),
		};
	});
	expect(spacing.gaps).toEqual([1, 1, 1]);
	expect(spacing.insets).toEqual([[1, 1], [1, 1], [1, 1], [1, 1]]);
	const field = chip.getByRole("button", { name: "Change Agent status field" });
	await field.hover();
	const fieldGeometry = await field.evaluate((element) => {
		const button = element.getBoundingClientRect();
		const chip = element.parentElement!.getBoundingClientRect();
		const border = Number.parseFloat(getComputedStyle(element.parentElement!).borderLeftWidth);
		const style = getComputedStyle(element);
		return { leftGap: button.left - chip.left - border, topGap: button.top - chip.top - border, bottomGap: chip.bottom - border - button.bottom, leftRadius: Number.parseFloat(style.borderTopLeftRadius), rightRadius: Number.parseFloat(style.borderTopRightRadius), buttonBorder: Number.parseFloat(style.borderLeftWidth) };
	});
	expect(fieldGeometry.leftGap).toBe(1);
	expect(fieldGeometry.topGap).toBe(1);
	expect(fieldGeometry.bottomGap).toBe(1);
	expect(fieldGeometry.leftRadius).toBeGreaterThanOrEqual(10);
	expect(fieldGeometry.rightRadius).toBe(0);
	expect(fieldGeometry.buttonBorder).toBe(0);
	await chip.getByRole("button", { name: "Change Agent status operator" }).click();
	await expect(chip.getByRole("button", { name: "Change Agent status operator" })).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
	await page.getByRole("menuitemcheckbox", { name: "is not", exact: true }).click();
	await expect(page.getByRole("group", { name: "Agent status is not Needs input" })).toBeVisible();
	const remove = page.getByRole("button", { name: "Remove Agent status filter" });
	await remove.hover();
	const geometry = await remove.evaluate((element) => {
		const button = element.getBoundingClientRect();
		const chip = element.parentElement!.getBoundingClientRect();
		const border = Number.parseFloat(getComputedStyle(element.parentElement!).borderRightWidth);
		const style = getComputedStyle(element);
		return { rightGap: chip.right - border - button.right, topGap: button.top - chip.top - border, bottomGap: chip.bottom - border - button.bottom, leftRadius: Number.parseFloat(style.borderTopLeftRadius), rightRadius: Number.parseFloat(style.borderTopRightRadius), buttonBorder: Number.parseFloat(style.borderRightWidth) };
	});
	expect(geometry.rightGap).toBe(1);
	expect(geometry.topGap).toBe(1);
	expect(geometry.bottomGap).toBe(1);
	expect(geometry.leftRadius).toBe(0);
	expect(geometry.rightRadius).toBeGreaterThanOrEqual(10);
	expect(geometry.buttonBorder).toBe(0);
	await remove.click();
	await page.getByRole("button", { name: "Restore filter" }).click();
	await expect(chip).toBeVisible();
});

test("searchable dropdown shares menu spacing and fades only its top edge", async ({ page }) => {
	await page.goto(appUrl("/components/ui/dropdown-menu#search"));
	await expect(page.getByRole("menu", { name: "Controlled menu" })).toBeVisible();
	await page.keyboard.press("Escape");
	const standardTrigger = page.getByRole("button", { name: "Menu items", exact: true }).first();
	await standardTrigger.evaluate((element) => element.scrollIntoView({ block: "center" }));
	await standardTrigger.click();
	const standardMenu = page.getByRole("menu", { name: "Menu items" });
	const standardRow = standardMenu.getByRole("menuitem", { name: "Dashboard", exact: true });
	const menuPadding = await standardMenu.evaluate((element) => getComputedStyle(element).padding);
	const rowStyle = await standardRow.evaluate((element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, radius: style.borderRadius, height: element.getBoundingClientRect().height };
	});
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Choose an action", exact: true }).click();
	const menu = page.getByRole("menu", { name: "Choose an action" });
	const search = menu.getByRole("textbox", { name: "Search actions" });
	const row = menu.getByRole("menuitem", { name: "Add attachment" });
	await expect(menu).toHaveCSS("padding", menuPadding);
	expect(await row.evaluate((element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, radius: style.borderRadius, height: element.getBoundingClientRect().height };
	})).toEqual(rowStyle);
	const list = menu.locator(".overflow-y-auto");
	expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
	const initialMask = await list.evaluate((element) => getComputedStyle(element).maskImage);
	expect(initialMask).toBe("none");
	const searchOffset = await search.evaluate((element) => element.getBoundingClientRect().top - element.closest('[role="menu"]')!.getBoundingClientRect().top);
	await list.evaluate((element) => { element.scrollTop = 160; });
	await expect.poll(() => list.evaluate((element) => getComputedStyle(element).maskImage)).not.toBe(initialMask);
	await expect.poll(() => list.evaluate((element) => getComputedStyle(element).maskImage)).toContain("rgba(0, 0, 0, 0) 0px");
	await expect.poll(() => list.evaluate((element) => element.style.maskImage)).not.toContain("transparent 100%");
	expect(await search.evaluate((element) => element.getBoundingClientRect().top - element.closest('[role="menu"]')!.getBoundingClientRect().top)).toBeCloseTo(searchOffset, 1);
	await search.fill("Duplicate");
	await expect(menu.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
	await expect(menu.getByRole("menuitem", { name: "Edit", exact: true })).toHaveCount(0);
});

test("labels picker restores its top fade after opening and reopening", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/artifact-pane"));
	await page.getByRole("button", { name: "See more", exact: true }).click();
	const trigger = page.getByRole("button", { name: "Edit labels", exact: true });
	await trigger.click();
	const search = page.getByRole("textbox", { name: "Search labels" });
	for (let index = 0; index < 10; index++) {
		await search.fill(`test label ${index}`);
		await search.press("Enter");
	}
	const list = page.getByRole("listbox", { name: "Search labels" });
	await expect.poll(() => list.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(1);
	const menu = list.locator("..");
	for (let attempt = 0; attempt < 2; attempt++) {
		await expect(list).toHaveCSS("mask-image", "none");
		await list.evaluate((element) => { element.scrollTop = 80; });
		await expect(menu).toHaveAttribute("data-list-scrolled", "true");
		await expect.poll(() => list.evaluate((element) => element.style.maskImage)).toContain("transparent 0,");
		await page.keyboard.press("Escape");
		await expect(list).toBeHidden();
		if (attempt === 0) await trigger.click();
	}
});

test("labels picker rows follow dropdown spacing and remain selectable", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/artifact-pane"));
	await page.getByRole("button", { name: "See more", exact: true }).click();
	await page.getByRole("button", { name: "Edit labels", exact: true }).click();
	const list = page.getByRole("listbox", { name: "Search labels" });
	const rows = list.getByRole("option");
	await expect(rows.first()).toHaveCSS("padding", "6px 8px");
	await expect(rows.first()).toHaveCSS("border-radius", "8px");
	await expect(rows.nth(1)).toHaveCSS("margin-top", "2px");
	await expect(list.getByText("More labels", { exact: true })).toHaveCount(0);
	const insets = await rows.first().evaluate((row) => {
		const menu = row.closest(".rich-text-command-menu")!.getBoundingClientRect();
		const search = row.closest(".rich-text-command-menu")!.querySelector('[data-slot="dropdown-menu-search"]')!.getBoundingClientRect();
		const bounds = row.getBoundingClientRect();
		return { left: bounds.left - menu.left, right: menu.right - bounds.right, searchLeft: search.left - menu.left, searchRight: menu.right - search.right };
	});
	expect(insets).toEqual({ left: 6, right: 6, searchLeft: 6, searchRight: 6 });
	const background = await rows.first().evaluate((row) => getComputedStyle(row).backgroundColor);
	await rows.first().hover();
	await expect.poll(() => rows.first().evaluate((row) => getComputedStyle(row).backgroundColor)).not.toBe(background);
	const selected = rows.first();
	const removedName = await selected.getAttribute("aria-label");
	await selected.click();
	await expect(list.getByRole("option", { name: removedName!.replace(/^Remove /, "Add ") })).toBeVisible();
});

test("labels reveal remove controls only while the picker is open", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/artifact-pane"));
	await page.getByRole("button", { name: "See more", exact: true }).click();
	const trigger = page.getByRole("button", { name: "Edit labels", exact: true });
	const remove = page.getByRole("button", { name: "Remove enterprise-rfp", exact: true });
	await expect(remove).toHaveCount(0);
	await trigger.click();
	await expect(remove).toBeVisible();
	await remove.click();
	await expect(remove).toHaveCount(0);
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	const list = page.getByRole("listbox", { name: "Search labels" });
	await expect(list.getByRole("option", { name: "Add enterprise-rfp" })).toBeVisible();
	await list.getByRole("option", { name: "Add enterprise-rfp" }).click();
	await expect(page.getByRole("button", { name: "Remove enterprise-rfp", exact: true })).toBeVisible();
	const keyboardRemove = page.getByRole("button", { name: "Remove esm", exact: true });
	await keyboardRemove.focus();
	await keyboardRemove.press("Enter");
	await expect(list.getByRole("option", { name: "Add esm" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "Remove enterprise-rfp", exact: true })).toHaveCount(0);
});

test("parent picker rows follow dropdown spacing and select a work item", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/artifact-pane"));
	await page.getByRole("button", { name: "See more", exact: true }).click();
	await page.getByRole("button", { name: "Change parent" }).click();
	await expect(page.getByRole("dialog", { name: "Change parent", exact: true })).toBeVisible();
	const list = page.getByRole("listbox", { name: "Search work items" });
	const rows = list.getByRole("option");
	await expect(rows.first()).toBeVisible();
	await expect(rows.first()).toHaveCSS("padding", "6px 8px");
	await expect(rows.first()).toHaveCSS("border-radius", "8px");
	await expect(rows.nth(1)).toHaveCSS("margin-top", "2px");
	const geometry = await rows.first().evaluate((row) => {
		const menu = row.closest(".rich-text-command-menu")!;
		const search = menu.querySelector('[data-slot="dropdown-menu-search"]')!;
		const tile = row.querySelector('[data-slot="icon-tile"]')!;
		const searchIcon = search.firstElementChild!;
		const menuRect = menu.getBoundingClientRect();
		const rowRect = row.getBoundingClientRect();
		const searchRect = search.getBoundingClientRect();
		const tileRect = tile.getBoundingClientRect();
		const iconRect = searchIcon.getBoundingClientRect();
		return {
			leftInset: rowRect.left - menuRect.left,
			rightInset: menuRect.right - rowRect.right,
			searchLeft: searchRect.left - menuRect.left,
			searchRight: menuRect.right - searchRect.right,
			tileCenter: tileRect.left + tileRect.width / 2,
			searchIconCenter: iconRect.left + iconRect.width / 2,
		};
	});
	expect(geometry.leftInset).toBe(6);
	expect(geometry.rightInset).toBe(6);
	expect(geometry.searchLeft).toBe(geometry.leftInset);
	expect(geometry.searchRight).toBe(geometry.rightInset);
	expect(geometry.tileCenter).toBe(geometry.searchIconCenter);
	const restingBackground = await rows.first().evaluate((row) => getComputedStyle(row).backgroundColor);
	await rows.first().hover();
	await expect.poll(() => rows.first().evaluate((row) => getComputedStyle(row).backgroundColor)).not.toBe(restingBackground);
	const selectedLabel = await rows.nth(1).innerText();
	await rows.nth(1).click();
	await expect(list).toBeHidden();
	await expect(page.getByRole("button", { name: "Change parent" })).toContainText(selectedLabel);
});
