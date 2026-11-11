import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("work item activity text aligns with its icon and timestamp", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("button", { name: /\d+ suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept description" }).click();
	const button = page.getByRole("button", { name: /Venn updated description/ });
	await expect(button).toBeVisible();
	const offsets = await button.evaluate((element) => {
		const row = element.closest("[data-jira-activity-entry-id]");
		const track = row?.firstElementChild?.firstElementChild;
		if (!track) throw new Error("Activity icon track not found");
		const center = (child: Element) => { const box = child.getBoundingClientRect(); return box.top + box.height / 2; };
		const mention = element.querySelector("[data-jira-activity-user-mention]");
		const mentionText = element.querySelector("[data-tag-text]");
		const avatar = element.querySelector("[data-slot=tag-before]");
		if (!mention || !mentionText || !avatar) throw new Error("Activity mention is missing");
		return [Math.abs(center(element) - center(track)), ...[...element.children, mention, mentionText, avatar].map((child) => Math.abs(center(child) - center(element)))];
	});
	for (const offset of offsets) expect(offset).toBeLessThanOrEqual(1);
	const gap = await button.evaluate((element) => element.children[2].getBoundingClientRect().left - element.children[1].getBoundingClientRect().right);
	expect(gap).toBeGreaterThanOrEqual(12);
	await button.click();
	const details = page.locator('[data-jira-activity-entry-id="butter-accepted-suggestions"] dd');
	await expect(details.first()).toBeVisible();
	const colors = await details.evaluateAll((elements) => elements.flatMap((element) => [...element.querySelectorAll("span")].map((span) => ({ color: getComputedStyle(span).color, parentColor: getComputedStyle(element).color, background: getComputedStyle(span).backgroundColor }))));
	expect(colors.length).toBeGreaterThan(0);
	for (const value of colors) {
		expect(value.color).toBe(value.parentColor);
		expect(value.background).toBe("rgba(0, 0, 0, 0)");
	}
});

test("agent assignment and field updates share activity text and mention styling", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /\d+ suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept description" }).click();
	const update = item.getByRole("button", { name: /Venn updated description/ });
	await expect(update).toBeVisible();
	await item.getByRole("button", { name: /\. Add agent$/ }).click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Claude");
	await page.getByRole("option", { name: /^Claude/ }).first().click();
	await page.getByRole("menu", { name: "Run Claude on" }).getByRole("menuitem", { name: "Run on cloud" }).click();
	const invocation = item.locator('[data-jira-activity-entry-id^="merchant-agent-added-"]');
	await expect(invocation).toContainText("Venn added Claude and self-assigned the issue");
	const actorMention = '[data-jira-activity-user-mention]';
	await expect(update.locator(actorMention)).toHaveText("Venn");
	await expect(invocation.locator(actorMention)).toHaveText("Venn");
	await expect(invocation.locator('[data-jira-activity-agent-mention]')).toHaveText("Claude");
	await expect(invocation.getByText("Just now", { exact: true })).toBeVisible();
	const invocationOffsets = await invocation.evaluate((row) => {
		const track = row.firstElementChild?.firstElementChild;
		const mentions = [...row.querySelectorAll("[data-jira-activity-user-mention], [data-jira-activity-agent-mention]")];
		const shapes = [...row.querySelectorAll("[data-jira-activity-user-mention] [data-slot=tag-before], [data-jira-activity-agent-mention] [data-slot=tag-before]")];
		if (!track || mentions.length !== 2 || shapes.length !== 2) throw new Error("Activity avatars or mentions are missing");
		const center = (element: Element) => { const box = element.getBoundingClientRect(); return box.top + box.height / 2; };
		return [...mentions, ...shapes].map((element) => Math.abs(center(element) - center(track)));
	});
	for (const offset of invocationOffsets) expect(offset).toBeLessThanOrEqual(1);
	const styles = await item.evaluate((root) => {
		const event = root.querySelector<HTMLElement>('[data-jira-activity-entry-id^="merchant-agent-added-"] p');
		const change = root.querySelector<HTMLElement>('[data-jira-activity-entry-id="butter-accepted-suggestions"] button');
		const action = change?.querySelector<HTMLElement>("span:nth-child(2)");
		const mentions = [event, change].map((node) => node?.querySelector<HTMLElement>("[data-jira-activity-user-mention] [data-tag-text]"));
		mentions.push(event?.querySelector<HTMLElement>("[data-jira-activity-agent-mention] [data-tag-text]"));
		if (!event || !action || mentions.some((node) => !node)) throw new Error("Activity text or mention is missing");
		const style = (element: Element) => { const computed = getComputedStyle(element); return [computed.fontSize, computed.fontWeight, computed.color]; };
		return { event: style(event), action: style(action), mentionSizes: mentions.map((node) => node ? getComputedStyle(node).fontSize : "") };
	});
	expect(styles.event).toEqual(styles.action);
	expect(styles.mentionSizes).toEqual([styles.action[0], styles.action[0], styles.action[0]]);
	await item.getByRole("button", { name: /\. Add agent$/ }).click();
	await page.getByRole("combobox", { name: "Search agents" }).fill("Cursor");
	await page.getByRole("option", { name: /^Cursor/ }).first().click();
	await page.getByRole("menu", { name: "Run Cursor on" }).getByRole("menuitem", { name: "Run on cloud" }).click();
	const cursorMention = item.locator('[data-jira-activity-agent-mention]').filter({ hasText: "Cursor" }).first();
	await expect(cursorMention).toBeVisible();
	const cursorSizes = await cursorMention.evaluate((mention) => {
		const text = mention.querySelector("[data-tag-text]");
		if (!text || !mention.parentElement) throw new Error("Cursor mention or activity text is missing");
		return [getComputedStyle(text).fontSize, getComputedStyle(mention.parentElement).fontSize];
	});
	expect(cursorSizes[0]).toBe(cursorSizes[1]);
});
