import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("session instruction hint stays visible for both choices and disappears when typing", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Cursor");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Cursor", exact: true }).click();
	const hint = editor.locator("xpath=..");
	const newSession = page.getByRole("option", { name: "Start a new session" });
	await newSession.hover();
	await expect(hint).toHaveAttribute("data-instruction-placeholder", "true");
	await expect.poll(() => editor.locator("p").last().evaluate((node) => getComputedStyle(node, "::after").content)).toBe('"write your instructions"');
	await page.getByRole("option", { name: "Continue in existing session" }).hover();
	await expect(hint).toHaveAttribute("data-instruction-placeholder", "true");
	await editor.press("ArrowDown");
	await expect(hint).toHaveAttribute("data-instruction-placeholder", "true");
	await editor.press("ArrowUp");
	await expect(hint).toHaveAttribute("data-instruction-placeholder", "true");
	await newSession.click();
	await expect(hint).toHaveAttribute("data-instruction-placeholder", "true");
	await editor.pressSequentially(" Review this");
	await expect(hint).not.toHaveAttribute("data-instruction-placeholder");
	await expect(editor).toContainText("Review this");
});

test("instruction hint disappears when inserting a line break", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	const hint = editor.locator("xpath=..");
	await expect(hint).toHaveAttribute("data-instruction-placeholder", "true");
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	await expect(hint).toHaveAttribute("data-instruction-placeholder", "true");
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Summarize onboarding feedback/ }).click();
	await expect(hint).toHaveAttribute("data-instruction-placeholder", "true");
	await editor.press("Shift+Enter");
	await expect(hint).not.toHaveAttribute("data-instruction-placeholder");
	await expect(editor.locator('[data-mention-category="subagent"]')).toHaveCount(1);
});
