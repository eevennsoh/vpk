import { expect, test } from "@playwright/test";

import { resolveAppOrigin } from "@/tests/helpers/origin";

const origin = resolveAppOrigin();

for (const width of [1440, 640]) {
	for (const route of ["/jira-team-eu26", "/rovo", "/confluence", "/studio", "/preview/blocks/top-navigation"]) {
		test(`Properties dropdown is exclusive to Team EU26 on ${route} at ${width}px`, async ({ page }) => {
			test.setTimeout(60_000);
			await page.setViewportSize({ width, height: 1000 });
			await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
			await expect(page.getByRole("searchbox", { name: "Search", exact: true, includeHidden: true })).toBeAttached({ timeout: 30_000 });
			if (width < 768) {
				await page.getByRole("button", { name: "More", exact: true }).first().click();
			}
			const settings = page.getByRole("button", { name: "Settings", exact: true });
			if (route === "/jira-team-eu26") {
				await settings.focus();
				await page.keyboard.press("Enter");
				await expect(page.getByRole("menu")).toContainText("Properties");
				await expect(page.getByRole("menuitemcheckbox", { name: "Card glow", exact: true })).toBeVisible();
				await page.keyboard.press("Escape");
				await expect(settings).toBeFocused();
			} else if (route === "/studio") {
				await settings.click();
				await expect(page.getByRole("menuitem").first()).toBeVisible();
				await expect(page.getByRole("menuitemcheckbox")).toHaveCount(0);
				await expect(page.getByRole("menu")).not.toContainText("Properties");
				await expect(page.getByRole("separator")).toHaveCount(0);
			} else {
				await expect(settings).toHaveCount(0);
				await expect(page.locator("[data-static-settings-icon]")).toBeVisible();
				await expect(page.getByRole("menuitemcheckbox")).toHaveCount(0);
			}
		});
	}
}

for (const route of ["/jira-team-eu26", "/confluence"]) {
	test(`shared chat controls preserve navigation and draft behavior on ${route}`, async ({ page }) => {
		test.setTimeout(60_000);
		await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
		const toggle = page.getByRole("button", { name: "Ask Rovo", exact: true });
		await expect(toggle).toBeVisible({ timeout: 30_000 });
		await expect(toggle).toHaveAttribute("aria-pressed", "false");
		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-pressed", "true");
		const composer = page.getByRole("textbox", { name: "Chat message input", exact: true });
		await expect(composer).toBeVisible();
		await composer.fill("Shared navigation draft");
		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-pressed", "false");
		await expect(composer).not.toBeVisible();
		await toggle.click();
		await expect(composer).toContainText("Shared navigation draft");
	});
}


test("shared surface controls open and close the original Golden Journeys floating chat", async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto(`${origin}/jira-golden-journeys-v0`, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Select Kanban", exact: true }).click();
	await page.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat).toBeVisible();
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toBeVisible();
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await expect(chat).not.toBeVisible();
	await expect(page.getByRole("button", { name: "Open Rovo chat", exact: true })).toBeVisible();
});
