import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("sidebar chat keeps follow-up buttons aligned and fully visible", async ({ page }) => {
	const threads = new Map<string, Record<string, unknown>>();
	await page.route("**/api/rovo/threads**", async (route) => {
		const request = route.request();
		const id = decodeURIComponent(new URL(request.url()).pathname.split("/").at(-1) ?? "");
		if (request.method() === "GET" && id === "threads") {
			await route.fulfill({ json: { threads: [...threads.values()] } });
		} else if (request.method() === "POST" && id === "threads") {
			const thread: Record<string, unknown> = request.postDataJSON();
			threads.set(String(thread.id), thread);
			await route.fulfill({ status: 201, json: { thread } });
		} else if (request.method() === "PUT") {
			const thread = { ...threads.get(id), ...request.postDataJSON(), id };
			threads.set(id, thread);
			await route.fulfill({ json: { thread } });
		} else if (request.method() === "GET") {
			await route.fulfill({ json: { thread: threads.get(id) } });
		} else {
			await route.fulfill({ json: {} });
		}
	});
	await page.route("**/api/chat-title", (route) => route.fulfill({ json: { title: "Scroller test" } }));
	await page.route("**/api/rovo/chat", (route) => route.fulfill({
		headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
		body: [
			'data: {"type":"start","messageId":"mock-reply"}',
			'data: {"type":"data-thinking-status","data":{"label":"Thinking"}}',
			'data: {"type":"text-start","id":"text"}',
			'data: {"type":"text-delta","id":"text","delta":"Please share the design link."}',
			'data: {"type":"text-end","id":"text"}',
			'data: {"type":"data-suggested-questions","data":{"questions":["How do I copy a link?"]}}',
			`data: ${JSON.stringify({ type: "data-turn-complete", data: { timestamp: new Date().toISOString() } })}`,
			'data: {"type":"finish"}',
			"data: [DONE]",
			"",
		].join("\n\n"),
	}));
	await page.goto(appUrl("/components/projects/sidebar-chat"));
	const input = page.getByRole("textbox", { name: "Chat message input" });
	await input.fill("Get design context for this file and explain how to find the correct frame and share its details with the team.");
	await input.press("Enter");
	const viewport = page.locator('[data-slot="message-scroller-viewport"]');
	const userBubble = viewport.locator('[data-slot="bubble-content"]').first();
	await expect(userBubble).toHaveCSS("padding", "12px 16px");
	await expect(userBubble).toHaveCSS("border-bottom-right-radius", "0px");
	await expect(userBubble).toHaveCSS("font-weight", "500");
	const bubbleWidth = await userBubble.evaluate((element) => {
		const message = element.closest('[data-slot="message"]');
		return message ? Math.abs(message.getBoundingClientRect().width - element.getBoundingClientRect().width) : Infinity;
	});
	expect(bubbleWidth).toBeLessThan(1);
	const neutralBackground = await page.evaluate(() => {
		const element = document.createElement("div");
		element.className = "bg-bg-neutral";
		document.body.append(element);
		const background = getComputedStyle(element).backgroundColor;
		element.remove();
		return background;
	});
	await expect(userBubble).toHaveCSS("background-color", neutralBackground);
	const suggestion = viewport.getByRole("button", { name: "How do I copy a link?" });
	await expect(suggestion).toBeVisible();
	const thought = viewport.getByRole("button", { name: /^Thought for/ });
	await expect(thought).toBeVisible();
	await suggestion.hover();
	const geometry = await suggestion.evaluate((button) => {
		const container = button.closest(".cv-auto");
		const scroller = button.closest('[data-slot="message-scroller-viewport"]');
		const thoughtButton = [...scroller!.querySelectorAll("button")].find((item) => item.textContent?.startsWith("Thought for"));
		return {
			iconOffset: Math.abs(button.querySelector("svg")!.getBoundingClientRect().left - thoughtButton!.querySelector("svg")!.getBoundingClientRect().left),
			clearance: button.getBoundingClientRect().left - container!.getBoundingClientRect().left,
		};
	});
	expect(geometry.iconOffset).toBeLessThanOrEqual(1);
	expect(geometry.clearance).toBeGreaterThanOrEqual(4);
});
