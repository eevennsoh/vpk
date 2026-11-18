import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("message-scroller examples demonstrate their interactive behaviors", async ({ page }) => {
	await page.goto(appUrl("/components/ui/message-scroller"));

	const anchoring = page.locator("#anchoring-turns");
	await anchoring.getByRole("button", { name: "Assistant", exact: true }).click();
	await anchoring.getByRole("button", { name: "Send Message" }).click();
	await expect(anchoring.locator('[data-message-id="assistant-1"]')).toHaveAttribute("data-scroll-anchor", "true");
	await anchoring.getByRole("button", { name: "User", exact: true }).click();
	await anchoring.getByRole("button", { name: "Send Message" }).click();
	await expect(anchoring.locator('[data-message-id="user-2"]')).toHaveAttribute("data-scroll-anchor", "true");

	const group = page.locator("#group-chat");
	await group.getByRole("button", { name: "Add Rocky" }).click();
	await expect(group.locator('[data-message-id="rocky-joined"]')).toHaveAttribute("data-scroll-anchor", "true");
	await expect(group.getByText("Rocky joined the chat")).toBeVisible();

	const context = page.locator("#keeping-context-visible");
	const slider = context.getByRole("slider", { name: "Previous message peek" });
	await slider.focus();
	await slider.press("ArrowRight");
	await expect(context.getByText("72px")).toBeVisible();
	await context.getByRole("button", { name: "Send", exact: true }).click();
	await expect(context.getByText("Show me the next step in turn 2.")).toBeVisible();

	const streaming = page.locator("#streaming-messages");
	await streaming.getByRole("button", { name: "Send", exact: true }).click();
	await expect(streaming.getByRole("button", { name: "Stop" })).toBeVisible();
	await expect(streaming.getByText(/rollout owner will share the next update/)).toBeVisible({ timeout: 8000 });
	await expect(streaming.getByRole("button", { name: "Send", exact: true })).toBeVisible();

	const opening = page.locator("#opening-position");
	await opening.getByRole("button", { name: "Start", exact: true }).click();
	await expect(opening.getByRole("button", { name: "Start", exact: true })).toBeFocused();
	await expect.poll(() => opening.getByRole("region", { name: "Opening Position messages" }).evaluate((node) => node.scrollTop)).toBe(0);
	await opening.getByRole("button", { name: "End", exact: true }).click();
	await expect.poll(() => opening.getByRole("region", { name: "Opening Position messages" }).evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	const endPosition = await opening.getByRole("region", { name: "Opening Position messages" }).evaluate((node) => node.scrollTop);
	await opening.getByRole("button", { name: "Last anchor" }).click();
	await expect(opening.locator('[data-message-id="prompt-4"]')).toHaveAttribute("data-scroll-anchor", "true");
	await expect.poll(() => opening.getByRole("region", { name: "Opening Position messages" }).evaluate((node) => node.scrollTop)).toBeLessThan(endPosition);

	const history = page.locator("#load-history");
	await history.scrollIntoViewIfNeeded();
	const historyViewport = history.getByRole("region", { name: "Load History messages" });
	await historyViewport.evaluate((node) => { node.scrollTop = 0; });
	await expect.poll(() => historyViewport.evaluate((node) => node.scrollTop)).toBe(0);
	const relativePosition = () => historyViewport.locator('[data-message-id="prompt-3"]').evaluate((node) => {
		const viewport = node.closest('[data-slot="message-scroller-viewport"]');
		return node.getBoundingClientRect().top - (viewport?.getBoundingClientRect().top ?? 0);
	});
	const previousPosition = await relativePosition();
	await history.getByRole("button", { name: "Load History", exact: true }).click();
	await expect(history.getByText("Review the incident handoff", { exact: false })).toBeAttached();
	await expect.poll(async () => Math.abs((await relativePosition()) - previousPosition)).toBeLessThan(2);

	const animation = page.locator("#animation");
	await animation.getByRole("combobox", { name: "Animation preset" }).click();
	await page.getByRole("option", { name: "Slide Up", exact: true }).click();
	await animation.getByRole("button", { name: "Send Message" }).click();
	await expect(animation.getByText("Send message 1")).toBeVisible();

	const commands = page.locator("#commands");
	await commands.getByRole("button", { name: "Jump to message 2" }).click();
	const commandsViewport = commands.getByRole("region", { name: "Commands messages" });
	await expect.poll(() => commandsViewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	await commands.getByRole("button", { name: "Start", exact: true }).click();
	await expect.poll(() => commandsViewport.evaluate((node) => node.scrollTop)).toBe(0);

	const outline = page.locator("#transcript-outline");
	await outline.getByRole("button", { name: "Turn 3" }).click();
	await expect(outline.getByRole("button", { name: "Turn 3" })).toHaveAttribute("aria-pressed", "true");

	const status = page.locator("#scroll-status");
	await expect(status.getByText("At the first message")).toBeVisible();
	await status.getByRole("button", { name: "Scroll to bottom" }).click();
	await expect(status.getByText("At the latest message")).toBeVisible();
});

test("animation example offers every shadcn entrance preset", async ({ page }) => {
	await page.goto(appUrl("/components/ui/message-scroller#animation"));
	const example = page.locator("#animation");
	const selector = example.getByRole("combobox", { name: "Animation preset" });
	const names = ["Fade", "Slide Up", "Slide Side", "Pop", "Spring Bounce", "Blur Fade", "Scale Fade"];
	await selector.click();
	for (const name of names) await expect(page.getByRole("option", { name, exact: true })).toBeInViewport({ ratio: 1 });
	await page.keyboard.press("Escape");
	for (const [index, name] of names.entries()) {
		await selector.click();
		await page.getByRole("option", { name, exact: true }).click();
		await expect(selector).toHaveText(name);
		await example.getByRole("button", { name: "Send Message" }).click();
		await expect(example.getByText(`Send message ${index + 1}`, { exact: true })).toBeVisible();
	}
});

test("animation presets respect reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/ui/message-scroller#animation"));
	const example = page.locator("#animation");
	await example.getByRole("combobox", { name: "Animation preset" }).click();
	await page.getByRole("option", { name: "Spring Bounce", exact: true }).click();
	await example.getByRole("button", { name: "Send Message" }).click();
	const row = example.locator('[data-message-id="animated-user-1"]');
	await expect(row).toHaveCSS("opacity", "1");
	await expect(row).toHaveCSS("transform", "none");
});

test("streaming yields to the reader and resumes when they return to the end", async ({ page }) => {
	await page.goto(appUrl("/components/ui/message-scroller#streaming-messages"));
	const example = page.locator("#streaming-messages");
	const viewport = example.getByRole("region", { name: "Streaming Messages messages" });
	await example.getByRole("button", { name: "Send", exact: true }).click();
	const log = viewport.getByRole("log");
	await expect(log).toHaveAttribute("aria-busy", "true");
	await expect.poll(() => viewport.evaluate((node) => node.scrollHeight - node.clientHeight), { timeout: 8000 }).toBeGreaterThan(40);
	await viewport.hover();
	await page.mouse.wheel(0, -1000);
	await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBe(0);
	await expect.poll(() => viewport.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeGreaterThan(20);
	const top = await viewport.evaluate((node) => node.scrollTop);
	const length = (await log.textContent())?.length ?? 0;
	await expect.poll(async () => (await log.textContent())?.length ?? 0).toBeGreaterThan(length);
	expect(Math.abs((await viewport.evaluate((node) => node.scrollTop)) - top)).toBeLessThan(2);
	await example.getByRole("button", { name: "Scroll to bottom" }).click();
	await expect.poll(() => viewport.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop)).toBeLessThan(2);
	await expect(log).not.toHaveAttribute("aria-busy", "true");
});
