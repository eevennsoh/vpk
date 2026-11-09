import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

async function expectSingleSelectorSurface(popup: Locator) {
	const selector = popup.locator("[data-overlay-surface]");
	await expect(selector).toBeVisible();
	await expect(popup).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(popup).toHaveCSS("overflow", "visible");
	const shadows = await popup.evaluate((element) => getComputedStyle(element).boxShadow.match(/rgba?\([^)]+\)/g) ?? []);
	expect(shadows.every((color) => color === "rgba(0, 0, 0, 0)")).toBe(true);
	await expect(selector).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(selector).not.toHaveCSS("box-shadow", "none");
}

async function sampleLayoutSize(locator: Locator) {
	return locator.evaluate((element) => new Promise<{
		width: number;
		height: number;
		parts: { id: string; x: number; y: number; width: number; height: number }[];
	}[]>((resolve) => {
		const samples: { width: number; height: number; parts: { id: string; x: number; y: number; width: number; height: number }[] }[] = [];
		const started = performance.now();
		const sample = () => {
			const bounds = element.getBoundingClientRect();
			const parts = [...element.querySelectorAll('[data-panel-id], [data-attachment-stack], [data-attachment-card], [data-pile-toggle], [data-attachment-card] img')].map((part) => {
				const rect = part.getBoundingClientRect();
				const id = part.tagName === "IMG" ? `image:${part.closest("[data-attachment-card]")?.getAttribute("data-attachment-card")}`
					: [...part.attributes].filter((attribute) => ["data-panel-id", "data-attachment-stack", "data-attachment-card", "data-pile-toggle"].includes(attribute.name)).map((attribute) => `${attribute.name}:${attribute.value}`).join(":");
				return { id, x: rect.x - bounds.x, y: rect.y - bounds.y, width: rect.width, height: rect.height };
			});
			samples.push({ width: bounds.width, height: bounds.height, parts });
			if (performance.now() - started < 600) requestAnimationFrame(sample);
			else resolve(samples);
		};
		requestAnimationFrame(sample);
	}));
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`gallery content stays in place across tab switches with ${reducedMotion} motion`, async ({ page }) => {
		test.setTimeout(60_000);
		await page.setViewportSize({ width: 1600, height: 1000 });
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.evaluate(() => document.fonts.ready.then(() => undefined));
		const workItem = page.getByRole("region", { name: "Work item full screen view" });
		const details = workItem.locator('[data-panel-id="details"]');
		const views = [
			{ name: "Agent selector", content: page.getByRole("region", { name: "Project Butter agent selector" }) },
			{ name: "Duplicative sessions", content: page.getByRole("region", { name: "Duplicative sessions agent selector" }) },
			{ name: "Board", content: page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-jira-kanban-column="To do"]') },
			{ name: "List", content: page.getByTestId("jira-list") },
			{ name: "Pull request", content: page.locator('[data-butter-gallery-pull-request] [data-slot="jira-issue-card"]') },
			{ name: "Development panel", content: page.getByRole("region", { name: "Development", exact: true }) },
			{ name: "e2e Journey", content: page.locator('[data-butter-board-surface] [data-jira-kanban-column="To do"]') },
		];
		await page.getByRole("button", { name: "Select Work item" }).click();
		await expect(details).toBeVisible();
		const initial = (await sampleLayoutSize(workItem)).at(-1);
		if (!initial) throw new Error("Work item details have no bounds");
		for (const view of views) {
			await test.step(view.name, async () => {
				await page.getByRole("button", { name: `Select ${view.name}` }).click();
				await expect(view.content).toBeVisible();
				const samples = await sampleLayoutSize(view.content);
				for (const dimension of ["width", "height"] as const) {
					const values = samples.map((sample) => sample[dimension]);
					expect(Math.max(...values) - Math.min(...values), `${view.name} ${dimension} changed after appearing`).toBeLessThanOrEqual(1);
				}
				await page.getByRole("button", { name: "Select Work item" }).click();
				const returned = await sampleLayoutSize(workItem);
				for (const part of initial.parts) {
					const positions = returned.map((sample) => sample.parts.find((candidate) => candidate.id === part.id));
					expect(positions.every(Boolean), `${part.id} disappeared after ${view.name}`).toBe(true);
					for (const dimension of ["x", "y", "width", "height"] as const) {
						const drift = Math.max(...positions.map((position) => Math.abs((position?.[dimension] ?? Infinity) - part[dimension])));
						expect(drift, `${part.id} ${dimension} jumped after ${view.name}`).toBeLessThanOrEqual(1);
					}
				}
			});
		}
	});
}

test("the board's agent submenu has one surface", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const card = page.locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await card.getByRole("button", { name: "More actions for PAY-118" }).focus();
	await page.keyboard.press("Enter");
	const menu = page.getByRole("menu", { name: "More actions for PAY-118" });
	await expect(menu).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(menu).not.toHaveCSS("box-shadow", "none");
	await page.getByRole("menuitem", { name: /^Add agent/ }).hover();
	await expectSingleSelectorSurface(page.getByRole("dialog", { name: "Agents", exact: true }));
});

test("Butter v1 board and work item use the direct cloud agent selector", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Work item" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	await workItem.getByRole("group", { name: "Agents field" }).getByRole("button").click();
	const workItemPicker = page.getByRole("dialog", { name: "Add agent" });
	await expectSingleSelectorSurface(workItemPicker);
	await expect(workItemPicker.getByRole("button", { name: "Browse agents" })).toBeVisible();
	await expect(workItemPicker.getByRole("button", { name: "Create agent" })).toHaveCount(0);
	await expect(workItemPicker.getByRole("button", { name: "Show more" })).toBeVisible();
	await workItemPicker.getByRole("button", { name: "Claude", exact: true }).click();
	await expect(workItemPicker).toHaveCount(0);
	await expect(workItem.getByText("Start a new session", { exact: true })).toHaveCount(0);
	await expect(workItem.getByRole("list", { name: "Activity timeline" })).toContainText("Redesign onboarding flow for new users");

	await gallery.getByRole("button", { name: "Select Board" }).click();
	const card = page.locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await card.hover();
	await card.getByRole("button", { name: "Add agent to PAY-118" }).click();
	const boardPicker = page.getByRole("dialog", { name: "Agents", exact: true });
	await expectSingleSelectorSurface(boardPicker);
	await expect(boardPicker.getByRole("button", { name: "Browse agents" })).toBeVisible();
	await expect(boardPicker.getByRole("button", { name: "Create agent" })).toHaveCount(0);
	await expect(boardPicker.getByRole("button", { name: "Show more" })).toBeVisible();
	await boardPicker.getByRole("button", { name: "Claude", exact: true }).click();
	await expect(boardPicker).toHaveCount(0);
	await expect(card.getByRole("button", { name: /Claude: (Working|Needs input)/ })).toBeVisible();
});

test("Work item gallery displays the Project Butter screen with floating Rovo", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const gallery = page.getByRole("group", { name: "Gallery items" });
	await gallery.getByRole("button", { name: "Select Work item" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	await expect(workItem).toBeVisible();
	await expect(page.getByRole("dialog", { name: "Project butter" })).toHaveCount(0);
	await expect(workItem.getByRole("complementary", { name: "Work item details" }).getByRole("button", { name: "Copy prompt", exact: true })).toHaveCount(0);
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
		await page.getByRole("button", { name: "Select Board" }).click();
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
