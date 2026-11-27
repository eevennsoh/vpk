import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1600, height: 1100 }, ignoreHTTPSErrors: true });

async function addAgent(page: Page, surface: "Board" | "List" | "Work item", name: "Claude (Recommended)" | "Cursor") {
	if (surface === "Work item") {
		const item = page.getByRole("region", { name: "Work item full screen view" });
		await item.getByRole("group", { name: "Agents field" }).getByRole("button", { name: /^\d+ agents?$/u }).click();
		await page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name, exact: true }).click();
	} else {
		const area = surface === "List" ? page.getByRole("region", { name: "Payments SDK v2 migration work items list" }) : page.locator('[data-issue-key="PAY-118"][data-board-column-title]');
		const trigger = area.getByRole("button", { name: "Add agent to PAY-118", exact: true });
		if (surface === "Board") {
			await trigger.focus();
			await trigger.press("Enter");
		} else await trigger.click();
		await page.getByRole("dialog", { name: "Agents" }).getByRole("button", { name, exact: true }).click();
	}
}

for (const surface of ["Board", "List", "Work item"] as const) {
	test(`adding an agent plays the Rovo logo cycle in ${surface}`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: `Select ${surface}`, exact: true }).click();
		const launcher = page.getByRole("button", { name: "Open Rovo chat", exact: true });
		await expect(launcher).toBeVisible();
		await expect(launcher.locator("svg linearGradient")).toHaveCount(0);
		await addAgent(page, surface, "Claude (Recommended)");
		await expect(page.getByRole("button", { name: "Claude added", exact: true })).toBeVisible();
		await expect(launcher.locator("svg linearGradient")).toHaveCount(2);
		const movingFacet = launcher.locator("svg g[mask] > g").first();
		const initialTransform = await movingFacet.getAttribute("style");
		await expect.poll(() => movingFacet.getAttribute("style")).not.toBe(initialTransform);
		await expect(launcher.locator("svg linearGradient")).toHaveCount(0, { timeout: 6000 });
	});
}

test("starting an agent keeps its list row in place", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const list = page.getByRole("region", { name: "Payments SDK v2 migration work items list" });
	const row = list.getByRole("row").filter({ has: page.getByRole("button", { name: "PAY-118", exact: true }) });
	const before = await row.boundingBox();
	await addAgent(page, "List", "Claude (Recommended)");
	await expect(row.getByRole("button", { name: "Change status for PAY-118. Current status: In progress" })).toBeVisible();
	await expect(row.getByRole("button", { name: "Claude: Working" })).toBeVisible();
	await expect.poll(async () => (await row.boundingBox())?.y).toBe(before?.y);
});

test("another agent addition restarts an in-progress Rovo cycle", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List", exact: true }).click();
	const launcher = page.getByRole("button", { name: "Open Rovo chat", exact: true });
	await addAgent(page, "List", "Claude (Recommended)");
	await expect(launcher.locator("svg linearGradient")).toHaveCount(2);
	const firstCycle = await launcher.locator("svg linearGradient").first().getAttribute("id");
	await addAgent(page, "List", "Cursor");
	await expect(page.getByRole("button", { name: "Cursor added", exact: true })).toBeVisible();
	await expect.poll(() => launcher.locator("svg linearGradient").first().getAttribute("id")).not.toBe(firstCycle);
	await expect(launcher.locator("svg linearGradient")).toHaveCount(0, { timeout: 6000 });
});

test("agent arrival keeps the Rovo logo still with reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select List", exact: true }).click();
	await addAgent(page, "List", "Claude (Recommended)");
	await expect(page.getByRole("button", { name: "Claude added", exact: true })).toBeVisible();
	const launcher = page.getByRole("button", { name: "Open Rovo chat", exact: true });
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	await expect(launcher.locator("svg linearGradient")).toHaveCount(0);
	await expect(launcher.locator("svg")).toBeVisible();
});

test("adding an agent in AI suggestions uses its Rovo button notification", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	const item = page.getByRole("region", { name: "Work item full screen view" });
	const launcher = page.getByRole("button", { name: "Review AI suggestions", exact: true });
	const suggestions = page.getByRole("button", { name: "Review suggestions", exact: true });
	await expect(suggestions).toBeVisible();
	await item.getByRole("group", { name: "Agents field" }).getByRole("button", { name: "Add agent", exact: true }).click();
	await page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "Cursor", exact: true }).click();

	await expect(page.getByRole("button", { name: "Cursor added", exact: true })).toBeVisible();
	await expect(launcher).toHaveCount(1);
	await expect(page.getByRole("button", { name: "Open Rovo chat", exact: true })).toHaveCount(0);
	await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
	await expect(item.getByRole("region", { name: "Activity" })).toContainText("Venn added Cursor");

	await page.getByRole("button", { name: "Dismiss Cursor added", exact: true }).click();
	await suggestions.click();
	await expect(page.getByRole("dialog", { name: /^Work item suggestions/ })).toBeVisible();
});

test("inline suggestions show immediately alongside the shared Rovo launcher", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();

	await expect(page.locator('[data-suggestion-preview="description"]')).toContainText("Help merchants adopt Payments SDK v2");
	await expect(page.getByRole("button", { name: "Accept description" })).toBeVisible();
	await page.getByRole("button", { name: "Why description was suggested" }).click();
	await page.getByRole("button", { name: "Context", exact: true }).click();
	const sources = page.getByRole("dialog", { name: "Source previews" });
	await expect(sources).toContainText("Payments SDK v2 — Merchant onboarding PRD");
	await expect(sources).toContainText("Onboarding design review");
	await expect(sources.getByText("Payments SDK v2 — Merchant onboarding PRD").locator("..").locator('[data-slot="icon-tile"][data-variant="blue"] svg')).toBeVisible();
	await expect(sources.getByText("Onboarding design review").locator("..").locator('[data-slot="icon-tile"][data-variant="gray"] svg')).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", { name: "Open Rovo chat", exact: true })).toBeVisible();
	const review = page.getByRole("button", { name: "Review suggestions", exact: true });
	await expect(review).toBeVisible();
	await review.click();
	await expect(page.getByRole("dialog", { name: /^Work item suggestions/ })).toBeVisible();
});

test("inline navigation reveals a collapsed details field and keeps the toolbar with it", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	const details = page.getByRole("button", { name: "Details", exact: true });
	await details.click();
	await expect(details).toHaveAttribute("aria-expanded", "false");
	await page.getByRole("button", { name: "Next suggestion" }).click();
	await expect(details).toHaveAttribute("aria-expanded", "true");
	const assignee = page.locator('[data-field-id="assignee"] [data-project-butter-detail-value-row]');
	const assigneeToolbar = page.getByRole("dialog", { name: "AI suggestion for assignee, 5 left to review" });
	await expect(assignee.getByText("Robi Lopez", { exact: true }).first()).toBeVisible();
	await expect(assigneeToolbar.getByRole("button", { name: "Accept assignee" })).toBeInViewport();
	await expect(page.getByRole("button", { name: "Show more details" })).toBeVisible();
	await page.getByRole("button", { name: "Next suggestion" }).click();
	const dueDate = page.locator('[data-field-id="dueDate"] [data-project-butter-detail-value-row]');
	const toolbar = page.locator('[aria-label^="AI suggestion for due date"]');
	await expect(dueDate).toBeVisible();
	await expect(page.getByRole("button", { name: "Show less details" })).toBeVisible();
	await expect(toolbar.getByRole("button", { name: "Accept due date" })).toBeVisible();
	await expect.poll(async () => {
		const row = await dueDate.boundingBox();
		const bar = await toolbar.boundingBox();
		return row && bar ? Math.abs(bar.y - (row.y + row.height)) : Infinity;
	}).toBeLessThan(8);
	await toolbar.getByRole("button", { name: "Previous suggestion" }).click();
	await expect(page.getByRole("button", { name: "Accept assignee" })).toBeVisible();
});

test("custom source icons use an icon tile in the sources menu", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	await page.getByRole("button", { name: "Next suggestion" }).click();
	await page.getByRole("button", { name: "Why assignee was suggested" }).click();
	const context = page.getByRole("button", { name: "Context", exact: true });
	const clockTile = context.locator('[data-slot="tile"]').filter({ has: page.locator("svg") }).first();
	await expect(clockTile).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await context.hover();
	await expect(clockTile).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await context.click();
	const source = page.getByRole("dialog", { name: "Source previews" }).getByText("8 of 10 similar items resolved by Robi").locator("..");
	await expect(source.locator('[data-slot="icon-tile"][data-variant="gray"] svg')).toBeVisible();
	const resting = await source.evaluate((element) => getComputedStyle(element).backgroundColor);
	await source.hover();
	await expect.poll(() => source.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(resting);
	await expect(source).toHaveCSS("cursor", "default");
	await source.click();
	await expect(page.getByRole("dialog", { name: "Source previews" })).toBeVisible();
	const jira = page.getByRole("dialog", { name: "Source previews" }).getByText("Component lead: Merchant Onboarding").locator("..");
	await expect(jira.locator('[data-slot="icon-tile"][data-variant="gray"] svg')).toBeVisible();
});

test("sources menu uses content tiles for linked sources in both variants", async ({ page }) => {
	await page.goto(appUrl("/components/ui-custom/sources-menu"));
	const triggers = page.getByRole("button", { name: "Context", exact: true });
	for (let index = 0; index < 2; index += 1) {
		await triggers.nth(index).click();
		const menu = page.getByRole("dialog", { name: "Source previews" });
		for (const [title, variant] of [["About UST", "blue"], ["VPK repository", "gray"], ["Team conversation", "gray"]] as const) {
			const row = menu.locator('[data-menu-row], a').filter({ hasText: title }).first();
			await expect(row.locator(`[data-slot="icon-tile"][data-variant="${variant}"] svg`)).toBeVisible();
		}
		await page.keyboard.press("Escape");
	}
});

for (const reducedMotion of ["reduce", "no-preference"] as const) test(`finishing inline suggestions opens the compact review result (${reducedMotion})`, async ({ page }) => {
	await page.emulateMedia({ reducedMotion });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	if (reducedMotion === "no-preference") await page.evaluate(() => {
		const observer = new MutationObserver(() => {
			if (document.querySelector("[data-notification-opening]")) {
				document.documentElement.dataset.completionOpening = "seen";
				observer.disconnect();
			}
		});
		observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-notification-opening"] });
	});
	for (const field of ["description", "assignee", "due date", "parent", "labels"]) {
		await page.getByRole("button", { name: `Accept ${field}`, exact: true }).click();
	}
	await expect(page.getByRole("status").filter({ hasText: "All caught up" })).toHaveCount(0);
	const result = page.getByRole("dialog", { name: /5 suggestions reviewed/ });
	await expect(result).toBeVisible();
	if (reducedMotion === "no-preference") await expect(page.locator("html")).toHaveAttribute("data-completion-opening", "seen");
	const undo = result.getByRole("button", { name: "Undo accepting Labels" });
	await expect(undo).toBeVisible();
	await expect(result.getByRole("button", { name: "Check again" })).toBeVisible();
	await expect(result.getByRole("button", { name: "Close suggestions" })).toBeVisible();
	await result.getByRole("button", { name: "Close suggestions" }).click();
	await expect(page.getByRole("button", { name: "Accept description", exact: true })).toHaveCount(0);
});

test("inline completion keeps discarded suggestions decided", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	await page.getByRole("button", { name: "Discard description", exact: true }).click();
	for (const field of ["assignee", "due date", "parent", "labels"]) {
		await page.getByRole("button", { name: `Accept ${field}`, exact: true }).click();
	}
	const result = page.getByRole("dialog", { name: /5 suggestions reviewed/ });
	await expect(result).toBeVisible();
	await result.getByRole("button", { name: "Undo accepting Labels" }).click();
	await expect(page.getByRole("button", { name: "Accept labels", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Undo description", exact: true })).toBeVisible();
});

test("Undo restores the last discarded inline suggestion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	for (const field of ["description", "assignee", "due date", "parent"]) {
		await page.getByRole("button", { name: `Accept ${field}`, exact: true }).click();
	}
	await page.getByRole("button", { name: "Discard labels", exact: true }).click();
	const result = page.getByRole("dialog", { name: /5 suggestions reviewed/ });
	await result.getByRole("button", { name: "Undo dismissing Labels" }).click();
	await expect(page.getByRole("button", { name: "Accept labels", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Undo description", exact: true })).toBeVisible();
});

test("closing the review menu resumes inline at the next pending suggestion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Inline", exact: true }).click();
	await expect(page.locator('[data-suggestion-preview="description"]')).toBeVisible();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	await expect(panel).toBeVisible();
	await expect(page.getByRole("button", { name: "Next suggestion" })).toHaveCount(0);
	await panel.getByRole("button", { name: "Close suggestions" }).click();
	await expect(page.locator('[data-suggestion-preview="description"]')).toBeVisible();
	await page.getByRole("button", { name: "Review suggestions", exact: true }).click();
	await expect(panel).toBeVisible();
	await panel.getByRole("button", { name: "Accept description" }).click();
	await panel.getByRole("button", { name: "Close suggestions" }).click();
	await expect(page.locator('[data-suggestion-preview="assignee"]')).toContainText("Robi Lopez");
	await expect(page.getByRole("button", { name: "Accept assignee", exact: true })).toBeVisible();
});
