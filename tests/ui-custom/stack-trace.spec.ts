import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const STACK_TRACE_URL = appUrl("/components/ui-custom/stack-trace");

test("stack trace main preview renders parsed frames under the header", async ({
	page,
}) => {
	await page.goto(STACK_TRACE_URL, { waitUntil: "networkidle" });

	// The default preview is expanded, so the parsed error header and the
	// collapsible frame content should both be visible.
	const errorMessage = page
		.getByText("Cannot read properties of undefined (reading 'map')")
		.first();
	await expect(errorMessage).toBeVisible();

	// Frames live in StackTraceContent / StackTraceFrames beneath the header.
	await expect(page.getByText("processData").first()).toBeVisible();
	await expect(page.getByText("handleRequest").first()).toBeVisible();

	// The clickable file path button should render with line:column.
	await expect(
		page.getByRole("button", { name: /src\/utils\/data\.ts:42:15/ }).first(),
	).toBeVisible();
});
