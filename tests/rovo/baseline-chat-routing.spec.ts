import { expect, test, type Page, type Response } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const ROVO_APP_URL = appUrl("/rovo");

const COMPOSER_PLACEHOLDER = "Ask, @mention, or / for skills";

type RouteDecision = {
	intent: string;
	presentation: string;
	confidence: number;
	reason: string;
	origin: string;
};

function extractFirstRouteDecisionFromSse(body: string): RouteDecision | null {
	const lines = body.split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("data:")) {
			continue;
		}

		const payloadText = trimmed.slice(5).trim();
		if (!payloadText.startsWith("{")) {
			continue;
		}

		try {
			const parsed = JSON.parse(payloadText) as {
				type?: string;
				data?: RouteDecision;
			};
			if (parsed.type === "data-route-decision" && parsed.data) {
				return parsed.data;
			}
		} catch {
			continue;
		}
	}

	return null;
}

async function gotoFreshRovoApp(page: Page) {
	await page.goto(ROVO_APP_URL, { waitUntil: "networkidle" });

	const newChatButton = page.getByRole("button", { name: /new chat/i });
	if (await newChatButton.isVisible().catch(() => false)) {
		await newChatButton.click();
	}

	await expect(page.getByPlaceholder(COMPOSER_PLACEHOLDER)).toBeVisible();
}

async function submitPromptAndCollectRouteDecision(
	page: Page,
	prompt: string,
): Promise<RouteDecision | null> {
	const responsePromise = page.waitForResponse((response: Response) => {
		return response.url().includes("/api/rovo/chat")
			&& response.request().method() === "POST";
	});

	await page.getByPlaceholder(COMPOSER_PLACEHOLDER).fill(prompt);
	await page.getByRole("button", { name: /^submit$/i }).click();

	const response = await responsePromise;
	const body = await response.text();
	return extractFirstRouteDecisionFromSse(body);
}

test.describe("Rovo baseline routing", () => {
	test("hello stays in chat and does not create artifact or plan UI", async ({
		page,
	}) => {
		let agentModeRequestCount = 0;
		page.on("request", (request) => {
			if (
				request.url().includes("/api/agent-mode")
				&& request.method() === "POST"
			) {
				agentModeRequestCount += 1;
			}
		});

		await gotoFreshRovoApp(page);

		const routeDecision = await submitPromptAndCollectRouteDecision(page, "hello");

		await expect(page.getByTestId("message-user").last()).toContainText("hello");
		await expect(page.getByTestId("message-assistant").last()).toBeVisible();
		await expect(page.getByLabel(/clarification questions/i)).toHaveCount(0);
		await expect(page.getByTestId("approval-card")).toHaveCount(0);
		await expect(page.getByText(/Editing artifact context from/i)).toHaveCount(0);
		await expect(page.getByLabel(/artifact version/i)).toHaveCount(0);

		expect(routeDecision).not.toBeNull();
		expect(routeDecision).toMatchObject({
			intent: "chat",
			presentation: "text",
			origin: "text",
		});
		expect(agentModeRequestCount).toBe(0);
	});

	test("what is React? stays in chat and does not create artifact or plan UI", async ({
		page,
	}) => {
		await gotoFreshRovoApp(page);

		const routeDecision = await submitPromptAndCollectRouteDecision(
			page,
			"what is React?",
		);

		await expect(page.getByTestId("message-user").last()).toContainText(
			"what is React?",
		);
		await expect(page.getByTestId("message-assistant").last()).toBeVisible();
		await expect(page.getByLabel(/clarification questions/i)).toHaveCount(0);
		await expect(page.getByTestId("approval-card")).toHaveCount(0);
		await expect(page.getByText(/Editing artifact context from/i)).toHaveCount(0);
		await expect(page.getByLabel(/artifact version/i)).toHaveCount(0);

		expect(routeDecision).not.toBeNull();
		expect(routeDecision).toMatchObject({
			intent: "chat",
			presentation: "text",
			origin: "text",
		});
	});
});
