import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("Butter previews an assigned agent from its session avatar", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").getByRole("button", { name: "Cursor: Working" }).click();
	const assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await assignment.getByRole("button", { name: "Cursor", exact: true }).click();
	await expect(page.getByRole("menu", { name: /Cursor/ })).toBeVisible();
	await page.keyboard.press("Escape");
	const avatar = assignment.getByRole("button", { name: "Preview Cursor" });
	await avatar.hover();
	const lanyard = page.getByRole("article", { name: "Cursor agent" });
	await expect(lanyard).toBeVisible();
	await lanyard.hover();
	await expect(assignment).toBeVisible();
	await expect(lanyard.getByRole("button", { name: "Chat with Cursor" })).toBeVisible();
	await lanyard.getByRole("button", { name: "More actions for Cursor" }).click();
	await expect(page.getByRole("menu", { name: "Actions for Cursor" })).toBeVisible();
	await expect(assignment).toBeVisible();
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");
	await avatar.focus();
	await expect(lanyard).toBeVisible();
	await expect(avatar.locator("xpath=ancestor::button")).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(lanyard).toBeHidden();
	await expect(assignment).toBeVisible();
});

for (const example of [
	{ route: "/butter", key: "PAY-118", type: "task" },
	{ route: "/components/blocks/jira-issue#project-butter", key: "PD-40", type: "story" },
]) {
	test(`Butter centers the ${example.type} icon with its key`, async ({ page }) => {
		await page.goto(appUrl(example.route), { waitUntil: "domcontentloaded" });
		const issue = example.type === "task"
			? card(page, example.key)
			: page.getByRole("region", { name: "Project butter playground" });
		const icon = issue.getByRole("img", { name: example.type, exact: true }).locator("svg");
		const key = issue.getByText(example.key, { exact: true });
		await expect(icon).toBeVisible();
		const [iconBox, keyBox] = await Promise.all([icon.boundingBox(), key.boundingBox()]);
		if (!iconBox || !keyBox) throw new Error(`Missing ${example.key} icon or key`);
		expect(Math.abs((iconBox.y + iconBox.height / 2) - (keyBox.y + keyBox.height / 2))).toBeLessThan(0.5);
	});
}

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

test("Butter keeps card activation separate from its controls", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	const issue = card(page, "PAY-118");
	const title = issue.getByText("Carry card-artwork metadata into the next wallet epic", { exact: true });
	const workItem = page.getByRole("dialog", { name: "Project butter", exact: true });
	const activation = issue.getByRole("button", { name: "PAY-118: Carry card-artwork metadata into the next wallet epic", exact: true });
	await activation.focus();
	await page.keyboard.press("Enter");
	await expect(workItem).toBeVisible();
	await workItem.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(workItem).toHaveCount(0);

	await issue.getByText("wallet", { exact: true }).click();
	await expect(workItem).toHaveCount(0);
	const pullRequest = card(page, "PAY-119").getByRole("button", { name: "Pull request #1880: Publish rollback guide", exact: true });
	await pullRequest.hover();
	const preview = page.locator('[data-slot="hover-card-content"]').filter({ hasText: "Publish rollback guide" });
	await expect(preview).toBeVisible();
	await preview.getByText("Publish rollback guide", { exact: true }).click();
	await expect(workItem).toHaveCount(0);
	await title.hover();
	await issue.getByRole("button", { name: "More actions for PAY-118" }).click();
	const actions = page.getByRole("menu");
	await expect(actions).toBeVisible();
	await actions.locator('[role="separator"]').first().click();
	await expect(workItem).toHaveCount(0);
	await page.keyboard.press("Escape");

	await title.hover();
	await issue.getByRole("button", { name: "Add agent to PAY-118" }).click();
	const agents = page.getByRole("menu", { name: "Agents", exact: true });
	await expect(agents).toBeVisible();
	await expect(workItem).toHaveCount(0);
	await agents.getByRole("menuitem", { name: "Claude", exact: true }).click();
	await expect(issue).toHaveAttribute("data-board-column-title", "In progress");
	await expect(issue.locator("[data-jira-issue-agent-row-handle]")).toHaveAttribute("aria-label", "Claude: Working");
	await expect(workItem).toHaveCount(0);
	await title.click();
	await expect(workItem).toBeVisible();
	await expect(workItem.getByRole("heading", { name: "Carry card-artwork metadata into the next wallet epic" })).toBeVisible();
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

test("Team EU26 retains its original session avatar controls", async ({ page }) => {
	await page.goto(appUrl("/jira-team-eu26"));
	await card(page, "PAY-105").getByRole("button", { name: "Cursor: Working" }).click();
	const assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByRole("button", { name: /Cursor, used by Venn/ })).toBeVisible();
	await expect(assignment.getByRole("button", { name: "Preview Cursor" })).toHaveCount(0);
});
