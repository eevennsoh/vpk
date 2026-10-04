import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

/**
 * E2E coverage for the tiptap chat-composer palette (Phase 2).
 *
 * Requires a running stack (this worktree's dev server via tests/helpers/origin.ts;
 * override with PLAYWRIGHT_BASE_URL). NOT part of the `ci:pr` gate — run with
 * `pnpm exec playwright test tests/ui-custom/composer-palette.spec.ts`.
 *
 * Targets the prompt-input chat-composer demo, which renders the shared PromptInput
 * primitive — now a mentions-only tiptap contentEditable with the `/` and `@`
 * palettes. Assertions are anchored to real catalog labels from
 * app/data/directory (skills/people) so they stay meaningful as data evolves.
 */

const COMPOSER_URL = appUrl("/preview/ui-custom/prompt-input");

// The tiptap editor renders as a ProseMirror contentEditable inside the primitive.
const EDITOR = ".ProseMirror[contenteditable='true']";

test.beforeEach(async ({ page }) => {
	await page.goto(COMPOSER_URL);
	await expect(page.locator(EDITOR).first()).toBeVisible();
});

test("`/` opens the slash menu with reference categories and excludes text formatting", async ({ page }) => {
	const editor = page.locator(EDITOR).first();
	await editor.click();
	await page.keyboard.type("/");

	// Chat composers are already an Ask Rovo surface, so the editor-only Ask
	// Rovo prompt is hidden while reference categories stay available.
	await expect(page.getByRole("textbox", { name: "Ask Rovo" })).toHaveCount(0);
	await expect(page.getByRole("option", { name: /Skills/i }).first()).toBeVisible();
	await expect(page.getByRole("option", { name: /Apps/i }).first()).toBeVisible();

	// …but NOT the document editor's block-formatting commands (includeFormat:false).
	await expect(page.getByText(/^Heading 1$/)).toHaveCount(0);
	await expect(page.getByText(/^Bullet list$/)).toHaveCount(0);
});

test("`@` opens the mention menu for people and teams", async ({ page }) => {
	const editor = page.locator(EDITOR).first();
	await editor.click();
	await page.keyboard.type("@");

	// People/team mention targets surface (catalog has people like "Priya Nair").
	await expect(page.getByText(/people|team/i).first()).toBeVisible();
});

test("top-level `/` search inserts a matching reference, and Escape closes the menu", async ({ page }) => {
	const editor = page.locator(EDITOR).first();
	await editor.click();

	// Escape closes the open menu without inserting anything.
	await page.keyboard.type("/");
	await expect(page.getByRole("listbox", { name: "Commands" })).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Ask Rovo" })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(page.getByRole("listbox", { name: "Commands" })).toHaveCount(0);
	await page.keyboard.press("Backspace");

	// Re-open, narrow to a known skill, and select it -> inline mention token.
	await page.keyboard.type("/Design");
	const option = page.getByRole("option", { name: /Design landing page/i }).first();
	await expect(option).toBeVisible();
	await option.click();

	// The selected reference is inserted and the trigger/query text is consumed.
	await expect(editor).toContainText("Design landing page");
	await expect(editor).not.toContainText("/Design");
});

test("`/` keeps search scoped after drilling into a category", async ({ page }) => {
	const editor = page.locator(EDITOR).first();
	await editor.click();
	await page.keyboard.type("/");
	await page.getByRole("option", { name: /Skills/i }).click();

	await page.keyboard.type("Design");

	await expect(page.getByRole("listbox", { name: "Skills" })).toBeVisible();
	await expect(page.getByRole("option", { name: /Design landing page/i })).toBeVisible();
	await expect(page.getByRole("option", { name: /Tools/i })).toHaveCount(0);
});

test("top-level `@` search spans people and agents", async ({ page }) => {
	const editor = page.locator(EDITOR).first();
	await editor.click();
	await page.keyboard.type("@Andrea");

	const person = page.getByRole("option", { name: /Andrea Wilson/i }).first();
	await expect(person).toBeVisible();
	await person.click();

	await expect(editor).toContainText("Andrea Wilson");
	await expect(editor).not.toContainText("@Andrea");
});

test("Tab in the composer slash menu selects a reference instead of focusing Ask Rovo", async ({ page }) => {
	const editor = page.locator(EDITOR).first();
	await editor.click();
	await page.keyboard.type("/Design");
	await page.keyboard.press("Tab");

	await expect(page.getByRole("textbox", { name: "Ask Rovo" })).toHaveCount(0);
	await expect(editor).toContainText("Design landing page");
	await expect(editor).not.toContainText("/Design");
});

test("Shift+Enter inserts a newline rather than submitting", async ({ page }) => {
	const editor = page.locator(EDITOR).first();
	await editor.click();
	await page.keyboard.type("first line");
	await page.keyboard.press("Shift+Enter");
	await page.keyboard.type("second line");

	// Both lines remain in the still-focused editor (no submit/clear happened).
	await expect(editor).toContainText("first line");
	await expect(editor).toContainText("second line");
});
