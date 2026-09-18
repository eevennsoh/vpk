import { expect, test } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL;

test("board scrollbars hide at rest and support hover, wheel, dragging, and keyboard", async ({ page }) => {
	test.skip(!origin, "PLAYWRIGHT_BASE_URL must identify the owning worktree");
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(`${origin}/jira-team-eu26`);
	const heading = page.getByRole("heading", { name: "Jira Design", exact: true });
	await expect(heading).toBeVisible();
	const viewport = page.getByRole("region", { name: "In review work items", exact: true });
	const area = viewport.locator("..");
	const scrollbar = area.locator('[data-slot="scroll-area-scrollbar"]');
	const thumb = scrollbar.locator('[data-slot="scroll-area-thumb"]');
	const scrollTop = () => viewport.evaluate((element) => element.scrollTop);

	await heading.hover();
	await expect(viewport).toHaveCSS("scrollbar-width", "none");
	await expect(scrollbar).toHaveCSS("opacity", "0");
	await expect(scrollbar).toHaveCSS("pointer-events", "none");
	const idleWidth = await viewport.evaluate((element) => element.clientWidth);

	await viewport.hover();
	await expect(scrollbar).toHaveCSS("opacity", "1");
	await expect(scrollbar).toHaveCSS("pointer-events", "auto");
	expect(await viewport.evaluate((element) => element.clientWidth)).toBe(idleWidth);
	await page.mouse.wheel(0, 180);
	await expect.poll(scrollTop).toBeGreaterThan(0);

	const beforeDrag = await scrollTop();
	const bounds = await thumb.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
	await page.mouse.down();
	await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2 + 30, { steps: 5 });
	await page.mouse.up();
	await expect.poll(scrollTop).toBeGreaterThan(beforeDrag);

	await heading.hover();
	await expect(scrollbar).toHaveCSS("opacity", "0");
	await page.keyboard.press("Tab");
	await viewport.focus();
	await expect(scrollbar).toHaveCSS("opacity", "1");
	await expect(viewport).toHaveCSS("mask-image", "none");
	await page.screenshot({ path: "output/agent-browser/vpk-verify/jira-team-eu26-scrollbars/keyboard-focus.png" });
	await viewport.press("Tab");
	await expect(scrollbar).toHaveCSS("opacity", "1");
	await expect(viewport).toHaveCSS("mask-image", "none");
	await viewport.press("Home");
	await expect.poll(scrollTop).toBe(0);
	await viewport.press("PageDown");
	await expect.poll(scrollTop).toBeGreaterThan(0);
	await heading.click();
	await heading.hover();
	await expect(scrollbar).toHaveCSS("opacity", "0");
	await expect(viewport).not.toHaveCSS("mask-image", "none");

	// The thumb stays available while scrolling settles after the pointer leaves.
	await viewport.hover();
	await page.mouse.wheel(0, -60);
	await heading.hover();
	await expect(scrollbar).toHaveAttribute("data-scrolling", "");
	await expect(scrollbar).toHaveCSS("opacity", "1");
	await expect(scrollbar).toHaveCSS("opacity", "0");
});
