import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`reply context reveals removal on hover and keyboard focus (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Work item" }).click();
		await page.getByRole("button", { name: "Close gallery" }).click();
		const thread = page.locator('[data-jira-activity-entry-kind="comment"]').first();
		await thread.scrollIntoViewIfNeeded();
		await thread.hover();
		await page.evaluate(() => {
			document.addEventListener("transitionrun", (event) => {
				if (event.target instanceof HTMLElement && event.target.dataset.testid === "reply-target-chip") {
					document.documentElement.dataset.contextChipTransition = `${document.documentElement.dataset.contextChipTransition ?? ""} ${event.propertyName}`;
				}
			});
		});
		await thread.getByRole("button", { name: "Reply", exact: true }).first().click();
		const chip = page.getByTestId("reply-target-chip");
		const remove = chip.getByRole("button", { name: "Remove reply target" });
		await expect(chip).toContainText("Review the onboarding flow");
		if (reducedMotion === "no-preference") {
			await expect.poll(() => page.locator("html").getAttribute("data-context-chip-transition")).toContain("scale");
		} else {
			await expect(page.locator("html")).not.toHaveAttribute("data-context-chip-transition");
		}
		await expect.poll(() => chip.evaluate((element) => element.getAnimations().length)).toBe(0);
		await expect(remove).toHaveCSS("opacity", "0");
		await expect(remove).toHaveCSS("pointer-events", "none");
		const restingWidth = (await chip.boundingBox())?.width;
		await chip.hover();
		await expect(remove).toHaveCSS("opacity", "1");
		expect((await chip.boundingBox())?.width).toBe(restingWidth);
		await page.mouse.move(0, 0);
		await chip.getByRole("button").first().focus();
		await page.keyboard.press("Tab");
		await expect(remove).toBeFocused();
		await expect(remove).toHaveCSS("opacity", "1");
		await page.keyboard.press("Enter");
		await expect(chip).toHaveCount(0);
	});
}


test("context chip reveals compact actions only on hover or keyboard focus", async ({ page }) => {
	await page.goto(appUrl("/components/ui-custom/context-chip"));
	const chip = page.locator("#preview").getByTestId("context-chip-reply");
	const remove = chip.getByRole("button", { name: "Remove reply target" });
	await page.mouse.move(0, 0);
	await expect(chip).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(remove).toHaveCSS("opacity", "0");
	await expect(remove).toHaveCSS("pointer-events", "none");
	const restingWidth = (await chip.boundingBox())?.width;
	await chip.hover();
	await expect(chip).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(remove).toHaveCSS("opacity", "1");
	expect((await chip.boundingBox())?.width).toBe(restingWidth);
	const label = chip.getByText("Replying to Summarize onboarding feedback", { exact: true });
	const labelBox = await label.boundingBox();
	const crossBox = await remove.locator("svg").boundingBox();
	expect(labelBox).not.toBeNull();
	expect(crossBox).not.toBeNull();
	if (labelBox && crossBox) {
		const gap = crossBox.x - labelBox.x - labelBox.width;
		expect(gap).toBeGreaterThanOrEqual(0);
		expect(gap).toBeLessThanOrEqual(8);
	}
	await chip.getByRole("button").first().click();
	await page.keyboard.press("Escape");
	await page.mouse.move(0, 0);
	await expect(chip).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(remove).toHaveCSS("opacity", "0");
	await chip.getByRole("button").first().focus();
	await page.keyboard.press("Tab");
	await expect(remove).toBeFocused();
	await expect(remove).toHaveCSS("opacity", "1");
	await page.keyboard.press("Enter");
	await expect(chip).toHaveCount(0);
	await page.locator("#preview").getByRole("button", { name: "Restore context" }).click();
	await expect(remove).toHaveCSS("opacity", "0");
});
