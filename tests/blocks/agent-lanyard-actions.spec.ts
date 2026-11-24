import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("third-party session lanyards show a centered, legible brand mark", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-session"));
	const cloud = page.getByRole("region", { name: "Cloud sessions" });
	for (const brand of ["Canva", "Figma"]) {
		await cloud.getByRole("button", { name: `Preview ${brand}`, exact: true }).hover();
		const lanyard = page.locator(`[data-agent-id="${brand.toLowerCase()}"]`).filter({ visible: true });
		const frame = lanyard.locator('[data-slot="agent-lanyard-avatar"]');
		const logo = frame.locator("svg");
		await expect(logo).toBeVisible();
		const [frameBox, logoBox] = await Promise.all([frame.boundingBox(), logo.boundingBox()]);
		if (!frameBox || !logoBox) throw new Error(`${brand} lanyard avatar must be visible`);
		expect(logoBox.width).toBeGreaterThanOrEqual(32);
		expect(logoBox.width).toBeLessThanOrEqual(frameBox.width);
		expect(Math.abs((logoBox.x + logoBox.width / 2) - (frameBox.x + frameBox.width / 2))).toBeLessThan(1);
		expect(Math.abs((logoBox.y + logoBox.height / 2) - (frameBox.y + frameBox.height / 2))).toBeLessThan(1);
	}
});

test("avatar is centered below the lanyard hole", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-lanyard"));
	// Claude appears in the agent card, both recommendations, and the MCP setup card.
	const cards = page.locator('[data-agent-id="claude"]');
	await expect(cards).toHaveCount(4);
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

test("the MCP setup prompt wraps its URLs, scrolls vertically, and confirms copy", async ({ context, page }) => {
	await context.grantPermissions(["clipboard-write"], { origin: new URL(appUrl("/")).origin });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(appUrl("/components/blocks/agent-lanyard"));
	await page.getByRole("button", { name: "Close sidebar", exact: true }).click();
	const setup = page.getByRole("region", { name: "Atlassian MCP setup", exact: true });
	const prompt = setup.locator("pre");
	await expect(prompt).toBeVisible();
	await expect.poll(() => prompt.evaluate((element) => ({
		horizontalOverflow: element.scrollWidth - element.clientWidth,
		verticalOverflow: element.scrollHeight > element.clientHeight,
	}))).toEqual({ horizontalOverflow: 0, verticalOverflow: true });
	await expect(prompt).toHaveCSS("overflow-x", "hidden");
	await prompt.press("End");
	await expect.poll(() => prompt.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await setup.getByRole("button", { name: "Copy setup prompt" }).click();
	await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: /^Prompt copied$/u })).toBeVisible();
});

test("card selection and built-in actions remain independently clickable", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-lanyard"));
	const card = page.locator('[data-agent-id="claude"][data-variant="agent"]');
	await card.getByRole("button", { name: "Chat with Claude" }).click({ timeout: 5000 });
	await expect(page.locator('[data-slot="agent-lanyard-demo"]').getByRole("status")).toHaveText("Selected: Chat with Claude");
	await card.getByRole("button", { name: "More actions for Claude" }).click();
	await expect(page.getByRole("menuitem", { name: "View profile" })).toBeVisible();
	await page.keyboard.press("Escape");
	await card.getByRole("button", { name: "View Claude" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(page.getByRole("dialog").getByRole("heading", { name: "Claude" })).toBeVisible();
});
