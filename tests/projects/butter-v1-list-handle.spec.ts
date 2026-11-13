import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

// Selecting List plays the gallery transition while the previous view is still attached; wait for the list itself.
async function openList(page: Page) {
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	await expect(list).toBeVisible();
	return list;
}

test("two additional list rows cycle between their agents", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	const list = await openList(page);
	// PAY-130's Cursor session waits for input, so its pair reads as needing input.
	const pairs = [["PAY-130", "2 agents: Needs input"], ["PAY-128", "2 agents: Working"]] as const;
	const rows = pairs.map(([key]) => list.getByRole("row").filter({ hasText: key }));
	for (const [index, [, label]] of pairs.entries()) await expect(rows[index].getByRole("button", { name: label })).toBeVisible();
	const avatars = rows.map((row) => row.locator(".agent-loading-vertical [data-agent-id]").first());
	const initial = await Promise.all(avatars.map((avatar) => avatar.getAttribute("data-agent-id")));
	await Promise.all(avatars.map((avatar, index) => expect.poll(() => avatar.getAttribute("data-agent-id"), { timeout: 8_000 }).not.toBe(initial[index])));
});

for (const key of ["PAY-118", "PAY-105"]) test(`selected agent animates into list sessions for ${key}`, async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	const list = await openList(page);
	const add = list.getByRole("button", { name: `Add agent to ${key}` });
	const cell = add.locator("xpath=ancestor::*[@data-butter-agent-surface]");
	await add.click();
	const figma = page.getByRole("dialog", { name: "Agents" }).getByRole("button", { name: /^Figma/ }).first();
	await figma.hover();
	const previewAvatar = await cell.locator('[data-slot="jira-issue-agent-invocation-preview"] > span:first-child').boundingBox();
	const previewLabel = await cell.locator('[data-slot="jira-issue-agent-invocation-preview"] > span:nth-child(2)').boundingBox();
	const beforeTrigger = await add.boundingBox();
	await page.clock.install();
	await page.clock.pauseAt(Date.now());
	await figma.click();
	await expect(cell.getByRole("button", { name: /Figma: Working|agents: Working/ })).toBeVisible();
	await expect(cell.locator('[data-handoff-label="outgoing"]')).toHaveText("Add Figma");
	await expect(cell.locator('[data-handoff-label="incoming"]')).toHaveText("Working");
	const handoffLabel = await cell.locator('[data-slot="jira-issue-agent-handoff-label"]').boundingBox();
	const afterTrigger = await add.boundingBox();
	if (!previewAvatar || !previewLabel || !handoffLabel || !beforeTrigger || !afterTrigger) throw new Error("Invocation geometry is unavailable");
	expect(handoffLabel.y + handoffLabel.height / 2 - afterTrigger.y).toBeCloseTo(previewLabel.y + previewLabel.height / 2 - beforeTrigger.y, 0);
	if (key === "PAY-105") {
		// A second agent joins the row's vertical loading stack in the preview's avatar slot.
		const joined = cell.locator('.agent-loading-vertical [data-agent-id="figma"]');
		await expect(joined).toBeAttached();
		const joinedBounds = await joined.boundingBox();
		if (!joinedBounds) throw new Error("Selected avatar geometry is unavailable");
		expect(joinedBounds.x + joinedBounds.width / 2).toBeCloseTo(previewAvatar.x + previewAvatar.width / 2, 0);
		expect(joinedBounds.y + joinedBounds.height / 2 - afterTrigger.y).toBeCloseTo(previewAvatar.y + previewAvatar.height / 2 - beforeTrigger.y, 0);
		await expect(cell.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toHaveCount(0);
	} else {
		await expect(cell.locator('[data-slot="jira-issue-agent-invocation-handoff"]')).toBeAttached();
		await expect(cell.locator('[data-slot="jira-issue-agent-avatar-handoff"]')).toHaveCSS("opacity", "0");
	}
});

for (const reducedMotion of ["reduce", "no-preference"] as const) test(`assigning an agent acknowledges the list row (${reducedMotion})`, async ({ page }) => {
	await page.emulateMedia({ reducedMotion });
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	const list = await openList(page);
	const add = list.getByRole("button", { name: "Add agent to PAY-118" });
	const row = add.locator("xpath=ancestor::tr");
	for (const name of ["Figma", "Claude"]) {
		await add.click();
		await page.getByRole("dialog", { name: "Agents" }).getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
		const glow = row.locator('[data-jira-linking-glow-backdrop][data-jira-linking-glow-direction="left-to-right"]');
		if (reducedMotion === "reduce") {
			await expect(glow).toHaveCount(0);
		} else {
			await expect(glow).toBeAttached();
			const geometry = await glow.evaluate((element) => {
				const effect = element.firstElementChild?.getAnimations()[0]?.effect;
				return { width: element.getBoundingClientRect().width, rowWidth: element.closest("tr")?.getBoundingClientRect().width, keyframes: effect instanceof KeyframeEffect ? effect.getKeyframes() : [] };
			});
			expect(geometry.width).toBeCloseTo(geometry.rowWidth ?? 0, 0);
			expect(geometry.keyframes?.map((frame) => frame.transform)).toEqual(["translateX(0px)", "translateX(200%)"]);
			await expect(glow).toHaveCount(0);
		}
		await expect(row.getByRole("button", { name: new RegExp(`${name}: Working|agents: Working`) })).toBeVisible();
	}
});

test("each assigned agent plays a row glow in its avatar accent", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	const list = await openList(page);
	const fallbackVisible = await page.evaluate(() => {
		const probe = document.createElement("div");
		probe.style.backgroundImage = "linear-gradient(90deg, transparent, color-mix(in srgb, var(--ds-background-accent-gray-bolder) 28%, transparent), transparent)";
		document.body.append(probe);
		const visible = getComputedStyle(probe).backgroundImage !== "none";
		probe.remove();
		return visible;
	});
	expect(fallbackVisible).toBe(true);
	const add = list.getByRole("button", { name: "Add agent to PAY-118" });
	const row = add.locator("xpath=ancestor::tr");
	for (const [name, color] of [["Figma", "#a259ff"], ["Release Notes Drafter", "#fca700"], ["Claude", "#d97757"]]) {
		await add.click();
		await page.getByRole("dialog", { name: "Agents" }).getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
		const glow = row.locator('[data-jira-linking-glow-backdrop] > div');
		await expect(glow).toBeAttached();
		const matchesAccent = await glow.evaluate((element, accent) => {
			const reference = document.createElement("div");
			reference.style.backgroundImage = `linear-gradient(90deg, transparent 0%, color-mix(in srgb, ${accent} 28%, transparent) 50%, transparent 100%)`;
			document.body.append(reference);
			const matches = getComputedStyle(element).backgroundImage === getComputedStyle(reference).backgroundImage;
			reference.remove();
			return matches;
		}, color);
		expect(matchesAccent, `${name} glow matches its avatar`).toBe(true);
		await expect(glow).toHaveCount(0);
	}
});

for (const reducedMotion of ["reduce", "no-preference"] as const) test(`list placeholder, preview, and session stay aligned (${reducedMotion})`, async ({ page }) => {
	await page.emulateMedia({ reducedMotion });
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const trigger = page.getByRole("button", { name: "Add agent to PAY-118" });
	const cell = trigger.locator("xpath=ancestor::*[@data-butter-agent-surface]");
	const placeholder = cell.locator(":scope > span").filter({ hasText: /^Add$/ });
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

test("adding an agent in List shows a dismissible nudge", async ({ page }) => {
	page.setDefaultTimeout(7000);
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	await expect(list).toBeVisible();
	await list.getByRole("button", { name: "Add agent to PAY-118" }).click();
	await page.getByRole("dialog", { name: "Agents" }).getByRole("button", { name: "Claude (Recommended)" }).click();
	const nudge = page.getByRole("button", { name: "Claude added", exact: true });
	await expect(nudge).toBeVisible();
	await expect(nudge.locator('[data-slot="avatar"][data-shape="hexagon"]')).toBeVisible();
	await page.getByRole("button", { name: "Dismiss Claude added" }).click();
	await expect(nudge).toBeHidden();
	await expect(list.getByRole("button", { name: "Claude: Working" })).toBeVisible();
	await list.getByRole("button", { name: "Add agent to PAY-118" }).click();
	await page.getByRole("dialog", { name: "Agents" }).getByRole("button", { name: "Cursor", exact: true }).click();
	await page.getByRole("button", { name: "Cursor added", exact: true }).click();
	await expect(page.getByRole("textbox", { name: "Chat message input" })).toBeVisible();
});

test("agent previews replace the empty list cell placeholder", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const trigger = page.getByRole("button", { name: "Add agent to PAY-118" });
	const cell = trigger.locator("xpath=ancestor::*[@data-butter-agent-surface]");
	const placeholder = cell.locator(":scope > span").filter({ hasText: /^Add$/ });
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
	const list = await openList(page);
	const trigger = list.getByRole("button", { name: "Add agent to PAY-118" });
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
	const list = await openList(page);
	for (const [key, session] of [["PAY-112", "Codex: Needs input"], ["PAY-105", "Cursor: Working"], ["PAY-101", "Claude: Finished"]]) {
		const add = list.getByRole("button", { name: `Add agent to ${key}` });
		const activity = add.locator("xpath=ancestor::*[@data-butter-agent-surface]").getByRole("button", { name: session });
		const addBounds = await add.boundingBox();
		const activityBounds = await activity.boundingBox();
		if (!addBounds || !activityBounds) throw new Error(`Agent controls for ${key} are not visible`);
		expect(activityBounds.y + activityBounds.height / 2).toBeCloseTo(addBounds.y + addBounds.height / 2, 1);
	}
});

test("list session avatar has balanced spacing", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	const list = await openList(page);
	const add = list.getByRole("button", { name: "Add agent to PAY-112" });
	const cell = add.locator("xpath=ancestor::*[@data-butter-agent-surface]");
	await add.hover();
	const plus = cell.locator('[data-slot="jira-issue-add-agent-visual"]');
	const avatar = cell.locator('[aria-label="Agents field"] [data-slot="avatar"]');
	const label = cell.getByText("Needs input", { exact: true });
	await expect.poll(async () => {
		const [plusBounds, avatarBounds, labelBounds] = await Promise.all([plus.boundingBox(), avatar.boundingBox(), label.boundingBox()]);
		if (!plusBounds || !avatarBounds || !labelBounds) return Infinity;
		return Math.abs(avatarBounds.x - (plusBounds.x + plusBounds.width) - (labelBounds.x - avatarBounds.x - avatarBounds.width));
	}).toBeLessThan(1);
});

test("list plus opens the agent picker and the status opens session cards", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1300 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List" }).click();
	const add = page.getByRole("button", { name: "Add agent to PAY-105" });
	const cell = add.locator("xpath=ancestor::*[@data-butter-agent-surface]");
	const status = cell.getByRole("button", { name: "Cursor: Working" });
	await status.focus();
	await page.keyboard.press("Enter");
	const sessions = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(sessions.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await expect(sessions.getByText("12m", { exact: true })).toBeVisible();
	const statusBounds = await status.boundingBox();
	const menuBounds = await sessions.boundingBox();
	if (!statusBounds || !menuBounds) throw new Error("Session menu geometry is unavailable");
	expect(menuBounds.y).toBeGreaterThanOrEqual(statusBounds.y + statusBounds.height);
	await expect(page.getByRole("dialog", { name: "Agents" })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await add.click();
	await expect(page.getByRole("dialog", { name: "Agents" })).toBeVisible();
	await expect(page.getByRole("dialog", { name: "Agent assignment" })).toHaveCount(0);
	await page.keyboard.press("Escape");
	const multi = page.getByRole("button", { name: "2 agents: Working" });
	await multi.click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).locator("li")).toHaveCount(2);
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
