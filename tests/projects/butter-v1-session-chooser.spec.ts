import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("session choices use the shared dropdown hover color for pointer and keyboard selection", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.getByRole("button", { name: "Change status, In progress" }).click();
	const status = page.getByRole("menuitem", { name: "To do", exact: true });
	await status.hover();
	const referenceColor = await status.evaluate((row) => getComputedStyle(row).backgroundColor);
	await page.keyboard.press("Escape");
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	const sessions = page.getByRole("list", { name: "Choose a session" });
	const first = sessions.locator("article").first();
	await first.hover();
	await expect.poll(() => first.evaluate((row) => getComputedStyle(row).backgroundColor)).toBe(referenceColor);
	await editor.focus();
	await editor.press("ArrowDown");
	await expect.poll(() => sessions.locator('article[data-selected="true"]').evaluate((row) => getComputedStyle(row).backgroundColor)).toBe(referenceColor);
});

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

test("selecting a session keeps the draft in the sticky composer", async ({ page }) => {
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
	await expect(editor).toBeFocused();
	await expect(editor).toContainText("Please check this");
	await expect(page.getByTestId("reply-target-chip")).toContainText("Summarize onboarding feedback");
	await expect(thread).toHaveAttribute("data-active", "");
	await expect(page.locator('[data-rovo-chat-placement="floating"]')).toHaveCount(0);
	await editor.press("Enter");
	await expect(thread).toContainText("Please check this");
	await expect(page.getByTestId("reply-target-chip")).toHaveCount(0);
});

for (const reducedMotion of ["reduce", "no-preference"] as const) test(`an acknowledged reply resumes only the selected session (${reducedMotion})`, async ({ page }) => {
	test.setTimeout(60_000);
	await page.emulateMedia({ reducedMotion });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-claude-onboarding-feedback"]');
	const card = thread.getByTestId("agent-session-row-butter-claude-onboarding-feedback");
	const other = page.getByTestId("agent-session-row-butter-claude-postmortem");
	await expect(card).toContainText("Finished");
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Summarize onboarding feedback/ }).click();
	const reply = editor;
	await reply.pressSequentially(" Please check this");
	const transition = page.evaluate(() => new Promise<{ state: string; opacity: number; scale: number; count: number; label: string; blur: number; labelTransform: string }[]>((resolve, reject) => {
		const frames: { state: string; opacity: number; scale: number; count: number; label: string; blur: number; labelTransform: string }[] = [];
		const started = performance.now();
		let seenWorking = false;
		function sample() {
			const button = document.querySelector('[data-testid="agent-session-row-butter-claude-onboarding-feedback"] button[aria-label="Working"]');
			const visuals = button?.querySelectorAll<HTMLElement>("[data-agent-session-lifecycle-state]");
			const visual = visuals?.[0];
			if (visual) {
				const label = visual.querySelector<HTMLElement>("[data-agent-session-lifecycle-label]");
				const glyph = visual.querySelector<HTMLElement>("[data-agent-session-lifecycle-glyph]");
				const state = visual.dataset.agentSessionLifecycleState ?? "";
				seenWorking ||= state === "running";
				const glyphStyle = glyph ? getComputedStyle(glyph) : null;
				const glyphTransform = glyphStyle?.transform ?? "none";
				const scale = glyphTransform === "none" ? 1 : new DOMMatrixReadOnly(glyphTransform).a;
				const labelStyle = label ? getComputedStyle(label) : null;
				frames.push({ state, opacity: Number(glyphStyle?.opacity ?? 1), scale, count: visuals.length, label: label?.dataset.agentSessionLifecycleLabel ?? "", blur: Number(labelStyle?.filter.match(/blur\(([\d.]+)px\)/u)?.[1] ?? 0), labelTransform: labelStyle?.transform ?? "none" });
				if (seenWorking && frames.length > 2 && frames.at(-1)!.label === "running" && frames.at(-1)!.opacity >= 0.999 && Math.abs(frames.at(-1)!.scale - 1) < 0.01 && frames.at(-1)!.blur < 0.01) { resolve(frames); return; }
			}
			if (performance.now() - started > 10000) reject(new Error(`Lifecycle transition did not settle (working: ${seenWorking})`));
			else requestAnimationFrame(sample);
		}
		requestAnimationFrame(sample);
	}));
	await reply.press("Enter");
	await expect(card).toContainText("Finished");
	await expect(thread.getByRole("group", { name: "Reactions" }).getByText("👀")).toBeVisible({ timeout: 10_000 });
	await expect(card).toContainText("Working");
	const frames = await transition;
	expect(frames.every((frame) => frame.count === 1)).toBe(true);
	expect(frames.every((frame) => frame.label === frame.state && frame.labelTransform === "none"), JSON.stringify(frames)).toBe(true);
	if (reducedMotion === "reduce") expect(frames.every((frame) => frame.state === "running" && frame.opacity === 1 && frame.scale === 1 && frame.blur === 0), JSON.stringify(frames)).toBe(true);
	else {
		expect(frames.some((frame) => frame.state === "complete" && frame.opacity < 0.95 && frame.scale < 0.99 && frame.blur > 0.1), JSON.stringify(frames)).toBe(true);
		expect(frames.some((frame) => frame.state === "running" && frame.opacity < 0.95 && frame.scale < 0.99 && frame.blur > 0.1), JSON.stringify(frames)).toBe(true);
		expect(frames.some((frame) => frame.state === "running" && frame.opacity >= 0.999 && frame.blur > 0.1), JSON.stringify(frames)).toBe(true);
		expect(frames.findIndex((frame) => frame.state === "running")).toBeGreaterThan(frames.findLastIndex((frame) => frame.state === "complete"));
	}
	await page.getByRole("button", { name: "Show more activity" }).click();
	await expect(other).toContainText("Finished");
});

test("a submitted handoff does not prefill later manual replies", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await editor.pressSequentially(" Please check this instruction once");
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Rewrite the incident postmortem/ }).click();
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-claude-postmortem"]');
	const reply = editor;
	await expect(reply).toContainText("Please check this instruction once");
	await reply.press("Enter");
	await expect(page.getByTestId("reply-target-chip")).toHaveCount(0);
	const header = thread.locator('[data-slot="jira-activity-comment-header"]').first();
	await header.hover();
	await header.getByRole("button", { name: "Reply", exact: true }).click();
	await expect(reply).toBeFocused();
	await expect(reply).not.toContainText("Please check this instruction once");
	await reply.press("ControlOrMeta+A");
	await reply.press("Backspace");
	await expect(reply).toHaveText("");
	await header.hover();
	await header.getByRole("button", { name: "Reply", exact: true }).click();
	await thread.getByRole("button", { name: /Show \d+ replies/u }).click();
	const participant = thread.locator('[data-slot="jira-activity-comment-header"]').filter({ hasText: "Sarah Lim" });
	await participant.hover();
	await participant.getByRole("button", { name: "Reply", exact: true }).click();
	await expect(reply).toBeFocused();
	await expect(page.getByTestId("reply-target-chip")).toContainText("Replying to The onboarding guide still sends people to the old identity page.");
	await expect(reply).not.toContainText("Please check this instruction once");
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
	await expect(page.getByRole("region", { name: "Work item full screen view" }).getByRole("button", { name: "Expand Related work" })).toHaveAttribute("aria-expanded", "false");
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
