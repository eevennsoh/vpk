import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

async function expectAssigneePickerGeometry(picker: Locator) {
	const list = picker.getByRole("listbox", { name: "Search people" });
	const search = picker.getByRole("textbox", { name: "Search people" });
	await expect(search).toBeVisible();
	await expect(list.getByRole("option").first()).toBeVisible();
	await expect(search).toBeFocused();
	const option = list.getByRole("option").first();
	const initialBackground = await option.evaluate((element) => getComputedStyle(element).backgroundColor);
	await option.hover();
	await expect(search).toBeFocused();
	await expect.poll(() => option.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(initialBackground);
	await expect.poll(() => list.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
	const geometry = await picker.evaluate((popup) => {
		const surface = popup.querySelector<HTMLElement>(".rich-text-command-menu");
		const list = popup.querySelector<HTMLElement>('[role="listbox"]');
		const search = popup.querySelector<HTMLElement>('[data-slot="dropdown-menu-search"]');
		const searchIcon = search?.querySelector<HTMLElement>('[data-slot="dropdown-menu-search-icon"]');
		const input = search?.querySelector<HTMLInputElement>("input");
		const row = list?.querySelector<HTMLElement>('[role="option"]');
		const avatar = row?.querySelector<HTMLElement>(".rich-text-command-menu-avatar");
		const label = row?.querySelector<HTMLElement>(".menu-row-title");
		if (!surface || !list || !searchIcon || !input || !avatar || !label) throw new Error("Missing assignee picker geometry");
		const searchIconBounds = searchIcon.getBoundingClientRect();
		const avatarBounds = avatar.getBoundingClientRect();
		const surfaceBounds = surface.getBoundingClientRect();
		const listBounds = list.getBoundingClientRect();
		const inputStyle = getComputedStyle(input);
		return {
			iconOffset: searchIconBounds.left + searchIconBounds.width / 2 - avatarBounds.left - avatarBounds.width / 2,
			textOffset: input.getBoundingClientRect().left + Number.parseFloat(inputStyle.borderLeftWidth) + Number.parseFloat(inputStyle.paddingLeft) - label.getBoundingClientRect().left,
			bottomGap: surfaceBounds.bottom - Number.parseFloat(getComputedStyle(surface).borderBottomWidth) - listBounds.bottom,
		};
	});
	expect.soft(Math.abs(geometry.iconOffset), `search and avatar centers: ${geometry.iconOffset}px apart`).toBeLessThanOrEqual(1);
	expect.soft(Math.abs(geometry.textOffset), `search and row text: ${geometry.textOffset}px apart`).toBeLessThanOrEqual(1);
	expect.soft(Math.abs(geometry.bottomGap), `outside scroll viewport: ${geometry.bottomGap}px`).toBeLessThanOrEqual(1);
}

test("inline-create assignee picker aligns its search and scrolling rows", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	const header = page.locator('[data-slot="board-column-header"]').filter({ has: page.getByRole("button", { name: "Create work item in To do" }) });
	await header.hover();
	await header.getByRole("button", { name: "Create work item in To do" }).click();
	await page.locator('[data-jira-inline-create]').getByRole("button", { name: "Set assignee" }).click();
	await expectAssigneePickerGeometry(page.getByRole("dialog", { name: "Choose assignee" }));
});

test("work-item assignee picker aligns its search and scrolling rows", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	await page.getByRole("button", { name: "Change assignee" }).click();
	await expectAssigneePickerGeometry(page.getByRole("dialog", { name: "Change assignee" }));
});
