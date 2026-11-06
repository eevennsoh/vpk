import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("the PR Smart Link matches its comment text and baseline", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter"));
	await page.getByRole("button", { name: "Pull request", exact: true }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	const link = item.getByRole("link", { name: /#284: Add merchant onboarding quickstart.*Open/ }).first();
	await expect(link).toBeVisible();
	const metrics = await link.evaluate((element) => {
		const paragraph = element.parentElement;
		const label = element.querySelector<HTMLElement>("[data-smart-link-text]");
		if (!paragraph || !label?.firstChild) throw new Error("Missing comment text or Smart Link label");
		const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
		let previous: Text | null = null;
		while (walker.nextNode()) {
			const node = walker.currentNode as Text;
			if (element.contains(node)) break;
			if (node.textContent?.trim()) previous = node;
		}
		if (!previous) throw new Error("Missing text before the Smart Link");
		const end = previous.textContent!.trimEnd().length;
		const bodyRange = document.createRange();
		bodyRange.setStart(previous, end - 1);
		bodyRange.setEnd(previous, end);
		const labelRange = document.createRange();
		labelRange.selectNodeContents(label);
		const bodyBox = bodyRange.getBoundingClientRect();
		const labelBox = labelRange.getBoundingClientRect();
		return {
			bodySize: getComputedStyle(previous.parentElement!).fontSize,
			linkSize: getComputedStyle(label).fontSize,
			verticalOffset: (labelBox.top + labelBox.bottom - bodyBox.top - bodyBox.bottom) / 2,
		};
	});
	expect(metrics.linkSize).toBe(metrics.bodySize);
	expect(Math.abs(metrics.verticalOffset)).toBeLessThanOrEqual(1.5);
});
