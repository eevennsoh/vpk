import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the instruction placeholder stays beside the agent mention after deleting text", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await editor.pressSequentially("abc");
	for (let index = 0; index < 4; index++) await editor.press("Backspace");
	await expect(editor.locator("xpath=..")).toHaveAttribute("data-instruction-placeholder", "true");
	const metrics = await editor.evaluate((element) => {
		const paragraph = element.querySelector("p");
		const mention = element.querySelector('[data-mention-category="subagent"]');
		if (!paragraph || !mention) throw new Error("Missing mention paragraph");
		return { paragraphHeight: paragraph.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(paragraph).lineHeight) };
	});
	expect(metrics.paragraphHeight).toBeLessThanOrEqual(metrics.lineHeight + 2);
	await editor.pressSequentially("hello");
	await expect(editor).toContainText("hello");
	await expect(editor.locator("xpath=..")).not.toHaveAttribute("data-instruction-placeholder");
});
