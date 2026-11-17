import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("Small joins the avatar stack directly to metadata and keeps the PR-time separator", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Small", exact: true }).click();
	const rows = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("article");
	await expect(rows).toHaveCount(6);
	const separators = await rows.evaluateAll((elements) => elements.map((row) => {
		const identity = row.querySelector("[data-agent-session-agent]")?.parentElement;
		const metadata = identity?.parentElement;
		return {
			leadingDot: identity?.nextElementSibling?.firstElementChild?.textContent === "·",
			dots: [...(metadata?.querySelectorAll('span[aria-hidden="true"]') ?? [])].filter((element) => element.textContent === "·").length,
		};
	}));
	expect(separators).toEqual([
		{ leadingDot: false, dots: 1 }, { leadingDot: false, dots: 1 }, { leadingDot: false, dots: 1 },
		{ leadingDot: false, dots: 1 }, { leadingDot: false, dots: 0 }, { leadingDot: false, dots: 0 },
	]);
});

test("session identity shows names in Large and states in Medium", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const identities = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("[data-agent-session-agent]");
	for (const size of ["Large", "Medium", "Small", "Large"]) {
		await page.getByRole("button", { name: size, exact: true }).click();
		await expect(identities).toHaveText(size === "Large" ? ["Claude", "Cursor", "Rovo", "Claude", "Canva", "Figma"] : size === "Medium" ? ["Working", "Needs input", "Finished", "Working", "Needs input", "Finished"] : ["", "", "", "", "", ""]);
	}
	await expect(page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("[data-agent-session-tool-call]")).toHaveCount(0);
});

test("Medium puts shimmering state text after the avatars and keeps Small status glyphs", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Medium", exact: true }).click();
	const rows = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("article");
	for (const [index, state] of ["Working", "Needs input", "Finished", "Working", "Needs input", "Finished"].entries()) {
		const row = rows.nth(index);
		const identity = row.locator("[data-agent-session-agent]");
		await expect(identity).toHaveText(state);
		const stack = identity.locator(":scope > *").first();
		const label = identity.locator(":scope > span[title]");
		const [stackBounds, labelBounds] = await Promise.all([stack.boundingBox(), label.boundingBox()]);
		if (!stackBounds || !labelBounds) throw new Error("Missing avatar stack or state text");
		expect(labelBounds.x - stackBounds.x - stackBounds.width).toBe(4);
		expect(labelBounds.y + labelBounds.height / 2).toBe(stackBounds.y + stackBounds.height / 2);
		await expect(identity.locator(".shimmer")).toHaveCount(state === "Working" ? 1 : 0);
		await expect(row.locator("[data-agent-session-lifecycle-current]")).toHaveCount(1);
	}
	const glyphs = () => rows.evaluateAll((elements) => elements.map((row) => {
		const indicator = row.querySelector("[data-agent-session-lifecycle-current]");
		if (!indicator) throw new Error("Missing status indicator");
		const box = indicator.getBoundingClientRect();
		return { state: indicator.getAttribute("data-agent-session-lifecycle-current"), width: box.width, height: box.height, glyphs: [...indicator.querySelectorAll("svg")].map((svg) => ({ width: getComputedStyle(svg).width, height: getComputedStyle(svg).height, viewBox: svg.getAttribute("viewBox"), color: getComputedStyle(svg).color })) };
	}));
	const mediumGlyphs = await glyphs();
	await page.getByRole("button", { name: "Small", exact: true }).click();
	expect(await glyphs()).toEqual(mediumGlyphs);
});

test("My session menus show owner actions with icons and a separator before Delete", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "My session", exact: true }).click();
	await page.getByRole("button", { name: "Small", exact: true }).click();
	for (const host of ["Local", "Cloud"]) {
		const row = page.getByRole("region", { name: `${host} sessions`, exact: true }).locator("article").first();
		await row.getByRole("button", { name: /^More actions for/ }).focus();
		await page.keyboard.press("Enter");
		const menu = page.getByRole("menu");
		await expect(menu.getByRole("menuitem")).toHaveText(["Stop session", "Pin", "Rename", "Delete"]);
		await expect(menu.getByRole("separator")).toHaveCount(1);
		for (const label of ["Stop session", "Pin", "Rename", "Delete"]) {
			const action = menu.getByRole("menuitem", { name: label, exact: true });
			await expect(action).toBeEnabled();
			await expect(action.locator("svg")).toBeVisible();
			await expect(action.locator("svg")).toHaveCSS("width", "16px");
			await expect(action.locator("svg")).toHaveCSS("height", "16px");
			await expect(action.locator(":scope > span").first()).toHaveCSS("width", "16px");
			await expect(action.locator(":scope > span").first()).toHaveCSS("height", "16px");
		}
		await expect(menu.getByRole("menuitem", { name: "Delete", exact: true })).toHaveAttribute("data-variant", "destructive");
		await page.keyboard.press("Escape");
		await expect(menu).toBeHidden();
	}
});

test("session timestamps remain last in the metadata at every size", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const rows = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("article");
	for (const size of ["Large", "Medium", "Small"]) {
		await page.getByRole("button", { name: size, exact: true }).click();
		await expect.poll(() => rows.evaluateAll((elements) => elements.map((row) => {
			const identity = row.querySelector("[data-agent-session-agent]")?.getBoundingClientRect();
			const time = row.querySelector('[title="Last update"]')?.getBoundingClientRect();
			const artifact = row.querySelector('[title^="#"]')?.getBoundingClientRect();
			return identity !== undefined && time !== undefined && time.x >= identity.right && (artifact === undefined || time.x >= artifact.right);
		})), size).toEqual([true, true, true, true, true, true]);
	}
});

test("private sessions keep their status on hover and focus without owner actions", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Private session", exact: true }).click();
	for (const size of ["Large", "Medium", "Small"]) {
		await page.getByRole("button", { name: size, exact: true }).click();
		for (const host of ["Local", "Cloud"]) {
			const sessions = page.getByRole("region", { name: `${host} sessions`, exact: true });
			const rows = sessions.locator("article");
			await expect(rows).toHaveCount(3);
			for (const [index, state] of ["Working", "Needs input", "Finished"].entries()) {
				const row = rows.nth(index);
				const indicator = size === "Medium" ? row.locator("[data-agent-session-agent]").getByText(state, { exact: true }) : row.getByRole("img", { name: state, exact: true });
				await row.hover();
				await expect(indicator).toBeVisible();
				await row.focus();
				await expect(indicator).toBeVisible();
				await expect(row.locator('[data-access-mark="private"]')).toBeVisible();
				await expect(row.locator('[data-access-mark="team"]')).toHaveCount(0);
				await expect(row.getByRole("button")).toHaveCount(0);
			}
			await expect(sessions.getByRole("button", { name: /^More actions for/ })).toHaveCount(0);
		}
	}
	await page.getByRole("button", { name: "My session", exact: true }).click();
	const ownedRow = page.getByRole("region", { name: "Local sessions", exact: true }).locator("article").first();
	await ownedRow.hover();
	await expect(ownedRow.getByRole("button", { name: /^More actions for/ })).toBeVisible();
});

test("session size controls stay centered over the card column", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const controls = page.getByRole("group", { name: "Session card size", exact: true });
	const card = page.getByRole("region", { name: "Cloud sessions", exact: true }).locator("article").first();
	for (const size of ["Large", "Medium", "Small"]) {
		await controls.getByRole("button", { name: size, exact: true }).click();
		await expect.poll(async () => {
			const [controlBounds, cardBounds] = await Promise.all([controls.boundingBox(), card.boundingBox()]);
			if (!controlBounds || !cardBounds) throw new Error("Missing session size control or card");
			return Math.abs(controlBounds.x + controlBounds.width / 2 - cardBounds.x - cardBounds.width / 2);
		}).toBeLessThan(1);
	}
});

test("large session metadata reveals more text when the card has space", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const row = page.getByRole("region", { name: "Local sessions", exact: true }).locator("article").first();
	const artifact = row.locator('[title^="#1306:"]');
	await page.getByRole("button", { name: "Medium", exact: true }).click();
	const mediumWidth = await artifact.evaluate((element) => element.getBoundingClientRect().width);
	await page.getByRole("button", { name: "Large", exact: true }).click();
	await expect.poll(() => artifact.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(mediumWidth);
	await expect.poll(() => artifact.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
	const timestamp = row.locator('[title="Last update"]');
	await expect(timestamp).toBeVisible();
	const bounds = await row.boundingBox();
	const timeBounds = await timestamp.boundingBox();
	if (!bounds || !timeBounds) throw new Error("Missing session metadata geometry");
	expect(timeBounds.x + timeBounds.width).toBeLessThan(bounds.x + bounds.width);
});

test("session cards do not expose individual tool calls at any size", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const sessions = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ });
	for (const size of ["Large", "Medium", "Small"]) {
		await page.getByRole("button", { name: size, exact: true }).click();
		await expect(sessions.locator("article")).toHaveCount(6);
		await expect(sessions.locator("[data-agent-session-tool-call]")).toHaveCount(0);
		await expect(sessions.getByText("Tool call:")).toHaveCount(0);
		await expect(sessions.getByText("Editing the shared implementation.", { exact: true })).toHaveCount(0);
	}
});

test("teammate sessions keep their popover alignment while expanding near the viewport edge", async ({ page }) => {
	await page.setViewportSize({ width: 1398, height: 1236 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	await page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-123"][data-board-column-title]').getByRole("button", { name: "2 agents: Needs input" }).click();
	const popup = page.getByRole("dialog", { name: "Agent assignment" });
	const disclosure = popup.getByRole("button", { name: /(?:\d+ )?other sessions?/iu });
	await expect(disclosure).toHaveAttribute("aria-expanded", "true");
	await disclosure.click();
	await expect(disclosure).toHaveAttribute("aria-expanded", "false");
	await page.setViewportSize({ width: 1398, height: 900 });
	await expect(popup).toHaveAttribute("data-align", "start");
	await disclosure.click();
	await expect(disclosure).toHaveAttribute("aria-expanded", "true");
	const panel = popup.locator('[data-slot="collapsible-content"]');
	await expect.poll(() => panel.evaluate((element) => Math.abs(element.getBoundingClientRect().height - element.scrollHeight))).toBeLessThan(1);
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	await expect(popup).toHaveAttribute("data-align", "start");
	await expect(popup.getByText("Recording decline-code fixtures")).toBeVisible();
	await disclosure.press("Escape");
	await expect(disclosure).toHaveAttribute("aria-expanded", "false");
	await expect(disclosure).toBeFocused();
});

test("Butter session menus name the work instead of the agent", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const issue = board.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await issue.getByRole("button", { name: "Cursor: Working" }).click();
	const assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	// A working session shows the agent mark, never its name.
	await expect(assignment.getByText("Cursor", { exact: true })).toHaveCount(0);
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
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
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

test("the original Butter session menu shows sessions without an Add agent footer", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-105"][data-board-column-title]').getByRole("button", { name: "Cursor: Working" }).click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
});

test("session titles describe their work in grouped, review, and List views", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const unlinked = page.getByRole("region", { name: /Unlink sessions/ });
	await expect(unlinked.getByText("Keep or delete the adapter", { exact: true })).toBeHidden();
	await unlinked.getByRole("button", { name: "Expand Unlink sessions column" }).click();
	await expect(unlinked.getByText("Keep or delete the adapter", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const grouped = board.locator('[data-issue-key="PAY-123"][data-board-column-title]');
	await grouped.getByRole("button", { name: "2 agents: Needs input" }).click();
	let assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Checking decline fixture coverage", { exact: true })).toBeVisible();
	await expect(assignment.getByText("Recording decline-code fixtures", { exact: true })).toBeVisible();
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
	assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await row.getByRole("button", { name: "Add agent to PAY-105" }).click();
	const picker = page.getByRole("dialog", { name: "Agents" });
	await picker.getByRole("button", { name: "Claude (Recommended)" }).click();
	await expect(picker).toBeHidden();
	const sessions = row.getByRole("button", { name: "2 agents: Working" });
	await expect(sessions).toBeVisible();
	await sessions.focus();
	await page.keyboard.press("Enter");
	await expect(assignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await expect(assignment.getByText("Port confirmPaymentIntent and the 3-D Secure challenge flow", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(assignment).toBeHidden();
	await expect(sessions).toBeFocused();
});

test("a new board session uses the work-item summary as its title", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
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
