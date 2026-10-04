import {
	expect,
	test,
	type Locator,
	type Page,
} from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const JIRA_FOR_YOU_URL = appUrl("/preview/projects/jira-for-you");

function getRow(pageTitle: string, page: Page) {
	return page
		.getByTestId("jira-for-you-feed")
		.getByRole("listitem")
		.filter({ hasText: pageTitle });
}

function getAgentSessionRow(agentName: string, detailRegion: Locator) {
	return detailRegion
		.getByTestId("jira-for-you-agent-section")
		.getByRole("listitem")
		.filter({ hasText: agentName });
}

async function expectLocatorWithinPane(
	locator: Locator,
	pane: Locator,
) {
	const [elementBox, regionBox] = await Promise.all([
		locator.boundingBox(),
		pane.boundingBox(),
	]);

	if (!elementBox || !regionBox) {
		throw new Error("Expected both the conversation region and target element to have bounding boxes.");
	}

	expect(elementBox.x).toBeGreaterThanOrEqual(regionBox.x - 1);
	expect(elementBox.x + elementBox.width).toBeLessThanOrEqual(
		regionBox.x + regionBox.width + 1,
	);
	expect(elementBox.y).toBeGreaterThanOrEqual(regionBox.y - 1);
	expect(elementBox.y + elementBox.height).toBeLessThanOrEqual(
		regionBox.y + regionBox.height + 1,
	);
}

async function expectTabsOnSingleRowBelowHeading(
	page: Page,
) {
	const heading = page.getByRole("heading", { exact: true, level: 2, name: "For you" });
	const tablist = page.getByRole("tablist");
	const tabs = [
		page.getByRole("tab", { name: /^All$/u }),
		page.getByRole("tab", { name: /^Assigned to me 25$/u }),
		page.getByRole("tab", { name: /^Worked on$/u }),
		page.getByRole("tab", { name: /^Viewed$/u }),
	];
	const search = page.getByTestId("jira-for-you-header").locator('[data-slot="input-group"]').first();
	const [headingBox, tablistBox, searchBox, ...tabBoxes] = await Promise.all([
		heading.boundingBox(),
		tablist.boundingBox(),
		search.boundingBox(),
		...tabs.map((tab) => tab.boundingBox()),
	]);

	if (!headingBox || !tablistBox || !searchBox || tabBoxes.some((box) => !box)) {
		throw new Error("Expected the heading, tablist, tabs, and search field to have bounding boxes.");
	}

	const resolvedTabBoxes = tabBoxes as NonNullable<typeof tabBoxes[number]>[];
	expect(Math.abs(tablistBox.y - (headingBox.y + headingBox.height) - 16)).toBeLessThan(2);
	expect(Math.abs(tablistBox.x - searchBox.x)).toBeLessThan(2);
	expect(Math.abs(tablistBox.width - searchBox.width)).toBeLessThan(2);
	for (let i = 1; i < resolvedTabBoxes.length; i += 1) {
		expect(Math.abs(resolvedTabBoxes[i]!.y - resolvedTabBoxes[0]!.y)).toBeLessThan(2);
	}
	const tablistOverflow = await tablist.evaluate((element) => ({
		clientWidth: element.clientWidth,
		scrollWidth: element.scrollWidth,
	}));
	expect(tablistOverflow.scrollWidth).toBeGreaterThanOrEqual(tablistOverflow.clientWidth);
	expect(searchBox.y).toBeGreaterThan(tablistBox.y + tablistBox.height - 2);
}

async function expectWideHeaderAlignment(page: Page) {
	const heading = page.getByRole("heading", { exact: true, level: 2, name: "For you" });
	const tablist = page.getByRole("tablist");
	const search = page.getByTestId("jira-for-you-header").locator('[data-slot="input-group"]').first();
	const headerRow = page.getByTestId("jira-for-you-heading-tabs-row");
	const tabs = page.getByRole("tab");
	const [headingBox, tablistBox, searchBox, headerRowBox] = await Promise.all([
		heading.boundingBox(),
		tablist.boundingBox(),
		search.boundingBox(),
		headerRow.boundingBox(),
	]);
	const tabBoxes = await tabs.evaluateAll((elements) =>
		elements.map((element) => element.getBoundingClientRect().toJSON()),
	);

	if (!headingBox || !tablistBox || !searchBox || !headerRowBox || tabBoxes.length === 0) {
		throw new Error("Expected the wide header controls to have bounding boxes.");
	}

	expect(Math.abs(
		headingBox.y + headingBox.height / 2 - (tablistBox.y + tablistBox.height / 2),
	)).toBeLessThan(2);
	expect(Math.abs(tablistBox.x + tablistBox.width - (searchBox.x + searchBox.width))).toBeLessThan(2);
	const tabContentWidth =
		tabBoxes.at(-1)!.x + tabBoxes.at(-1)!.width - tabBoxes[0]!.x;
	expect(tablistBox.width - tabContentWidth).toBeLessThan(10);
	expect(tablistBox.width).toBeLessThan(headerRowBox.width * 0.8);
}

async function getConstrainedTabMetrics(page: Page) {
	return page.getByRole("tab").evaluateAll((elements) =>
		elements.map((element) => {
			const label = element.querySelector("span");
			const box = element.getBoundingClientRect();
			return {
				labelClientWidth: label?.clientWidth ?? 0,
				labelScrollWidth: label?.scrollWidth ?? 0,
				tabClientWidth: element.clientWidth,
				tabScrollWidth: element.scrollWidth,
				width: box.width,
				y: box.y,
			};
		}),
	);
}

async function getStableDetailSnapshot(detailRegion: Locator) {
	return Promise.all([
		detailRegion.getByTestId("jira-for-you-item-details").innerText(),
		detailRegion.getByTestId("jira-for-you-detail-sources").innerText(),
		detailRegion.getByTestId("jira-for-you-detail-output").innerText(),
	]);
}

test("wide workspace caps chat at 800px and gives viewport surplus to the feed", async ({ page }) => {
	const geometries: {
		conversationWidth: number;
		detailWidth: number;
		feedWidth: number;
		workspaceWidth: number;
	}[] = [];

	for (const viewportWidth of [1880, 1920, 2200]) {
		await page.setViewportSize({ width: viewportWidth, height: 1024 });
		await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });

		const crmRow = getRow("CRM Analytics Dashboard", page);
		await crmRow.hover();
		await crmRow.getByRole("button", { exact: true, name: "View" }).last().click();

		const workspace = page.getByTestId("jira-for-you-workspace");
		const feed = page.getByTestId("jira-for-you-feed");
		const chatWorkspace = page.getByTestId("jira-for-you-chat-workspace");
		const conversationPane = page.getByTestId("jira-for-you-conversation-pane");
		const chatContent = conversationPane.locator(".overflow-y-auto > div").first();
		const composerContent = page.getByTestId("jira-for-you-composer-region").locator(":scope > div");
		const detailPanel = page.locator("#jira-for-you-detail-panel");
		const [
			workspaceBox,
			feedBox,
			chatWorkspaceBox,
			conversationBox,
			chatContentBox,
			composerContentBox,
			detailBox,
		] = await Promise.all([
			workspace.boundingBox(),
			feed.boundingBox(),
			chatWorkspace.boundingBox(),
			conversationPane.boundingBox(),
			chatContent.boundingBox(),
			composerContent.boundingBox(),
			detailPanel.boundingBox(),
		]);

		if (
			!workspaceBox ||
			!feedBox ||
			!chatWorkspaceBox ||
			!conversationBox ||
			!chatContentBox ||
			!composerContentBox ||
			!detailBox
		) {
			throw new Error("Expected all wide workspace regions to have bounding boxes.");
		}

		await expect(chatContent).toHaveCSS("padding-left", "24px");
		await expect(chatContent).toHaveCSS("padding-right", "24px");
		await expect(composerContent).toHaveCSS("padding-left", "24px");
		await expect(composerContent).toHaveCSS("padding-right", "24px");
		expect(feedBox.width).toBeGreaterThanOrEqual(419);
		expect(conversationBox.width).toBeLessThanOrEqual(801);
		expect(Math.abs(detailBox.width - 360)).toBeLessThan(2);
		expect(Math.abs(feedBox.x - workspaceBox.x)).toBeLessThan(2);
		expect(Math.abs(feedBox.x + feedBox.width - chatWorkspaceBox.x)).toBeLessThan(2);
		expect(Math.abs(conversationBox.x + conversationBox.width - detailBox.x)).toBeLessThan(2);
		expect(Math.abs(detailBox.x + detailBox.width - workspaceBox.x - workspaceBox.width)).toBeLessThan(2);
		expect(await page.evaluate(() => (
			document.documentElement.scrollWidth - document.documentElement.clientWidth
		))).toBe(0);
		await expectLocatorWithinPane(chatContent, conversationPane);
		await expectLocatorWithinPane(composerContent, conversationPane);
		await expectLocatorWithinPane(detailPanel, workspace);

		geometries.push({
			conversationWidth: conversationBox.width,
			detailWidth: detailBox.width,
			feedWidth: feedBox.width,
			workspaceWidth: workspaceBox.width,
		});

		if (viewportWidth === 1920) {
			const resizeHandle = page.getByTestId("jira-for-you-detail-resize-handle");
			const handleBox = await resizeHandle.boundingBox();
			if (!handleBox) {
				throw new Error("Expected the wide detail resize handle to have a bounding box.");
			}

			await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
			await page.mouse.down();
			await page.mouse.move(handleBox.x - 120, handleBox.y + handleBox.height / 2);
			await page.mouse.up();

			const [resizedDetailBox, resizedConversationBox] = await Promise.all([
				detailPanel.boundingBox(),
				conversationPane.boundingBox(),
			]);
			if (!resizedDetailBox || !resizedConversationBox) {
				throw new Error("Expected resized wide regions to have bounding boxes.");
			}
			expect(resizedDetailBox.width).toBeGreaterThan(detailBox.width);
			expect(resizedConversationBox.width).toBeLessThanOrEqual(801);
			await expectLocatorWithinPane(detailPanel, workspace);
			await expectLocatorWithinPane(composerContent, conversationPane);
		}
	}

	const [intermediate, wide, extraWide] = geometries;
	expect(intermediate!.conversationWidth).toBeGreaterThan(750);
	expect(intermediate!.conversationWidth).toBeLessThan(800);
	expect(Math.abs(wide!.conversationWidth - 800)).toBeLessThan(2);
	expect(Math.abs(extraWide!.conversationWidth - 800)).toBeLessThan(2);
	expect(Math.abs(extraWide!.detailWidth - wide!.detailWidth)).toBeLessThan(2);
	expect(Math.abs(
		extraWide!.feedWidth - wide!.feedWidth -
		(extraWide!.workspaceWidth - wide!.workspaceWidth),
	)).toBeLessThan(2);
});

test("desktop workspace opens from View, supports agent switching, resizes details, and restores focus", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1024 });
	await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });
	await expect(page.getByRole("button", { name: "Ask Rovo" })).toBeVisible();
	await expect(
		page.getByRole("navigation", { name: "Jira" }).getByRole("button", { exact: true, name: "For you" }),
	).toHaveAttribute("aria-current", "page");
	await expectWideHeaderAlignment(page);

	const crmRow = getRow("CRM Analytics Dashboard", page);
	await crmRow.hover();
	const crmViewButton = crmRow.getByRole("button", { exact: true, name: "View" }).last();
	await crmViewButton.click();

	await expect(page.getByRole("button", { name: "Back to For you feed" })).toBeVisible();
	const conversationRegion = page.getByRole("region", { name: "Conversation: CRM Analytics Dashboard" });
	const conversationPane = page.getByTestId("jira-for-you-conversation-pane");
	const composer = page.getByTestId("jira-for-you-composer");
	const composerRegion = page.getByTestId("jira-for-you-composer-region");
	const workspace = page.getByTestId("jira-for-you-workspace");
	await expect(
		conversationRegion.locator("header").getByText(/^Readiness checker$/iu),
	).toBeVisible();
	await expect(page.getByRole("heading", { name: "Details" })).toBeVisible();
	const detailRegion = page.getByRole("region", { name: "Details for CRM-318" });
	const readinessRow = getAgentSessionRow("Readiness Checker", detailRegion);
	await expect(readinessRow.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
	await expect(readinessRow.getByRole("button", { exact: true, name: "View" })).toHaveCount(0);
	await expect(detailRegion.getByTestId("jira-for-you-item-details").getByText("Agent", { exact: true })).toHaveCount(0);
	await expect(detailRegion.getByRole("region", { name: "Agents" })).toBeVisible();
	const stableDetails = await getStableDetailSnapshot(detailRegion);
	await expectLocatorWithinPane(
		conversationRegion.getByText(/Give me the latest update on CRM-318 and tell me what Readiness checker is doing next\./iu),
		conversationPane,
	);
	await expectLocatorWithinPane(
		conversationRegion.getByText(/I finished the launch-readiness pass for CRM-318/u),
		conversationPane,
	);
	await expectLocatorWithinPane(
		composer.locator('[contenteditable="true"]'),
		conversationPane,
	);
	await expectLocatorWithinPane(page.getByTestId("jira-for-you-footer"), conversationPane);
	await expectLocatorWithinPane(detailRegion, workspace);
	await expect(composerRegion).toHaveCSS("border-top-width", "0px");
	for (const controlName of ["Add", "Customize", "Start live voice"]) {
		await expect(composer.getByRole("button", { name: controlName })).toBeVisible();
	}
	await expect(composer.getByRole("button", { name: /^Reasoning:/u })).toHaveCount(0);
	const liveChatButton = composer.getByRole("button", { name: "Start live voice" });
	await expect(liveChatButton).toHaveClass(/bg-bg-neutral-bold/u);
	await expectLocatorWithinPane(liveChatButton, composer.locator('[data-slot="input-group"]'));

	const codeReviewerRow = getAgentSessionRow("Code Reviewer", detailRegion);
	await codeReviewerRow.getByRole("button").first().click();
	await expect(codeReviewerRow.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
	await expect(conversationRegion.getByText(/I reviewed the latest implementation branch for CRM-318/u)).toBeVisible();
	expect(await getStableDetailSnapshot(detailRegion)).toEqual(stableDetails);
	await expectLocatorWithinPane(
		composer.locator('[contenteditable="true"]'),
		conversationPane,
	);
	await composer.locator('[contenteditable="true"]').fill("Check the latest changes");
	const submitButton = composer.getByRole("button", { name: "Submit" });
	await expect(liveChatButton).toHaveCount(0);
	await expect(submitButton).toBeEnabled();
	await expectLocatorWithinPane(submitButton, composer.locator('[data-slot="input-group"]'));
	await submitButton.click();
	await expect(conversationRegion.getByText("Check the latest changes", { exact: true })).toBeVisible();

	const feedbackAnalyzerRow = getAgentSessionRow("Feedback Analyzer", detailRegion);
	await feedbackAnalyzerRow.getByRole("button").first().click();
	await expect(feedbackAnalyzerRow.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
	await expect(conversationRegion.getByText(/I clustered the latest field feedback for CRM-318/u)).toBeVisible();
	expect(await getStableDetailSnapshot(detailRegion)).toEqual(stableDetails);
	await expect(composer.locator('[contenteditable="true"]')).toBeVisible();
	for (const controlName of ["Add", "Customize", "Start live voice"]) {
		await expect(composer.getByRole("button", { name: controlName })).toBeVisible();
	}
	await expect(composer.getByRole("button", { name: /^Reasoning:/u })).toHaveCount(0);

	await page.getByRole("button", { name: "Close detail panel" }).click();
	await expect(page.getByRole("heading", { name: "Details" })).toHaveCount(0);
	await page.getByRole("button", { name: "Open detail panel" }).click();
	await expect(page.getByRole("heading", { name: "Details" })).toBeVisible();

	await page.getByRole("button", { name: "Back to For you feed" }).click();
	await expect(page.getByText("CRM-318: CRM Analytics Dashboard", { exact: true })).toHaveCount(0);
	await expect.poll(async () => (
		page.evaluate(() => {
			const active = document.activeElement;
			const rowText = active?.closest("li")?.textContent ?? "";
			return `${active?.textContent?.trim() ?? ""}::${rowText.includes("CRM Analytics Dashboard")}`;
		})
	)).toBe("View::true");
});

test("constrained desktop opens a bounded inert-safe overlay and preserves the feed", async ({ page }) => {
	await page.setViewportSize({ width: 1180, height: 1024 });
	await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });
	await expect(page.getByRole("button", { name: "Ask Rovo" })).toBeVisible();
	await expect(
		page.getByRole("navigation", { name: "Jira" }).getByRole("button", { exact: true, name: "For you" }),
	).toHaveAttribute("aria-current", "page");

	const workspace = page.getByTestId("jira-for-you-workspace");
	const feed = page.getByTestId("jira-for-you-feed");
	const [workspaceBeforeBox, feedBeforeBox] = await Promise.all([
		workspace.boundingBox(),
		feed.boundingBox(),
	]);
	if (!workspaceBeforeBox || !feedBeforeBox) {
		throw new Error("Expected the constrained workspace and feed to have bounding boxes.");
	}
	expect(Math.abs(feedBeforeBox.width - workspaceBeforeBox.width)).toBeLessThan(2);
	expect(Math.abs(feedBeforeBox.x - workspaceBeforeBox.x)).toBeLessThan(2);

	const vitaRow = getRow("Create presentation on Vitafleet vision", page);
	await vitaRow.hover();
	const vitaViewButton = vitaRow.getByRole("button", { exact: true, name: "View" }).last();
	const feedScrollTop = await feed.evaluate((element) => element.scrollTop);
	await vitaViewButton.click();

	const conversationRegion = page.getByRole("region", { name: "Conversation: Create presentation on Vitafleet vision" });
	const conversationPane = page.getByTestId("jira-for-you-conversation-pane");
	const overlay = page.getByTestId("jira-for-you-chat-workspace");
	await expect(overlay).toHaveAttribute("data-layout", "overlay");
	await expect(feed).toHaveAttribute("inert", "");
	await expect(feed).toHaveAttribute("aria-hidden", "true");
	await expect.poll(async () => {
		const [currentWorkspaceBox, currentOverlayBox] = await Promise.all([
			workspace.boundingBox(),
			overlay.boundingBox(),
		]);
		return currentWorkspaceBox && currentOverlayBox
			? Math.abs(currentOverlayBox.x - currentWorkspaceBox.x)
			: Number.POSITIVE_INFINITY;
	}).toBeLessThan(2);
	const [workspaceBox, overlayBox] = await Promise.all([workspace.boundingBox(), overlay.boundingBox()]);
	if (!workspaceBox || !overlayBox) {
		throw new Error("Expected the constrained workspace overlay to have a bounding box.");
	}
	expect(Math.abs(overlayBox.x - workspaceBox.x)).toBeLessThan(2);
	expect(Math.abs(overlayBox.y - workspaceBox.y)).toBeLessThan(2);
	expect(Math.abs(overlayBox.width - workspaceBox.width)).toBeLessThan(2);
	expect(Math.abs(overlayBox.height - workspaceBox.height)).toBeLessThan(2);
	await expect(
		conversationRegion.locator("header").getByText(/^Readiness checker$/iu),
	).toBeVisible();
	await expectLocatorWithinPane(
		conversationRegion.getByText(/Give me the latest update on VITA-142 and tell me what Readiness checker is doing next\./iu),
		conversationPane,
	);
	await expectLocatorWithinPane(
		conversationRegion.getByText(/I reviewed the deck outline against the latest Vitafleet strategy memo/u),
		conversationPane,
	);
	await expectLocatorWithinPane(
		page.getByTestId("jira-for-you-composer").locator('[contenteditable="true"]'),
		conversationPane,
	);
	const composer = page.getByTestId("jira-for-you-composer");
	const liveChatButton = composer.getByRole("button", { name: "Start live voice" });
	await expect(liveChatButton).toBeVisible();
	await expectLocatorWithinPane(liveChatButton, composer.locator('[data-slot="input-group"]'));
	await expect(liveChatButton).toHaveClass(/bg-bg-neutral-bold/u);
	await expect(composer.getByRole("button", { name: /^Reasoning:/u })).toHaveCount(0);
	await expect(page.getByTestId("jira-for-you-composer-region")).toHaveCSS("border-top-width", "0px");

	await page.getByRole("button", { name: "Open detail panel" }).click();
	const detailRegion = page.getByRole("region", { name: "Details for VITA-142" });
	await expect.poll(async () => {
		const [currentDetailBox, currentOverlayBox] = await Promise.all([
			detailRegion.boundingBox(),
			overlay.boundingBox(),
		]);
		return currentDetailBox && currentOverlayBox
			? currentDetailBox.y + currentDetailBox.height - (currentOverlayBox.y + currentOverlayBox.height)
			: Number.POSITIVE_INFINITY;
	}).toBeLessThanOrEqual(1);
	await expectLocatorWithinPane(detailRegion, overlay);
	await expect(detailRegion.getByTestId("jira-for-you-item-details").getByText("Agent", { exact: true })).toHaveCount(0);
	await expect(detailRegion.getByTestId("jira-for-you-agent-section")).toContainText("Agent");
	await page.getByRole("button", { name: "Close detail panel" }).click();

	await page.getByRole("button", { name: "Back to For you feed" }).click();
	await expect(overlay).toHaveCount(0);
	await expect(feed).not.toHaveAttribute("inert", "");
	await expect(feed).not.toHaveAttribute("aria-hidden", "true");
	expect(await feed.evaluate((element) => element.scrollTop)).toBe(feedScrollTop);
	await expect(vitaViewButton).toBeFocused();
});

test("wide feed keeps content-width tabs right aligned", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1024 });
	await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });
	await expectWideHeaderAlignment(page);
});

test("constrained feed distributes tab width by content and truncates progressively", async ({ page }) => {
	await page.setViewportSize({ width: 400, height: 900 });
	await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });
	await expectTabsOnSingleRowBelowHeading(page);

	const referenceMetrics = await getConstrainedTabMetrics(page);
	const [all, assigned, workedOn, viewed] = referenceMetrics;
	expect(assigned!.width).toBeGreaterThan(all!.width);
	expect(assigned!.width).toBeGreaterThan(viewed!.width);
	expect(workedOn!.width).toBeGreaterThan(all!.width);
	expect(workedOn!.width).toBeGreaterThan(viewed!.width);
	for (const metric of referenceMetrics) {
		expect(metric.labelScrollWidth).toBeLessThanOrEqual(metric.labelClientWidth);
	}

	await page.setViewportSize({ width: 320, height: 900 });
	await expectTabsOnSingleRowBelowHeading(page);
	const smallerMetrics = await getConstrainedTabMetrics(page);
	const smallerTruncatedCount = smallerMetrics.filter(
		(metric) => metric.tabScrollWidth - metric.tabClientWidth > 4,
	).length;
	const referenceTruncatedCount = referenceMetrics.filter(
		(metric) => metric.tabScrollWidth - metric.tabClientWidth > 4,
	).length;
	expect(smallerTruncatedCount).toBeGreaterThan(referenceTruncatedCount);
	for (let index = 1; index < smallerMetrics.length; index += 1) {
		expect(Math.abs(smallerMetrics[index]!.y - smallerMetrics[0]!.y)).toBeLessThan(2);
	}

	const widthGrowth = referenceMetrics.map(
		(metric, index) => metric.width - smallerMetrics[index]!.width,
	);
	expect(widthGrowth[1]!).toBeGreaterThan(widthGrowth[0]! * 2);
	expect(widthGrowth[2]!).toBeGreaterThan(widthGrowth[0]! * 2);
});

test("agent session profile previews open left for selected and non-selected rows", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1024 });
	await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });

	const crmRow = getRow("CRM Analytics Dashboard", page);
	await crmRow.hover();
	await crmRow.getByRole("button", { exact: true, name: "View" }).last().click();

	const detailRegion = page.getByRole("region", { name: "Details for CRM-318" });
	const selectedRow = getAgentSessionRow("Readiness Checker", detailRegion);
	await selectedRow.hover();

	const selectedProfile = page.getByTestId("agent-list-profile-readiness-checker");
	await expect(selectedProfile).toBeVisible();
	await expect(selectedProfile.getByRole("heading", { name: "Readiness Checker" })).toBeVisible();
	await expect(selectedProfile.locator('img[src="/avatar-agent/service-agents/service-triage.svg"]')).toHaveCount(1);
	await expect(selectedRow.getByRole("button", { exact: true, name: "View" })).toHaveCount(0);

	const [selectedRowBox, selectedProfileBox] = await Promise.all([
		selectedRow.boundingBox(),
		selectedProfile.boundingBox(),
	]);
	if (!selectedRowBox || !selectedProfileBox) {
		throw new Error("Expected the selected session row and profile preview to have bounding boxes.");
	}
	expect(selectedProfileBox.x + selectedProfileBox.width).toBeLessThanOrEqual(selectedRowBox.x + 1);
	expect(selectedProfileBox.x).toBeGreaterThanOrEqual(0);
	expect(selectedProfileBox.y).toBeGreaterThanOrEqual(0);
	expect(selectedProfileBox.y + selectedProfileBox.height).toBeLessThanOrEqual(1024);
	await page.mouse.move(
		selectedProfileBox.x + selectedProfileBox.width / 2,
		selectedProfileBox.y + selectedProfileBox.height / 2,
	);
	await expect(selectedProfile).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(selectedProfile).toHaveCount(0);

	const codeReviewerRow = getAgentSessionRow("Code Reviewer", detailRegion);
	const codeReviewerTrigger = codeReviewerRow.getByRole("button").first();
	await codeReviewerTrigger.focus();
	const codeReviewerProfile = page.getByTestId("agent-list-profile-code-reviewer");
	await expect(codeReviewerProfile).toBeVisible();
	await expect(codeReviewerProfile.getByRole("heading", { name: "Code Reviewer" })).toBeVisible();
	await expect(codeReviewerRow.getByRole("button", { exact: true, name: "View" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(codeReviewerProfile).toHaveCount(0);
	await expect(codeReviewerTrigger).toBeFocused();
});

test("row actions follow hover, focus, and open-menu state instead of selection", async ({ page }) => {
	for (const viewportWidth of [2200, 1180]) {
		await page.setViewportSize({ width: viewportWidth, height: 1024 });
		await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });

		const crmRow = getRow("CRM Analytics Dashboard", page);
		const actions = crmRow.locator('[data-slot="jira-for-you-actions"]');
		const restingStatus = crmRow
			.locator('[data-slot="jira-for-you-trailing"] > div')
			.last();
		await crmRow.hover();
		await crmRow.getByRole("button", { exact: true, name: "View" }).last().click();
		await expect.poll(() => page.getByTestId("jira-for-you-conversation-pane").evaluate(
			(element) => element.contains(document.activeElement),
		)).toBe(true);
		await page.getByTestId("jira-for-you-conversation-pane").hover({ position: { x: 20, y: 100 } });
		await expect(actions).toBeHidden();
		if (viewportWidth === 2200) {
			await expect(restingStatus).toBeVisible();
		} else {
			await expect(restingStatus).toBeHidden();
		}
	}

	await page.setViewportSize({ width: 1440, height: 1024 });
	await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });
	const crmRow = getRow("CRM Analytics Dashboard", page);
	await crmRow.hover();
	const viewButton = crmRow.getByRole("button", { exact: true, name: "View" }).last();
	await viewButton.focus();
	await page.keyboard.press("Enter");
	const backButton = page.getByRole("button", { name: "Back to For you feed" });
	await expect.poll(() => page.getByTestId("jira-for-you-conversation-pane").evaluate(
		(element) => element.contains(document.activeElement),
	)).toBe(true);
	await backButton.focus();
	await page.keyboard.press("Enter");
	await expect(viewButton).toBeFocused();
	await expect(crmRow.locator('[data-slot="jira-for-you-actions"]')).toBeVisible();

	await page.getByRole("textbox", { name: "Search work items" }).focus();
	await crmRow.hover();
	const statusMenuTrigger = crmRow.getByRole("button", {
		name: "Change status. Current status: In progress",
	});
	await statusMenuTrigger.focus();
	await page.keyboard.press("Space");
	await expect(statusMenuTrigger).toHaveAttribute("aria-expanded", "true");
	await page.mouse.move(0, 0);
	await expect(crmRow.locator('[data-slot="jira-for-you-actions"]')).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("textbox", { name: "Search work items" }).focus();
	await expect(crmRow.locator('[data-slot="jira-for-you-actions"]')).toBeHidden();
});

test("unassigned row and View activation embed canonical Jira Work Item wide and narrow", async ({ page }) => {
	const scenarios = [
		{
			activation: "row",
			issueKey: "PAY-88",
			title: "Resolve intermittent payment suite failures",
		},
		{
			activation: "view",
			issueKey: "GROW-204",
			title: "Add end-to-end coverage for the onboarding flow",
		},
	] as const;

	for (const viewportWidth of [1440, 820]) {
		for (const scenario of scenarios) {
			await page.setViewportSize({ width: viewportWidth, height: 1024 });
			await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });

			const row = getRow(scenario.title, page);
			await row.hover();
			const viewButton = row.getByRole("button", { exact: true, name: "View" }).last();
			const rowButton = row.locator('[data-slot="jira-for-you-row-button"]');
			const originControl = scenario.activation === "row"
				? rowButton
				: viewButton;
			if (scenario.activation === "row") {
				await rowButton.click();
			} else {
				await viewButton.click();
			}

			const embedded = page.getByTestId("jira-for-you-work-item-workspace");
			await expect(embedded).toBeVisible();
			await expect(
				page.getByRole("region", { name: `Jira Work Item for ${scenario.issueKey}` }),
			).toBeVisible();
			await expect(embedded.getByRole("region", { name: scenario.title })).toBeVisible();
			await expect(page.getByTestId("jira-for-you-chat-workspace")).toHaveCount(0);
			await expect(page.getByTestId("jira-for-you-composer")).toHaveCount(0);
			await expect(page.getByRole("region", { name: `Details for ${scenario.issueKey}` })).toHaveCount(0);
			await expect(page.getByText("Rovo Dev", { exact: true })).toHaveCount(0);
			await expect(page.getByRole("dialog")).toHaveCount(0);

			const feed = page.getByTestId("jira-for-you-feed");
			if (viewportWidth === 820) {
				await expect(feed).toHaveAttribute("inert", "");
			} else {
				await expect(feed).not.toHaveAttribute("inert", "");
			}

			const backButton = page.getByRole("button", { name: "Back to For you feed" });
			await expect(backButton).toBeFocused();
			await backButton.click();
			await expect(embedded).toHaveCount(0);
			await expect(originControl).toBeFocused();
		}
	}
});

test("reduced-motion narrow overlay preserves single-agent identity and restores focus", async ({ page }) => {
	await page.setViewportSize({ width: 820, height: 1180 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });

	const benchmarkRow = getRow("Conduct performance benchmarking", page);
	await benchmarkRow.hover();
	const benchmarkViewButton = benchmarkRow.getByRole("button", { exact: true, name: "View" }).last();
	await benchmarkViewButton.click();

	const conversationRegion = page.getByRole("region", { name: "Conversation: Conduct performance benchmarking" });
	const conversationPane = page.getByTestId("jira-for-you-conversation-pane");
	const overlay = page.getByTestId("jira-for-you-chat-workspace");
	const workspace = page.getByTestId("jira-for-you-workspace");
	const [overlayBox, workspaceBox] = await Promise.all([
		overlay.boundingBox(),
		workspace.boundingBox(),
	]);
	if (!overlayBox || !workspaceBox) {
		throw new Error("Expected the reduced-motion overlay and workspace to have bounding boxes.");
	}
	expect(Math.abs(overlayBox.x - workspaceBox.x)).toBeLessThan(2);
	await expect(
		conversationRegion.locator("header").getByText(/^Progress tracker$/iu),
	).toBeVisible();
	await expect(page.getByRole("heading", { name: "Details" })).toHaveCount(0);
	await expectLocatorWithinPane(
		page.getByTestId("jira-for-you-composer").locator('[contenteditable="true"]'),
		conversationPane,
	);
	const composer = page.getByTestId("jira-for-you-composer");
	await expect(composer.getByRole("button", { name: "Start live voice" })).toBeVisible();

	await page.getByRole("button", { name: "Open detail panel" }).click();
	await expect(page.getByRole("heading", { name: "Details" })).toBeVisible();
	const detailRegion = page.getByRole("region", { name: "Details for PERF-27" });
	await expect(
		getAgentSessionRow("Progress Tracker", detailRegion).getByRole("button").first(),
	).toHaveAttribute("aria-pressed", "true");

	await page.getByRole("button", { name: "Close detail panel" }).click();
	await expect(page.getByRole("heading", { name: "Details" })).toHaveCount(0);

	await page.getByRole("button", { name: "Back to For you feed" }).click();
	await expect(page.getByText("PERF-27: Conduct performance benchmarking", { exact: true })).toHaveCount(0);
	await expect.poll(async () => (
		page.evaluate(() => {
			const active = document.activeElement;
			const rowText = active?.closest("li")?.textContent ?? "";
			return `${active?.textContent?.trim() ?? ""}::${rowText.includes("Conduct performance benchmarking")}`;
		})
	)).toBe("View::true");
});
