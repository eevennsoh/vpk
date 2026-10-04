import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 } });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`keyboard session selection focuses the Jira Issue chat with ${reducedMotion} motion`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/components/blocks/jira-issue"));
		await page.getByRole("button", { name: "1 agent as owner", exact: true }).click();

		const trigger = page.getByRole("button", { name: "Claude: Working", exact: true });
		await trigger.focus();
		await page.keyboard.press("Enter");

		const flyout = page.getByRole("dialog", { name: "Agent assignment" });
		await expect(flyout).toBeVisible();
		await page.keyboard.press("Tab");
		const session = flyout.getByRole("button", {
			name: /^Claude Claude, used by Venn Claude Cloud session 12m/u,
		});
		await expect(session).toBeFocused();
		await page.keyboard.press("Enter");

		const composer = page.getByRole("textbox", { name: "Chat message input" });
		await expect(composer).toBeVisible();
		await expect(composer).toBeFocused();
	});
}
