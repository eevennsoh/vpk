import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const width of [700, 1600]) {
	test(`work item content fades beneath the header after scrolling at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 800 });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Work item" }).click();
		const layout = page.locator("[data-project-butter-work-item]");
		const column = layout.locator(":scope > div").first();
		const scroller = width < 860 ? layout : column;
		await expect(scroller).toHaveCSS("mask-image", "none");
		await scroller.evaluate((element) => { element.scrollTop = 200; });
		await expect(scroller).toHaveCSS("mask-image", /linear-gradient/);
		await expect(scroller).toHaveCSS("--scroll-mask-fade-size", "3rem");
		await expect(column.locator('[data-slot="scroll-mask-blur"]')).toHaveCount(0);
		await scroller.evaluate((element) => { element.scrollTop = 0; });
		await expect(scroller).toHaveCSS("mask-image", "none");
	});
}

test("the details rail fades independently when it scrolls", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 600 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	await page.getByRole("button", { name: "Show more details" }).click();
	const rail = page.locator("[data-project-butter-details-rail]");
	const scroller = rail.locator(":scope > div.overflow-y-auto");
	await expect(scroller).toHaveCSS("mask-image", "none");
	await scroller.evaluate((element) => { element.scrollTop = 200; });
	await expect(scroller).toHaveCSS("mask-image", /linear-gradient/);
	await expect(scroller).toHaveCSS("--scroll-mask-fade-size", "3rem");
	await expect(rail.locator('[data-slot="scroll-mask-blur"]')).toHaveCount(0);
	await scroller.evaluate((element) => { element.scrollTop = 0; });
	await expect(scroller).toHaveCSS("mask-image", "none");
});

test("a dragged details field settles without jumping back on release", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	await page.getByRole("button", { name: "Show more details" }).click();
	const fields = page.locator("[data-project-butter-detail-fields]");
	await fields.evaluate(async (node) => { await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => undefined))); });
	const dueDate = fields.getByRole("group", { name: "Due Date field" });
	const priority = fields.getByRole("group", { name: "Priority field" });
	const label = dueDate.getByText("Due Date", { exact: true });
	await expect(label).toHaveCSS("cursor", "grab");
	const [source, target] = await Promise.all([dueDate.boundingBox(), priority.boundingBox()]);
	if (!source || !target) throw new Error("Missing field geometry");
	await page.mouse.move(source.x + 12, source.y + 8);
	await page.mouse.down();
	await page.mouse.move(target.x + 12, target.y + 28, { steps: 10 });
	await expect(dueDate).toHaveAttribute("data-field-dragging", "true");
	await expect(label).toHaveCSS("cursor", "grabbing");
	await dueDate.evaluate((node) => {
		const panel = node.closest('[data-panel-id="details"]');
		if (!panel) throw new Error("Missing details panel");
		const top = () => node.getBoundingClientRect().top - panel.getBoundingClientRect().top;
		const positions = [top()];
		document.addEventListener("pointerup", () => {
			let frames = 0;
			const sample = () => {
				positions.push(top());
				if (++frames < 20) requestAnimationFrame(sample);
				else node.setAttribute("data-drop-positions", JSON.stringify(positions));
			};
			requestAnimationFrame(sample);
		}, { once: true });
	});
	await page.mouse.up();
	await expect(dueDate).toHaveAttribute("data-drop-positions", /\[/);
	const positions: number[] = JSON.parse((await dueDate.getAttribute("data-drop-positions")) ?? "[]");
	const largestJump = Math.max(...positions.slice(1).map((position, index) => Math.abs(position - positions[index])));
	expect(largestJump, `Release positions: ${positions.join(", ")}`).toBeLessThan(source.height / 2);
	expect(new Set(positions.map((position) => Math.round(position))).size, `Release positions: ${positions.join(", ")}`).toBeGreaterThan(3);
	const order = await fields.locator("[data-field-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-field-id")));
	expect(order.indexOf("dueDate")).toBeLessThan(order.indexOf("priority"));
});

test("a field released within its current slot eases back into place", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	await page.getByRole("button", { name: "Show more details" }).click();
	await page.locator("[data-project-butter-detail-fields]").evaluate(async (node) => { await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => undefined))); });
	const field = page.getByRole("group", { name: "Due Date field" });
	const box = await field.boundingBox();
	if (!box) throw new Error("Missing field geometry");
	await page.mouse.move(box.x + 12, box.y + 8);
	await page.mouse.down();
	await page.mouse.move(box.x + 12, box.y + 25, { steps: 5 });
	await expect(field).toHaveAttribute("data-field-dragging", "true");
	await page.mouse.up();
	await expect.poll(() => field.evaluate((node) => node.getAnimations().some((animation) => animation.playState === "running"))).toBe(true);
	await expect.poll(() => field.evaluate((node) => node.getBoundingClientRect().top)).toBeCloseTo(box.y, 0);
});

test("reordering a field with reduced motion reaches the same order without a drop animation", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	await page.getByRole("button", { name: "Show more details" }).click();
	const fields = page.locator("[data-project-butter-detail-fields]");
	const field = fields.getByRole("group", { name: "Due Date field" });
	const [source, target] = await Promise.all([field.boundingBox(), fields.getByRole("group", { name: "Priority field" }).boundingBox()]);
	if (!source || !target) throw new Error("Missing field geometry");
	await page.mouse.move(source.x + 12, source.y + 8);
	await page.mouse.down();
	await page.mouse.move(target.x + 12, target.y + 28, { steps: 10 });
	await expect(field).toHaveAttribute("data-field-dragging", "true");
	await page.mouse.up();
	await expect.poll(() => fields.locator("[data-field-id]").evaluateAll((nodes) => {
		const order = nodes.map((node) => node.getAttribute("data-field-id"));
		return order.indexOf("dueDate") < order.indexOf("priority");
	})).toBe(true);
	expect(await field.evaluate((node) => node.getAnimations().some((animation) => animation.playState === "running" && Number(animation.effect?.getTiming().duration) > 20))).toBe(false);
});

test("PAY-999 activity uses the same distinct avatars as the board", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const people = [
		{ name: "Maya Ferreira", card: "PAY-125", entry: "pay-999-production" },
		{ name: "Jordan Okafor", card: "PAY-105", entry: "pay-999-challenge-flow" },
		{ name: "Priya Raman", card: "PAY-124", entry: "pay-999-pilot-scope" },
	] as const;
	const boardAvatars = await Promise.all(people.map(({ name, card }) =>
		page.locator(`[data-issue-key="${card}"][data-board-column-title]`).getByRole("img", { name }).locator("img").getAttribute("src"),
	));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	for (const [index, person] of people.entries()) {
		const entry = item.locator(`[data-jira-activity-entry-id="${person.entry}"]`);
		await expect(entry).toContainText(person.name);
		await expect(entry.locator("img").first()).toHaveAttribute("src", boardAvatars[index] ?? "");
	}
	expect(new Set(boardAvatars).size).toBe(people.length);
	for (const [index, color] of ["teamwork-blue", "product-purple", "strategy-orange"].entries()) {
		expect(boardAvatars[index]).toContain(color);
	}
	await expect(item.locator('[data-jira-activity-entry-id="pay-999-challenge-flow"] img').nth(1)).toHaveAttribute("src", boardAvatars[0] ?? "");
});

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

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`the work item agent field previews the agent under the pointer while scrolling (${reducedMotion})`, async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 1200 });
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Work item" }).click();
		const field = page.getByRole("group", { name: "Agents field" });
		await field.getByRole("button", { name: /\d+ agents/ }).click();
		const preview = field.locator('[data-slot="jira-issue-agent-invocation-preview"]');
		await expect(preview).toHaveAttribute("data-agent-id", "default");
		await expect(preview).toContainText("Add");
		const picker = page.getByRole("dialog", { name: "Add agent" });
		const claude = picker.getByRole("button", { name: "Claude", exact: true });
		await claude.hover();
		await expect(preview).toHaveAttribute("data-agent-id", "claude-code");
		const box = await claude.boundingBox();
		if (!box) throw new Error("Claude is not visible in the picker");
		const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
		await page.mouse.wheel(0, 120);
		await expect.poll(async () => page.evaluate(({ x, y }) => {
			const id = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>("button[data-agent-id]")?.dataset.agentId;
			return Boolean(id && id !== "claude-code");
		}, point)).toBe(true);
		const hovered = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest<HTMLButtonElement>("button[data-agent-id]")?.dataset.agentId, point);
		if (!hovered) throw new Error("Scrolling did not reveal another agent under the pointer");
		await expect(preview).toHaveAttribute("data-agent-id", hovered);
		await expect(preview).toHaveAttribute("data-direction", "forward");
		await expect(preview.locator("[data-preview-layer]")).toHaveCount(reducedMotion === "reduce" ? 0 : 2);
		await picker.getByRole("button", { name: "Jira Coding Agent", exact: true }).focus();
		await expect(preview).toHaveAttribute("data-agent-id", "jira-coding");
		await page.keyboard.press("Escape");
		await expect(preview).toHaveCount(0);
		await expect(field.getByRole("button", { name: /\d+ agents/ })).toBeVisible();
	});
}

test("the agent field shows an avatar stack without session state", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const field = page.getByRole("group", { name: "Agents field" });
	await expect(field.getByRole("button", { name: "4 agents" })).toBeVisible();
	await expect(field.locator('[data-slot="avatar"]')).toHaveCount(4);
	await expect(field).not.toContainText(/Needs input|Working|Finished/);
	await field.getByRole("button", { name: "4 agents" }).click();
	await expect(page.getByRole("dialog", { name: "Add agent" })).toBeVisible();
});

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

test("gallery session cards open the selected agent in floating Rovo chat", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	await workItem.getByRole("button", { name: "Compare the Q3 revenue forecast", exact: true }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	await expect(chat).toBeVisible();
	await expect(chat).toContainText("Cursor");
	await expect(chat).toContainText("Which revenue line should we keep?");
	await expect(page.getByRole("textbox", { name: "Reply to Cursor" })).toHaveCount(0);
	await chat.getByRole("button", { name: "Close", exact: true }).click();

	await workItem.getByRole("group", { name: "Agents field" }).getByRole("button").click();
	await page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "Jira Coding Agent", exact: true }).click();
	const session = workItem.locator('[data-project-butter-session-start]').filter({ hasText: "Jira Coding Agent" });
	await session.getByRole("button", { name: "Redesign onboarding flow for new users", exact: true }).click();
	await expect(chat).toBeVisible();
	await expect(chat).toContainText("Jira Coding Agent");
	await expect(chat).toContainText("VITA-1: Redesign onboarding flow for new users");
	await expect(page.getByRole("textbox", { name: "Reply to Jira Coding Agent" })).toHaveCount(0);
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
