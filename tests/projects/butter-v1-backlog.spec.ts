import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("Backlog hierarchy and Work header align like List", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "Backlog", exact: true }).click();
	const table = page.getByRole("table", { name: "Backlog work items", exact: true });
	const parent = table.getByRole("button", { name: "PAY-118", exact: true });
	const leaf = table.getByRole("button", { name: "PAY-124", exact: true });
	const expand = table.getByRole("button", { name: "Expand PAY-118", exact: true });
	const expandAll = table.getByRole("button", { name: "Expand all subtasks in Backlog", exact: true });
	await expect(parent).toBeVisible();
	const rowIcon = parent.locator("xpath=ancestor::tr").getByRole("img", { name: "task", exact: true });
	const [parentBounds, leafBounds, expandBounds, expandAllBounds, iconBounds] = await Promise.all([
		parent.boundingBox(), leaf.boundingBox(), expand.boundingBox(), expandAll.boundingBox(), rowIcon.boundingBox(),
	]);
	if (!parentBounds || !leafBounds || !expandBounds || !expandAllBounds || !iconBounds) throw new Error("Expected visible hierarchy controls");
	expect(parentBounds.x).toBeCloseTo(leafBounds.x, 1);
	expect(expandBounds.x).toBeCloseTo(expandAllBounds.x, 1);
	const headingX = await table.getByRole("columnheader", { name: "Work", exact: true }).evaluate((heading) => {
		const range = document.createRange();
		range.selectNodeContents(heading);
		return range.getBoundingClientRect().left;
	});
	expect(Math.abs(headingX - iconBounds.x)).toBeLessThanOrEqual(1);
	await expand.focus();
	await expand.press("Enter");
	const child = table.getByRole("button", { name: "PAY-201", exact: true });
	await expect(child).toBeVisible();
	const childBounds = await child.boundingBox();
	if (!childBounds) throw new Error("Expected a visible child work item");
	const backlogIndent = childBounds.x - parentBounds.x;
	await table.getByRole("button", { name: "Expand all subtasks in Backlog", exact: true }).click();
	const collapseAll = table.getByRole("button", { name: "Collapse all subtasks in Backlog", exact: true });
	await expect(collapseAll).toHaveAttribute("aria-expanded", "true");
	await collapseAll.press("Space");
	await expect(child).toHaveCount(0);
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await page.getByRole("button", { name: "Expand PAY-118", exact: true }).click();
	const listParent = page.getByRole("button", { name: "PAY-118", exact: true });
	const listChild = page.getByRole("button", { name: "PAY-201", exact: true });
	await expect(listChild).toBeVisible();
	const [listParentBounds, listChildBounds] = await Promise.all([listParent.boundingBox(), listChild.boundingBox()]);
	if (!listParentBounds || !listChildBounds) throw new Error("Expected visible List hierarchy");
	expect(backlogIndent).toBeCloseTo(listChildBounds.x - listParentBounds.x, 1);
});

test("one drag grip stays visible across rows and the create separator", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1050 });
	await page.goto(appUrl("/butter-v1"));
	for (const [view, upperKey, lowerKey] of [
		["Backlog", "PAY-105", "PAY-107"],
		["List", "PAY-118", "PAY-999"],
	] as const) {
		await page.getByRole("tab", { name: view, exact: true }).click();
		const row = (key: string) => page.getByRole("row").filter({ has: page.getByRole("button", { name: key, exact: true }) });
		await expect(row(upperKey)).toBeVisible();
		const upper = await row(upperKey).boundingBox();
		const lower = await row(lowerKey).boundingBox();
		if (!upper || !lower) throw new Error("Expected two visible work items");
		const x = upper.x + 200;
		const gapY = upper.y + upper.height - 2;
		await page.mouse.move(x, upper.y + upper.height / 2);
		const grip = page.getByTestId("jira-list-hover-grip");
		await expect(grip).toBeVisible();
		const initialGrip = await grip.elementHandle();
		await page.mouse.move(x, gapY);
		await expect(page.getByRole("button", { name: `Create work item after ${upperKey}`, exact: true })).toHaveCSS("pointer-events", "auto");
		await page.mouse.move(x + 20, gapY);
		await expect(grip).toHaveCSS("opacity", "1");
		expect(await grip.evaluate((current, initial) => current === initial, initialGrip)).toBe(true);
		await page.mouse.move(x, lower.y + lower.height / 2);
		await expect(page.getByTestId(`jira-list-drag-handle-${lowerKey}`)).toHaveCSS("pointer-events", "auto");
		await expect(grip).toHaveCSS("opacity", "1");
		expect(await grip.evaluate((current, initial) => current === initial, initialGrip)).toBe(true);
		await page.mouse.move(0, 0);
		await expect(grip).toHaveCount(0);
	}
});

test("Butter v1 Backlog shares work items with List and retains sprint membership", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1050 });
	await page.goto(appUrl("/butter-v1"));
	const boardTab = page.getByRole("tab", { name: "Board", exact: true });
	const backlogTab = page.getByRole("tab", { name: "Backlog", exact: true });
	await expect(boardTab).toHaveAttribute("aria-selected", "true");
	await backlogTab.click();

	const panel = page.getByRole("tabpanel", { name: "Backlog", exact: true });
	const sprint = panel.getByRole("table", { name: "Payments SDK sprint work items" });
	const backlog = panel.getByRole("table", { name: "Backlog work items" });
	const item = backlog.getByRole("button", { name: "PAY-118", exact: true });
	const handle = panel.getByRole("button", { name: "Move work items between sprint and backlog" });
	await expect(item).toBeVisible();
	expect(await backlogTab.getAttribute("aria-controls")).toBe(await panel.getAttribute("id"));
	await expect(sprint.getByRole("columnheader", { name: "Agent sessions" })).toBeVisible();
	await expect(sprint.getByRole("button", { name: "Add agent to PAY-105" })).toBeVisible();

	const grip = await handle.boundingBox();
	const row = await item.boundingBox();
	if (!grip || !row) throw new Error("Expected visible sprint boundary and backlog row");
	const x = grip.x + grip.width / 2;
	await page.mouse.move(x, grip.y + grip.height / 2);
	await page.mouse.down();
	await page.mouse.move(x, row.y + row.height, { steps: 12 });
	await expect(panel.getByTestId("sprint-boundary-preview")).toHaveText("4 work items in sprint");
	await expect(item).toBeVisible();
	await page.mouse.up();
	await expect(sprint.getByRole("button", { name: "PAY-118", exact: true })).toBeVisible();
	await expect(item).toHaveCount(0);

	await sprint.getByRole("button", { name: /Change status for PAY-118/ }).click();
	await page.getByRole("menuitem", { name: "Paused", exact: true }).click();
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByRole("button", { name: "Change status for PAY-118. Current status: Paused" })).toBeVisible();

	await backlogTab.click();
	await expect(sprint.getByRole("button", { name: "Change status for PAY-118. Current status: Paused" })).toBeVisible();
});

test("Backlog and List share Butter filters and grouping", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1050 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "Backlog", exact: true }).click();
	const panel = page.getByRole("tabpanel", { name: "Backlog", exact: true });
	const sprint = panel.getByRole("table", { name: "Payments SDK sprint work items" });
	const workItem = (key: string) => page.getByRole("button", { name: key, exact: true });

	await page.getByRole("button", { name: "Filter backlog", exact: true }).click();
	await page.getByRole("menuitem", { name: "Saved Open submenu" }).hover();
	await page.getByRole("menuitemcheckbox", { name: "Tasks in progress", exact: true }).click();
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");
	await expect(sprint.getByRole("button", { name: "PAY-105", exact: true })).toBeVisible();
	await expect(workItem("PAY-118")).toHaveCount(0);
	await expect(panel.getByText("Clear filters to move work items")).toBeVisible();

	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByRole("button", { name: /Filter list \(/ })).toBeVisible();
	await expect(workItem("PAY-105")).toBeVisible();
	await expect(workItem("PAY-118")).toHaveCount(0);
	await page.getByRole("button", { name: "Clear all filters", exact: true }).click();
	await expect(workItem("PAY-118")).toBeVisible();

	await page.getByRole("button", { name: "Group", exact: true }).click();
	await expect(page.getByRole("menuitemradio", { name: "No grouping" })).toHaveCount(0);
	await expect(page.getByRole("menuitemradio", { name: "Priority", exact: true })).toHaveAttribute("aria-checked", "false");
	await page.getByRole("menuitemradio", { name: "Priority", exact: true }).click();
	await expect(page.getByRole("button", { name: "Collapse Major", exact: true })).toBeVisible();
	await page.getByRole("tab", { name: "Backlog", exact: true }).click();
	await expect(page.getByRole("button", { name: "Group by Priority" })).toBeVisible();
	await sprint.getByRole("button", { name: "Collapse Major", exact: true }).click();
	await expect(sprint.getByRole("button", { name: "Expand Major", exact: true })).toBeFocused();
	await expect(sprint.getByRole("button", { name: "PAY-105", exact: true })).toHaveCount(0);
	await expect(panel.getByText("Clear grouping to move work items")).toBeVisible();
	await page.getByRole("button", { name: "Clear grouping" }).click();
	await expect(panel.getByRole("button", { name: "Move work items between sprint and backlog" })).toBeVisible();
	await page.getByRole("button", { name: "Group", exact: true }).click();
	await expect(page.getByRole("menuitemradio", { name: "No grouping" })).toHaveCount(0);
	await expect(page.getByRole("menuitemradio", { name: "Status", exact: true })).toHaveAttribute("aria-checked", "false");
	await page.getByRole("menuitemradio", { name: "Status", exact: true }).click();
	await expect(sprint.getByRole("button", { name: "Collapse In progress", exact: true })).toBeVisible();
});

test("Backlog and List create nested drafts inline with Tab and Shift+Tab", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1050 });
	await page.goto(appUrl("/butter-v1"));
	for (const [tab, parent] of [["Backlog", "PAY-105"], ["List", "PAY-124"]] as const) {
		await page.getByRole("tab", { name: tab, exact: true }).click();
		const summary = `Nested from ${tab}`;
		const gap = page.getByRole("button", { name: `Create work item after ${parent}`, exact: true });
		if (tab === "Backlog") {
			const parentRow = page.getByRole("row").filter({ has: page.getByRole("button", { name: parent, exact: true }) });
			const bounds = await parentRow.boundingBox();
			if (!bounds) throw new Error("Expected the parent row to be visible");
			const x = bounds.x + 260;
			const y = bounds.y + bounds.height - 2;
			await page.mouse.move(x, y);
			await expect(gap).toHaveCSS("pointer-events", "auto");
			await page.mouse.click(x, y);
		} else {
			await gap.focus();
			await gap.press("Enter");
		}
		const draft = page.getByRole("textbox", { name: "New work item summary" });
		const draftRow = page.getByRole("row").filter({ has: draft });
		await draft.fill(summary);
		await draft.press("Tab");
		await expect(draft).toBeFocused();
		await expect(draftRow.getByRole("img", { name: "subtask" })).toBeVisible();
		await draft.press("Shift+Tab");
		await expect(draft).toHaveValue(summary);
		await expect(draftRow.getByRole("img", { name: "task", exact: true })).toBeVisible();
		await draft.press("Tab");
		await draft.press("Enter");
		const child = page.getByRole("row").filter({ hasText: summary });
		await expect(child.getByRole("img", { name: "subtask" })).toBeVisible();
		await page.getByRole("button", { name: `Collapse ${parent}`, exact: true }).click();
		await expect(child).toHaveCount(0);
	}
	await expect(page.getByTestId("jira-list-sticky-footer")).toHaveCount(0);
});
