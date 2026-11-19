import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

async function expectCaretAligned(editor: Locator, anchorSelector: string) {
	await editor.press("End");
	const geometry = await editor.evaluate((element, selector) => {
		const anchor = element.querySelector<HTMLElement>(selector);
		const chip = element.querySelector<HTMLElement>(".rich-text-mention-chip");
		const selection = window.getSelection();
		if (!anchor || !chip || !selection?.rangeCount) throw new Error("Missing mention or caret");
		const a = anchor.getBoundingClientRect();
		const c = chip.getBoundingClientRect();
		const r = selection.getRangeAt(0).getBoundingClientRect();
		return { anchorHeight: a.height, anchorCenter: a.top + a.height / 2, chipCenter: c.top + c.height / 2, caretHeight: r.height, caretCenter: r.top + r.height / 2, editorFontSize: getComputedStyle(element).fontSize, chipFontSize: getComputedStyle(chip).fontSize };
	}, anchorSelector);
	expect(geometry.caretHeight).toBeGreaterThan(0);
	expect(Math.abs(geometry.anchorHeight - geometry.caretHeight)).toBeLessThan(2);
	expect(Math.abs(geometry.anchorCenter - geometry.chipCenter)).toBeLessThan(1);
	expect(Math.abs(geometry.caretCenter - geometry.chipCenter)).toBeLessThan(2);
	expect(geometry.chipFontSize).toBe(geometry.editorFontSize);
}

test("the standalone mention preview keeps its caret aligned before and after typing", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/jira-at-mention"));
	await page.getByRole("button", { name: "Replay animation" }).click();
	const editor = page.getByRole("textbox", { name: "Inline reply" });
	await expect(editor.locator("[data-mention-caret-anchor]")).toHaveCSS("opacity", "1");
	await expect(editor).toBeFocused();
	const caret = await editor.evaluate(() => {
		const selection = window.getSelection();
		const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
		return { height: range?.getBoundingClientRect().height ?? 0, isText: range?.startContainer.nodeType === Node.TEXT_NODE, offset: range?.startOffset, length: range?.startContainer.textContent?.length };
	});
	expect(caret.height).toBeGreaterThan(0);
	expect(caret.isText).toBe(true);
	expect(caret.offset).toBe(caret.length);
	await expectCaretAligned(editor, "[data-mention-caret-anchor]");
	await page.keyboard.type("asdf");
	await expect(editor).toContainText("asdf");
	await expectCaretAligned(editor, "[data-mention-caret-anchor]");
	await page.getByRole("button", { name: "Replay animation" }).click();
	await expect(editor).toBeFocused();
	await page.keyboard.type(" more");
	await expect(editor).toContainText("asdf more");
});

test("reduced motion focuses the inline reply immediately", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/preview/blocks/jira-at-mention"));
	await page.getByRole("button", { name: "Replay animation" }).click();
	const editor = page.getByRole("textbox", { name: "Inline reply" });
	await expect(editor).toBeFocused();
	await page.keyboard.type("Ready");
	await expect(editor).toContainText("Ready");
});

test("replay does not steal focus from another control", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/jira-at-mention"));
	await page.getByRole("button", { name: "Replay animation" }).click();
	const arc = page.getByRole("textbox", { name: "Arc" });
	await arc.focus();
	await expect(page.getByRole("textbox", { name: "Inline reply" }).locator("[data-mention-caret-anchor]")).toHaveCSS("opacity", "1");
	await expect(arc).toBeFocused();
});

test("Butter inline replies keep their caret aligned beside an agent mention", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	const comment = page.getByRole("textbox", { name: "Comment editor" });
	await comment.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Summarize onboarding feedback/ }).click();
	const reply = page.getByRole("textbox", { name: "Leave a reply..." });
	await expect(reply).toBeFocused();
	await page.keyboard.press("End");
	await page.keyboard.type(" text");
	await expect(reply).toContainText("text");
	await expectCaretAligned(reply, ".react-renderer.node-mention");
});
