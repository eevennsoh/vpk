import { expect, test } from "@playwright/test";

const URL = `${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/components/ui/avatar#coding-agents`;

for (const width of [1440, 390]) {
	test(`coding agent artwork and brand canvases stay correct in both themes at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto(URL);
		const demo = page.locator("[data-coding-agent-avatars]");
		const tiers = page.locator("[data-agent-avatar-tiers]");
		const claude = demo.getByRole("img", { name: "Claude coding agent", exact: true });
		const codex = demo.getByRole("img", { name: "Codex coding agent", exact: true });
		const copilot = demo.getByRole("img", { name: "GitHub Copilot coding agent", exact: true });
		const cursor = demo.getByRole("img", { name: "Cursor coding agent", exact: true });
		await expect(demo.getByRole("img")).toHaveCount(4);
		for (const avatar of await tiers.getByRole("img").all()) {
			await expect(avatar).toHaveCSS("width", "32px");
			await expect(avatar).toHaveCSS("height", "32px");
		}
		for (const theme of ["light", "dark"] as const) {
			const toggle = page.getByRole("button", { name: theme === "dark" ? "Light theme" : "System theme", exact: true });
			if (await toggle.count()) await toggle.click();
			await expect(claude.locator('[data-slot="avatar-hexagon-artwork"] > span')).toHaveCSS("background-color", "rgb(217, 119, 87)");
			await expect(cursor.locator('[data-slot="avatar-hexagon-artwork"] > span')).toHaveCSS("background-color", "rgb(20, 18, 11)");
			await expect(copilot.locator('[data-slot="avatar-hexagon-artwork"] > span')).toHaveCSS("background-color", "rgb(0, 0, 0)");
			await expect(codex.locator("img")).toHaveAttribute("src", "/3p/openai-codex/24.svg");
			await expect(cursor.locator("img")).toHaveAttribute("src", "/3p/cursor/24.svg");
			for (const avatar of [codex, cursor, copilot]) {
				await expect(avatar.locator("img")).toHaveCSS("width", "24px");
			}
			for (const [name, avatar] of [["Claude", claude], ["Codex", codex], ["GitHub Copilot", copilot], ["Cursor", cursor]] as const) {
				const tier = tiers.getByRole("img", { name: `${name} agent`, exact: true });
				await expect(avatar).toHaveCSS("width", "32px");
				await expect(avatar).toHaveCSS("height", "32px");
				const backdrop = '[data-slot="avatar-hexagon-artwork"] > span';
				await expect(tier.locator(backdrop)).toHaveCSS("background-color", await avatar.locator(backdrop).evaluate(el => getComputedStyle(el).backgroundColor));
				if (name !== "Claude") {
					await expect(tier.locator("img")).toHaveCSS("width", "24px");
					await expect(tier.locator("img")).toHaveAttribute("src", (await avatar.locator("img").getAttribute("src"))!);
				}
			}
			await expect(codex.locator("img")).toHaveCSS("filter", "none");
			await expect(codex.locator("img")).toHaveCSS("scale", /1\.25/);
			await expect(tiers.getByRole("img", { name: "Codex agent", exact: true }).locator("img")).toHaveCSS("scale", /1\.25/);
			await expect(cursor.locator("img")).toHaveCSS("filter", "none");
			await expect(copilot.locator("img")).toHaveCSS("filter", "brightness(0) invert(1)");
			await expect(claude.locator('svg:not([data-slot="avatar-hexagon-border"])')).toHaveCSS("filter", "brightness(0) invert(1)");
		}
	});
}
