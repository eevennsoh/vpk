import { expect, test, type Locator, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

// The Delete run action on a finished task/agent progress card reveals on hover. A keyboard
// user must reach it by Tab from the card and see it, without it showing at rest. The doc
// pages render the "failed" example, the one with a Delete run action.
const ROUTES = [
	"/components/blocks/task-progress",
	"/components/blocks/agent-progress",
];

// The width the action's reveal wrapper paints; a visually hidden wrapper clips to 1px.
async function renderedWidth(locator: Locator): Promise<number> {
	return (await locator.locator("..").boundingBox())?.width ?? 0;
}

async function openCard(page: Page, route: string) {
	await page.goto(appUrl(route));
	const card = page.locator("[role=button][tabindex='0']").filter({ hasText: "Deploy Pipeline" });
	await card.scrollIntoViewIfNeeded();
	await expect(card).toBeVisible();
	return { card, deleteRun: card.getByRole("button", { includeHidden: true, name: "Delete run" }) };
}

for (const route of ROUTES) {
	test(`Tab from the card reaches a visible Delete run on ${route}`, async ({ page }) => {
		const { card, deleteRun } = await openCard(page, route);
		await page.mouse.move(0, 0);
		expect(await renderedWidth(deleteRun), "Delete run is not shown at rest").toBeLessThanOrEqual(1);

		await card.focus();
		await page.keyboard.press("Tab");

		await expect(deleteRun).toBeFocused();
		expect(await renderedWidth(deleteRun), "Delete run is shown while focused").toBeGreaterThan(16);
	});

	test(`a mouse click on the card does not reveal Delete run once the pointer leaves on ${route}`, async ({ page }) => {
		const { card, deleteRun } = await openCard(page, route);
		await card.hover();
		expect(await renderedWidth(deleteRun), "Delete run is shown on hover").toBeGreaterThan(16);

		await card.click();
		await page.mouse.move(0, 0);

		expect(await renderedWidth(deleteRun)).toBeLessThanOrEqual(1);
	});
}
