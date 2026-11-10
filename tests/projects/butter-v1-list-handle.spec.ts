import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const reducedMotion of ["reduce", "no-preference"] as const) test(`list placeholder, preview, and session stay aligned (${reducedMotion})`, async ({ page }) => {
	await page.emulateMedia({ reducedMotion });
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const trigger = page.getByRole("button", { name: "Add agent to PAY-118" });
	const cell = trigger.locator("xpath=ancestor::*[@data-butter-agent-surface]");
	const placeholder = cell.locator(":scope > span").filter({ hasText: /^Add agent$/ });
	const placeholderBounds = await placeholder.boundingBox();
	if (!placeholderBounds) throw new Error("Placeholder is not visible");
	await trigger.click();
	const picker = page.getByRole("dialog", { name: "Agents" });
	const preview = cell.locator('[data-slot="jira-issue-agent-invocation-preview"]');
	const previewLabel = preview.locator(":scope > span:nth-child(2)");
	const avatar = preview.locator(":scope > span:first-child");
	await expect(preview).toBeVisible();
	await expect.poll(async () => {
		const bounds = await previewLabel.boundingBox();
		return bounds ? Math.abs(bounds.y + bounds.height / 2 - placeholderBounds.y - placeholderBounds.height / 2) : Infinity;
	}).toBeLessThan(0.5);
	const previewBounds = await previewLabel.boundingBox();
	if (!previewBounds) throw new Error("Preview is not visible");
	const avatarBounds = await avatar.boundingBox();
	if (!avatarBounds) throw new Error("Preview avatar geometry is unavailable");
	expect(avatarBounds.x).toBeCloseTo(placeholderBounds.x, 0);
	expect(previewBounds.y + previewBounds.height / 2).toBeCloseTo(placeholderBounds.y + placeholderBounds.height / 2, 0);
	await picker.getByRole("button", { name: /^Figma/ }).first().hover();
	await expect(preview).toHaveAttribute("data-agent-id", "figma");
	await picker.getByRole("button", { name: /^Figma/ }).first().click();
	const session = cell.getByRole("button", { name: "Figma: Working" });
	await expect(session).toBeVisible();
	const sessionVisual = cell.locator('[aria-label="Agents field"] [aria-hidden="true"]').first();
	const sessionBounds = await sessionVisual.boundingBox();
	if (!avatarBounds || !sessionBounds) throw new Error("Agent avatar geometry is unavailable");
	expect(sessionBounds.x).toBeCloseTo(avatarBounds.x, 0);
	await expect.poll(async () => {
		const label = await sessionVisual.getByText("Working", { exact: true }).boundingBox();
		const button = await trigger.boundingBox();
		return label && button ? Math.abs(label.y + label.height / 2 - button.y - button.height / 2) : Infinity;
	}).toBeLessThan(0.5);
	const sessionLabelBounds = await sessionVisual.getByText("Working", { exact: true }).boundingBox();
	if (!sessionLabelBounds) throw new Error("Session label geometry is unavailable");
	expect(sessionLabelBounds.x).toBeCloseTo(previewBounds.x, 0);
});

test("agent previews replace the empty list cell placeholder", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const trigger = page.getByRole("button", { name: "Add agent to PAY-118" });
	const cell = trigger.locator("xpath=ancestor::*[@data-butter-agent-surface]");
	const placeholder = cell.locator(":scope > span").filter({ hasText: /^Add agent$/ });
	await expect(placeholder).toBeVisible();
	await trigger.click();
	const picker = page.getByRole("dialog", { name: "Agents" });
	const preview = cell.locator('[data-slot="jira-issue-agent-invocation-preview"]');
	await expect(placeholder).toHaveCount(0);
	for (const [name, id] of [["Claude", "claude-code"], ["Cursor", "test-agent"]]) {
		await picker.getByRole("button", { name: new RegExp(`^${name}`) }).first().hover();
		await expect(preview).toHaveAttribute("data-agent-id", id);
		await expect(placeholder).toHaveCount(0);
	}
	await trigger.click();
	await expect(placeholder).toBeVisible();
});

test("the list agent selector opens to the left of its trigger", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const trigger = page.getByRole("button", { name: "Add agent to PAY-118" });
	await trigger.click();
	const picker = page.getByRole("dialog", { name: "Agents" });
	await expect(picker).toBeVisible();
	const triggerBounds = await trigger.boundingBox();
	const pickerBounds = await picker.boundingBox();
	if (!triggerBounds || !pickerBounds) throw new Error("Agent selector geometry is unavailable");
	expect(pickerBounds.x + pickerBounds.width).toBeLessThanOrEqual(triggerBounds.x);
});

test("list session controls align with the add-agent control", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	for (const [key, session] of [["PAY-112", "Codex: Needs input"], ["PAY-105", "Cursor: Working"], ["PAY-101", "Claude: Finished"]]) {
		const add = page.getByRole("button", { name: `Add agent to ${key}` });
		const activity = add.locator("xpath=ancestor::*[@data-butter-agent-surface]").getByRole("button", { name: session });
		const addBounds = await add.boundingBox();
		const activityBounds = await activity.boundingBox();
		if (!addBounds || !activityBounds) throw new Error(`Agent controls for ${key} are not visible`);
		expect(activityBounds.y + activityBounds.height / 2).toBeCloseTo(addBounds.y + addBounds.height / 2, 1);
	}
});

test("the standalone drag handle sits outside the list and reorders rows", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	const first = list.getByRole("button", { name: "PAY-118", exact: true }).locator("xpath=ancestor::tr");
	const second = list.getByRole("button", { name: "PAY-999", exact: true }).locator("xpath=ancestor::tr");
	const handle = list.getByTestId("jira-list-drag-handle-PAY-118");
	await first.hover({ position: { x: 120, y: 20 } });
	await expect(handle).toHaveCSS("opacity", "1");
	const firstBounds = await first.boundingBox();
	const secondBounds = await second.boundingBox();
	const handleBounds = await handle.boundingBox();
	if (!firstBounds || !secondBounds || !handleBounds) throw new Error("List drag geometry is unavailable");
	expect(handleBounds.x + handleBounds.width).toBeLessThanOrEqual(firstBounds.x);
	await expect(handle).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(handle).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await page.mouse.move(handleBounds.x + handleBounds.width / 2, handleBounds.y + handleBounds.height / 2, { steps: 5 });
	await expect(handle).toHaveCSS("opacity", "1");
	await page.mouse.down();
	await page.mouse.move(firstBounds.x + 100, secondBounds.y + secondBounds.height / 2, { steps: 10 });
	await page.mouse.up();
	await expect(second).toHaveJSProperty("rowIndex", 1);
	await page.keyboard.press("Tab");
	await handle.focus();
	await expect(handle).toBeFocused();
	expect(await handle.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
	await handle.press("ArrowUp");
	await expect(first).toHaveJSProperty("rowIndex", 1);
});
