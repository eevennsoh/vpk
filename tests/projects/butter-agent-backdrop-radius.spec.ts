import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("assigned agents have a 12px backdrop on the board", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	const column = page.getByRole("region", { name: "In progress work items" });
	const backdrop = column.locator('[data-issue-key="PAY-107"] [data-slot="jira-issue-agent-backdrop"]');
	await expect(backdrop).toHaveCSS("opacity", "1");
	await expect(backdrop).toHaveCSS("border-radius", "12px");
});
