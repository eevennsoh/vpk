import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

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
