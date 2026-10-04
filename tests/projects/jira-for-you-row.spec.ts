import {
	expect,
	test,
	type Locator,
	type Page,
} from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const JIRA_FOR_YOU_URL = appUrl("/preview/projects/jira-for-you");

function getRow(page: Page, title: string) {
	return page.getByRole("listitem").filter({
		has: page.getByText(title, { exact: true }),
	});
}

async function expectMetadataWithinContent(row: Locator) {
	const content = row.locator('[data-slot="jira-for-you-row-button"]');
	const metadata = row.locator('[data-slot="jira-for-you-metadata"]');
	const metadataText = row.locator('[data-slot="jira-for-you-metadata-text"]');
	const separators = row.locator('[data-slot="jira-for-you-metadata-separator"]');
	const [contentBox, metadataBox, metadataTextBox] = await Promise.all([
		content.boundingBox(),
		metadata.boundingBox(),
		metadataText.boundingBox(),
	]);

	if (!contentBox || !metadataBox || !metadataTextBox) {
		throw new Error("Expected row content and metadata to have bounding boxes.");
	}

	expect(metadataBox.x).toBeGreaterThanOrEqual(contentBox.x - 1);
	expect(metadataBox.x + metadataBox.width).toBeLessThanOrEqual(
		contentBox.x + contentBox.width + 1,
	);
	expect(metadataTextBox.x + metadataTextBox.width).toBeLessThanOrEqual(
		contentBox.x + contentBox.width + 1,
	);
	await expect(metadataText).toHaveCSS("overflow", "hidden");
	await expect(metadataText).toHaveCSS("text-overflow", "ellipsis");
	await expect(metadataText).toHaveCSS("white-space", "nowrap");
	const separatorStyles = await separators.evaluateAll((elements) =>
		elements.map((element) => ({
			marginLeft: getComputedStyle(element).marginLeft,
			marginRight: getComputedStyle(element).marginRight,
			text: element.textContent?.trim(),
		})),
	);
	expect(separatorStyles.length).toBeGreaterThan(0);
	for (const separator of separatorStyles) {
		expect(separator).toEqual({
			marginLeft: "4px",
			marginRight: "4px",
			text: "·",
		});
	}
}

test("narrow Jira rows ellipsize metadata after fixed agent avatars", async ({ page }) => {
	await page.setViewportSize({ width: 820, height: 1000 });
	await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });

	const crmRow = getRow(page, "CRM Analytics Dashboard");
	const benchmarkRow = getRow(page, "Conduct performance benchmarking");

	for (const row of [crmRow, benchmarkRow]) {
		await expectMetadataWithinContent(row);
		await expect(row.locator('[data-slot="avatar-group"]')).toBeVisible();
		expect(await row.locator('[data-slot="jira-for-you-metadata"]').boundingBox())
			.toMatchObject({ height: 16 });
	}

	const crmMetadata = crmRow.locator('[data-slot="jira-for-you-metadata-text"]');
	await expect(
		crmRow.locator('[data-slot="jira-for-you-status-segment"]').first(),
	).toHaveCSS("margin-right", "4px");
	await expect(crmRow.locator('[data-slot="spinner"]')).toHaveCSS(
		"margin-left",
		"4px",
	);
	const crmOverflow = await crmMetadata.evaluate((element) => ({
		clientWidth: element.clientWidth,
		scrollWidth: element.scrollWidth,
	}));
	expect(crmOverflow.scrollWidth).toBeGreaterThan(crmOverflow.clientWidth);

	await crmRow.hover();
	const [contentBox, actionsBox] = await Promise.all([
		crmRow.locator('[data-slot="jira-for-you-row-button"]').boundingBox(),
		crmRow.locator('[data-slot="jira-for-you-actions"]').boundingBox(),
	]);
	if (!contentBox || !actionsBox) {
		throw new Error("Expected row content and hover actions to have bounding boxes.");
	}
	expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(actionsBox.x - 11);
	await expectMetadataWithinContent(crmRow);
	const hoverOverflow = await crmMetadata.evaluate((element) => ({
		clientWidth: element.clientWidth,
		scrollWidth: element.scrollWidth,
	}));
	expect(hoverOverflow.scrollWidth).toBeGreaterThan(hoverOverflow.clientWidth);
	expect(await crmRow.evaluate((element) => element.scrollWidth)).toBe(
		await crmRow.evaluate((element) => element.clientWidth),
	);
});

test("wide Jira rows preserve complete metadata", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1024 });
	await page.goto(JIRA_FOR_YOU_URL, { waitUntil: "load" });

	for (const title of [
		"CRM Analytics Dashboard",
		"Conduct performance benchmarking",
	]) {
		const row = getRow(page, title);
		await expectMetadataWithinContent(row);
		const overflow = await row.locator(
			'[data-slot="jira-for-you-metadata-text"]',
		).evaluate((element) => ({
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
		}));
		expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
	}
});
