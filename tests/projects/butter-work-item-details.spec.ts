import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("child work item progress has breathing room after its heading", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const heading = page.getByRole("button", { name: /^Collapse Child work items/ });
	const label = heading.getByText("Child work items", { exact: true });
	const circle = heading.locator('[data-slot="progress-circle"]');
	await expect(circle).toBeVisible();
	await expect.poll(async () => {
		const [labelBox, circleBox] = await Promise.all([label.boundingBox(), circle.boundingBox()]);
		return labelBox && circleBox ? circleBox.x - (labelBox.x + labelBox.width) : null;
	}).toBe(8);
});

test("work item story points use the number icon and stay in sync with the list", async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: "Show more details" }).click();
	const field = page.getByRole("group", { name: "Story points field" });
	await expect(field.locator('[data-field-icon="storyPoints"] svg')).toBeVisible();
	await expect(page.getByRole("group", { name: "Acceptance Criteria field" })).toHaveCount(0);
	await field.getByRole("button", { name: "Change story points" }).click();
	await field.getByRole("spinbutton", { name: "Story points" }).fill("5");
	await field.getByRole("button", { name: "Save story points" }).click();
	await expect(field.getByText("5", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const listPoints = page.getByRole("button", { name: "Edit story points for PAY-118, 5" });
	await listPoints.click();
	const listInput = page.getByRole("spinbutton", { name: "Story points for PAY-118" });
	await listInput.fill("3");
	await listInput.press("Enter");
	await page.getByRole("tab", { name: "Board", exact: true }).click();
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: "Show more details" }).click();
	await expect(page.getByRole("group", { name: "Story points field" }).getByText("3", { exact: true })).toBeVisible();
});

test("Butter details fields drag from the label and value on the vertical axis", async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const fields = page.locator("[data-project-butter-detail-fields]");
	const priority = fields.getByRole("group", { name: "Priority field" });
	const status = fields.getByRole("group", { name: "Status field" });
	const label = priority.getByText("Priority", { exact: true });
	const [labelBox, targetBox] = await Promise.all([label.boundingBox(), status.boundingBox()]);
	if (!labelBox || !targetBox) throw new Error("Missing field geometry");
	await page.mouse.move(labelBox.x + 4, labelBox.y + labelBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(labelBox.x + 80, labelBox.y + labelBox.height / 2, { steps: 5 });
	await expect(priority).toHaveAttribute("data-field-dragging", "true");
	await expect.poll(() => priority.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m41)).toBe(0);
	await expect(priority).toHaveCSS("box-shadow", "none");
	await page.mouse.move(targetBox.x + 80, targetBox.y + targetBox.height / 2, { steps: 5 });
	await page.mouse.up();
	await expect(fields.locator("[data-field-id]").first()).toHaveAttribute("data-field-id", "priority");
	await expect(fields.getByRole("button", { name: /Drag to reorder/ })).toHaveCount(0);
	const statusValue = status.getByRole("button", { name: "Change status in details, To do" });
	const dueDate = fields.getByRole("group", { name: "Due Date field" });
	const [valueBox, dueDateBox] = await Promise.all([statusValue.boundingBox(), dueDate.boundingBox()]);
	if (!valueBox || !dueDateBox) throw new Error("Missing value geometry");
	await page.mouse.move(valueBox.x + 20, valueBox.y + valueBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(dueDateBox.x + 20, dueDateBox.y + dueDateBox.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(fields.locator("[data-field-id]").last()).toHaveAttribute("data-field-id", "status");
	await expect(page.getByRole("menuitem", { name: "In progress", exact: true })).toHaveCount(0);
	await priority.hover();
	const actions = priority.getByRole("button", { name: "More priority field actions" });
	const [rowBox, actionBox] = await Promise.all([priority.boundingBox(), actions.boundingBox()]);
	if (!rowBox || !actionBox) throw new Error("Missing action geometry");
	expect(actionBox.x + actionBox.width).toBeLessThan(rowBox.x + rowBox.width + 8);
	await actions.click();
	await expect(page.getByRole("menuitem", { name: "Move down" })).toBeVisible();
});

test("the status field opens across its row without a second background", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const row = page.getByRole("group", { name: "Status field" });
	const status = row.getByRole("button", { name: "Change status in details, To do" });
	const bounds = await status.boundingBox();
	if (!bounds) throw new Error("Status field is missing");
	await status.click({ position: { x: bounds.width - 75, y: bounds.height / 2 } });
	await expect(page.getByRole("menuitem", { name: "In progress", exact: true })).toBeVisible();
	await expect(status).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await page.keyboard.press("Escape");
	await expect(status).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("menuitem", { name: "Done", exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await row.getByRole("button", { name: "More status field actions" }).click();
	await expect(page.getByRole("menuitem", { name: "Pinned by default" })).toBeVisible();
});

