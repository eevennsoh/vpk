import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function stackShadows(page: Page) {
	return page.locator('[aria-roledescription="suggestion stack"] > div').evaluateAll((slots) => slots.map((slot) => {
		const paper = slot.firstElementChild;
		if (!(paper instanceof HTMLElement)) return null;
		const style = getComputedStyle(paper);
		return { opacity: Number(style.opacity), shadow: style.boxShadow };
	}));
}

test("gathering extra suggestions does not deepen the visible stack shadow", async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: "5 suggestions" }).click();
	await page.getByRole("button", { name: "Show as list" }).click();
	await expect(page.getByRole("list", { name: "Suggestions" })).toBeVisible();
	await page.getByRole("button", { name: "Show as stack" }).click();
	await expect.poll(async () => (await stackShadows(page)).map((card) => card?.opacity)).toEqual([1, 1, 1, 0, 0]);
	const five = await stackShadows(page);
	await page.getByRole("button", { name: "Dismiss description" }).click();
	await page.getByRole("button", { name: "Dismiss due date" }).click();
	await expect.poll(async () => (await stackShadows(page)).map((card) => card?.opacity)).toEqual([1, 1, 1]);
	const three = await stackShadows(page);
	expect(five.slice(0, 3).map((card) => card?.shadow)).toEqual(three.map((card) => card?.shadow));
	for (const card of five.slice(3)) {
		const colors = [...(card?.shadow ?? "").matchAll(/rgba?\(([^)]+)\)/gu)];
		expect(colors.length).toBeGreaterThan(0);
		expect(colors.every((color) => color[1].split(",").map(Number)[3] === 0)).toBe(true);
	}
});
