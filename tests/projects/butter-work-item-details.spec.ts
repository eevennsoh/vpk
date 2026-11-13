import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("assignee options use compact palette sizing and highlight on hover while searching", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	await page.getByRole("button", { name: "Change assignee" }).click();
	const picker = page.getByRole("dialog", { name: "Change assignee" });
	const search = picker.getByRole("textbox", { name: "Search people" });
	const option = picker.getByRole("option", { name: "Annie Cook" });
	await expect(search).toBeFocused();
	await expect(option).toHaveCSS("height", "36px");
	await option.hover();
	await expect(search).toBeFocused();
	await expect.poll(() => option.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
	await option.click();
	await expect(page.getByRole("button", { name: "Change assignee" })).toContainText("Annie Cook");
});

test("Agents hover highlights the value below its label, like Priority", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	await page.getByRole("button", { name: "Show more details" }).click();
	const fields = page.locator("[data-project-butter-detail-fields]");
	const agents = fields.locator('[data-field-id="agents"]');
	const priority = fields.locator('[data-field-id="priority"]');
	const agentLabel = agents.getByText("Agents", { exact: true });
	const priorityLabel = priority.getByText("Priority", { exact: true });
	const hoverSurface = (label: typeof agentLabel) => label.locator("xpath=following-sibling::*[1]");
	await agentLabel.hover();
	await expect(hoverSurface(agentLabel)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await agents.getByRole("group", { name: "Agents field" }).hover();
	await expect.poll(() => hoverSurface(agentLabel).evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
	await priority.getByRole("button", { name: /Change priority/ }).hover();
	const priorityBackground = await hoverSurface(priorityLabel).evaluate((node) => getComputedStyle(node).backgroundColor);
	await agents.getByRole("group", { name: "Agents field" }).hover();
	await expect(hoverSurface(agentLabel)).toHaveCSS("background-color", priorityBackground);
	await expect(agentLabel).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("Agents can be dragged and moved independently in the Work item Details", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	await page.getByRole("button", { name: "Show more details" }).click();
	const fields = page.locator("[data-project-butter-detail-fields]");
	const agents = fields.locator('[data-field-id="agents"]');
	const parent = fields.locator('[data-field-id="parent"]');
	const [source, target] = await Promise.all([agents.boundingBox(), parent.boundingBox()]);
	if (!source || !target) throw new Error("Missing field geometry");
	await page.mouse.move(source.x + 5, source.y + 8);
	await page.mouse.down();
	await page.mouse.move(target.x + 5, target.y + target.height / 2, { steps: 10 });
	await expect(agents).toHaveAttribute("data-field-dragging", "true");
	await page.mouse.up();
	const order = () => fields.locator("[data-field-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-field-id")));
	await expect.poll(async () => (await order()).indexOf("agents")).toBeGreaterThan((await order()).indexOf("parent"));
	await fields.getByRole("group", { name: "Agents field" }).getByRole("button", { name: /^\d+ agents$/u }).click();
	await expect(page.getByRole("dialog", { name: "Add agent" })).toBeVisible();
	await page.keyboard.press("Escape");
	const actions = agents.getByRole("button", { name: "More agents field actions" });
	await actions.focus();
	await page.keyboard.press("Enter");
	await page.getByRole("menuitem", { name: "Move up" }).focus();
	await page.keyboard.press("Enter");
	expect((await order()).indexOf("agents")).toBeLessThan((await order()).indexOf("parent"));
	await page.getByRole("button", { name: "Show less details" }).click();
	await expect(fields.getByRole("group", { name: "Agents field" })).toBeVisible();
	await page.getByRole("button", { name: "Show more details" }).click();
	expect((await order()).indexOf("agents")).toBeLessThan((await order()).indexOf("parent"));
});

test("the agent row aligns with the other Details field icons and values", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const fields = page.getByRole("dialog", { name: "Project butter" }).locator("[data-project-butter-detail-fields]");
	test.skip(await fields.locator('[data-field-id="status"]').count() > 0, "The older work-item layout does not contain the agent field.");
	// The Agents field shows an avatar stack and, for a single agent, its name; it carries no session status.
	const agentField = fields.getByRole("group", { name: "Agents field" });
	const agent = agentField.getByRole("button", { name: "Cursor", exact: true });
	await expect(agent).toBeVisible();
	await expect(fields.getByText("Agents", { exact: true })).toBeVisible();
	await expect(agentField).not.toContainText(/Needs input|Working|Finished/);
	await expect(agentField.locator('[data-slot="spinner"]')).toHaveCount(0);
	const geometry = await fields.evaluate((root) => {
		const assignee = root.querySelector('[data-field-id="assignee"] [data-slot="avatar"]');
		const priority = root.querySelector('[data-field-id="priority"] [data-slot="icon-tile"]');
		const agentAvatar = root.querySelector('[aria-label="Agents field"] [data-agent-name] [data-slot="avatar"]');
		const assigneeText = assignee?.nextElementSibling;
		const agentText = agentAvatar?.closest('[data-slot="avatar-group"]')?.nextElementSibling;
		if (!assignee || !priority || !agentAvatar || !assigneeText || !agentText) return null;
		const center = (element: Element) => { const box = element.getBoundingClientRect(); return box.left + box.width / 2; };
		const avatarBox = agentAvatar.getBoundingClientRect();
		let clipped = false;
		for (let ancestor = agentAvatar.parentElement; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
			const style = getComputedStyle(ancestor);
			const box = ancestor.getBoundingClientRect();
			if (style.overflowX !== "visible" && (avatarBox.left < box.left - 0.5 || avatarBox.right > box.right + 0.5)) clipped = true;
		}
		return {
			clipped,
			starts: [assignee.getBoundingClientRect().left, avatarBox.left, priority.getBoundingClientRect().left],
			avatarCenters: [center(assignee), center(agentAvatar)],
			values: [assigneeText.getBoundingClientRect().left, agentText.getBoundingClientRect().left],
		};
	});
	expect(geometry).not.toBeNull();
	if (!geometry) throw new Error("Missing Details field geometry");
	expect(geometry.clipped).toBe(false);
	// Field icons share a leading edge; the 24px assignee and agent avatars also share their centre and value column.
	expect(Math.max(...geometry.starts) - Math.min(...geometry.starts)).toBeLessThan(1);
	expect(Math.max(...geometry.avatarCenters) - Math.min(...geometry.avatarCenters)).toBeLessThan(1);
	expect(Math.max(...geometry.values) - Math.min(...geometry.values)).toBeLessThan(1);
	await agent.click();
	await expect(page.getByRole("dialog", { name: "Add agent" })).toBeVisible();
});

test("details move after the description in a narrow work item and retain their state", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	const details = dialog.getByRole("complementary", { name: "Work item details" });
	await expect(details).toHaveCount(1);
	await details.getByRole("button", { name: "Show more details" }).click();
	await details.getByRole("button", { name: "Show less details" }).focus();
	await page.setViewportSize({ width: 800, height: 1100 });
	await expect.poll(() => dialog.evaluate((root) => {
		const description = root.querySelector('[aria-label="Description"], [aria-labelledby$="-description"]');
		const details = root.querySelector('[aria-label="Work item details"]');
		const related = root.querySelector('[data-component="RelatedWork"]');
		const activity = root.querySelector('[data-project-butter-activity]');
		if (!description || !details || !related || !activity) return false;
		return Boolean(description.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING)
			&& Boolean(details.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING)
			&& Boolean(related.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING);
	})).toBe(true);
	await expect(details.getByRole("button", { name: "Show less details" })).toBeVisible();
	await expect(details.getByRole("button", { name: "Show less details" })).toBeFocused();
	await page.setViewportSize({ width: 1800, height: 1100 });
	await expect.poll(async () => {
		const [description, rail] = await Promise.all([
			dialog.getByRole("region", { name: "Description" }).boundingBox(),
			details.boundingBox(),
		]);
		return Boolean(description && rail && rail.x > description.x + description.width);
	}).toBe(true);
	await expect(details.getByRole("button", { name: "Show less details" })).toBeVisible();
	await expect(details.getByRole("button", { name: "Show less details" })).toBeFocused();
	await expect(details).toHaveCount(1);
});

test("focusing a list-ending description does not add a blank line", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const editor = page.getByRole("textbox", { name: "Work item description" });
	const related = page.getByRole("button", { name: "Collapse Related work" });
	const original = await editor.boundingBox();
	const relatedBefore = await related.boundingBox();
	if (!original || !relatedBefore) throw new Error("Description geometry is unavailable");
	await editor.locator("li").last().click();
	const focused = await editor.boundingBox();
	const relatedAfter = await related.boundingBox();
	if (!focused || !relatedAfter) throw new Error("Focused description geometry is unavailable");
	expect(focused.height).toBeCloseTo(original.height, 0);
	expect(relatedAfter.y).toBeCloseTo(relatedBefore.y, 0);
	await editor.evaluate((element) => {
		const lastParagraph = element.querySelector("li:last-child p");
		if (!lastParagraph) throw new Error("Last list item is unavailable");
		const range = document.createRange();
		range.selectNodeContents(lastParagraph);
		range.collapse(false);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	});
	await page.keyboard.press("Enter");
	await page.keyboard.press("Enter");
	await page.keyboard.type("New paragraph after the list");
	await expect(editor.locator(":scope > p").last()).toHaveText("New paragraph after the list");
	await page.getByRole("button", { name: "Description", exact: true }).click();
	await page.getByRole("button", { name: "Description", exact: true }).click();
	await expect(editor).toContainText("New paragraph after the list");
});

test("a description ending in a table keeps an editable paragraph after it", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const editor = page.getByRole("textbox", { name: "Work item description" });
	await editor.fill("");
	await editor.evaluate((element) => {
		const clipboard = new DataTransfer();
		clipboard.setData("text/html", "<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>");
		element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard }));
	});
	await expect(editor.locator("table")).toBeVisible();
	const trailing = editor.locator(":scope > p").last();
	await expect(trailing).toBeVisible();
	await page.getByRole("textbox", { name: "Work item summary" }).focus();
	const beforeFocus = await editor.boundingBox();
	await trailing.click();
	const afterFocus = await editor.boundingBox();
	if (!beforeFocus || !afterFocus) throw new Error("Table description geometry is unavailable");
	expect(afterFocus.height).toBeCloseTo(beforeFocus.height, 0);
	await page.keyboard.type("Notes below.");
	await expect(trailing).toHaveText("Notes below.");
	await page.getByRole("button", { name: "Description", exact: true }).click();
	await page.getByRole("button", { name: "Description", exact: true }).click();
	await expect(editor).toContainText("Notes below.");
});

test("attachment cards stay fanned while hovered and settle when the pointer leaves", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const pile = page.locator('[data-attachment-stack="documents"]');
	const toggle = pile.getByRole("button", { name: "Documents, 2 attachments" });
	const front = pile.locator("[data-attachment-card]").first().locator(":scope > div").first();
	const rotation = () => front.evaluate((node) => {
		const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
		return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
	});
	await toggle.hover();
	await expect.poll(rotation).toBeLessThan(-1);
	await page.waitForTimeout(600);
	expect(await rotation()).toBeLessThan(-1);
	await page.mouse.move(0, 0);
	await expect.poll(async () => Math.abs(await rotation())).toBeLessThan(0.1);
	await toggle.click();
	await expect(pile.getByRole("button", { name: "Close documents" })).toHaveAttribute("aria-expanded", "true");
});

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

test("child work item actions appear on hover and keyboard focus", async ({ page }) => {
	test.setTimeout(90_000);
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const row = page.getByRole("list", { name: "Child work items" }).getByRole("listitem").first();
	const action = row.getByRole("button", { name: /^More actions for / });
	const actions = row.locator('[data-component="SubItemActionsMenu"]');
	await page.mouse.move(0, 0);
	await expect(actions).toHaveCSS("opacity", "0");
	await row.getByRole("button", { name: /^Edit priority for / }).focus();
	await page.keyboard.press("Shift+Tab");
	await expect(action).toBeFocused();
	await expect(actions).toHaveCSS("opacity", "1");
	await page.getByRole("button", { name: /^Collapse Child work items/ }).focus();
	await expect(actions).toHaveCSS("opacity", "0");
	await row.hover();
	await expect(actions).toHaveCSS("opacity", "1");
	await action.click();
	await page.mouse.move(0, 0);
	await expect(action).toHaveAttribute("aria-expanded", "true");
	await expect(actions).toHaveCSS("opacity", "1");
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
	const assignee = fields.getByRole("group", { name: "Assignee field" });
	const label = priority.getByText("Priority", { exact: true });
	const [labelBox, targetBox] = await Promise.all([label.boundingBox(), assignee.boundingBox()]);
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
	await priority.hover();
	const actions = priority.getByRole("button", { name: "More priority field actions" });
	const [rowBox, actionBox] = await Promise.all([priority.boundingBox(), actions.boundingBox()]);
	if (!rowBox || !actionBox) throw new Error("Missing action geometry");
	expect(actionBox.x + actionBox.width).toBeLessThan(rowBox.x + rowBox.width + 8);
	await actions.click();
	await expect(page.getByRole("menuitem", { name: "Move down" })).toBeVisible();
});

test("status and agent controls follow the new work item layout", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	const details = dialog.getByRole("complementary", { name: "Work item details" });
	const assignee = details.getByRole("group", { name: "Assignee field" });
	const addAgent = details.getByRole("button", { name: "Add agent", exact: true });
	const priority = details.getByRole("group", { name: "Priority field" });
	const [assigneeBox, agentBox, priorityBox] = await Promise.all([assignee.boundingBox(), addAgent.boundingBox(), priority.boundingBox()]);
	if (!assigneeBox || !agentBox || !priorityBox) throw new Error("Missing details geometry");
	expect(agentBox.y).toBeGreaterThan(assigneeBox.y + assigneeBox.height - 1);
	expect(agentBox.y + agentBox.height).toBeLessThanOrEqual(priorityBox.y);
	await expect(details.getByRole("group", { name: "Status field" })).toHaveCount(0);
	const status = dialog.getByRole("button", { name: "Change status, To do" });
	await status.click();
	await expect(page.getByRole("menuitem", { name: "In progress", exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await addAgent.focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Add agent" });
	await expect(picker.getByRole("textbox", { name: "Search agents" })).toBeVisible();
	await picker.getByRole("textbox", { name: "Search agents" }).fill("Figma");
	await expect(picker.getByRole("button", { name: "Figma", exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(addAgent).toBeFocused();
});


test("long suggestions scroll inside the card without clipping the panel", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-999").locator('[data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: "5 suggestions" }).click();
	const value = page.getByRole("region", { name: "Suggested value" });
	await expect(value).toBeVisible();
	await expect(page.getByRole("button", { name: "Accept all" })).toBeVisible();
	const popup = page.locator('[data-slot="popover-content"]').filter({ has: value });
	await expect(popup).toHaveCSS("overflow-x", "visible");
	const geometry = await value.evaluate((element) => ({ height: element.clientHeight, total: element.scrollHeight }));
	expect(geometry.height).toBeLessThanOrEqual(200);
	expect(geometry.total).toBeGreaterThan(geometry.height);
	await value.focus();
	await page.keyboard.press("End");
	await expect.poll(() => value.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await expect(page.getByRole("button", { name: "Accept description" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Accept all" })).toBeVisible();
});
