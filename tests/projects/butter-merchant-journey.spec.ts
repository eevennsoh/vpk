import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const JOURNEY_STEPS = ["Prepare", "Invoke", "In progress", "Pull request", "Fix checks", "Done"] as const;
type JourneyStep = (typeof JOURNEY_STEPS)[number];

const journeyCard = (page: Page) => page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
const journeyItem = (page: Page) => page.getByRole("dialog", { name: "Project butter" });
const wideStep = (page: Page, name: JourneyStep) => page.getByRole("group", { name: "Merchant onboarding journey steps" }).getByRole("button", { name, exact: true });

async function openMerchantJourney(page: Page) {
	await page.goto(appUrl("/butter"));
	await expect(journeyCard(page)).toBeVisible({ timeout: 30_000 });
}

async function closeJourneyItem(page: Page) {
	const item = journeyItem(page);
	if (await item.isVisible()) await item.getByRole("button", { name: "Close Project butter work item" }).click();
}

async function jumpToWideStep(page: Page, name: JourneyStep) {
	await wideStep(page, name).click();
	await expect(wideStep(page, name)).toHaveAttribute("aria-pressed", "true");
}

async function expectJourneyStage(page: Page, name: JourneyStep) {
	const card = journeyCard(page);
	const item = journeyItem(page);
	const early = name === "Prepare" || name === "Invoke";
	const status = name === "Done" ? "Done" : early ? "To do" : "In progress";
	await expect(card).toHaveAttribute("data-board-column-title", status);
	if (name === "In progress" || name === "Done") {
		await expect(item).toBeHidden();
		await card.locator('[data-slot="jira-issue-card"]').click();
	} else await expect(item).toBeVisible();
	await expect(item.getByRole("button", { name: `Change status in details, ${status}`, exact: true })).toBeVisible();
	if (name !== "Prepare") await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	const development = item.getByRole("region", { name: "Pull request development" });
	const activity = item.getByRole("region", { name: "Activity" });
	const entries = activity.locator("[data-jira-activity-entry-id]");
	if (name === "Prepare" || name === "Invoke" || name === "In progress") {
		await expect(development).toHaveCount(0);
		await expect(card.getByRole("button", { name: /Pull request.*#284/, includeHidden: true })).toHaveCount(0);
		await expect(entries.getByText(/opened PR #284/)).toHaveCount(0);
	} else {
		await expect(development).toHaveAttribute("data-project-butter-development", name === "Done" ? "merged" : name === "Fix checks" ? "failed" : "pr");
		await expect(entries.getByText(/opened PR #284/)).toBeVisible();
		await expect(card.getByRole("button", { name: name === "Done" ? /Pull request merged #284/ : /Pull request #284/, includeHidden: true })).toHaveCount(1);
	}
	if (name === "Done") {
		await expect(entries.getByText(/PR #284 merged/)).toBeVisible();
		await expect(item.getByRole("button", { name: "Finished, open Claude chat" })).toBeVisible();
	} else {
		await expect(entries.getByText(/PR #284 merged/)).toHaveCount(0);
		if (name !== "Fix checks") {
			await expect(entries.getByText(/pushed a fix/)).toHaveCount(0);
			await expect(entries.getByText(/checks passed after the fix/)).toHaveCount(0);
		}
	}
	if (early) await expect(item.locator('[data-jira-activity-entry-id^="invocation-"]')).toHaveCount(0);
	else await expect(activity).toContainText("Venn");
}

test("PAY-999 travels from suggestions through Claude's repaired and merged PR", async ({ page }) => {
	test.setTimeout(90_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	const step = (name: JourneyStep) => wideStep(page, name);
	await expect(step("Prepare")).toHaveAttribute("aria-pressed", "true");
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const activity = item.getByRole("region", { name: "Activity" });
	await expect(activity.getByRole("heading", { name: "Activity" })).toBeVisible();
	await expect(item.getByRole("tablist", { name: "Activity views" })).toHaveCount(0);
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect(step("Invoke")).toHaveAttribute("aria-pressed", "true");
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(activity).toContainText("updated description");
	await item.getByRole("button", { name: /\. Add agent$/ }).click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	await page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" }).click();
	await expect(activity).toContainText("Venn added Claude and self-assigned the issue");
	await expect(activity.locator('[data-jira-activity-entry-id^="merchant-agent-added-"]')).toHaveCount(1);
	await expect(activity.getByRole("button", { name: /automatically assigned this work item/ })).toHaveCount(0);
	await expect(activity).toContainText("Claude");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(step("In progress")).toHaveAttribute("aria-pressed", "true");
	await step("Pull request").click();
	await expect(step("Pull request")).toHaveAttribute("aria-pressed", "true");
	await expect(card.getByRole("button", { name: /Pull request #284/ })).toBeVisible();
	const development = item.getByRole("region", { name: "Pull request development" });
	await expect(development).toContainText("Checks running");
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("opened PR #284");
	await development.getByRole("button", { name: /CI checks and automation/ }).click();
	await expect(page.getByRole("menuitemcheckbox", { name: /Auto-fix/ })).toHaveAttribute("aria-checked", "true");
	await expect(page.getByRole("menuitemcheckbox", { name: /Auto-merge/ })).toHaveAttribute("aria-checked", "true");
	await page.keyboard.press("Escape");
	await development.getByRole("button", { name: "Complete checks" }).click();
	await expect(development).toHaveAttribute("data-ci-status", "failed");
	await expect(step("Fix checks")).toHaveAttribute("aria-pressed", "true");
	await expect(development).toHaveAttribute("data-project-butter-development", "fixing", { timeout: 10_000 });
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("pushed a fix");
	await expect(development).toHaveAttribute("data-project-butter-development", "merged", { timeout: 15_000 });
	await expect(step("Done")).toHaveAttribute("aria-pressed", "true");
	await expect(item.getByRole("button", { name: "Finished, open Claude chat" })).toBeVisible();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "Done");
	await expect(card.getByRole("button", { name: /Pull request merged #284/ })).toBeVisible();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(step("Prepare")).toHaveAttribute("aria-pressed", "true");
	await expect(card).toHaveAttribute("data-board-column-title", "To do");
});

test("disabled automations leave the failed and passed checks for manual action", async ({ page }) => {
	test.setTimeout(60_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /\. Add agent$/ }).click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	await page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" }).click();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	const development = item.getByRole("region", { name: "Pull request development" });
	await development.getByRole("button", { name: /CI checks and automation/ }).click();
	await page.getByRole("menuitemcheckbox", { name: /Auto-fix/ }).click();
	await page.getByRole("menuitemcheckbox", { name: /Auto-merge/ }).click();
	await page.keyboard.press("Escape");
	await development.getByRole("button", { name: "Complete checks" }).click();
	await expect(development).toHaveAttribute("data-project-butter-development", "failed");
	await page.waitForTimeout(5500);
	await expect(development).toHaveAttribute("data-project-butter-development", "failed");
	await expect(development.getByRole("button", { name: "Fix accessibility check" })).toBeVisible();
	await development.getByRole("button", { name: "Fix accessibility check" }).click();
	await expect(development).toHaveAttribute("data-project-butter-development", "passed", { timeout: 10_000 });
	await page.waitForTimeout(5500);
	await expect(development).toHaveAttribute("data-project-butter-development", "passed");
	await expect(development.getByRole("button", { name: "Merge pull request" })).toBeVisible();
	await development.getByRole("button", { name: "Merge pull request" }).click();
	await expect(development).toHaveAttribute("data-project-butter-development", "merged");
});

for (const step of JOURNEY_STEPS) test(`a fresh journey can jump directly to ${step}`, async ({ page }) => {
	test.setTimeout(60_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	for (const name of JOURNEY_STEPS) await expect(wideStep(page, name)).toBeEnabled();
	await jumpToWideStep(page, step);
	await expectJourneyStage(page, step);
});

test("backward and forward jumps remove future activity and keep the comment draft", async ({ page }) => {
	test.setTimeout(90_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	await jumpToWideStep(page, "Pull request");
	const item = journeyItem(page);
	const editor = item.getByRole("textbox", { name: "Comment editor" });
	await page.keyboard.press("m");
	await editor.pressSequentially("@Claude");
	await page.getByRole("option", { name: /^Claude / }).first().click();
	await editor.pressSequentially(" Keep the sandbox migration note in this draft");
	await jumpToWideStep(page, "Done");
	await expectJourneyStage(page, "Done");
	await jumpToWideStep(page, "Prepare");
	await expectJourneyStage(page, "Prepare");
	await page.keyboard.press("m");
	await expect(editor).toContainText("Keep the sandbox migration note in this draft");
	await expect(editor.locator('[data-mention-category="subagent"]')).toHaveText("Claude");
	await jumpToWideStep(page, "Pull request");
	await expectJourneyStage(page, "Pull request");
	await page.keyboard.press("m");
	await expect(editor).toContainText("Keep the sandbox migration note in this draft");
	await expect(editor.locator('[data-mention-category="subagent"]')).toHaveText("Claude");
	await expect(item.getByRole("option", { name: "Continue in existing session" })).toBeVisible();
	await jumpToWideStep(page, "In progress");
	await expectJourneyStage(page, "In progress");
	await jumpToWideStep(page, "Invoke");
	await expectJourneyStage(page, "Invoke");
});

test("compact controls jump to every stage and support previous, next, and reset", async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 760, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	const picker = page.getByRole("button", { name: "Jump to step", exact: true });
	const previous = page.getByRole("button", { name: "Previous step", exact: true });
	const next = page.getByRole("button", { name: "Next step", exact: true });
	await expect(picker).toHaveText("Prepare");
	await expect(previous).toBeDisabled();
	await expect(next).toBeEnabled();
	await picker.click();
	for (const name of JOURNEY_STEPS) await expect(page.getByRole("menuitem", { name, exact: true })).toBeEnabled();
	await page.getByRole("menuitem", { name: "Done", exact: true }).click();
	await expect(picker).toHaveText("Done");
	await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", "Done");
	await expect(next).toBeDisabled();
	await expect(previous).toBeEnabled();
	await previous.click();
	await expect(picker).toHaveText("Fix checks");
	await expect(journeyItem(page).getByRole("region", { name: "Pull request development" })).toHaveAttribute("data-project-butter-development", "failed");
	await closeJourneyItem(page);
	await next.click();
	await expect(picker).toHaveText("Done");
	await picker.click();
	await page.getByRole("menuitem", { name: "Prepare", exact: true }).click();
	await expect(picker).toHaveText("Prepare");
	await expect(journeyItem(page)).toBeVisible();
	await page.waitForTimeout(5500);
	await expect(picker).toHaveText("Prepare");
	await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", "To do");
	await expect(journeyItem(page).getByRole("region", { name: "Activity" }).getByText(/pushed a fix|PR #284 merged/)).toHaveCount(0);
	await closeJourneyItem(page);
	await next.click();
	await expect(picker).toHaveText("Invoke");
	await closeJourneyItem(page);
	await picker.click();
	await page.getByRole("menuitem", { name: "Pull request", exact: true }).click();
	await expect(picker).toHaveText("Pull request");
	await expect(journeyItem(page).getByRole("region", { name: "Pull request development" })).toHaveAttribute("data-project-butter-development", "pr");
	await closeJourneyItem(page);
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(picker).toHaveText("Prepare");
	await expect(previous).toBeDisabled();
	await expect(next).toBeEnabled();
	await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", "To do");
	await expect(journeyCard(page).getByRole("button", { name: /Pull request.*#284/ })).toHaveCount(0);
});
