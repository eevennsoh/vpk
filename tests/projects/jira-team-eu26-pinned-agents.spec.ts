import { expect, test } from "@playwright/test";
import { appUrl } from "../helpers/origin";

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1720, height: 1100 } });

test("card picker pins the project's coding agents in both content presets", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/jira-team-eu26"));
	await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
	let defaultCatalog: unknown;
	for (const content of ["default", "wac"] as const) {
		if (content === "wac") {
			await page.getByRole("button", { name: "Settings", exact: true }).click();
			await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
			await expect(page.getByRole("heading", { name: "Checkout roadmap", exact: true })).toBeVisible();
		}
		const wacAvatarSources = content === "wac" ? await Promise.all(
			["Claude", "Cursor", "Codex", "GitHub Copilot"].map(async (name) => ({
				name,
				src: await page.getByRole("button", { name: `Preview ${name}`, exact: true }).locator("img").getAttribute("src"),
			})),
		) : [];
		await page.getByRole("button", { name: "More actions for PAY-118", exact: true }).focus();
		await page.keyboard.press("Enter");
		await page.getByRole("menuitem", { name: /^Add agent/ }).focus();
		await page.keyboard.press("ArrowRight");
		await expect(page.getByPlaceholder("Search agents", { exact: true })).toBeVisible();
		const options = page.getByRole("listbox", { name: "Suggestions", exact: true }).getByRole("option");
		await expect(options).toHaveCount(8);
		const catalog = await options.evaluateAll((items) => items.map((item) => item.getAttribute("data-value")));
		if (content === "default") defaultCatalog = catalog;
		else expect(catalog).toEqual(defaultCatalog);
		const moreAgents = page.locator('[data-slot="command-group"]').filter({ has: page.getByText("More agents", { exact: true }) });
		for (const name of ["Figma", "Code Reviewer", "Release Notes Drafter", "Bug Report Assistant"]) {
			await expect(moreAgents.getByRole("option", { name: new RegExp(`^${name} `) })).toHaveCount(1);
			await expect(page.getByRole("button", { name: `Unpin ${name}`, exact: true })).toHaveCount(0);
		}
		for (const { name, src } of wacAvatarSources) {
			const avatar = page.getByRole("option", { name: new RegExp(`^${name} `) }).locator('[data-slot="avatar"]');
			await expect(avatar).toHaveAttribute("data-shape", "hexagon");
			await expect(avatar.locator("img")).toHaveAttribute("src", src!);
		}
		const figma = page.getByRole("option", { name: /^Figma / }).locator('[data-slot="avatar"]');
		await expect(figma).toHaveAttribute("data-shape", "hexagon");
		await expect(figma.locator("svg")).toHaveCount(1);
		if (content === "wac") await expect(page.getByRole("button", { name: "Preview Figma", exact: true }).locator("svg")).toHaveCount(1);
		for (const name of ["Claude", "Codex", "Cursor", "GitHub Copilot"]) {
			await expect(page.getByRole("button", { name: `Unpin ${name}`, exact: true })).toBeVisible();
		}
		await expect(page.getByRole("button", { name: "Unpin Readiness Checker", exact: true })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Unpin RFP Drafter", exact: true })).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/pinned-space-coding-${content}.png` });
		await page.getByRole("option", { name: /^Bug Report Assistant / }).scrollIntoViewIfNeeded();
		await page.screenshot({ path: `output/agent-browser/more-custom-agents-${content}.png` });
		await page.keyboard.press("Escape");
		await page.keyboard.press("Escape");
	}
});

for (const content of ["default", "wac"] as const) {
	test(`custom agent search and assignment work in ${content} content`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(appUrl("/jira-team-eu26"));
		if (content === "wac") {
			await page.getByRole("button", { name: "Settings", exact: true }).click();
			await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
		}
		await page.getByRole("button", { name: "More actions for PAY-118", exact: true }).focus();
		await page.keyboard.press("Enter");
		await page.getByRole("menuitem", { name: /^Add agent/ }).focus();
		await page.keyboard.press("ArrowRight");
		await page.getByPlaceholder("Search agents", { exact: true }).fill("Code Reviewer");
		await expect(page.getByRole("listbox", { name: "Suggestions", exact: true }).getByRole("option")).toHaveCount(1);
		await page.getByRole("option", { name: /^Code Reviewer / }).click();
		const card = page.getByRole("region", { name: "In progress work items", exact: true }).locator('[data-issue-key="PAY-118"]');
		await expect(card.getByRole("button", { name: "Code Reviewer: Working", exact: true })).toBeVisible();
	});
}
