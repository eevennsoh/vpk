import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

async function openGalleryCommentEditor(page: Page) {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	return page.getByRole("region", { name: "Work item full screen view" }).getByRole("textbox", { name: "Comment editor" });
}

async function mentionGalleryClaude(page: Page) {
	const editor = page.getByRole("region", { name: "Work item full screen view" }).getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	return editor;
}

test("gallery Claude mentions offer the existing completed session", async ({ page }) => {
	const editor = await openGalleryCommentEditor(page);
	await mentionGalleryClaude(page);
	const choices = page.getByRole("listbox", { name: "Choose agent session" });
	await expect(choices.getByRole("option")).toHaveText(["Continue in existing session", "Start a new session"]);
	await editor.pressSequentially(" Review the remaining action items");
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	const sessions = page.getByRole("list", { name: "Choose a session" });
	await expect(sessions.getByRole("button", { name: /Summarize onboarding feedback/ })).toBeVisible();
	await sessions.getByRole("button", { name: /Rewrite the incident postmortem/ }).click();
	await expect(page.getByRole("textbox", { name: "Leave a reply..." })).toContainText("Review the remaining action items");
});

test("session previews match comment hover and mask the timeline behind reply controls", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	await page.getByRole("textbox", { name: "Comment editor" }).pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	const session = page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Rewrite the incident postmortem/ });
	await session.hover();
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-claude-postmortem"]');
	await expect(thread).toHaveAttribute("data-active", "");
	const previewColors = await thread.evaluate((row) => ({
		plate: getComputedStyle(row, "::after").backgroundColor,
		mask: getComputedStyle(row.querySelector("[data-jira-activity-reply-toggle-icon]")!).backgroundImage,
	}));
	const hoveredThread = page.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]');
	await hoveredThread.locator("[data-jira-activity-reply-toggle-icon]").hover();
	await expect.poll(() => hoveredThread.evaluate((row) => getComputedStyle(row, "::after").backgroundColor)).toBe(previewColors.plate);
	const hoverColors = await hoveredThread.evaluate((row) => ({
		plate: getComputedStyle(row, "::after").backgroundColor,
		mask: getComputedStyle(row.querySelector("[data-jira-activity-reply-toggle-icon]")!).backgroundImage,
	}));
	expect(hoverColors.mask).not.toBe("none");
	expect(previewColors).toEqual(hoverColors);
});

test("session preview scroll moves smoothly to the selected activity", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.keyboard.press("m");
	await page.getByRole("textbox", { name: "Comment editor" }).pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	const session = page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Rewrite the incident postmortem/ });
	const samples = page.evaluate(() => new Promise<number[]>((resolve) => {
		const feed = document.querySelector<HTMLElement>("[data-project-butter-activity-feed]");
		let root = feed?.parentElement;
		while (root && !/(auto|scroll)/u.test(getComputedStyle(root).overflowY)) root = root.parentElement;
		if (!root) throw new Error("Activity scrollport is unavailable");
		const values: number[] = [];
		const start = performance.now();
		const sample = () => {
			values.push(root.scrollTop);
			if (performance.now() - start < 700) requestAnimationFrame(sample);
			else resolve(values);
		};
		requestAnimationFrame(sample);
	}));
	await session.hover();
	const positions = await samples;
	await expect(page.locator('[data-jira-activity-entry-id="invocation-butter-claude-postmortem"]')).toHaveAttribute("data-active", "");
	expect(new Set(positions).size).toBeGreaterThan(3);
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Summarize onboarding feedback/ }).hover();
	const stopped = await page.evaluate(() => new Promise<{ before: number; after: number }>((resolve) => {
		let root = document.querySelector<HTMLElement>("[data-project-butter-activity-feed]")?.parentElement;
		while (root && !/(auto|scroll)/u.test(getComputedStyle(root).overflowY)) root = root.parentElement;
		if (!root) throw new Error("Activity scrollport is unavailable");
		root.dispatchEvent(new WheelEvent("wheel", { deltaY: 20 }));
		root.scrollTop += 20;
		const before = root.scrollTop;
		window.setTimeout(() => resolve({ before, after: root.scrollTop }), 400);
	}));
	expect(stopped.after).toBe(stopped.before);
});

test("gallery Claude session choices support multiple sessions and Back", async ({ page }) => {
	const editor = await openGalleryCommentEditor(page);
	await mentionGalleryClaude(page);
	const choices = page.getByRole("listbox", { name: "Choose agent session" });
	await choices.getByRole("option", { name: "Start a new session" }).click();
	await editor.pressSequentially(" A second Claude review");
	await editor.press("Enter");
	await page.keyboard.press("m");
	await mentionGalleryClaude(page);
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	const sessions = page.getByRole("list", { name: "Choose a session" });
	await expect(sessions.locator("article")).toHaveCount(3);
	await expect(sessions.locator("article").filter({ hasText: "Rewrite the incident postmortem" })).toContainText("Finished");
	const targetMenu = page.locator("[data-project-butter-session-target-menu]");
	const back = targetMenu.getByRole("button", { name: "Back", exact: true });
	await sessions.locator("article").first().hover();
	await expect(sessions.locator("article").first()).toHaveAttribute("data-selected", "true");
	await editor.focus();
	await editor.press("ArrowUp");
	await expect(back).toBeFocused();
	await page.keyboard.press("ArrowDown");
	await expect(editor).toBeFocused();
	await expect(sessions.locator("article").first()).toHaveAttribute("data-selected", "true");
	await editor.press("ArrowUp");
	await page.keyboard.press("Enter");
	await expect(choices).toBeVisible();
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await targetMenu.getByRole("button", { name: "Back", exact: true }).click();
	await expect(choices).toBeVisible();
	await expect(editor).toContainText("Claude");
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await targetMenu.getByRole("button", { name: "Back", exact: true }).focus();
	await page.keyboard.press("Enter");
	await expect(choices).toBeVisible();
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await editor.press("ArrowLeft");
	await expect(choices).toBeVisible();
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await editor.press("Escape");
	await expect(choices).toBeVisible();
	await expect(editor).toContainText("Claude");
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await sessions.getByRole("button", { name: /A second Claude review/ }).click();
	await expect(page.getByRole("textbox", { name: "Leave a reply..." })).toBeVisible();
});

test("keyboard navigation scrolls the selected session into view", async ({ page }) => {
	const editor = await openGalleryCommentEditor(page);
	for (let index = 0; index < 5; index++) {
		await mentionGalleryClaude(page);
		await page.getByRole("option", { name: "Start a new session" }).click();
		await editor.pressSequentially(` Review item ${index}`);
		await editor.press("Enter");
		await page.keyboard.press("m");
	}
	await mentionGalleryClaude(page);
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	const sessions = page.getByRole("list", { name: "Choose a session" });
	await expect(sessions.locator("article")).toHaveCount(7);
	for (let index = 0; index < 6; index++) await editor.press("ArrowDown");
	const selected = sessions.locator('article[data-selected="true"]');
	await expect(selected).toHaveCount(1);
	const visible = await selected.evaluate((card) => {
		const viewport = card.closest("ul")!.getBoundingClientRect();
		const bounds = card.getBoundingClientRect();
		return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom;
	});
	expect(visible).toBe(true);
});

test("the comment shadow fades without moving the scrollbar over details", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/jira-work-item"));
	await page.getByRole("button", { name: "Full screen", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	await page.keyboard.press("m");
	const bar = dialog.locator("[data-project-butter-comment-bar]");
	await expect(bar.getByRole("textbox", { name: "Comment editor" })).toBeVisible();
	const geometry = await bar.evaluate((element) => {
		const scrollport = element.closest("[data-project-butter-work-item]")!.firstElementChild!;
		const details = element.closest("[data-project-butter-work-item]")!.querySelector("[data-project-butter-details-rail]")!;
		const shadow = element.querySelector("[data-project-butter-comment-shadow]")!;
		return {
			scrollbarOverlapsDetails: scrollport.getBoundingClientRect().right > details.getBoundingClientRect().left,
			shadowRoom: scrollport.getBoundingClientRect().right - shadow.getBoundingClientRect().right,
			shadow: getComputedStyle(shadow).boxShadow,
		};
	});
	expect(geometry.scrollbarOverlapsDetails).toBe(false);
	expect(geometry.shadowRoom).toBeGreaterThanOrEqual(48);
	expect(geometry.shadow).not.toBe("none");
	await expect(dialog.getByRole("separator", { name: "Resize details panel" })).toBeVisible();
});

async function mockRovoThreads(page: Page) {
	const threads = new Map<string, Record<string, unknown>>();
	const openedThreads: string[] = [];
	let delayedThreadId: string | null = null;
	let releaseThread = () => {};
	const threadGate = new Promise<void>((resolve) => { releaseThread = resolve; });
	await page.route("**/api/rovo/threads**", async (route) => {
		const request = route.request();
		const pathname = new URL(request.url()).pathname;
		const id = decodeURIComponent(pathname.split("/").at(-1) ?? "");
		if (request.method() === "POST" && id === "threads") {
			const thread: Record<string, unknown> = request.postDataJSON();
			threads.set(String(thread.id), thread);
			await route.fulfill({ status: 201, json: { thread } });
		} else if (request.method() === "GET" && id === "threads") {
			await route.fulfill({ json: { threads: [...threads.values()] } });
		} else if (request.method() === "PUT") {
			const thread = { ...threads.get(id), ...request.postDataJSON(), id };
			threads.set(id, thread);
			await route.fulfill({ json: { thread } });
		} else if (request.method() === "GET") {
			openedThreads.push(id);
			if (id === delayedThreadId) await threadGate;
			const thread = threads.get(id);
			await route.fulfill(thread ? { json: { thread } } : { status: 404, json: { error: "Not found" } });
		} else await route.continue();
	});
	await page.route("**/api/rovo/runs/**/detach", async (route) => route.fulfill({ json: { detached: true } }));
	await page.route("**/api/chat-title", async (route) => route.fulfill({ json: { title: "Test session" } }));
	return { threads, openedThreads, delayThread: (id: string) => { delayedThreadId = id; }, releaseThread: () => releaseThread() };
}

test("the comment bar has matching left and bottom insets", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	const scrollport = dialog.locator("[data-project-butter-work-item] > div").first();
	const bar = dialog.locator("[data-project-butter-comment-bar]");
	await scrollport.evaluate((element) => {
		const activity = element.querySelector<HTMLElement>("[data-project-butter-activity]");
		if (activity) element.scrollTop += activity.getBoundingClientRect().top - element.getBoundingClientRect().top;
	});
	await expect(bar.getByRole("textbox", { name: "Comment editor" })).toBeVisible();
	const insets = () => bar.evaluate((element) => {
		const viewport = element.closest("[data-project-butter-work-item]")!.firstElementChild!.getBoundingClientRect();
		const bounds = element.getBoundingClientRect();
		return Math.abs((bounds.left - viewport.left) - (viewport.bottom - bounds.bottom));
	});
	await expect.poll(insets).toBeLessThan(1);
	await bar.getByRole("textbox", { name: "Comment editor" }).click();
	await expect.poll(insets).toBeLessThan(1);
	await scrollport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
	await expect.poll(insets).toBeLessThan(1);
});

test("the comment bar reveals quickly and covers content below it while scrolling", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	const scrollport = dialog.locator("[data-project-butter-work-item] > div").first();
	const bar = dialog.locator("[data-project-butter-comment-bar]");
	await expect(bar).toHaveAttribute("data-visible", "false", { timeout: 20_000 });
	const revealMs = await scrollport.evaluate(async (root) => {
		const activity = root.querySelector<HTMLElement>("[data-project-butter-activity]")!;
		const bar = root.querySelector<HTMLElement>("[data-project-butter-comment-bar]")!;
		root.scrollTop += activity.getBoundingClientRect().top - root.getBoundingClientRect().bottom + 40;
		return new Promise<number>((resolve, reject) => {
			const start = performance.now();
			function check(now: number) {
				if (bar.dataset.visible === "true" && Number(getComputedStyle(bar).opacity) >= 0.99) resolve(now - start);
				else if (now - start > 1000) reject(new Error("Comment bar did not reveal"));
				else requestAnimationFrame(check);
			}
			requestAnimationFrame(check);
		});
	});
	expect(revealMs).toBeLessThan(220);
	await scrollport.evaluate((root) => { root.scrollTop += 160; });
	const shadow = bar.locator("[data-project-butter-comment-shadow]");
	await expect.poll(() => shadow.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
	await expect.poll(() => bar.evaluate((element) => {
		const root = element.closest("[data-project-butter-work-item]")!.firstElementChild!;
		const barBounds = element.getBoundingClientRect();
		const viewport = root.getBoundingClientRect();
		const hit = document.elementFromPoint(barBounds.left + barBounds.width / 2, Math.min(barBounds.bottom + 4, viewport.bottom - 1));
		return hit?.hasAttribute("data-project-butter-comment-backdrop") ?? false;
	})).toBe(true);
	await scrollport.evaluate((root) => { root.scrollTop = root.scrollHeight; });
	await expect(dialog.locator("[data-jira-activity-entry-id]").last()).toBeVisible();
});

test("comment dictation does not scale controls with reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeVisible();
	await page.keyboard.press("m");
	await page.getByRole("button", { name: "Start dictation" }).click();
	const scaled = await page.locator("[data-project-butter-comment-editor]").evaluate(async (editor) => {
		for (let frame = 0; frame < 12; frame += 1) {
			await new Promise(requestAnimationFrame);
			for (const element of editor.querySelectorAll("*")) {
				const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
				if (Math.abs(matrix.a - 1) > 0.001 || Math.abs(matrix.d - 1) > 0.001) return true;
			}
		}
		return false;
	});
	expect(scaled).toBe(false);
});

test("agent mentions show complete new avatars for first-party agents", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	await page.keyboard.press("m");
	const editor = page.getByRole("dialog", { name: "Project butter" }).getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially("@Code");
	const reviewer = page.getByRole("option", { name: /^Code Reviewer(?:\s|$)/ });
	const planner = page.getByRole("option", { name: /^Code Planner(?:\s|$)/ });
	await expect(reviewer.locator('[data-shape="hexagon"] img')).toHaveAttribute("src", "/avatar-agent-new/lime/auto-review.svg");
	await expect(planner.locator('[data-shape="hexagon"] img')).toHaveAttribute("src", "/avatar-agent-new/lime/auto-dev.svg");
	await reviewer.click();
	await expect(editor.locator('[data-mention-category="subagent"] img')).toHaveAttribute("src", "/avatar-agent-new/lime/auto-review.svg");
	await editor.press("ControlOrMeta+A");
	await editor.press("Backspace");
	await editor.pressSequentially("@Jira");
	const codingAgent = page.getByRole("option", { name: /^Jira Coding Agent(?:\s|$)/ });
	await expect(codingAgent.locator('[data-shape="hexagon"] img')).toHaveAttribute("src", "/avatar-agent-new/1P/jira-coder.svg");
});

for (const name of ["Claude", "Ali"]) test(`${name} mention aligns with the surrounding comment text`, async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	await page.keyboard.press("m");
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	await editor.pressSequentially(`@${name}`);
	await page.getByRole("option", { name: new RegExp(`^${name}(?:\\s|$)`) }).first().click();
	await editor.pressSequentially(" please review");
	const alignment = await editor.evaluate((element) => {
		const label = element.querySelector<HTMLElement>(".rich-text-mention-chip [data-tag-text]");
		const paragraph = element.querySelector<HTMLElement>("p");
		if (!label || !paragraph) throw new Error("Mention label or comment text not found");
		const text = [...paragraph.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
		if (!text) throw new Error("Comment text not found");
		const labelRange = document.createRange();
		labelRange.selectNodeContents(label);
		const textRange = document.createRange();
		textRange.selectNodeContents(text);
		return {
			labelSize: getComputedStyle(label).fontSize,
			textSize: getComputedStyle(paragraph).fontSize,
			topDifference: Math.abs(labelRange.getBoundingClientRect().top - textRange.getBoundingClientRect().top),
		};
	});
	expect(alignment.labelSize).toBe(alignment.textSize);
	expect(alignment.topDifference).toBeLessThan(0.75);
});

test("agent mentions open an existing session or create a separate session", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	async function mentionClaude() {
		await page.keyboard.press("m");
		await editor.pressSequentially("@Claude");
		await page.getByRole("option", { name: /^Claude / }).click();
	}
	await mentionClaude();
	await editor.pressSequentially("Check the timeout path");
	await editor.press("Enter");
	await expect(workItem.getByText("Check the timeout path", { exact: false }).first()).toBeVisible();
	await mentionClaude();
	const choices = workItem.getByRole("listbox", { name: "Choose agent session" });
	await expect(workItem.locator("[data-project-butter-session-target-menu]").getByRole("button", { name: "Back" })).toHaveCount(0);
	await expect(editor).toBeFocused();
	await editor.pressSequentially(" What should I check next?");
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button").first().click();
	const chat = workItem.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat.getByText("@Claude Check the timeout path")).toBeVisible();
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toHaveText("What should I check next?");
	await expect(chat.getByRole("log").getByText("What should I check next?", { exact: true })).toHaveCount(0);
	await chat.getByRole("textbox", { name: "Chat message input" }).fill("Existing chat draft");
	await workItem.getByRole("textbox", { name: "Comment editor" }).click();
	await editor.pressSequentially("@Claude");
	await page.getByRole("option", { name: /^Claude / }).click();
	await editor.pressSequentially(" More context");
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button").first().click();
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toContainText("Existing chat draft");
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toContainText("More context");
	await expect(chat.getByRole("log").getByText("More context", { exact: true })).toHaveCount(0);
	await workItem.getByRole("textbox", { name: "Comment editor" }).click();
	await editor.pressSequentially("@Claude");
	await page.getByRole("option", { name: /^Claude / }).click();
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button").first().click();
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toContainText("Existing chat draft");
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toContainText("More context");
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	if (await editor.isVisible()) await editor.press("Escape");
	await mentionClaude();
	await expect(choices).toBeVisible();
	if (await choices.getByRole("option", { name: "Continue in existing session" }).getAttribute("aria-selected") === "true") await editor.press("ArrowDown");
	await editor.press("Enter");
	await expect(editor).toBeFocused();
	await editor.pressSequentially("Inspect retry behavior");
	await editor.press("Enter");
	await expect(workItem.getByText("Inspect retry behavior", { exact: false }).first()).toBeVisible();
	await mentionClaude();
	await editor.pressSequentially(" Please revisit this");
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	const sessions = workItem.getByRole("list", { name: "Choose a session" });
	await expect(sessions.locator("article")).toHaveCount(2);
	const earlier = sessions.locator("article").filter({ hasText: "Check the timeout path" });
	const later = sessions.locator("article").filter({ hasText: "Inspect retry behavior" });
	await expect(earlier).toContainText("Working");
	await expect(earlier.getByRole("group", { name: "Claude, used by Venn" })).toBeVisible();
	await earlier.hover();
	await expect(workItem.locator("[data-jira-activity-entry-id][data-active]")).toContainText("Check the timeout path");
	await expect.poll(() => workItem.evaluate((root) => {
		const entry = root.querySelector<HTMLElement>("[data-jira-activity-entry-id][data-active]");
		const viewport = root.querySelector<HTMLElement>("[data-project-butter-work-item] > div");
		const menu = root.querySelector<HTMLElement>("[data-project-butter-session-target-menu]");
		if (!entry || !viewport || !menu) return false;
		return entry.getBoundingClientRect().top >= viewport.getBoundingClientRect().top && entry.getBoundingClientRect().top < menu.getBoundingClientRect().top;
	})).toBe(true);
	await later.hover();
	await expect(workItem.locator("[data-jira-activity-entry-id][data-active]")).toContainText("Inspect retry behavior");
	await earlier.hover();
	await editor.press("ArrowUp");
	await expect(workItem.locator("[data-jira-activity-entry-id][data-active]")).toContainText("Inspect retry behavior");
	await earlier.hover();
	await earlier.click();
	await expect(chat.getByText("@Claude Check the timeout path")).toBeVisible();
	await expect(chat.getByText("@Claude Inspect retry behavior")).toHaveCount(0);
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toContainText("Please revisit this");
	await expect(chat.getByRole("log").getByText("Please revisit this", { exact: true })).toHaveCount(0);
});

for (const suffix of ["", " later"]) test(`Escape converts the mention to plain text with${suffix ? "" : "out"} following text`, async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	async function insertClaude() {
		await editor.pressSequentially("@Claude");
		await page.getByRole("option", { name: /^Claude / }).click();
	}
	await page.keyboard.press("m");
	await insertClaude();
	await editor.pressSequentially(" Original task");
	await editor.press("Enter");
	const agents = workItem.getByRole("button", { name: /^Working on this work item\./ });
	const before = await agents.getAttribute("aria-label");
	await page.keyboard.press("m");
	await editor.pressSequentially("Please ask ");
	await insertClaude();
	const choices = workItem.getByRole("listbox", { name: "Choose agent session" });
	await expect(choices).toBeVisible();
	if (suffix) await editor.pressSequentially(suffix);
	await editor.press("Escape");
	await expect(choices).toHaveCount(0);
	await expect(page.getByRole("listbox", { name: "Mention" })).toHaveCount(0);
	await expect(editor.locator('[data-mention-category="subagent"]')).toHaveCount(0);
	await expect(editor).toContainText(`Please ask @Claude${suffix}`);
	await expect(editor).toBeFocused();
	await editor.pressSequentially(" today");
	await editor.press("Enter");
	await expect(workItem.getByText(`Please ask @Claude${suffix} today`, { exact: false }).first()).toBeVisible();
	await expect(agents).toHaveAttribute("aria-label", before!);
	await expect(workItem.locator('[data-rovo-chat-placement="floating"]')).toHaveCount(0);
});

test("Enter sends the prefilled chat draft only after the user presses it", async ({ page }) => {
	let sentBody = "";
	await mockRovoThreads(page);
	await page.route("**/api/rovo/chat", async (route) => {
		sentBody = route.request().postData() ?? "";
		await route.fulfill({ status: 503, body: "Mocked chat request" });
	});
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	async function mentionClaude() {
		await page.keyboard.press("m");
		await editor.pressSequentially("@Claude");
		await page.getByRole("option", { name: /^Claude / }).click();
	}
	await mentionClaude();
	await editor.pressSequentially(" First task");
	await editor.press("Enter");
	await mentionClaude();
	await editor.pressSequentially(" Please check status");
	await workItem.getByRole("option", { name: "Continue in existing session" }).click();
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button").first().click();
	const chatInput = workItem.locator('[data-rovo-chat-placement="floating"]').getByRole("textbox", { name: "Chat message input" });
	await expect(chatInput).toContainText("Please check status");
	expect(sentBody).toBe("");
	await chatInput.press("Enter");
	await expect.poll(() => sentBody).toContain("Please check status");
	expect(sentBody).not.toContain("statuspage");
});

test("continuing a mention-only session opens chat without starting a turn", async ({ page }) => {
	const startedRequests: string[] = [];
	await page.route("**/api/rovo/threads", async (route) => {
		if (route.request().method() === "POST") {
			startedRequests.push("thread");
			await route.fulfill({ status: 503, body: "Unexpected thread creation" });
		} else await route.continue();
	});
	await page.route("**/api/rovo/chat", async (route) => {
		startedRequests.push("chat");
		await route.fulfill({ status: 503, body: "Unexpected chat turn" });
	});
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	async function mentionCursor() {
		await page.keyboard.press("m");
		await editor.pressSequentially("@Cursor");
		await page.getByRole("option", { name: /^Cursor / }).first().click();
	}
	await mentionCursor();
	await editor.press("Enter");
	await mentionCursor();
	const choices = workItem.getByRole("listbox", { name: "Choose agent session" });
	const continueOption = choices.getByRole("option", { name: "Continue in existing session" });
	await expect(continueOption).toBeVisible();
	if (await continueOption.getAttribute("aria-selected") !== "true") await editor.press("ArrowUp");
	await editor.press("Enter");
	await editor.press("Enter");
	const chat = workItem.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toBeVisible();
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toHaveText("");
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toBeFocused();
	await expect(chat.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();
	await expect(chat.getByRole("log").getByText("@Cursor", { exact: true })).toHaveCount(0);
	await expect(chat.getByText(/I finished a first pass/)).toHaveCount(0);
	await expect.poll(() => startedRequests).toEqual([]);
});

test("a resumed session keeps its conversation after the user sends and reopens it", async ({ page }) => {
	const { threads, openedThreads, delayThread, releaseThread } = await mockRovoThreads(page);
	await page.route("**/api/rovo/chat", async (route) => {
		await route.fulfill({
			status: 200,
			headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
			body: [
				'data: {"type":"start","messageId":"mock-response"}',
				'data: {"type":"text-start","id":"mock-text"}',
				'data: {"type":"text-delta","id":"mock-text","delta":"Mocked response"}',
				'data: {"type":"text-end","id":"mock-text"}',
				`data: ${JSON.stringify({ type: "data-turn-complete", data: { timestamp: new Date().toISOString() } })}`,
				'data: {"type":"finish"}',
				"data: [DONE]",
				"",
			].join("\n\n"),
		});
	});
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	async function mentionCursor() {
		await page.keyboard.press("m");
		await editor.pressSequentially("@Cursor");
		await page.getByRole("option", { name: /^Cursor / }).first().click();
	}
	await mentionCursor();
	await editor.press("Enter");
	await mentionCursor();
	await workItem.getByRole("option", { name: "Continue in existing session" }).click();
	await page.getByRole("list", { name: "Choose a session" }).getByRole("button").first().click();
	const chat = workItem.locator('[data-rovo-chat-placement="floating"]');
	const chatInput = chat.getByRole("textbox", { name: "Chat message input" });
	await expect(chatInput).toBeVisible();
	await chatInput.fill("Please investigate the timeout");
	const saved = page.waitForResponse((response) => response.request().method() === "PUT" && /\/api\/rovo\/threads\//u.test(response.url()) && (response.request().postData() ?? "").includes("Please investigate the timeout") && response.ok());
	await chatInput.press("Enter");
	await expect(chat.getByRole("log").getByText("Please investigate the timeout")).toBeVisible();
	const firstSaveResponse = await saved;
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await mentionCursor();
	await workItem.getByRole("option", { name: "Start a new session" }).click();
	await expect(workItem.getByText("New session", { exact: true })).toHaveCount(0);
	await expect(workItem.getByRole("button", { name: "Choose agent session" })).toHaveCount(0);
	await editor.pressSequentially(" Second session task");
	await editor.press("Enter");
	await mentionCursor();
	await workItem.getByRole("option", { name: "Continue in existing session" }).click();
	await workItem.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Second session task/ }).click();
	await expect(chat.getByRole("log").getByText("Please investigate the timeout")).toHaveCount(0);
	await chatInput.fill("Second session message");
	const secondSaved = page.waitForResponse((response) => response.request().method() === "PUT" && /\/api\/rovo\/threads\//u.test(response.url()) && (response.request().postData() ?? "").includes("Second session message") && response.ok());
	await chatInput.press("Enter");
	const secondSaveResponse = await secondSaved;
	expect(secondSaveResponse.url()).not.toBe(firstSaveResponse.url());
	const firstThreadId = decodeURIComponent(new URL(firstSaveResponse.url()).pathname.split("/").at(-1) ?? "");
	expect(JSON.stringify(threads.get(firstThreadId))).not.toContain("Second session message");
	await workItem.getByRole("textbox", { name: "Comment editor" }).click();
	await editor.pressSequentially("@Cursor");
	await page.getByRole("option", { name: /^Cursor / }).first().click();
	await editor.pressSequentially(" Follow up later");
	await workItem.getByRole("option", { name: "Continue in existing session" }).click();
	delayThread(firstThreadId);
	await workItem.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Port confirmPaymentIntent/ }).click();
	await expect.poll(() => openedThreads.at(-1)).toBe(firstThreadId);
	await expect(chat).toHaveAttribute("inert", "");
	await expect(page.getByRole("status").filter({ hasText: "Opening session" })).toBeVisible();
	await expect(editor).toContainText("Follow up later");
	releaseThread();
	await expect(chat).not.toHaveAttribute("inert", "");
	expect(JSON.stringify(threads.get(firstThreadId))).not.toContain("Second session message");
	await expect(chat.getByRole("log").getByText("Please investigate the timeout")).toBeVisible();
	await expect(chat.getByRole("log").getByText("Second session message")).toHaveCount(0);
	await expect(chat.getByRole("log").getByText("@Cursor", { exact: true })).toHaveCount(0);
	await expect(chatInput).toContainText("Follow up later");
});

test("PAY-999 keeps Claude follow-ups in Venn's existing cloud session", async ({ page }) => {
	test.setTimeout(90_000);
	const { threads, openedThreads } = await mockRovoThreads(page);
	const chatRequests: string[] = [];
	await page.route("**/api/rovo/chat", async (route) => {
		chatRequests.push(route.request().postData() ?? "");
		const turn = chatRequests.length;
		await route.fulfill({
			status: 200,
			headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
			body: [
				`data: ${JSON.stringify({ type: "start", messageId: `claude-response-${turn}` })}`,
				`data: ${JSON.stringify({ type: "text-start", id: `claude-text-${turn}` })}`,
				`data: ${JSON.stringify({ type: "text-delta", id: `claude-text-${turn}`, delta: `Claude acknowledged follow-up ${turn}.` })}`,
				`data: ${JSON.stringify({ type: "text-end", id: `claude-text-${turn}` })}`,
				`data: ${JSON.stringify({ type: "data-turn-complete", data: { timestamp: new Date().toISOString() } })}`,
				'data: {"type":"finish"}',
				"data: [DONE]",
				"",
			].join("\n\n"),
		});
	});
	await page.goto(appUrl("/butter"));
	const issue = card(page, "PAY-999");
	await issue.locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await workItem.getByRole("button", { name: /\. Add agent$/ }).click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	await page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" }).click();
	const invocation = workItem.locator('[data-jira-activity-entry-id^="invocation-PAY-999:"]');
	await expect(invocation).toHaveCount(1);
	await expect(invocation).toContainText("Venn added Claude and self-assigned the issue");
	const invocationId = await invocation.getAttribute("data-jira-activity-entry-id");
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	const chat = workItem.locator('[data-rovo-chat-placement="floating"]');
	const chatInput = chat.getByRole("textbox", { name: "Chat message input" });
	const followUps = ["Build the merchant onboarding checklist", "Keep the sandbox migration note visible"];
	const savedThreadUrls: string[] = [];
	for (const [index, followUp] of followUps.entries()) {
		await page.keyboard.press("m");
		await editor.pressSequentially("@Claude");
		await page.getByRole("option", { name: /^Claude / }).first().click();
		await editor.pressSequentially(` ${followUp}`);
		await workItem.getByRole("option", { name: "Continue in existing session" }).click();
		await page.getByRole("list", { name: "Choose a session" }).getByRole("button").first().click();
		await expect(chatInput).toHaveText(followUp);
		await expect(chat.getByRole("log").getByText(followUp, { exact: true })).toHaveCount(0);
		expect(chatRequests).toHaveLength(index);
		const saved = page.waitForResponse((response) => response.request().method() === "PUT" && /\/api\/rovo\/threads\//u.test(response.url()) && (response.request().postData() ?? "").includes(`Claude acknowledged follow-up ${index + 1}.`) && response.ok());
		await chatInput.press("Enter");
		await expect(chat.getByRole("log").getByText(followUp, { exact: true })).toBeVisible();
		await expect(chat.getByRole("log").getByText(`Claude acknowledged follow-up ${index + 1}.`, { exact: true })).toBeVisible();
		savedThreadUrls.push((await saved).url());
		if (index === 0) await chat.getByRole("button", { name: "Close", exact: true }).click();
	}
	expect(savedThreadUrls[1]).toBe(savedThreadUrls[0]);
	expect(threads.size).toBe(1);
	const threadId = decodeURIComponent(new URL(savedThreadUrls[0]).pathname.split("/").at(-1) ?? "");
	expect(openedThreads).toContain(threadId);
	for (const request of chatRequests) expect(JSON.parse(request)).toMatchObject({ id: threadId });
	for (const followUp of followUps) await expect(chat.getByRole("log").getByText(followUp, { exact: true })).toBeVisible();
	await expect(invocation).toHaveCount(1);
	await expect(invocation).toHaveAttribute("data-jira-activity-entry-id", invocationId!);
	await page.screenshot({ path: "output/agent-browser/butter-pay-999-claude-continuation.png" });
});

test("the work-item agent picker offers existing sessions and starts a separate one", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	async function mentionClaude() {
		await page.keyboard.press("m");
		await editor.pressSequentially("@Claude");
		await page.getByRole("option", { name: /^Claude / }).first().click();
	}
	await mentionClaude();
	await editor.pressSequentially(" Check timeout behavior");
	await editor.press("Enter");
	await mentionClaude();
	await workItem.getByRole("option", { name: "Start a new session" }).click();
	await editor.pressSequentially(" Review retry behavior");
	await editor.press("Enter");
	const crew = workItem.getByRole("button", { name: /^Working on this work item\./ });
	await crew.click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	const actions = page.getByRole("menu", { name: "Run Claude on" });
	await expect(actions.getByRole("group", { name: "Run on cloud" })).toBeVisible();
	await expect(actions.getByRole("menuitem", { name: "Continue to existing session" })).toBeVisible();
	await expect(actions.getByRole("menuitem", { name: "Start a new session" })).toBeVisible();
	await expect(actions.getByRole("separator")).toBeVisible();
	await actions.getByRole("menuitem", { name: "Continue to existing session" }).click();
	const sessions = page.getByRole("listbox", { name: "Choose a Claude session" });
	await expect(sessions.getByRole("option")).toHaveCount(2);
	const earlier = sessions.getByRole("option", { name: /Check timeout behavior/ });
	await earlier.hover();
	await expect(workItem.locator("[data-jira-activity-entry-id][data-active]")).toContainText("Check timeout behavior");
	await earlier.click();
	const chat = workItem.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat.getByRole("textbox", { name: "Chat message input" })).toBeVisible();
	await expect(chat.getByRole("log").getByText("@Claude Check timeout behavior")).toBeVisible();
	await expect(chat.getByRole("log").getByText("@Claude Review retry behavior")).toHaveCount(0);
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await crew.click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	await actions.getByRole("menuitem", { name: "Start a new session" }).click();
	await expect(chat).toBeHidden();
	await crew.click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	await expect(actions.getByRole("menuitem", { name: "Continue to existing session" })).toBeVisible();
});

test("a first cloud session started from the board does not open chat", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const issue = card(page, "PAY-105");
	await issue.locator('[data-slot="jira-issue-card"]').hover();
	await issue.getByRole("button", { name: "Add agent to PAY-105" }).click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	await page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" }).click();
	await expect(issue.getByRole("button", { name: "2 agents: Needs input" })).toBeVisible();
	await expect(page.locator('[data-rovo-chat-placement="floating"]')).toBeHidden();
});

test("long session titles stay inside their own selectable rows", async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto(appUrl("/butter"));
	const issue = card(page, "PAY-105");
	async function chooseClaude() {
		await issue.locator('[data-slot="jira-issue-card"]').hover();
		await issue.getByRole("button", { name: "Add agent to PAY-105" }).click();
		await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
		await page.getByRole("option", { name: /^Claude/ }).first().click();
	}
	const actions = page.getByRole("menu", { name: "Run Claude on" });
	await chooseClaude();
	await actions.getByRole("menuitem", { name: "Run on cloud" }).click();
	await chooseClaude();
	await actions.getByRole("menuitem", { name: "Start a new session" }).click();
	await chooseClaude();
	await actions.getByRole("menuitem", { name: "Continue to existing session" }).click();
	const list = page.getByRole("listbox", { name: "Choose a Claude session" });
	await expect(list.getByRole("option")).toHaveCount(2);
	const rowsAreContained = () => list.evaluate((element) => {
		const rows = [...element.querySelectorAll<HTMLElement>('[role="option"]')];
		return rows.every((row, index) => {
			const bounds = row.getBoundingClientRect();
			const title = row.querySelector<HTMLElement>(".menu-row-title")?.getBoundingClientRect();
			const next = rows[index + 1]?.getBoundingClientRect();
			return Boolean(title && title.top >= bounds.top && title.bottom <= bounds.bottom + 1 && (!next || bounds.bottom <= next.top + 1));
		});
	});
	await expect.poll(rowsAreContained).toBe(true);
	await page.setViewportSize({ width: 900, height: 800 });
	await expect.poll(rowsAreContained).toBe(true);
});

test("the board card picker continues a chosen session or creates a separate empty session", async ({ page }) => {
	test.setTimeout(60_000);
	await mockRovoThreads(page);
	await page.route("**/api/rovo/chat", async (route) => route.fulfill({ status: 503, body: "Mocked chat request" }));
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const workItem = page.getByRole("dialog", { name: "Project butter" });
	await expect(workItem).toBeVisible();
	const editor = workItem.getByRole("textbox", { name: "Comment editor" });
	for (const [index, prompt] of ["Check timeouts", "Review retries"].entries()) {
		await page.keyboard.press("m");
		await editor.pressSequentially("@Claude");
		await page.getByRole("option", { name: /^Claude / }).first().click();
		if (index) await workItem.getByRole("option", { name: "Start a new session" }).click();
		await editor.pressSequentially(` ${prompt}`);
		await editor.press("Enter");
	}
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	const issue = card(page, "PAY-105");
	async function openClaudePicker() {
		await issue.locator('[data-slot="jira-issue-card"]').hover();
		await issue.getByRole("button", { name: "Add agent to PAY-105" }).click();
		await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
		await page.getByRole("option", { name: /^Claude/ }).first().click();
	}
	await openClaudePicker();
	const actions = page.getByRole("menu", { name: "Run Claude on" });
	await actions.getByRole("menuitem", { name: "Continue to existing session" }).click();
	const sessions = page.getByRole("listbox", { name: "Choose a Claude session" });
	await expect(sessions.getByRole("option")).toHaveCount(2);
	await expect.poll(() => sessions.locator("..").evaluate((menu) => ({
		shadow: getComputedStyle(menu).boxShadow,
		border: getComputedStyle(menu).borderTopWidth,
	}))).toEqual({ shadow: "none", border: "0px" });
	await expect(sessions.locator(".menu-row-byline")).toHaveCount(0);
	await page.setViewportSize({ width: 900, height: 800 });
	await expect.poll(() => sessions.evaluate((list) => {
		const bounds = list.getBoundingClientRect();
		return bounds.left >= 0 && bounds.right <= window.innerWidth;
	})).toBe(true);
	await expect(sessions.locator(".menu-row-byline")).toHaveCount(0);
	await page.setViewportSize({ width: 1800, height: 1100 });
	await expect(sessions.getByRole("option", { name: "Check timeouts" })).toBeVisible();
	await sessions.getByRole("option").first().focus();
	await page.keyboard.press("ArrowDown");
	await expect(sessions.getByRole("option", { name: /Check timeouts/ })).toBeFocused();
	await sessions.getByRole("option", { name: /Check timeouts/ }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat.getByRole("log").getByText("@Claude Check timeouts")).toBeVisible();
	await expect(chat.getByRole("log").getByText("@Claude Review retries")).toHaveCount(0);
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await openClaudePicker();
	await actions.getByRole("menuitem", { name: "Start a new session" }).click();
	await expect(chat).toBeHidden();
	await openClaudePicker();
	await expect(actions.getByRole("menuitem", { name: "Continue to existing session" })).toBeVisible();
	await actions.getByRole("menuitem", { name: "Continue to existing session" }).click();
	await expect.poll(() => sessions.getByRole("option", { name: /Work on Port confirmPaymentIntent/ }).locator(".menu-row-title").evaluate((title) => title.scrollHeight <= title.clientHeight + 1)).toBe(true);
	await sessions.getByRole("option", { name: /Work on Port confirmPaymentIntent/ }).click();
	const input = chat.getByRole("textbox", { name: "Chat message input" });
	await expect(input).toBeVisible();
	await expect(input).toBeEmpty();
	await expect(chat.getByRole("log").getByText("@Claude", { exact: false })).toHaveCount(0);
	await input.fill("Investigate decline handling");
	await input.press("Enter");
	await expect(chat.getByRole("log").getByText("Investigate decline handling", { exact: true })).toBeVisible();
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await openClaudePicker();
	await actions.getByRole("menuitem", { name: "Continue to existing session" }).click();
	await expect(sessions.getByRole("option", { name: "Investigate decline handling" })).toBeVisible();
});

