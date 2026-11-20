import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("Butter work item keeps its Timeline and drafts instructions from Agent sessions", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const switcher = activity.getByRole("group", { name: "Activity view" });
	const timeline = switcher.getByRole("button", { name: "Timeline" });
	const sessions = switcher.getByRole("button", { name: "Agent sessions" });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	await expect(timeline).toHaveAttribute("aria-pressed", "true");
	await expect(thread.getByText(/Thanks. Let's include both fixes/)).toBeVisible();
	await expect(thread.locator("[data-jira-activity-timeline-stem]")).toBeVisible();
	const composer = page.locator("[data-project-butter-comment-bar]:visible");
	const editor = composer.getByRole("textbox");
	await page.keyboard.press("m");
	await editor.fill("Keep this work-item draft.");

	await sessions.click();
	await expect(activity.getByRole("button", { name: "Using an agent", exact: true })).toHaveAttribute("aria-expanded", "true");
	await expect(activity.getByText(/Visuals are looking strong/).filter({ visible: true })).toHaveCount(0);
	await expect(thread.getByRole("button", { name: /5 replies/ })).toHaveAttribute("aria-expanded", "false");
	const summarize = thread.getByRole("button", { name: "Summarize thread" });
	await summarize.focus();
	await summarize.press("Enter");
	await expect(thread.getByText("Thread summary", { exact: true })).toBeVisible();
	await timeline.click();
	await expect(thread.getByText("Thread summary", { exact: true })).toHaveCount(0);
	await expect(thread.getByText(/Thanks. Let's include both fixes/)).toBeVisible();
	await sessions.click();
	await thread.getByRole("button", { name: "Draft instruction" }).click();

	await expect(editor).toBeFocused();
	await expect(editor).toContainText("error summary");
	await expect(editor).not.toContainText("Keep this work-item draft.");
	await expect(composer.getByTestId("reply-target-chip")).toContainText("Review the onboarding flow");
	await composer.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(thread.getByText(/Follow up on the work-item discussion/)).toBeVisible();
	await expect(thread.getByText("👀", { exact: true })).toBeVisible();
	await expect(thread.getByRole("button", { name: "Working", exact: true })).toBeVisible();
	await page.keyboard.press("m");
	await expect(editor).toContainText("Keep this work-item draft.");
	await composer.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(timeline).toHaveAttribute("aria-pressed", "true");
	await expect(activity.getByText("Keep this work-item draft.", { exact: true })).toBeVisible();
});

test("a Butter board work item can switch to Agent sessions", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	await page.locator('[data-issue-key="PAY-118"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const activity = page.getByRole("dialog", { name: "Project butter" }).getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("button", { name: "Agent sessions", exact: true }).click();
	await expect(activity.getByText("No agent sessions yet", { exact: true })).toBeVisible();
	await activity.getByRole("button", { name: "Timeline", exact: true }).click();
	await expect(activity.getByRole("button", { name: "Timeline", exact: true })).toHaveAttribute("aria-pressed", "true");
});
