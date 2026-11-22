import { expect, test, type Locator, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

// The Delete run action on a finished task/agent progress card reveals on hover. A keyboard
// user must reach it by Tab from the card and see it, without it showing at rest. The doc
// pages render the "failed" example, the one with a Delete run action.
const ROUTES = [
	{ route: "/components/blocks/task-progress", actionName: "Deploy Pipeline task progress" },
	{ route: "/components/blocks/agent-progress", actionName: "Deploy Pipeline agent progress" },
];

// The width the action's reveal wrapper paints; a visually hidden wrapper clips to 1px.
async function renderedWidth(locator: Locator): Promise<number> {
	return (await locator.locator("..").boundingBox())?.width ?? 0;
}

async function openCard(page: Page, route: string, actionName: string) {
	await page.goto(appUrl(route));
	const card = page.getByRole("button", { name: actionName, exact: true });
	await card.scrollIntoViewIfNeeded();
	await expect(card).toBeVisible();
	const shell = card.locator("..");
	return {
		card,
		cardContent: shell.getByText("Deploy Pipeline", { exact: true }),
		deleteRun: shell.getByRole("button", { includeHidden: true, name: "Delete run", exact: true }),
	};
}

for (const { route, actionName } of ROUTES) {
	test(`Tab from the card reaches a visible Delete run on ${route}`, { tag: "@smoke" }, async ({ page }) => {
		const { card, deleteRun } = await openCard(page, route, actionName);
		await page.mouse.move(0, 0);
		expect(await renderedWidth(deleteRun), "Delete run is not shown at rest").toBeLessThanOrEqual(1);

		await card.focus();
		await expect(card).toBeFocused();
		expect(await renderedWidth(deleteRun), "Delete run is shown while the card action has focus").toBeGreaterThan(16);
		await page.keyboard.press("Tab");

		await expect(deleteRun).toBeFocused();
		expect(await renderedWidth(deleteRun), "Delete run is shown while focused").toBeGreaterThan(16);
	});

	test(`a mouse click on the card does not reveal Delete run once the pointer leaves on ${route}`, { tag: "@smoke" }, async ({ page }) => {
		const { card, cardContent, deleteRun } = await openCard(page, route, actionName);
		await cardContent.hover();
		expect(await renderedWidth(deleteRun), "Delete run is shown on hover").toBeGreaterThan(16);

		await cardContent.click();
		await expect(card).not.toBeFocused();
		await page.mouse.move(0, 0);

		expect(await renderedWidth(deleteRun)).toBeLessThanOrEqual(1);
	});
}
