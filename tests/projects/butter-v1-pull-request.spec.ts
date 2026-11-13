import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 10000, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 } });

test("hovering a Jira card reveals the PR status color", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Pull request" }).click();
	const stage = page.locator("[data-butter-gallery-pull-request]");
	const card = stage.locator('[data-slot="jira-issue-card"]');
	const expectedColor = async (className: string) => page.evaluate((name) => {
		const probe = document.createElement("span");
		probe.className = name;
		document.body.append(probe);
		const color = getComputedStyle(probe).color;
		probe.remove();
		return color;
	}, className);
	for (const [state, name, tokenClass, tooltip] of [
		["Open PR", /Pull request #284/, "text-icon-accent-lime", "#284 Add merchant onboarding quickstart"],
		["Merged PR", /Pull request merged #284/, "text-icon-accent-purple", "#284 Add merchant onboarding quickstart"],
		["Multiple PRs", /Pull requests for PAY-999/, "text-icon-subtle", "2 pull requests"],
	] as const) {
		await page.getByRole("group", { name: "Pull request status" }).getByRole("button", { name: state }).click();
		await card.hover({ position: { x: 30, y: 30 } });
		const trigger = stage.getByRole("button", { name });
		const color = await expectedColor(tokenClass);
		await expect(trigger.locator("svg")).toHaveCSS("color", color);
		await trigger.hover();
		await expect(trigger.locator("svg")).toHaveCSS("color", color);
		await expect(page.getByRole("tooltip", { name: tooltip })).toBeVisible();
		await trigger.click();
		await expect(page.getByRole("tooltip", { name: tooltip })).toBeHidden();
		await expect(page.getByRole("dialog", { name: state === "Multiple PRs" ? "Pull requests for PAY-999" : "Pull request #284 details" })).toBeVisible();
		await page.keyboard.press("Escape");
	}
	await page.getByRole("button", { name: "Select Board" }).click();
	const failedCard = page.locator('[data-issue-key="PAY-105"] [data-slot="jira-issue-card"]');
	await failedCard.hover({ position: { x: 30, y: 30 } });
	const failedTrigger = failedCard.getByRole("button", { name: /Pull request failed #1851/ });
	await expect(failedTrigger.locator("svg")).toHaveCSS("color", await expectedColor("text-icon-danger"));
	await failedTrigger.focus();
	await page.keyboard.press("Tab");
	await page.keyboard.press("Shift+Tab");
	await expect(failedTrigger).toBeFocused();
	await expect(page.getByRole("tooltip", { name: /#1851 / })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("tooltip", { name: /#1851 / })).toBeHidden();
});

test("multiple pull requests expand inline one at a time", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Pull request" }).click();
	const statuses = page.getByRole("group", { name: "Pull request status" });
	await expect(statuses.getByRole("button")).toHaveText(["Open PR", "Merged PR", "Multiple PRs"]);
	await statuses.getByRole("button", { name: "Multiple PRs" }).click();
	const trigger = page.getByRole("button", { name: "Pull requests for PAY-999" });
	await trigger.click();
	const list = page.getByRole("list", { name: "Pull requests" });
	await expect(list.getByRole("listitem")).toHaveCount(2);
	const open = list.getByRole("button", { name: /#284.*Open/ });
	const merged = list.getByRole("button", { name: /#283.*Merged/ });
	await expect(list.getByRole("button")).toHaveText([/#284.*Open/, /#283.*Merged/]);
	await open.focus();
	await page.keyboard.press("Enter");
	await expect(open).toBeFocused();
	await expect(open).toHaveAttribute("aria-expanded", "true");
	await expect(list.locator('[data-pull-request="284"]')).toContainText("payments-platform/payments");
	await expect(merged).toBeVisible();
	await expect(list.getByRole("link")).toHaveCount(0);
	await merged.click();
	await expect(open).toHaveAttribute("aria-expanded", "false");
	await expect(merged).toHaveAttribute("aria-expanded", "true");
	await expect(list.locator('[data-pull-request="283"]')).toContainText("rovo/pay-999-migration-guide");
	await expect(list.locator('[data-pull-request="284"]')).not.toContainText("payments-platform/payments");
	await merged.click();
	await expect(merged).toHaveAttribute("aria-expanded", "false");
	await page.keyboard.press("Escape");
	await expect(trigger).toBeFocused();
});

test("multiple pull requests appear in the work item's development panel", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Pull request" }).click();
	await page.getByRole("button", { name: "Multiple PRs" }).click();
	await page.locator('[data-butter-gallery-pull-request] [data-slot="jira-issue-card"]').getByText("Improve merchant onboarding for Payments SDK v2", { exact: true }).click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	const development = workItem.getByRole("region", { name: "Pull request development" });
	for (const [number, title, status] of [
		["284", "Add merchant onboarding quickstart", "Open"],
		["283", "Add Payments SDK migration guide", "Merged"],
	] as const) {
		const row = development.getByRole("button", { name: new RegExp(`#${number} ${title} ${status}`) });
		await expect(row).toBeVisible();
		await row.focus();
		await row.press("Enter");
		const details = page.locator(`[data-pull-request="${number}"]`);
		await expect(details).toBeVisible();
		await expect(details).toContainText(title);
		await page.keyboard.press("Escape");
		await expect(row).toBeFocused();
	}
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await page.getByRole("button", { name: "Open PR", exact: true }).click();
	await page.locator('[data-butter-gallery-pull-request] [data-slot="jira-issue-card"]').getByText("Improve merchant onboarding for Payments SDK v2", { exact: true }).click();
	await expect(development.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ })).toBeVisible();
	await expect(development.getByRole("button", { name: /#282/ })).toHaveCount(0);
});

test("kanban pull request previews show read-only details in both PR states", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Pull request" }).click();
	const stage = page.locator("[data-butter-gallery-pull-request]");
	for (const state of ["Open PR", "Merged PR"]) {
		await page.getByRole("group", { name: "Pull request status" }).getByRole("button", { name: state }).click();
		await stage.getByRole("button", { name: /Pull request.*#284/ }).click();
		const preview = page.getByRole("dialog", { name: "Pull request #284 details" });
		await expect(preview).toContainText("#284 Add merchant onboarding quickstart");
		await expect(preview).toContainText("Venn");
		await expect(preview).toContainText(state === "Open PR" ? "Open" : "Merged");
		await expect(preview).toContainText("payments-platform/payments");
		await expect(preview).toContainText("rovo/pay-999-merchant-onboarding");
		await expect(preview).toContainText("6 files");
		await expect(preview.getByRole("button", { name: /builds? passed/ })).toHaveCount(0);
		await expect(preview.getByRole("group", { name: /additions, .* deletions/ })).toBeVisible();
		await page.keyboard.press("Escape");
	}
});

test("Pull request card assigns cloud agents in both PR states", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Pull request" }).click();
	const stage = page.locator("[data-butter-gallery-pull-request]");
	const card = stage.locator('[data-slot="jira-issue-card"]');
	const addAgent = stage.getByRole("button", { name: "Add agent to PAY-999" });
	for (const status of ["Open PR", "Merged PR"]) {
		await page.getByRole("button", { name: "Reset", exact: true }).click();
		await page.getByRole("group", { name: "Pull request status" }).getByRole("button", { name: status }).click();
		await card.hover();
		await expect(addAgent).toBeVisible();
		await addAgent.click();
		const picker = page.getByRole("dialog", { name: "Agents" });
		const cursor = picker.getByRole("button", { name: "Cursor", exact: true });
		await cursor.click();
		await expect(picker).toBeHidden();
		await expect(stage.getByRole("button", { name: status === "Open PR" ? /^2 agents:/ : /^Cursor:/ })).toBeVisible();
	}
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await addAgent.focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents" });
	await picker.getByRole("button", { name: "Cursor", exact: true }).click();
	await expect(picker).toBeHidden();
	await expect(stage.getByRole("button", { name: /^2 agents:/ })).toBeVisible();
});

test("Pull request tile opens the PAY-999 work item with its PR", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Board" }).click();
	const boardCard = page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-999"] [data-slot="jira-issue-card"]');
	await expect(boardCard).toBeVisible();
	const boardCardBounds = await boardCard.boundingBox();
	await gallery.getByRole("button", { name: "Select Pull request" }).click();
	const stage = page.locator("[data-butter-gallery-pull-request]");
	await expect(stage.locator("[data-jira-kanban-column]")).toHaveCount(0);
	const card = stage.locator('[data-slot="jira-issue-card"]');
	await expect(card).toHaveCount(1);
	await expect(card).toContainText("PAY-999");
	const stageBounds = await stage.boundingBox();
	const cardBounds = await card.boundingBox();
	if (!stageBounds || !cardBounds || !boardCardBounds) throw new Error("Pull request or board card has no bounds");
	expect(cardBounds.width).toBe(boardCardBounds.width);
	expect(cardBounds.height).toBe(boardCardBounds.height);
	expect(Math.abs((stageBounds.x + stageBounds.width / 2) - (cardBounds.x + cardBounds.width / 2))).toBeLessThan(2);
	await expect(card).toContainText("Improve merchant onboarding for Payments SDK v2");
	await expect(card.getByText("Improve merchant onboarding for Payments SDK v2", { exact: true })).toHaveCSS("-webkit-line-clamp", "2");
	const pullRequest = card.getByRole("button", { name: /Pull request.*#284/ });
	await expect(pullRequest).toBeVisible();
	await pullRequest.click();
	await expect(page.getByText("Add merchant onboarding quickstart", { exact: false }).first()).toBeVisible();
	await page.keyboard.press("Escape");
	await card.getByText("Improve merchant onboarding for Payments SDK v2", { exact: true }).click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	await expect(workItem.getByRole("region", { name: "Work item full screen view" })).toBeVisible();
	await expect(workItem.getByRole("button", { name: "Collapse work item" })).toHaveCount(0);
	await expect(workItem.getByRole("heading", { name: "Improve merchant onboarding for Payments SDK v2" })).toBeVisible();
	await expect(workItem.getByText("Agents", { exact: true })).toBeVisible();
	await expect(workItem.getByRole("region", { name: "Pull request development" })).toContainText("Add merchant onboarding quickstart");
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(workItem).toBeHidden();
	await expect(card).toBeVisible();
	const statuses = page.getByRole("group", { name: "Pull request status" });
	await expect(statuses.getByRole("button", { name: "Open PR" })).toHaveAttribute("aria-pressed", "true");
	await statuses.getByRole("button", { name: "Merged PR" }).click();
	await expect(statuses.getByRole("button", { name: "Merged PR" })).toHaveAttribute("aria-pressed", "true");
	await expect(card.getByRole("button", { name: /Pull request merged.*#284/ })).toBeVisible();
	await card.getByText("Improve merchant onboarding for Payments SDK v2", { exact: true }).click();
	await expect(workItem.getByRole("region", { name: "Pull request development" })).toContainText("Merged");
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await gallery.getByRole("button", { name: "Select Board" }).click();
	await gallery.getByRole("button", { name: "Select Pull request" }).click();
	await expect(statuses.getByRole("button", { name: "Merged PR" })).toHaveAttribute("aria-pressed", "true");
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(statuses.getByRole("button", { name: "Open PR" })).toHaveAttribute("aria-pressed", "true");
});

test("pull request controls and card fit a narrow viewport", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Pull request" }).click();
	const statuses = page.getByRole("group", { name: "Pull request status" });
	await expect(statuses.getByRole("button", { name: "Open PR" })).toBeVisible();
	await statuses.getByRole("button", { name: "Merged PR" }).click();
	await expect(page.locator('[data-butter-gallery-pull-request] [data-slot="jira-issue-card"]')).toBeVisible();
	await statuses.getByRole("button", { name: "Multiple PRs" }).click();
	await page.getByRole("button", { name: "Pull requests for PAY-999" }).click();
	await page.getByRole("list", { name: "Pull requests" }).getByRole("button", { name: /#284/ }).click();
	await expect(page.getByRole("list", { name: "Pull requests" }).getByRole("button", { name: /#284/ })).toHaveAttribute("aria-expanded", "true");
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
