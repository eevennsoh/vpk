import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

test("add agent scales in beside the assignee without moving its hit target", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const issue = page.locator('[data-issue-key="PAY-107"][data-board-column-title]');
	const add = issue.getByRole("button", { name: "Add agent to PAY-107" });
	const visual = add.locator('[data-slot="jira-issue-add-agent-visual"]');
	const assignee = issue.locator('[data-slot="jira-issue-assignee-slot"]');
	await expect(visual).toHaveCSS("scale", "0.9");
	const [buttonBefore, assigneeBefore] = await Promise.all([add.boundingBox(), assignee.boundingBox()]);
	const frames = issue.evaluate(async (element) => {
		const visual = element.querySelector<HTMLElement>('[data-slot="jira-issue-add-agent-visual"]');
		const slot = element.querySelector<HTMLElement>('[data-slot="jira-issue-add-agent"]');
		if (!visual || !slot) throw new Error("Missing add-agent visual");
		await new Promise<void>((resolve) => element.addEventListener("pointerenter", () => resolve(), { once: true }));
		const start = performance.now();
		const samples: { scale: number; opacity: number }[] = [];
		while (performance.now() - start < 240) {
			samples.push({ scale: Number.parseFloat(getComputedStyle(visual).scale), opacity: Number.parseFloat(getComputedStyle(slot).opacity) });
			await new Promise<number>((resolve) => requestAnimationFrame(resolve));
		}
		return samples;
	});
	const summary = issue.getByText("Move retry and backoff out of LegacyGatewayAdapter", { exact: true });
	await summary.hover();
	const samples = await frames;
	expect(samples.some(({ scale }) => scale > 0.9 && scale < 0.999), JSON.stringify(samples)).toBe(true);
	expect(samples.some(({ opacity }) => opacity > 0 && opacity < 0.999), JSON.stringify(samples)).toBe(true);
	await expect(visual).toHaveCSS("scale", "1");
	const [buttonAfter, assigneeAfter] = await Promise.all([add.boundingBox(), assignee.boundingBox()]);
	expect(buttonAfter).toEqual(buttonBefore);
	expect(assigneeAfter).toEqual(assigneeBefore);
	await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
	await summary.hover();
	await expect(visual).toHaveCSS("scale", "1");
	await add.click();
	await expect(page.getByRole("textbox", { name: "Search agents" })).toBeVisible();
	await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
	await expect(visual).toHaveCSS("scale", "1");
	await page.keyboard.press("Escape");
});

test("add agent appears without scaling when reduced motion is enabled", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const issue = page.locator('[data-issue-key="PAY-107"][data-board-column-title]');
	const visual = issue.getByRole("button", { name: "Add agent to PAY-107" }).locator('[data-slot="jira-issue-add-agent-visual"]');
	await expect(visual).toHaveCSS("scale", "1");
	await issue.getByText("Move retry and backoff out of LegacyGatewayAdapter", { exact: true }).hover();
	await expect(visual).toHaveCSS("scale", "1");
	await expect(visual).toHaveCSS("transition-property", "none");
});
