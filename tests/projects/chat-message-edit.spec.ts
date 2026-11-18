import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

async function mockChat(page: Page) {
	const threads = new Map<string, Record<string, unknown>>();
	const requests: string[] = [];
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
	await page.route("**/api/chat-title", (route) => route.fulfill({ json: { title: "Edit test" } }));
	await page.route("**/api/rovo/chat", (route) => {
		requests.push(route.request().postData() ?? "");
		return route.fulfill({
			headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
			body: [
				`data: ${JSON.stringify({ type: "start", messageId: `reply-${requests.length}` })}`,
				'data: {"type":"text-start","id":"text"}',
				'data: {"type":"text-delta","id":"text","delta":"Mocked response"}',
				'data: {"type":"text-end","id":"text"}',
				`data: ${JSON.stringify({ type: "data-turn-complete", data: { timestamp: new Date().toISOString() } })}`,
				'data: {"type":"finish"}',
				"data: [DONE]",
				"",
			].join("\n\n"),
		});
	});
	return requests;
}

for (const surface of [
	{ name: "sidebar", route: "/components/projects/sidebar-chat", composer: "Chat message input" },
	{ name: "fullscreen", route: "/rovo", composer: "Message" },
]) {
	test(`${surface.name} message editing keeps controls and focus visible`, async ({ page }, testInfo) => {
		const requests = await mockChat(page);
		await page.goto(appUrl(surface.route));
		const composer = page.getByRole("textbox", { name: surface.composer });
		await composer.fill("Original question");
		await composer.press("Enter");
		await expect(page.getByText("Mocked response").first()).toBeVisible();
		const message = page.locator('[data-slot="message"].is-user').first();
		await expect(message).toContainText("Original question");

		async function openEditor() {
			await message.hover();
			await message.getByRole("button", { name: "Edit", exact: true }).click();
			const field = message.locator('[data-slot="inline-edit"] textarea');
			await expect(field).toBeFocused();
			return field;
		}

		const field = await openEditor();
		const confirm = message.getByRole("button", { name: "Confirm changes" });
		const cancel = message.getByRole("button", { name: "Cancel changes" });
		await expect(confirm).toBeVisible();
		await expect(cancel).toBeVisible();
		const geometry = await field.evaluate((textarea) => {
			const editor = textarea.closest('[data-slot="inline-edit"]')!;
			const area = editor.getBoundingClientRect();
			const fieldBox = textarea.getBoundingClientRect();
			const buttons = [...editor.querySelectorAll("button")];
			return {
				focusClearance: Math.min(fieldBox.left - area.left, fieldBox.top - area.top, area.right - fieldBox.right),
				buttonsInside: buttons.every((button) => button.getBoundingClientRect().bottom <= area.bottom),
				buttonsReachable: buttons.every((button) => {
					const box = button.getBoundingClientRect();
					const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
					return hit === button || button.contains(hit);
				}),
			};
		});
		expect(geometry.focusClearance).toBeGreaterThanOrEqual(3);
		expect(geometry.buttonsInside).toBe(true);
		expect(geometry.buttonsReachable).toBe(true);
		await page.screenshot({ path: testInfo.outputPath("editing.png") });

		await field.fill("Discarded question");
		await cancel.click();
		await expect(page.getByText("Original question", { exact: true }).first()).toBeVisible();
		const secondField = await openEditor();
		await secondField.fill("Updated question\nwith another line of context");
		await confirm.click();
		await expect.poll(() => requests.some((body) => body.includes("Updated question"))).toBe(true);
	});
}
