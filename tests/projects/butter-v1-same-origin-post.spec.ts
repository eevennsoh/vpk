import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

// Answering PAY-112's clarification card saves the thread with a same-origin POST, which needs no
// credentials or Rovo. A server that does not allow the page's own origin rejects it (500), so this
// catches a smoke job browsing at an origin the production backend does not allow.
test("answering a clarification saves the thread from the page's own origin", { tag: "@smoke" }, async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Close gallery" }).click();
	const card = page.locator('[data-issue-key="PAY-112"][data-board-column-title]');
	await card.getByRole("button", { name: "Codex: Needs input" }).click();
	await page.getByRole("button", { name: "Review sandbox key retention", exact: true }).click();
	const saved = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname.startsWith("/api/rovo/threads"));
	await page.getByRole("button", { name: /Assume a 7-day sandbox window/ }).click();
	const response = await saved;
	const request = response.request();
	expect((await request.allHeaders()).origin, "the POST carries the page's own origin").toBe(new URL(page.url()).origin);
	expect(response.status(), `POST ${new URL(response.url()).pathname}`).toBeLessThan(400);
	await expect(page.getByText("I’ll use a seven-day retention window for the sandbox replay", { exact: false })).toBeVisible();
});
