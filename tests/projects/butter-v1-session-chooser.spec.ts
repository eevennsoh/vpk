import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("work item session cards show Venn as their owner", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	for (const [id, agent] of [["butter-claude", "Claude"], ["butter-cursor-forecast", "Cursor"], ["butter-claude-onboarding-feedback", "Claude"]]) {
		const thread = workItem.locator(`[data-jira-activity-entry-id="invocation-${id}"]`);
		await expect(thread).toContainText(`Venn added ${agent}`);
		await expect(thread.getByRole("group", { name: `${agent}, used by Venn` }).first()).toBeVisible();
		await expect(thread.getByText(/only Annie Cook can act on it/)).toHaveCount(0);
	}
});

test("selecting a session opens its inline reply with the draft", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await editor.pressSequentially(" Please check this");
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	await editor.press("Enter");
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-claude-onboarding-feedback"]');
	const reply = thread.getByRole("textbox", { name: "Leave a reply..." });
	await expect(reply).toBeFocused();
	await expect(reply).toContainText("Claude");
	await expect(reply).toContainText("Please check this");
	await expect(page.locator('[data-rovo-chat-placement="floating"]')).toHaveCount(0);
	await reply.press("Enter");
	await expect(thread).toContainText("Please check this");
	await expect(reply).toHaveCount(0);
});

test("Backspace returns to session choices at the agent mention", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1170, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	const choices = page.getByRole("listbox", { name: "Choose agent session" });
	await choices.getByRole("option", { name: "Start a new session" }).click();
	await editor.pressSequentially("abc");
	await editor.press("Backspace");
	await expect(editor).toContainText("ab");
	await expect(choices).toBeHidden();
	await editor.press("Backspace");
	await editor.press("Backspace");
	await editor.press("Backspace");
	await expect(choices).toBeVisible();
	await expect(editor).toContainText("Claude");
	await expect(editor).toBeFocused();
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await expect(page.getByRole("list", { name: "Choose a session" })).toBeVisible();
	await editor.press("Backspace");
	await expect(choices).toBeVisible();
	await expect(editor).toContainText("Claude");
});

test("duplicative sessions opens the work item directly", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1170, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await expect(page.getByRole("group", { name: "Duplicative sessions view" })).toHaveCount(0);
	await expect(page.getByRole("region", { name: "Duplicative sessions agent selector" })).toHaveCount(0);
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	await expect(workItem).toBeVisible();
	const commentBar = workItem.getByRole("group", { name: "Comment editor" });
	await expect(commentBar).toBeVisible();
	const barBounds = await commentBar.boundingBox();
	if (!barBounds) throw new Error("Comment editor is unavailable");
	expect(barBounds.y + barBounds.height).toBeLessThanOrEqual(1000);
	const galleryBounds = await page.getByRole("button", { name: "Select Agent & app selector" }).boundingBox();
	if (!galleryBounds) throw new Error("Gallery navigation is unavailable");
	expect(barBounds.y + barBounds.height).toBeLessThanOrEqual(galleryBounds.y);
	expect(await workItem.locator("[data-jira-activity-entry-id]").count()).toBeGreaterThan(2);
	const expandRelated = workItem.getByRole("button", { name: "Expand Related work" });
	await expect(expandRelated).toHaveAttribute("aria-expanded", "false");
	await expandRelated.click();
	await expect(workItem.getByRole("button", { name: "Collapse Related work" })).toHaveAttribute("aria-expanded", "true");
	await workItem.getByRole("button", { name: "Collapse Related work" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const scrollTop = await commentBar.evaluate((bar) => {
		let parent = bar.parentElement;
		while (parent && !/(auto|scroll)/u.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
		return parent?.scrollTop;
	});
	await page.keyboard.press("m");
	await expect.poll(() => commentBar.evaluate((bar) => {
		let parent = bar.parentElement;
		while (parent && !/(auto|scroll)/u.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
		return parent?.scrollTop;
	})).toBe(scrollTop);
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	await expect(page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Summarize onboarding feedback/ })).toBeVisible();
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Rewrite the incident postmortem/ }).hover();
	await expect(workItem.locator('[data-jira-activity-entry-id="invocation-butter-claude-postmortem"]')).toHaveAttribute("data-active", "");
	const olderPosition = await commentBar.evaluate((bar) => {
		let parent = bar.parentElement;
		while (parent && !/(auto|scroll)/u.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
		return parent?.scrollTop ?? 0;
	});
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Summarize onboarding feedback/ }).hover();
	await expect(workItem.locator('[data-jira-activity-entry-id="invocation-butter-claude-onboarding-feedback"]')).toHaveAttribute("data-active", "");
	await expect.poll(() => commentBar.evaluate((bar) => {
		let parent = bar.parentElement;
		while (parent && !/(auto|scroll)/u.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
		return parent?.scrollTop ?? 0;
	})).toBeLessThan(olderPosition);
	const back = workItem.getByRole("button", { name: "Back", exact: true });
	await expect(back).toHaveCSS("height", "36px");
	await expect(back).toHaveCSS("border-bottom-left-radius", "0px");
	await expect(back).toHaveCSS("border-bottom-right-radius", "0px");
	await page.getByRole("button", { name: "Open gallery" }).click();
	await page.getByRole("button", { name: "Select Work item" }).click();
	await expect(page.getByRole("region", { name: "Work item full screen view" }).getByRole("button", { name: "Collapse Related work" })).toHaveAttribute("aria-expanded", "true");
});

test("hovering sessions animates the activity scroll in the duplicative sessions work item", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.setViewportSize({ width: 1170, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	const chooser = page.getByRole("list", { name: "Choose a session" });
	const sampleScroll = () => page.evaluate(() => new Promise<number[]>((resolve) => {
		let root = document.querySelector<HTMLElement>("[data-project-butter-activity-feed]")?.parentElement;
		while (root && !/(auto|scroll)/u.test(getComputedStyle(root).overflowY)) root = root.parentElement;
		if (!root) throw new Error("Activity scrollport is unavailable");
		const positions: number[] = [];
		const start = performance.now();
		function sample() {
			positions.push(root!.scrollTop);
			if (performance.now() - start < 700) requestAnimationFrame(sample);
			else resolve(positions);
		}
		requestAnimationFrame(sample);
	}));
	const samples = sampleScroll();
	await chooser.getByRole("button", { name: /Rewrite the incident postmortem/ }).hover();
	const positions = await samples;
	await expect(page.locator('[data-jira-activity-entry-id="invocation-butter-claude-postmortem"]')).toHaveAttribute("data-active", "");
	expect(new Set(positions).size).toBeGreaterThan(3);
	const returnSamples = sampleScroll();
	await chooser.getByRole("button", { name: /Summarize onboarding feedback/ }).hover();
	await expect(page.locator('[data-jira-activity-entry-id="invocation-butter-claude-onboarding-feedback"]')).toHaveAttribute("data-active", "");
	const returnPositions = await returnSamples;
	expect(new Set(returnPositions).size).toBeGreaterThan(3);
	const largestStep = Math.max(...returnPositions.slice(1).map((value, index) => Math.abs(value - returnPositions[index])));
	expect(largestStep).toBeLessThan(Math.abs(returnPositions.at(-1)! - returnPositions[0]) * 0.6);
});
