import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("avatar is centered below the lanyard hole", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-lanyard"));
	// The preview shows Claude as an agent card and as a recommended card; both share the cover.
	const cards = page.locator('[data-agent-id="claude"]');
	await expect(cards).toHaveCount(2);
	for (const card of await cards.all()) {
		const variant = await card.getAttribute("data-variant");
		const cover = await card.locator('[data-slot="agent-lanyard-cutout"]').locator("..").boundingBox();
		const avatar = await card.locator('[data-slot="agent-lanyard-avatar"]').boundingBox();
		expect(cover, `${variant} cover`).not.toBeNull();
		expect(avatar, `${variant} avatar`).not.toBeNull();
		if (!cover || !avatar) return;
		expect(avatar.y + avatar.height / 2, variant ?? "").toBeCloseTo(cover.y + (16 + cover.height) / 2, 1);
	}
});

test("card selection and built-in actions remain independently clickable", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-lanyard"));
	const card = page.locator('[data-agent-id="claude"]');
	await card.getByRole("button", { name: "Chat with Claude" }).click({ timeout: 5000 });
	await expect(page.getByRole("status")).toHaveText("Selected: Chat with Claude");
	await card.getByRole("button", { name: "More actions for Claude" }).click();
	await expect(page.getByRole("menuitem", { name: "View profile" })).toBeVisible();
	await page.keyboard.press("Escape");
	await card.getByRole("button", { name: "View Claude" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(page.getByRole("dialog").getByRole("heading", { name: "Claude" })).toBeVisible();
});
