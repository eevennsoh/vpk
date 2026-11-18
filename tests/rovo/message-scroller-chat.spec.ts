import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("fullscreen chat anchors new turns and lets readers return to the latest reply", async ({ page }) => {
	const threads = new Map<string, Record<string, unknown>>();
	let responseNumber = 0;
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
			await route.fulfill({ status: 200, json: {} });
		}
	});
	await page.route("**/api/chat-title", (route) => route.fulfill({ json: { title: "Scroller test" } }));
	await page.route("**/api/rovo/chat", async (route) => {
		responseNumber += 1;
		const text = `Reply ${responseNumber}. ` + "A longer response keeps the conversation scrollable. ".repeat(30);
		await route.fulfill({
			headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
			body: [
				`data: ${JSON.stringify({ type: "start", messageId: `reply-${responseNumber}` })}`,
				'data: {"type":"text-start","id":"text"}',
				`data: ${JSON.stringify({ type: "text-delta", id: "text", delta: text })}`,
				'data: {"type":"text-end","id":"text"}',
				`data: ${JSON.stringify({ type: "data-turn-complete", data: { timestamp: new Date().toISOString() } })}`,
				'data: {"type":"finish"}',
				"data: [DONE]",
				"",
			].join("\n\n"),
		});
	});
	await page.goto(appUrl("/rovo"));
	const composer = page.getByRole("textbox", { name: "Message" });
	for (const number of [1, 2]) {
		await composer.fill(`Question ${number}`);
		await composer.press("Enter");
		await expect(page.getByTestId("message-assistant").last()).toContainText(`Reply ${number}.`);
	}
	const viewport = page.locator('[data-slot="message-scroller-viewport"]');
	await expect(viewport.locator('[data-scroll-anchor="true"]')).toHaveCount(2);
	await expect(viewport.locator('[data-slot="bubble"]')).toHaveCount(2);
	await expect.poll(() => viewport.locator('[data-scroll-anchor="true"]').last().evaluate((element) => {
		const scrollport = element.closest('[data-slot="message-scroller-viewport"]');
		return scrollport ? element.getBoundingClientRect().top - scrollport.getBoundingClientRect().top : Infinity;
	})).toBeLessThan(48);
	await viewport.hover();
	await page.mouse.wheel(0, -2000);
	const latest = page.getByRole("button", { name: "Scroll to bottom" });
	await expect(latest).toBeVisible();
	await latest.click();
	await expect.poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
});
