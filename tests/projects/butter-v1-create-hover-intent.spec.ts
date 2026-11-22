import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

for (const [tab, issueKey] of [["Backlog", "PAY-105"], ["List", "PAY-118"]] as const) {
	test(`${tab} reveals row creation after the pointer settles and immediately on focus`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: tab, exact: true }).click();
		const control = page.getByRole("button", { name: `Create work item after ${issueKey}`, exact: true });
		const row = page.getByRole("button", { name: issueKey, exact: true }).locator("xpath=ancestor::tr");
		await expect(row).toBeVisible();
		const bounds = await row.boundingBox();
		if (!bounds) throw new Error("Expected a measurable work item row");

		await page.mouse.move(bounds.x + 250, bounds.y + bounds.height - 3);
		await expect(control).toHaveCSS("pointer-events", "auto");
		await expect(control).toHaveCSS("opacity", "1");
		await expect(page.getByTestId("jira-list-hover-grip")).toHaveCount(1);
		await page.mouse.move(0, 0);
		await expect(control).toHaveCSS("opacity", "0");
		await control.focus();
		await expect(control).toHaveCSS("opacity", "1");
		await control.press("Enter");
		await expect(page.getByRole("textbox", { name: "New work item summary" })).toBeFocused();
	});
}

for (const [tab, issueKeys] of [
	["Backlog", ["PAY-105", "PAY-107", "PAY-112"]],
	["List", ["PAY-118", "PAY-999", "PAY-124"]],
] as const) {
	test(`${tab} avoids flashing Create during rapid traversal and accepts an immediate click`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.clock.install();
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: tab, exact: true }).click();
		const positions = await Promise.all(issueKeys.map(async (key) => {
			const row = page.getByRole("button", { name: key, exact: true }).locator("xpath=ancestor::tr");
			await expect(row).toBeVisible();
			const bounds = await row.boundingBox();
			if (!bounds) throw new Error("Expected a measurable work item row");
			return { x: bounds.x + 250, y: bounds.y + bounds.height - 3 };
		}));

		await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
		const grip = page.getByTestId("jira-list-hover-grip");
		let firstGripY = 0;
		for (const [index, position] of positions.entries()) {
			await page.mouse.move(position.x, position.y);
			await page.clock.runFor(16);
			const opacity = await page.getByRole("button", {
				name: `Create work item after ${issueKeys[index]}`, exact: true,
			}).evaluate((element) => getComputedStyle(element).opacity);
			expect(opacity).toBe("0");
			await expect(grip).toHaveAttribute("data-grip-issue-key", issueKeys[index]);
			if (index === 0) {
				await grip.evaluate((element) => element.setAttribute("data-test-grip-identity", "same"));
				firstGripY = (await grip.boundingBox())?.y ?? 0;
			} else {
				await expect(grip).toHaveAttribute("data-test-grip-identity", "same");
				if (index === 1) {
					const currentY = (await grip.boundingBox())?.y ?? 0;
					const targetY = position.y - 27;
					expect(currentY).toBeGreaterThanOrEqual(firstGripY);
					expect(currentY).toBeLessThan(targetY - 1);
				}
			}
		}
		const last = positions.at(-1);
		if (!last) throw new Error("Expected at least one row");
		await page.clock.resume();
		await page.mouse.click(last.x, last.y);
		await expect(page.getByRole("textbox", { name: "New work item summary" })).toBeFocused();
	});
}
