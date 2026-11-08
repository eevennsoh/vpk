import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("Work item gallery displays the Project Butter screen with floating Rovo", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Work item" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	await expect(workItem).toBeVisible();
	await expect(page.getByRole("dialog", { name: "Project butter" })).toHaveCount(0);
	await expect(workItem.getByText("Agents", { exact: true })).toBeVisible();
	const assignee = workItem.getByRole("button", { name: "Change assignee" });
	await expect(assignee).toContainText("Venn");
	await assignee.click();
	await page.getByRole("textbox", { name: "Search people" }).fill("Unassigned");
	await page.getByRole("textbox", { name: "Search people" }).press("Enter");
	await expect(assignee).toContainText("Unassigned");
	await assignee.click();
	await page.getByRole("textbox", { name: "Search people" }).fill("Venn");
	await page.getByRole("textbox", { name: "Search people" }).press("Enter");
	await expect(assignee).toContainText("Venn");
	await expect(workItem.getByRole("separator", { name: "Resize details panel" })).toBeVisible();
	const summary = workItem.getByRole("textbox", { name: "Work item summary" });
	await expect(summary).toHaveText("Redesign onboarding flow for new users");
	await page.getByRole("button", { name: "Open Rovo chat" }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat).toBeVisible();
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await summary.fill("Updated onboarding flow");
	await summary.press("Enter");
	await expect(summary).toHaveText("Updated onboarding flow");
	await expect(workItem.getByRole("button", { name: /Venn\s+updated summary/ })).toBeVisible();
	await gallery.getByRole("button", { name: "Select Pull request" }).click();
	await expect(page.locator("[data-butter-gallery-pull-request]")).toBeVisible();
	await expect(workItem).toBeHidden();
	await gallery.getByRole("button", { name: "Select Work item" }).click();
	await expect(summary).toHaveText("Updated onboarding flow");
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(summary).toHaveText("Redesign onboarding flow for new users");
});

for (const viewport of [{ width: 1600, height: 1200 }, { width: 1600, height: 1000 }, { width: 900, height: 700 }]) {
	test(`Work item gallery aligns with the board at ${viewport.width}x${viewport.height}`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(appUrl("/butter-v1"));
		const boardColumn = page.locator('[data-jira-kanban-column="To do"]');
		const boardBounds = await boardColumn.boundingBox();
		await page.getByText("Port confirmPaymentIntent and the 3-D Secure challenge flow", { exact: true }).click();
		const modal = page.getByRole("dialog", { name: "Project butter" });
		await expect(modal).toBeVisible();
		await expect(modal.getByText("Agents", { exact: true })).toBeVisible();
		const modalBounds = await modal.boundingBox();
		await modal.getByRole("button", { name: "Close Project butter work item" }).click();
		await page.getByRole("button", { name: "Select Work item" }).click();
		const screen = page.getByRole("region", { name: "Work item full screen view" });
		await expect(screen).toBeVisible();
		const screenBounds = await screen.boundingBox();
		if (!boardBounds || !modalBounds || !screenBounds) throw new Error("Work item bounds are unavailable");
		for (const dimension of ["x", "width"] as const) {
			expect(Math.abs(screenBounds[dimension] - modalBounds[dimension])).toBeLessThanOrEqual(2);
		}
		expect(Math.abs(screenBounds.y + screenBounds.height - viewport.height)).toBeLessThanOrEqual(2);
		const keyRow = await screen.locator("[data-project-butter-header-key-row]").boundingBox();
		if (!keyRow) throw new Error("Work item header bounds are unavailable");
		expect(Math.abs(keyRow.y + 24 - boardBounds.y)).toBeLessThanOrEqual(2);
	});
}
