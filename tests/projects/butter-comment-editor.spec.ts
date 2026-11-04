import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

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
	await expect(bar.getByRole("button", { name: "Add a comment" })).toBeVisible();
	const insets = () => bar.evaluate((element) => {
		const viewport = element.closest("[data-project-butter-work-item]")!.firstElementChild!.getBoundingClientRect();
		const bounds = element.getBoundingClientRect();
		return Math.abs((bounds.left - viewport.left) - (viewport.bottom - bounds.bottom));
	});
	await expect.poll(insets).toBeLessThan(1);
	await bar.getByRole("button", { name: "Add a comment" }).click();
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
	const commentButton = bar.getByRole("button", { name: "Add a comment" });
	await expect(commentButton).toHaveCSS("border-top-left-radius", "12px");
	await expect.poll(() => commentButton.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
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
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	const chat = workItem.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat.getByText("@Claude Check the timeout path")).toBeVisible();
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	if (await editor.isVisible()) await workItem.getByRole("button", { name: "Close comment editor" }).click();
	await mentionClaude();
	await choices.getByRole("option", { name: "Start a new session" }).click();
	await expect(editor).toBeFocused();
	await editor.pressSequentially("Inspect retry behavior");
	await editor.press("Enter");
	await expect(workItem.getByText("Inspect retry behavior", { exact: false }).first()).toBeVisible();
	await mentionClaude();
	await choices.getByRole("option", { name: "Continue in existing session" }).click();
	await expect(chat.getByText("@Claude Inspect retry behavior")).toBeVisible();
	await expect(chat.getByText("@Claude Check the timeout path")).toHaveCount(0);
});

