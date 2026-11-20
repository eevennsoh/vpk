import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["reduce", "no-preference"] as const) {
	test(`reply composer resizes and keeps its draft (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Work item", exact: true }).click();
		await page.getByRole("button", { name: "Close gallery", exact: true }).click();
		const form = page.getByRole("form", { name: "Comment editor" });
		const editor = form.getByRole("textbox", { name: "Comment editor" });
		await editor.fill("Keep this draft");
		const closedHeight = (await form.boundingBox())?.height;
		if (closedHeight === undefined) throw new Error("Missing comment editor");
		await form.evaluate((element) => {
			const samples: number[] = [];
			Object.assign(window, { __replyComposerSamples: samples });
			new ResizeObserver(() => samples.push(element.getBoundingClientRect().height)).observe(element);
		});
		const thread = page.locator('[data-project-butter-activity-feed] [data-jira-activity-entry-id="invocation-butter-cursor-forecast"]');
		const reply = thread.getByRole("button", { name: "Reply", exact: true }).first();
		await thread.hover();
		await reply.click();
		const header = form.locator('[data-slot="input-group-addon"][data-align="block-start"]');
		const chip = form.getByTestId("reply-target-chip");
		await expect(chip).toBeVisible();
		await expect(editor).toBeFocused();
		await expect(editor).toHaveText("Keep this draft");
		await expect(header.locator(":scope > div")).toHaveCSS("clip-path", "inset(-4px)");
		const openHeight = (await form.boundingBox())?.height;
		if (openHeight === undefined) throw new Error("Missing expanded comment editor");
		expect(openHeight - closedHeight).toBeGreaterThan(30);
		const opening = await page.evaluate(() => { const samples = Reflect.get(window, "__replyComposerSamples"); return Array.isArray(samples) ? samples.slice() : []; });
		if (reducedMotion === "no-preference") expect(opening.some((height) => height > closedHeight + 2 && height < openHeight - 2)).toBe(true);
		else expect(opening.some((height) => height > closedHeight + 2 && height < openHeight - 2)).toBe(false);
		await page.evaluate(() => { const samples = Reflect.get(window, "__replyComposerSamples"); if (Array.isArray(samples)) samples.length = 0; });
		await chip.getByRole("button", { name: "Remove reply target" }).focus();
		await page.keyboard.press("Enter");
		await expect(header).toHaveAttribute("aria-hidden", "true");
		await expect(header).toHaveAttribute("inert", "");
		await expect(chip).toHaveCount(0);
		await expect.poll(async () => (await form.boundingBox())?.height).toBeCloseTo(closedHeight, 0);
		await expect(editor).toBeFocused();
		await expect(editor).toHaveText("Keep this draft");
		const closing = await page.evaluate(() => { const samples = Reflect.get(window, "__replyComposerSamples"); return Array.isArray(samples) ? samples.slice() : []; });
		if (reducedMotion === "no-preference") expect(closing.some((height) => height > closedHeight + 2 && height < openHeight - 2)).toBe(true);
		else expect(closing.some((height) => height > closedHeight + 2 && height < openHeight - 2)).toBe(false);
	});
}

test("reply context can reopen while it is closing", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const form = page.getByRole("form", { name: "Comment editor" });
	const editor = form.getByRole("textbox", { name: "Comment editor" });
	await editor.fill("Keep this draft");
	const thread = page.locator('[data-project-butter-activity-feed] [data-jira-activity-entry-id="invocation-butter-cursor-forecast"]');
	const reply = thread.getByRole("button", { name: "Reply", exact: true }).first();
	await reply.focus();
	await reply.press("Enter");
	const chip = form.getByTestId("reply-target-chip");
	await expect(chip).toBeVisible();
	await chip.getByRole("button", { name: "Remove reply target" }).focus();
	await page.keyboard.press("Enter");
	await reply.focus();
	await reply.press("Enter");
	await expect(chip).toHaveCount(1);
	await expect(chip).toBeVisible();
	await expect(editor).toBeFocused();
	await expect(editor).toHaveText("Keep this draft");
	const header = form.locator('[data-slot="input-group-addon"][data-align="block-start"]');
	await expect(header).not.toHaveAttribute("inert", "");
	await expect(header.locator(":scope > div")).toHaveCSS("clip-path", "inset(-4px)");
});
