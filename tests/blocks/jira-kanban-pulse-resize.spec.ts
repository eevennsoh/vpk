import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const JIRA_KANBAN_EXPERIMENTAL_URL = appUrl("/preview/blocks/jira-kanban-demo-experimental");

const JIRA_GOLDEN_JOURNEYS_V3_URL = appUrl("/jira-golden-journeys-v3");

async function openPulseInsights(page: Page) {
	await page.getByRole("button", { name: /^Insights/u }).click();
	await expect(page.getByRole("separator", { name: "Resize insights and work items" })).toBeVisible();
	await expect(page.getByRole("separator", { name: "Resize work items and uncaptured work" })).toHaveCount(0);
}

test("Pulse Insights has one resize handle between the article and the work rail", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_KANBAN_EXPERIMENTAL_URL, { waitUntil: "domcontentloaded" });
	await openPulseInsights(page);

	const insightsHandle = page.getByRole("separator", { name: "Resize insights and work items" });
	const pill = insightsHandle.locator(":scope > div");
	await expect(pill).toHaveCSS("opacity", "0");
	await page.getByRole("heading", { name: "Work items" }).hover();
	await expect(pill).toHaveCSS("opacity", "1");

	const startRailWidth = Number(await insightsHandle.getAttribute("aria-valuenow"));

	await insightsHandle.focus();
	await page.keyboard.press("ArrowLeft");
	await expect.poll(async () => Number(await insightsHandle.getAttribute("aria-valuenow")))
		.toBeGreaterThan(startRailWidth);
});

test("golden journeys v3 Track Insights exposes the article/work-rail resize handle", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_GOLDEN_JOURNEYS_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Track", exact: true }).click();
	await openPulseInsights(page);

	await expect(page.getByRole("heading", { name: "Work items" })).toBeVisible();
	await expect(page.getByText("We agreed to delete the adapter, not wrap it")).toBeVisible();
});

test("golden journeys v3 Track Insights hides the floating Rovo button", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_GOLDEN_JOURNEYS_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Track", exact: true }).click();
	await expect(page.getByRole("button", { name: "Open Rovo chat" })).toBeVisible();

	await openPulseInsights(page);
	await expect(page.getByRole("button", { name: "Open Rovo chat" })).toHaveCount(0);
	await expect(page.getByRole("heading", { name: "Work items" })).toBeVisible();
});

test("golden journeys v3 Track Insights prompt replaces the work rail with embedded chat", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(JIRA_GOLDEN_JOURNEYS_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Track", exact: true }).click();
	await openPulseInsights(page);

	await page.getByRole("button", { name: "What happened outside Jira?" }).click();

	await expect(page.getByRole("heading", { name: "Work items" })).toHaveCount(0);
	const chat = page.getByRole("region", { name: "Agent chat" });
	await expect(chat).toBeVisible();
	await expect(chat.getByText("What happened outside Jira?")).toBeVisible();

	await chat.getByRole("button", { name: "Close" }).click();
	await expect(page.getByRole("heading", { name: "Work items" })).toBeVisible();
	await expect(page.getByRole("region", { name: "Agent chat" })).toHaveCount(0);
});
