import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("session chooser matches the run menu inset and uses a plain chat icon", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Submenu", exact: true }).click();
	const picker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	const insets = async (popup: Locator, rows: Locator) => {
		const [outer, first, last] = await Promise.all([popup.boundingBox(), rows.first().boundingBox(), rows.last().boundingBox()]);
		if (!outer || !first || !last) throw new Error("Menu geometry is not visible");
		return {
			top: first.y - outer.y,
			left: first.x - outer.x,
			right: outer.x + outer.width - first.x - first.width,
			bottom: outer.y + outer.height - last.y - last.height,
		};
	};
	await picker.getByRole("option", { name: /^Cursor/ }).click();
	const runMenu = page.getByRole("menu", { name: "Run Cursor on" });
	const reference = await insets(runMenu, runMenu.getByRole("menuitem"));
	await picker.getByRole("option", { name: /^Claude/ }).click();
	const parentMenu = page.getByRole("menu", { name: "Run Claude on" });
	const parentBox = await parentMenu.boundingBox();
	const parentRowBox = await parentMenu.getByRole("menuitem", { name: "Continue to existing session" }).boundingBox();
	if (!parentBox) throw new Error("Parent menu is not visible");
	if (!parentRowBox) throw new Error("Parent menu row is not visible");
	await page.getByRole("menuitem", { name: "Continue to existing session" }).click();
	const chooser = page.getByRole("dialog", { name: "Choose a Claude session" });
	const sessions = chooser.getByRole("option");
	const chooserBox = await chooser.boundingBox();
	if (!chooserBox) throw new Error("Session chooser is not visible");
	expect(chooserBox.width).toBe(parentBox.width);
	await expect(sessions).toHaveCount(2);
	await expect(sessions.nth(0)).toHaveText("Review the onboarding quickstart");
	await expect(sessions.nth(1)).toHaveText("Check the onboarding tests");
	const sessionRowBox = await sessions.first().boundingBox();
	if (!sessionRowBox) throw new Error("Session row is not visible");
	expect(sessionRowBox.height).toBe(parentRowBox.height);
	await expect(sessions.first().locator(".menu-row-title")).toHaveCSS("text-overflow", "ellipsis");
	await expect(sessions.first().locator(".menu-row-title")).toHaveCSS("white-space", "nowrap");
	expect(await insets(chooser, sessions)).toEqual(reference);
	await expect(sessions.first().locator("[data-slot=icon-tile]")).toHaveCount(0);
	await expect(sessions.first().locator("svg")).toBeVisible();
	await sessions.first().click();
	await expect(picker.getByRole("status")).toHaveText("Selected session: Review the onboarding quickstart");
});

test("inline existing sessions truncate long titles", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const picker = page.getByRole("region", { name: "Duplicative sessions agent selector" });
	await picker.evaluate((element) => { element.style.width = "200px"; });
	await picker.getByRole("button", { name: "Claude", exact: true }).click();
	await picker.getByRole("button", { name: "Continue to existing session" }).click();
	const title = picker.getByRole("button", { name: "Review the onboarding quickstart" }).locator("span").last();
	await expect(title).toHaveCSS("text-overflow", "ellipsis");
	await expect(title).toHaveCSS("white-space", "nowrap");
	expect(await title.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});
