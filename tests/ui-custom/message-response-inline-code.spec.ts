import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const STREAMDOWN_PREVIEW_URL = appUrl("/preview/utility/streamdown");

test("shared MessageResponse defers inline code lozenges until the streaming block completes", async ({
	page,
}) => {
	await page.goto(STREAMDOWN_PREVIEW_URL, { waitUntil: "networkidle" });

	const replayButton = page.getByRole("button", { name: /replay animation/i });
	const showFinalStateButton = page.getByRole("button", { name: /show final state/i });
	const sharedHarness = page.getByTestId("message-response-streaming-demo");
	const streamingInlineCode = sharedHarness
		.locator('[data-inline-code-state="streaming"]')
		.filter({ hasText: "`animated`" });
	const completeInlineCode = sharedHarness
		.locator('[data-inline-code-state="complete"]')
		.filter({ hasText: "animated" });

	await expect(sharedHarness).toBeVisible();

	await showFinalStateButton.click();
	await expect(completeInlineCode.first()).toBeVisible();

	await replayButton.click();
	await expect(streamingInlineCode.first()).toBeVisible({ timeout: 3_000 });
	await expect(completeInlineCode).toHaveCount(0);

	await expect(sharedHarness.locator('[data-inline-code-state="streaming"]')).toHaveCount(0, {
		timeout: 10_000,
	});
	await expect(completeInlineCode.first()).toBeVisible();

	await replayButton.click();
	await expect(streamingInlineCode.first()).toBeVisible({ timeout: 3_000 });
});
