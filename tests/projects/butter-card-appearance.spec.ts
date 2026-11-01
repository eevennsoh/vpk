import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("Butter aligns footer icons with the agent row", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	for (const key of ["PAY-105", "PAY-107", "PAY-112", "PAY-123", "PAY-101"]) {
		const issue = card(page, key);
		const centers = await issue.evaluate((node) => {
			const center = (selector: string) => {
				const bounds = node.querySelector(selector)?.getBoundingClientRect();
				return bounds ? bounds.left + bounds.width / 2 : null;
			};
			return {
				metadata: center('[aria-label^="Pull request"] svg') ?? center('[aria-label$="priority"] svg'),
				agent: center('[data-jira-issue-agent-row-handle] > div > span:first-child'),
				assignee: center('[data-slot="jira-issue-project-butter"] [data-slot="jira-issue-assignee-slot"]'),
				status: center('[data-slot="jira-issue-agent-status-affordance"]'),
			};
		});
		for (const value of Object.values(centers)) expect(value, `${key}: ${JSON.stringify(centers)}`).not.toBeNull();
		expect(Math.abs(centers.metadata! - centers.agent!), key).toBeLessThan(0.5);
		expect(Math.abs(centers.assignee! - centers.status!), key).toBeLessThan(0.5);
	}
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Butter's inset keeps card content still and uses one raised edge (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		await page.evaluate(() => document.fonts.ready);
		const issue = card(page, "PAY-118");
		const summary = issue.getByText("Carry card-artwork metadata into the next wallet epic", { exact: true });
		await summary.hover();
		const add = issue.getByRole("button", { name: "Add agent to PAY-118", exact: true });
		const surface = issue.locator('[data-slot="jira-issue-surface"]');
		const baseline = await issue.evaluate((node) => {
			const host = node.querySelector("article")!.getBoundingClientRect();
			return ["[data-slot='jira-issue-project-butter']", "p", "[data-slot='jira-issue-assignee-slot']"].map((selector) => {
				const bounds = node.querySelector(selector)!.getBoundingClientRect();
				return [bounds.x - host.x, bounds.y - host.y, bounds.width, bounds.height];
			});
		});
		const framesPromise = issue.evaluate(async (node) => {
			const trigger = node.querySelector<HTMLButtonElement>("[aria-label='Add agent to PAY-118']")!;
			await new Promise<void>((resolve) => trigger.addEventListener("click", () => resolve(), { once: true, capture: true }));
			const frames: number[][][] = [];
			for (let i = 0; i < 32; i++) {
				const host = node.querySelector("article")!.getBoundingClientRect();
				frames.push(["[data-slot='jira-issue-project-butter']", "p", "[data-slot='jira-issue-assignee-slot']"].map((selector) => {
					const bounds = node.querySelector(selector)!.getBoundingClientRect();
					return [bounds.x - host.x, bounds.y - host.y, bounds.width, bounds.height];
				}));
				await new Promise<number>((resolve) => requestAnimationFrame(resolve));
			}
			return frames;
		});
		await add.click();
		const frames = await framesPromise;
		expect(frames.every((frame) => frame.every((box, index) => box.every((value, axis) =>
			Math.abs(value - baseline[index][axis]) < 0.5))), JSON.stringify({ baseline, frames })).toBe(true);
		await expect(page.getByRole("menu", { name: "Agents", exact: true })).toBeVisible();
		await expect(surface).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
		await expect(surface).not.toHaveCSS("box-shadow", "none");
		await page.keyboard.press("Escape");
		await expect(add).toBeFocused();
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Butter's card picker keeps keyboard focus through assignment (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter"));
		const issue = card(page, "PAY-118");
		await expect(issue.locator('[data-slot="jira-issue-project-butter"]')).toBeVisible();
		const add = issue.getByRole("button", { name: "Add agent to PAY-118", exact: true });
		await add.focus();
		await page.keyboard.press("Enter");
		const menu = page.getByRole("menu", { name: "Agents", exact: true });
		const claude = menu.getByRole("menuitem", { name: "Claude", exact: true });
		await claude.focus();
		await expect(issue.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveAttribute("data-agent-id", "claude-code");
		await page.keyboard.press("Escape");
		await expect(add).toBeFocused();
		await expect(issue.locator('[data-jira-issue-agent-row-handle]')).toHaveCount(0);
		await page.keyboard.press("Enter");
		await claude.focus();
		await page.keyboard.press("Enter");
		await expect(issue).toHaveAttribute("data-board-column-title", "In progress");
		const activity = issue.locator('[data-jira-issue-agent-row-handle]');
		await expect(activity).toHaveCount(1);
		await expect(activity).toHaveAttribute("aria-label", "Claude: Working");
		await expect(activity).toBeFocused();
		await expect(issue.getByRole("button", { name: "Add agent to PAY-118", exact: true })).toHaveCount(0);
	});
}

test("Butter retains the new cards across Board/List and content presets", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await expect(page.locator('[data-slot="jira-issue-project-butter"]')).toHaveCount(20);
	const issue = card(page, "PAY-118");
	await issue.locator('[data-slot="jira-issue-project-butter"] p').first().click({ modifiers: ["Shift"] });
	await expect(issue.locator('[data-jira-issue-activation-control]')).toHaveAttribute("aria-pressed", "true");
	await page.keyboard.press("Escape");
	await expect(issue.locator('[data-jira-issue-activation-control]')).toHaveAttribute("aria-pressed", "false");
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByRole("region", { name: "Payments SDK v2 migration work items list", exact: true })).toBeVisible();
	await page.getByRole("tab", { name: "Board", exact: true }).click();
	await expect(issue.locator('[data-slot="jira-issue-project-butter"]')).toBeVisible();
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Checkout roadmap", exact: true })).toBeVisible();
	await expect(page.locator('[data-slot="jira-issue-project-butter"]')).toHaveCount(11);
});

test("Butter's new card still moves through the board's native drag path", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const source = card(page, "PAY-124").locator('[draggable]').first();
	const origin = await source.boundingBox();
	if (!origin) throw new Error("Source card is missing");
	await page.mouse.move(origin.x + 70, origin.y + 42);
	await page.mouse.down();
	await page.mouse.move(origin.x + 95, origin.y + 45, { steps: 5 });
	await expect(source).toHaveAttribute("data-dragging", "true");
	const target = page.locator('[data-jira-kanban-column="In progress"] [data-issue-status-zone="In progress"]');
	await expect(target).toBeVisible();
	const destination = await target.boundingBox();
	if (!destination) throw new Error("Destination column is missing");
	await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 5 });
	await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2);
	await expect(page.locator('[data-issue-drop-entered="In progress"]')).toBeVisible();
	await page.mouse.up();
	await expect(card(page, "PAY-124")).toHaveAttribute("data-board-column-title", "In progress");
	await expect(card(page, "PAY-124").locator('[data-slot="jira-issue-project-butter"]')).toBeVisible();
});

test("the Team EU26 board retains its existing card appearance", async ({ page }) => {
	await page.goto(appUrl("/jira-team-eu26"));
	await expect(card(page, "PAY-118")).toBeVisible();
	await expect(page.locator('[data-slot="jira-issue-project-butter"]')).toHaveCount(0);
});
