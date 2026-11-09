import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const JOURNEY_STEPS = ["Prepare & invoke", "In progress", "Pull request", "Fix checks", "Done"] as const;
type JourneyStep = (typeof JOURNEY_STEPS)[number];

const journeyCard = (page: Page) => page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
const journeyItem = (page: Page) => page.getByRole("dialog", { name: "Project butter" });
const wideStep = (page: Page, name: JourneyStep) => page.getByRole("group", { name: "Merchant onboarding journey steps", includeHidden: true }).getByRole("button", { name, exact: true, includeHidden: true });

async function openMerchantJourney(page: Page) {
	await page.goto(appUrl("/butter"));
	await expect(journeyCard(page)).toBeVisible({ timeout: 30_000 });
}

async function closeJourneyItem(page: Page) {
	const item = journeyItem(page);
	if (await item.isVisible()) await item.getByRole("button", { name: "Close Project butter work item" }).click();
}

async function jumpToWideStep(page: Page, name: JourneyStep) {
	await closeJourneyItem(page);
	await wideStep(page, name).click();
	await expect(wideStep(page, name)).toHaveAttribute("aria-pressed", "true");
}

async function expectJourneyStage(page: Page, name: JourneyStep) {
	const card = journeyCard(page);
	const item = journeyItem(page);
	const early = name === "Prepare & invoke";
	const status = name === "Done" ? "Done" : early ? "To do" : "In progress";
	await expect(card).toHaveAttribute("data-board-column-title", status);
	if (name === "In progress" || name === "Pull request" || name === "Done") {
		await expect(item).toBeHidden();
		if (name === "Pull request") await expect(card.getByRole("button", { name: /Pull request #284/ })).toBeVisible();
		await card.locator('[data-slot="jira-issue-card"]').click();
	} else await expect(item).toBeVisible();
	await expect(item.getByRole("button", { name: `Change status in details, ${status}`, exact: true })).toBeVisible();
	if (name !== "Prepare & invoke") await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	const development = item.getByRole("region", { name: "Pull request development" });
	const activity = item.getByRole("region", { name: "Activity" });
	const entries = activity.locator("[data-jira-activity-entry-id]");
	if (name === "Prepare & invoke" || name === "In progress") {
		await expect(development).toHaveCount(0);
		await expect(card.getByRole("button", { name: /Pull request.*#284/, includeHidden: true })).toHaveCount(0);
		await expect(entries.getByText(/opened #284: Add merchant onboarding quickstart/)).toHaveCount(0);
	} else {
		await expect(development).toHaveAttribute("data-project-butter-development", name === "Done" ? "merged" : name === "Fix checks" ? "failed" : "pr");
		await expect(entries.getByText(/opened #284: Add merchant onboarding quickstart/)).toBeVisible();
		await expect(card.getByRole("button", { name: name === "Done" ? /Pull request merged #284/ : /Pull request (?:failed )?#284/, includeHidden: true })).toHaveCount(1);
	}
	if (name === "Done") {
		await expect(entries.getByText(/merged\. PAY-999 is ready for the Done column/)).toBeVisible();
		await expect(item.getByRole("button", { name: /^Claude: Finished/ })).toBeVisible();
	} else {
		await expect(entries.getByText(/merged\. PAY-999 is ready for the Done column/)).toHaveCount(0);
		if (name !== "Fix checks") {
			await expect(entries.getByText(/pushed a fix/)).toHaveCount(0);
			await expect(entries.getByText(/checks passed after the fix/)).toHaveCount(0);
		}
	}
	if (early) await expect(item.locator('[data-jira-activity-entry-id^="invocation-"]')).toHaveCount(0);
	else await expect(activity).toContainText("Venn");
}

test("Pull request begins on the board and reveals the PR before opening the work item", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await openMerchantJourney(page);
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await wideStep(page, "Pull request").click();
	await expect(page.getByRole("tab", { name: "Board", exact: true })).toHaveAttribute("aria-selected", "true");
	await expect(journeyItem(page)).toBeHidden();
	const card = journeyCard(page);
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card.getByRole("button", { name: /Pull request #284/ })).toBeVisible();
	await card.locator('[data-slot="jira-issue-card"]').click();
	await expect(journeyItem(page).getByRole("region", { name: "Pull request development" })).toHaveAttribute("data-project-butter-development", "pr");
});

test("pull request flyouts link the title without linking the number", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	await wideStep(page, "Pull request").click();
	await journeyCard(page).locator('[data-slot="jira-issue-card"]').click();
	const development = journeyItem(page).getByRole("region", { name: "Pull request development" });
	await development.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ }).click();
	const flyout = page.getByRole("group", { name: "Pull request #284: Add merchant onboarding quickstart" });
	const title = flyout.getByRole("link", { name: "Add merchant onboarding quickstart", exact: true });
	await expect(title).toHaveAttribute("href", "https://github.com/payments-platform/payments/pull/284");
	await expect(flyout.getByText("#284", { exact: true }).locator("xpath=ancestor::a")).toHaveCount(0);
	await title.hover();
	await expect(title).toHaveCSS("text-decoration-line", "underline");
	await title.focus();
	await expect(title).toBeFocused();
	await page.keyboard.press("Escape");
	await closeJourneyItem(page);
	await page.locator('[data-issue-key="PAY-119"][data-board-column-title]').getByRole("button", { name: "Pull request #1880: Publish rollback guide" }).click();
	const boardFlyout = page.getByRole("group", { name: "Pull request #1880: Publish rollback guide" });
	await expect(boardFlyout.getByRole("link", { name: "Publish rollback guide", exact: true })).toHaveAttribute("href", "https://github.com/payments-platform/payments/pull/1880");
	await expect(boardFlyout.getByText("#1880", { exact: true }).locator("xpath=ancestor::a")).toHaveCount(0);
});

for (const [step, destination] of [["In progress", "In progress"], ["Done", "Done"]] as const) {
	test(`${step} traces the card border after its arrival`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await openMerchantJourney(page);
		const trace = page.locator(`[data-issue-drop-trace][data-board-column-title="${destination}"]`);
		for (let replay = 0; replay < 2; replay++) {
			await wideStep(page, step).click();
			await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", destination);
			await expect(trace).toHaveCount(1, { timeout: 10_000 });
			await expect(trace.locator("g rect[stroke]")).toHaveAttribute("stroke", destination === "Done" ? /--ds-border-success/ : /--ds-border-bold/);
			await expect(page.locator('[data-issue-drop-flight="PAY-999"]')).toHaveCount(0);
			await expect(trace).toHaveCount(0, { timeout: 10_000 });
		}
	});
}

for (const [step, source, destination] of [["In progress", "To do", "In progress"], ["Done", "In progress", "Done"]] as const) {
	test(`${step} fades out at the source and fades in at the destination on replay`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await openMerchantJourney(page);
		const flight = page.locator('[data-issue-drop-flight="PAY-999"]');
		const button = wideStep(page, step);
		await button.click();
		await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", destination);
		await expect(flight).toHaveCount(0, { timeout: 10_000 });
		await page.evaluate(({ target, sourceColumn, nextCode }) => {
			const columns: string[] = [];
			const positions: number[] = [];
			let nextStart: number | undefined;
			const start = performance.now();
			const record = () => {
				const column = document.querySelector<HTMLElement>('[data-issue-key="PAY-999"][data-board-column-title]')?.dataset.boardColumnTitle;
				if (column && columns.at(-1) !== column) columns.push(column);
				document.documentElement.dataset.journeyReplayColumns = JSON.stringify(columns);
			};
			new MutationObserver(record).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-board-column-title"] });
			record();
			function sample(now: number) {
				const moving = document.querySelector<HTMLElement>('[data-issue-drop-flight="PAY-999"]');
				const next = document.querySelector<HTMLElement>(`[data-issue-key="${nextCode}"][data-board-column-title="${sourceColumn}"] [data-slot="jira-issue-surface"]`);
				if (moving) {
					const style = getComputedStyle(moving);
					const transform = new DOMMatrixReadOnly(style.transform);
					positions.push(transform.m41);
					if (next && moving.firstElementChild) {
						const nextTop = next.getBoundingClientRect().top;
						const gap = nextTop - moving.firstElementChild.getBoundingClientRect().bottom;
						nextStart ??= nextTop;
						document.documentElement.dataset.journeyReplaySourceGap = String(Math.min(Number(document.documentElement.dataset.journeyReplaySourceGap ?? Infinity), gap));
					}
					document.documentElement.dataset.journeyReplayTravel = String(Math.max(...positions) - Math.min(...positions));
					if (Number(style.opacity) < 0.9 && transform.a < 0.99) document.documentElement.dataset.journeyReplayFadedOut = "true";
					for (const animation of moving.getAnimations()) {
						const frames = animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [];
						const last = frames.at(-1);
						if (typeof last?.transform === "string" && Number(last.opacity) === 0 && new DOMMatrixReadOnly(last.transform).a < 0.99) {
							document.documentElement.dataset.journeyReplayFadedOut = "true";
							document.documentElement.dataset.journeyReplayExitDuration = String(animation.effect?.getTiming().duration);
						}
					}
					const arrival = document.querySelector<HTMLElement>(`[data-issue-key="PAY-999"][data-board-column-title="${target}"] [data-slot="jira-creating-card"]`);
					if (arrival && getComputedStyle(arrival).visibility === "visible" && Number(getComputedStyle(arrival).opacity) > 0.05) document.documentElement.dataset.journeyReplayDuplicate = "true";
				}
				if (!moving && next && nextStart !== undefined) document.documentElement.dataset.journeyReplaySourceShift = String(nextStart - next.getBoundingClientRect().top);
				const arrival = document.querySelector<HTMLElement>(`[data-issue-key="PAY-999"][data-board-column-title="${target}"] [data-slot="jira-creating-card"]`);
				if (!moving && arrival) {
					const style = getComputedStyle(arrival);
					if (style.visibility === "visible" && Number(style.opacity) < 0.9 && new DOMMatrixReadOnly(style.transform).a < 0.99) document.documentElement.dataset.journeyReplayFadedIn = "true";
				}
				if (now - start < 5000) requestAnimationFrame(sample);
			}
			requestAnimationFrame(sample);
		}, { target: destination, sourceColumn: source, nextCode: step === "Done" ? "PAY-105" : "PAY-124" });
		await button.click();
		await expect.poll(async () => JSON.parse((await page.locator("html").getAttribute("data-journey-replay-columns")) ?? "[]")).toContain(source);
		await expect(page.locator("html")).toHaveAttribute("data-journey-replay-faded-out", "true");
		await expect(page.locator("html")).toHaveAttribute("data-journey-replay-faded-in", "true");
		await expect.poll(async () => Number(await page.locator("html").getAttribute("data-journey-replay-source-shift"))).toBeGreaterThan(20);
		expect(Number(await page.locator("html").getAttribute("data-journey-replay-source-gap"))).toBeGreaterThanOrEqual(-2);
		expect(Number(await page.locator("html").getAttribute("data-journey-replay-exit-duration"))).toBeGreaterThanOrEqual(350);
		expect(Number(await page.locator("html").getAttribute("data-journey-replay-travel"))).toBeLessThan(1);
		await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", destination);
		await expect(flight).toHaveCount(0, { timeout: 10_000 });
		await expect(page.locator("html")).not.toHaveAttribute("data-journey-replay-duplicate", "true");
	});
}

test("replayed steps settle immediately when reduced motion is enabled", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	for (const [step, column] of [["In progress", "In progress"], ["Done", "Done"], ["Done", "Done"]] as const) {
		await wideStep(page, step).click();
		await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", column);
		await expect(page.locator('[data-issue-drop-flight="PAY-999"]')).toHaveCount(0);
		await expect(page.locator("[data-issue-drop-trace]")).toHaveCount(0);
	}
});

test("changing journey steps during a replay settles on the latest selection", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await openMerchantJourney(page);
	await wideStep(page, "In progress").click();
	await wideStep(page, "Done").click();
	await wideStep(page, "In progress").click();
	await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", "In progress");
	await expect(page.locator('[data-issue-drop-flight="PAY-999"]')).toHaveCount(0, { timeout: 10_000 });
	await expect(wideStep(page, "In progress")).toHaveAttribute("aria-pressed", "true");
	await wideStep(page, "Done").click();
	await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", "Done");
});

test("PAY-999 travels from suggestions through Claude's repaired and merged PR", async ({ page }) => {
	test.setTimeout(90_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	const step = (name: JourneyStep) => wideStep(page, name);
	await expect(step("Prepare & invoke")).toHaveAttribute("aria-pressed", "true");
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const activity = item.getByRole("region", { name: "Activity" });
	const initialDevelopment = item.getByRole("region", { name: "Development" });
	await initialDevelopment.getByRole("button", { name: "Configure", exact: true }).click();
	await expect(page.getByRole("menuitemcheckbox", { name: "Auto-fix" })).toHaveAttribute("aria-checked", "true");
	await expect(page.getByRole("menuitemcheckbox", { name: "Merge when ready" })).toHaveAttribute("aria-checked", "true");
	await page.keyboard.press("Escape");
	await expect(activity.getByRole("heading", { name: "Activity" })).toBeVisible();
	await expect(item.getByRole("tablist", { name: "Activity views" })).toHaveCount(0);
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	await page.getByRole("button", { name: "Close suggestions" }).click();
	await expect(step("Prepare & invoke")).toHaveAttribute("aria-pressed", "true");
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(activity).toContainText("updated description");
	await item.getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("dialog", { name: "Add agent", exact: true }).getByRole("button", { name: "Claude", exact: true }).click();
	await expect(activity).toContainText("Venn added Claude and self-assigned the issue");
	await expect(activity.locator('[data-jira-activity-entry-id^="merchant-agent-added-"]')).toHaveCount(1);
	const acknowledgment = activity.locator('[data-jira-activity-entry-id^="merchant-started-"]');
	await expect(acknowledgment).toHaveCount(1);
	await expect(acknowledgment).toContainText("Claude");
	await expect(acknowledgment).toContainText("I'm looking into this issue now. I'll report back here with updates as I make progress.");
	await expect(activity.getByRole("button", { name: /automatically assigned this work item/ })).toHaveCount(0);
	await expect(activity).toContainText("Claude");
	await expect(step("Prepare & invoke")).toHaveAttribute("aria-pressed", "true");
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await expect(step("Prepare & invoke")).toHaveAttribute("aria-pressed", "true");
	await step("Pull request").click();
	await expect(step("Pull request")).toHaveAttribute("aria-pressed", "true");
	await expect(card.getByRole("button", { name: /Pull request #284/ })).toBeVisible();
	await expect(item).toBeHidden();
	await card.locator('[data-slot="jira-issue-card"]').click();
	const development = item.getByRole("region", { name: "Pull request development" });
	await expect(development.getByRole("button", { name: /0\/3 builds passed.*checks running/ })).toBeVisible();
	await development.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ }).click();
	const prFlyout = page.locator('[data-slot="popover-content"]').filter({ hasText: "payments-platform/payments" });
	await expect(prFlyout).toBeVisible();
	await expect(prFlyout.getByRole("group", { name: "Claude, used by Venn" })).toBeVisible();
	await expect(prFlyout.getByRole("button", { name: /0\/3 builds passed/ })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("opened #284: Add merchant onboarding quickstart");
	await development.getByRole("button", { name: "Configure", exact: true }).click();
	await expect(page.getByRole("menuitemcheckbox", { name: "Auto-fix" })).toHaveAttribute("aria-checked", "true");
	await expect(page.getByRole("menuitemcheckbox", { name: "Merge when ready" })).toHaveAttribute("aria-checked", "true");
	await page.keyboard.press("Escape");
	await expect(development.getByRole("button", { name: "Complete checks" })).toHaveCount(0);
	await jumpToWideStep(page, "Fix checks");
	await expect(development).toHaveAttribute("data-ci-status", "failed");
	await expect(step("Fix checks")).toHaveAttribute("aria-pressed", "true");
	await expect(development).toHaveAttribute("data-project-butter-development", "fixing", { timeout: 10_000 });
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("pushed a fix");
	await expect(development).toHaveAttribute("data-project-butter-development", "merged", { timeout: 15_000 });
	await expect(step("Fix checks")).toHaveAttribute("aria-pressed", "true");
	await expect(item.getByRole("button", { name: /^Claude: Finished/ })).toBeVisible();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "Done");
	await expect(card.getByRole("button", { name: /Pull request merged #284/ })).toBeVisible();
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(step("Prepare & invoke")).toHaveAttribute("aria-pressed", "true");
	await expect(card).toHaveAttribute("data-board-column-title", "To do");
});

test("disabled automations leave the failed and passed checks for manual action", async ({ page }) => {
	test.setTimeout(60_000);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	const card = page.locator('[data-issue-key="PAY-999"][data-board-column-title]');
	await card.locator('[data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("dialog", { name: "Add agent", exact: true }).getByRole("button", { name: "Claude", exact: true }).click();
	await item.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(card).toHaveAttribute("data-board-column-title", "In progress");
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	await expect(card.getByRole("button", { name: /Pull request #284/ })).toBeVisible();
	await card.locator('[data-slot="jira-issue-card"]').click();
	const development = item.getByRole("region", { name: "Pull request development" });
	await development.getByRole("button", { name: "Configure", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Auto-fix" }).click();
	await page.getByRole("menuitemcheckbox", { name: "Merge when ready" }).click();
	await page.keyboard.press("Escape");
	await expect(development.getByRole("button", { name: "Complete checks" })).toHaveCount(0);
	await jumpToWideStep(page, "Fix checks");
	await expect(development).toHaveAttribute("data-project-butter-development", "failed");
	await page.waitForTimeout(5500);
	await expect(development).toHaveAttribute("data-project-butter-development", "failed");
	await expect(development.getByRole("button", { name: "Fix accessibility check" })).toHaveCount(0);
	await development.getByRole("button", { name: /#284 Add merchant onboarding quickstart/ }).click();
	const failedFlyout = page.locator('[data-slot="popover-content"]').filter({ hasText: "payments-platform/payments" });
	await expect(failedFlyout.getByRole("button", { name: "Review" })).toBeEnabled();
	await failedFlyout.getByRole("button", { name: "Fix PR" }).click();
	await page.keyboard.press("Escape");
	await expect(development).toHaveAttribute("data-project-butter-development", "passed", { timeout: 10_000 });
	await page.waitForTimeout(5500);
	await expect(development).toHaveAttribute("data-project-butter-development", "passed");
	await expect(development.getByRole("button", { name: "Merge pull request" })).toBeVisible();
	await development.getByRole("button", { name: "Merge pull request" }).click();
	await expect(development).toHaveAttribute("data-project-butter-development", "merged");
});

test("the board PR flyout shows Venn, Claude, repository and current checks", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	await jumpToWideStep(page, "Pull request");
	await closeJourneyItem(page);
	const pr = journeyCard(page).getByRole("button", { name: /Pull request #284/ });
	await pr.click();
	const author = page.getByRole("group", { name: "Claude, used by Venn" });
	await expect(author).toBeVisible();
	await expect(page.getByText("payments-platform/payments", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: /0\/3 builds passed/ })).toBeVisible();
	const gap = await author.evaluate((element) => {
		const label = element.nextElementSibling;
		return label ? label.getBoundingClientRect().left - element.getBoundingClientRect().right : null;
	});
	expect(gap).toBe(6);
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
	await journeyCard(page).locator('[data-slot="jira-issue-card"]').click();
	const item = journeyItem(page);
	const editor = item.getByRole("textbox", { name: "Comment editor" });
	await page.keyboard.press("m");
	await editor.pressSequentially("@Claude");
	await page.getByRole("option", { name: /^Claude / }).first().click();
	await editor.pressSequentially(" Keep the sandbox migration note in this draft");
	await jumpToWideStep(page, "Done");
	await expectJourneyStage(page, "Done");
	await jumpToWideStep(page, "Prepare & invoke");
	await expectJourneyStage(page, "Prepare & invoke");
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
});

test("compact controls jump to every stage and support previous, next, and reset", async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 760, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openMerchantJourney(page);
	const picker = page.getByRole("button", { name: "Jump to step", exact: true, includeHidden: true });
	const previous = page.getByRole("button", { name: "Previous step", exact: true });
	const next = page.getByRole("button", { name: "Next step", exact: true });
	await expect(picker).toHaveText("Prepare & invoke");
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
	await page.getByRole("menuitem", { name: "Prepare & invoke", exact: true }).click();
	await expect(picker).toHaveText("Prepare & invoke");
	await expect(journeyItem(page)).toBeVisible();
	await page.waitForTimeout(5500);
	await expect(picker).toHaveText("Prepare & invoke");
	await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", "To do");
	await expect(journeyItem(page).getByRole("region", { name: "Activity" }).getByText(/pushed a fix|merged\. PAY-999 is ready for the Done column/)).toHaveCount(0);
	await closeJourneyItem(page);
	await next.click();
	await expect(picker).toHaveText("In progress");
	await closeJourneyItem(page);
	await picker.click();
	await page.getByRole("menuitem", { name: "Pull request", exact: true }).click();
	await expect(picker).toHaveText("Pull request");
	await expect(journeyItem(page)).toBeHidden();
	await expect(journeyCard(page).getByRole("button", { name: /Pull request #284/ })).toBeVisible();
	await journeyCard(page).locator('[data-slot="jira-issue-card"]').click();
	await expect(journeyItem(page).getByRole("region", { name: "Pull request development" })).toHaveAttribute("data-project-butter-development", "pr");
	await closeJourneyItem(page);
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(picker).toHaveText("Prepare & invoke");
	await expect(previous).toBeDisabled();
	await expect(next).toBeEnabled();
	await expect(journeyCard(page)).toHaveAttribute("data-board-column-title", "To do");
	await expect(journeyCard(page).getByRole("button", { name: /Pull request.*#284/ })).toHaveCount(0);
});
