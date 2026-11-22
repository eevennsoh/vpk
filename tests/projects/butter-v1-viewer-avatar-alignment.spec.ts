import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("viewer chat uses the horizontal agent and owner avatar stack", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Team session", exact: true }).click();
	const viewer = page.getByRole("region", { name: "Cloud (Viewer) sessions" });
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	for (const [title, agent, owner] of [
		["Hand off the off-road suspension controls to engineering", "Figma", "Austin Lee"],
		["Active air suspension roadmap", "Canva", "Jordan Okafor"],
	] as const) {
		await viewer.locator("article").filter({ hasText: title }).click();
		const stack = chat.getByRole("group", { name: `${agent}, used by ${owner}` });
		await expect(stack).toHaveAttribute("data-slot", "avatar-group");
		const agentAvatar = stack.locator('[data-slot="avatar"][data-shape="hexagon"]');
		const ownerAvatar = stack.getByRole("img", { name: owner, exact: true });
		await expect(agentAvatar).toBeVisible();
		await expect(ownerAvatar).toBeVisible();
		const [agentBounds, ownerBounds] = await Promise.all([agentAvatar.boundingBox(), ownerAvatar.boundingBox()]);
		if (!agentBounds || !ownerBounds) throw new Error("Both header avatars must be visible");
		expect(ownerBounds.x).toBeGreaterThan(agentBounds.x);
		expect(ownerBounds.y + ownerBounds.height / 2).toBeCloseTo(agentBounds.y + agentBounds.height / 2, 0);
		await expect(chat.getByRole("group", { name: "Session owner and status" })).toHaveCount(0);
	}
	await page.getByRole("region", { name: "Cloud (Owner) sessions" }).locator("article").first().click();
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toBeVisible();
	await expect(chat.locator('[data-slot="avatar-group"]')).toHaveCount(0);
});
