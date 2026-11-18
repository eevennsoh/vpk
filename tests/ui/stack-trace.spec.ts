import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const STACK_TRACE_URL = appUrl("/components/ui/stack-trace");

test("stack trace main preview opens the failed command on its frames", async ({ page }) => {
	await page.goto(STACK_TRACE_URL, { waitUntil: "networkidle" });

	// The failed tool call is an error line titled with the parsed error, open by default.
	await expect(page.getByText("Failed: TypeError: Cannot read properties of undefined (reading 'email')").first()).toBeVisible();

	// The app frames are links to the file and line; the framework frames fold into their own line.
	await expect(page.getByRole("link", { name: /seedUsers in prisma\/seed\.ts:27/ }).first()).toBeVisible();
	await expect(page.getByRole("button", { name: /4 framework frames/ }).first()).toBeVisible();
});
