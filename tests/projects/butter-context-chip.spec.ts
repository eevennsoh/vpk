import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`reply context uses a removable overlay tag (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Work item" }).click();
		await page.getByRole("button", { name: "Close gallery" }).click();
		const thread = page.locator('[data-jira-activity-entry-kind="comment"]').first();
		await thread.scrollIntoViewIfNeeded();
		await thread.hover();
		await page.evaluate(() => {
			document.addEventListener("transitionrun", (event) => {
				if (event.target instanceof HTMLElement && event.target.dataset.testid === "reply-target-chip") {
					document.documentElement.dataset.contextChipTransition = `${document.documentElement.dataset.contextChipTransition ?? ""} ${event.propertyName}`;
				}
			});
		});
		await thread.getByRole("button", { name: "Reply", exact: true }).first().click();
		const chip = page.getByTestId("reply-target-chip");
		const tag = chip.locator('[data-slot="tag"]');
		const remove = chip.getByRole("button", { name: "Remove reply target" });
		const form = page.getByRole("form", { name: "Comment editor" });
		const mention = form.getByRole("textbox", { name: "Comment editor" }).locator('[data-mention-id^="subagent:"]');
		await expect(chip.locator("[data-tag-text]")).toHaveText("Replying to Review the onboarding flow");
		await expect(mention).toHaveText("Cursor");
		await expect(form.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
		if (reducedMotion === "no-preference") {
			await expect.poll(() => page.locator("html").getAttribute("data-context-chip-transition")).toContain("scale");
		} else {
			await expect(page.locator("html")).not.toHaveAttribute("data-context-chip-transition");
		}
		await expect.poll(() => chip.evaluate((element) => element.getAnimations().length)).toBe(0);
		const replyIcon = chip.locator(":scope > span").first().locator("svg");
		const addIcon = page.getByRole("button", { name: "Mention an agent or person" }).locator("svg");
		await expect(tag).toHaveCSS("font-size", "14px");
		await expect(remove).toHaveAttribute("data-slot", "tag-remove-overlay-button");
		await expect(replyIcon).toHaveCSS("width", "12px");
		await expect(replyIcon).toHaveCSS("height", "12px");
		await expect(chip.locator(":scope > span").first()).toHaveCSS("width", "36px");
		await expect(chip.locator(":scope > span").first()).toHaveCSS("height", "24px");
		await expect(addIcon).toHaveCSS("width", "16px");
		const replyBox = await replyIcon.boundingBox();
		const addBox = await addIcon.boundingBox();
		if (!replyBox || !addBox) throw new Error("Missing reply or add icon");
		expect(Math.abs(replyBox.x + replyBox.width / 2 - addBox.x - addBox.width / 2)).toBeLessThanOrEqual(1);
		await expect(remove).toHaveCSS("opacity", "0");
		await expect(remove).toHaveCSS("width", "16px");
		await expect(remove).toHaveCSS("height", "16px");
		const formBox = await form.boundingBox();
		const replyIconBox = await replyIcon.boundingBox();
		const addIconBox = await addIcon.boundingBox();
		if (!formBox || !replyIconBox || !addIconBox) throw new Error("Missing composer or icon geometry");
		expect(Math.abs((replyIconBox.y + replyIconBox.height / 2 - formBox.y) - (formBox.y + formBox.height - addIconBox.y - addIconBox.height / 2))).toBeLessThanOrEqual(1);
		const labelBox = await tag.locator("[data-tag-text]").boundingBox();
		const editorBox = await form.getByRole("textbox", { name: "Comment editor" }).boundingBox();
		if (!labelBox || !editorBox) throw new Error("Missing tag label or editor geometry");
		expect(Math.abs(labelBox.x - editorBox.x)).toBeLessThanOrEqual(1);
		const restingWidth = (await chip.boundingBox())?.width;
		await tag.hover();
		await expect(remove).toHaveCSS("opacity", "1");
		expect((await chip.boundingBox())?.width).toBe(restingWidth);
		await page.mouse.move(0, 0);
		await chip.getByRole("button", { name: /^Review Replying to/ }).focus();
		await page.keyboard.press("Tab");
		await expect(remove).toBeFocused();
		await expect(remove).toHaveCSS("opacity", "1");
		await page.keyboard.press("Enter");
		await expect(chip).toHaveCount(0);
		await expect(mention).toHaveCount(0);
	});
}

for (const view of ["Timeline", "Agent sessions"] as const) {
	test(`nested replies identify and quote the selected message in ${view}`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Work item", exact: true }).click();
		await page.getByRole("button", { name: "Close gallery", exact: true }).click();
		const activity = page.getByRole("region", { name: "Activity", exact: true });
		await activity.getByRole("tab", { name: view, exact: true }).click();
		const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
		await thread.getByRole("button", { name: view === "Timeline" ? /Show 4 replies/u : "Show replies" }).click();
		const form = page.getByRole("form", { name: "Comment editor" });
		const editor = form.getByRole("textbox", { name: "Comment editor" });
		const chip = form.getByTestId("reply-target-chip");
		const replies = thread.getByRole("group", { name: "Replies", exact: true });
		await editor.fill("Keep this draft");
		await thread.getByRole("button", { name: "Reply", exact: true }).first().press("Enter");
		const mention = editor.locator('[data-mention-id^="subagent:"]');
		await expect(mention).toHaveText("Cursor");
		await expect(editor).toContainText("Keep this draft");
		const longMessage = "The step controls are reachable by keyboard, but the error summary needs focus.";
		const truncatedExcerpt = "The step controls are reachable by keyboard, but the error summary needs…";
		for (const [message, excerpt] of [
			["Did you check the account setup step?", "Did you check the account setup step?"],
			["Yes. The validation messages need to explain how to recover from an error.", "Yes."],
			[longMessage, truncatedExcerpt],
		]) {
			const row = replies.locator(":scope > div").filter({ hasText: message });
			await row.hover();
			await row.getByRole("button", { name: "Reply", exact: true }).click();
			await expect(chip.locator("[data-tag-text]")).toHaveText(`Replying to ${excerpt}`);
			await expect(mention).toHaveCount(0);
			await expect(editor).toBeFocused();
			await expect(editor).toHaveText("Keep this draft");
		}
		await chip.getByRole("button", { name: /^Review Replying to The step controls/ }).click();
		const context = page.getByRole("dialog").filter({ hasText: longMessage });
		await expect(context.getByText("Review the onboarding flow", { exact: true })).toBeVisible();
		await expect(context.getByText(longMessage, { exact: true })).toBeVisible();
		await page.keyboard.press("Escape");
		await form.getByRole("button", { name: "Submit", exact: true }).click();
		await expect(thread.getByRole("button", { name: /Show 5 replies/u })).toHaveAttribute("aria-expanded", "false");
		const sentReply = replies.locator(":scope > div").filter({ has: page.getByText("Keep this draft", { exact: true }) });
		const quote = sentReply.locator("blockquote");
		await expect(quote).toHaveText(truncatedExcerpt);
		await expect(quote).toHaveCSS("border-inline-start-width", "2px");
		await expect(sentReply.getByText("Keep this draft", { exact: true })).toBeVisible();
	});
}


test("context chip uses the tag overlay action and keeps it keyboard accessible", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/ui-custom/context-chip"));
	const chip = page.locator("#preview").getByTestId("context-chip-reply");
	const tag = chip.locator('[data-slot="tag"]');
	const remove = chip.getByRole("button", { name: "Remove reply target" });
	await expect.poll(() => chip.evaluate((element) => element.getAnimations().length)).toBe(0);
	await page.mouse.move(0, 0);
	await expect(remove).toHaveCSS("opacity", "0");
	await expect(tag).toHaveCSS("font-size", "14px");
	await expect(tag).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(remove).toHaveCSS("width", "16px");
	await expect(remove).toHaveCSS("height", "16px");
	const restingWidth = (await chip.boundingBox())?.width;
	await tag.hover();
	await expect(tag).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
	await expect(remove).toHaveCSS("opacity", "1");
	const tagBox = await tag.boundingBox();
	const removeBox = await remove.boundingBox();
	if (!tagBox || !removeBox) throw new Error("Missing tag or remove control geometry");
	const topGap = removeBox.y - tagBox.y;
	const bottomGap = tagBox.y + tagBox.height - removeBox.y - removeBox.height;
	const rightGap = tagBox.x + tagBox.width - removeBox.x - removeBox.width;
	expect(Math.abs(topGap - rightGap)).toBeLessThanOrEqual(1);
	expect(Math.abs(bottomGap - rightGap)).toBeLessThanOrEqual(1);
	expect((await chip.boundingBox())?.width).toBe(restingWidth);
	const label = chip.getByText("Replying to Summarize onboarding feedback", { exact: true });
	const labelBox = await label.boundingBox();
	expect(labelBox).not.toBeNull();
	await chip.getByRole("button", { name: /^Review Replying to/ }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await page.mouse.move(0, 0);
	await chip.getByRole("button", { name: /^Review Replying to/ }).focus();
	await page.keyboard.press("Tab");
	await expect(remove).toBeFocused();
	await expect(remove).toHaveCSS("opacity", "1");
	await page.keyboard.press("Enter");
	await expect(chip).toHaveCount(0);
	await page.locator("#preview").getByRole("button", { name: "Restore context" }).click();
	await expect(remove).toHaveCSS("opacity", "0");
});
