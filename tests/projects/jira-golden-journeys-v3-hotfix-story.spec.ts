import { expect, test, type Locator, type Page } from "@playwright/test";

import { probeFocusIndicatorClearance } from "@/tests/helpers/jira-interaction-contracts";
import { appUrl } from "@/tests/helpers/origin";

const JIRA_GOLDEN_JOURNEYS_V3_URL = appUrl("/jira-golden-journeys-v3");

const CHAPTERS = ["Track", "Learn", "Build", "Terminal"] as const;

function chapterButton(page: Page, name: (typeof CHAPTERS)[number]): Locator {
	return page.getByRole("button", {
		exact: true,
		name: name === "Terminal" ? /^Terminal · [1-4] of 4$/u : name,
	});
}

async function openStory(page: Page): Promise<void> {
	await page.goto(JIRA_GOLDEN_JOURNEYS_V3_URL, { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Golden Journeys v3" })).toBeVisible();
	await expect(
		page.getByRole("group", { name: "Open a software delivery story chapter" })
			.or(page.getByRole("button", { name: "Jump to chapter" })),
	).toBeVisible();
}

async function selectChapter(
	page: Page,
	name: (typeof CHAPTERS)[number],
): Promise<void> {
	const button = chapterButton(page, name);
	if (await button.isVisible()) {
		await button.click();
		await expect(button).toHaveAttribute("aria-pressed", "true");
		return;
	}

	const jumpToChapter = page.getByRole("button", { name: "Jump to chapter" });
	const activeLabel = (await jumpToChapter.textContent())?.trim();
	const activeIndex = CHAPTERS.findIndex((chapter) => chapter === activeLabel);
	const targetIndex = CHAPTERS.indexOf(name);
	const direction = targetIndex > activeIndex ? "Next chapter" : "Previous chapter";
	for (let index = 0; index < Math.abs(targetIndex - activeIndex); index += 1) {
		await page.getByRole("button", { name: direction }).click();
	}
	await expect(jumpToChapter).toContainText(name);
}

async function openInsights(page: Page): Promise<void> {
	const insights = page.getByRole("button", {
		name: "Insights, 3 new updates since you last viewed",
	});
	await insights.click();
	await expect(chapterButton(page, "Learn")).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("region", {
		name: "PAY · Payments SDK v2 migration insights",
	})).toBeVisible();
}

test("Track starts the story with a populated SDLC board and four chapters", async ({ page }) => {
	await openStory(page);

	const controls = page.getByRole("group", {
		name: "Open a software delivery story chapter",
	});
	await expect(controls.getByRole("button")).toHaveCount(CHAPTERS.length);
	for (const chapter of CHAPTERS) {
		await expect(chapterButton(page, chapter)).toBeVisible();
	}
	await expect(chapterButton(page, "Track")).toHaveAttribute("aria-pressed", "true");

	const columns = page.locator("[data-jira-kanban-column]");
	await expect(columns).toHaveCount(5);
	for (const column of await columns.all()) {
		await expect(column.locator("[data-variant='default']")).toHaveCount(4);
	}
});

test("the actual Insights control advances Track to Learn and PAY-101 opens Build", async ({ page }) => {
	await openStory(page);
	await openInsights(page);

	const pay101 = page.locator("[data-work-item-key='PAY-101']");
	await expect(pay101.getByRole("button")).toBeVisible();
	await pay101.getByRole("button").click();

	await expect(chapterButton(page, "Build")).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("region", {
		name: "Inventory every v1 call site across services and name an owner for each",
	})).toBeVisible();
	await expect(page.getByText("Call-site inventory across four services", { exact: true }).first()).toBeVisible();
	await expect(page.getByText("8c2f4e1 map 61 v1 call sites and owners", { exact: true }).first()).toBeVisible();
});

test("direct Learn entry clears Track filters and Reset clears child-owned state", async ({ page }) => {
	await openStory(page);
	const diegoFilter = page.getByRole("button", { name: "Filter board by Diego Santos" });
	await diegoFilter.click();
	await expect(diegoFilter).toHaveAttribute("aria-pressed", "true");

	await selectChapter(page, "Learn");
	await expect(page.locator("[data-work-item-key='PAY-101']").getByRole("button")).toBeVisible();

	await page.getByRole("button", { exact: true, name: "Reset" }).click();
	await expect(chapterButton(page, "Track")).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("button", { name: "Filter board by Diego Santos" })).toHaveAttribute("aria-pressed", "false");
});

test("Resume is hover and keyboard discoverable, copies a prompt, and Terminal restores the local session", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: async (text: string) => {
					(window as typeof window & { __resumePrompt?: string }).__resumePrompt = text;
				},
			},
		});
	});
	await openStory(page);
	await openInsights(page);

	const localSession = page.locator('[data-testid="agent-session-row-lw-scope-thread"]');
	const resume = localSession.getByRole("button", { name: "Resume", exact: true });
	await expect(localSession).toBeVisible();
	await expect(resume).toBeHidden();
	await localSession.hover();
	await expect(resume).toBeVisible();
	await resume.click();

	await expect(page.locator("[data-resume-prompt-copied='true']")).toBeVisible();
	await expect(chapterButton(page, "Learn")).toHaveAttribute("aria-pressed", "true");
	const copiedPrompt = await page.evaluate(() => (
		window as typeof window & { __resumePrompt?: string }
	).__resumePrompt);
	expect(copiedPrompt).toBe(
		"cd /Users/venn/dev/payments/.worktrees/pay-101-adapter && claude --resume 338eaaca-62da-4dcb-925b-f2c5f16be5a8",
	);

	await page.locator("[data-work-item-key='PAY-101']").getByRole("button").click();
	await expect(chapterButton(page, "Build")).toHaveAttribute("aria-pressed", "true");
	await selectChapter(page, "Terminal");

	const terminalStory = page.locator("[data-restored-session='PAY-101']");
	await expect(terminalStory).toHaveAttribute("data-prompt-copied", "true");
	await page.getByRole("button", {
		name: "Paste the copied resume prompt for PAY-101",
	}).click();
	await page.keyboard.press("ArrowRight");
	await page.keyboard.press("ArrowRight");
	await expect(terminalStory).toHaveAttribute("data-story-complete", "true");
	await expect(terminalStory).toHaveAttribute("data-restored-artifacts", "available");
	await expect(page.getByText("PR #1839 merged · Call-site inventory across four services · +312 lines", {
		exact: true,
	})).toBeVisible();
});

test("Reset returns the presentation to Track and clears the resume handoff", async ({ page }) => {
	await openStory(page);
	await selectChapter(page, "Terminal");
	await page.getByRole("button", { exact: true, name: "Reset" }).click();

	await expect(chapterButton(page, "Track")).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator("[data-resume-prompt-copied='false']")).toBeVisible();
	await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(5);
});

test("desktop chapter focus indicators stay clear of the header scrollport", async ({ page }) => {
	await openStory(page);
	const result = await probeFocusIndicatorClearance(page, chapterButton(page, "Learn"));
	expect(result.focused).toBe(true);
	expect(result.focusVisible).toBe(true);
	expect(result.visibleIndicator).toBe(true);
	expect(result.clips).toEqual([]);
});

test("compact previous and next controls traverse the same four chapters", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openStory(page);
	const jump = page.getByRole("button", { name: "Jump to chapter" });
	await expect(jump).toContainText("Track");
	await page.getByRole("button", { name: "Next chapter" }).click();
	await expect(jump).toContainText("Learn");
	await page.getByRole("button", { name: "Previous chapter" }).click();
	await expect(jump).toContainText("Track");
});
