import { expect, test, type Page } from "@playwright/test";

test.setTimeout(60_000);

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });
const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost";
const issue = (page: Page, code: string) => page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`);
const column = (page: Page, title: string) => page.locator(`[data-jira-kanban-column="${title}"]`);

for (const route of ["/jira-team-eu26", "/preview/blocks/jira-dragging"]) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`grid selection and column-scoped Select all on ${route} (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}${route}`);
			await expect(page.locator('[data-board-agent-session-drop-zone="issue"]').first()).toBeVisible();
			const readColumns = () => page.locator("[data-jira-kanban-column]").evaluateAll((nodes) => nodes
				.filter((node) => node.getAttribute("data-collapsed") !== "true")
				.map((node) => ({
					title: node.getAttribute("data-jira-kanban-column")!,
					codes: [...node.querySelectorAll('[data-board-agent-session-drop-zone="issue"]')].map((card) => card.getAttribute("data-issue-key")!),
				})));
			const card = (code: string) => issue(page, code).locator('[draggable]').first();
			const selected = () => page.locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes
				.filter((node) => node.querySelector('[data-jira-issue-activation-control][aria-pressed="true"]'))
				.map((node) => node.getAttribute("data-issue-key")));
			let columns = await readColumns();
			if (columns.filter((item) => item.codes.length > 0).length === 1) {
				// Populate two other lanes through native drag so this playground exercises a grid.
				for (const destination of [columns.at(-1)!, columns[1]]) {
					const code = (await readColumns())[0].codes.at(-1)!;
					const source = (await card(code).boundingBox())!;
					const target = (await column(page, destination.title).boundingBox())!;
					await page.mouse.move(source.x + 70, source.y + 30);
					await page.mouse.down();
					await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
					await page.mouse.move(target.x + 90, target.y + 100, { steps: 5 });
					await page.mouse.move(target.x + 91, target.y + 100);
					await page.mouse.up();
					await expect(column(page, destination.title).locator(`[data-issue-key="${code}"]`)).toHaveCount(1);
				}
				columns = await readColumns();
			}
			const populated = columns.filter((item) => item.codes.length > 0);
			const [left, middle] = populated;
			const right = populated.at(-1)!;
			const click = (code: string, modifiers: ("Shift" | "ControlOrMeta")[] = ["Shift"]) => card(code).click({ position: { x: 70, y: 30 }, modifiers });
			await click(left.codes[0]);
			await click(middle.codes[0]);
			await expect.poll(selected).toEqual([left.codes[0], middle.codes[0]]);
			await click(left.codes[0]);
			await expect.poll(selected).toEqual([left.codes[0], middle.codes[0]]);
			await click(middle.codes[0], ["ControlOrMeta"]);
			await expect.poll(selected).toEqual([left.codes[0]]);
			await page.getByRole("button", { name: "Select all", exact: true }).click();
			await expect.poll(selected).toEqual(left.codes);
			await click(middle.codes[0], ["ControlOrMeta"]);
			await page.getByRole("button", { name: "Select all", exact: true }).click();
			await expect.poll(selected).toEqual([...left.codes, ...middle.codes]);
			await page.keyboard.press("Escape");
			await click(left.codes[0]);
			await click(right.codes.at(-1)!);
			await expect.poll(selected).toEqual(populated.flatMap((item) => item.codes));
			await page.screenshot({ path: `output/agent-browser/grid-selection/${route.includes("preview") ? "dragging" : "eu26"}-${reducedMotion}.png` });
			await page.keyboard.press("Escape");
			await click(middle.codes[0]);
			for (const modifier of ["Meta", "Control"]) {
				const intercepted = await issue(page, middle.codes[0]).locator('[data-jira-issue-activation-control]').evaluate((node, key) => {
					const event = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true, metaKey: key === "Meta", ctrlKey: key === "Control" });
					node.dispatchEvent(event);
					return event.defaultPrevented;
				}, modifier);
				expect(intercepted).toBe(false);
				await page.keyboard.press(`${modifier}+a`);
				await expect.poll(selected).toEqual([middle.codes[0]]);
			}
			await page.keyboard.press("Escape");
			await page.getByRole("button", { name: `Collapse ${middle.title} column`, exact: true }).click();
			await click(left.codes[0]);
			await click(right.codes.at(-1)!);
			await expect.poll(selected).toEqual(populated.filter((item) => item.title !== middle.title).flatMap((item) => item.codes));
		});
	}
}

test("EU26 plain click does not select; Shift click selects a range", async ({ page }) => {
	await page.goto(`${origin}/jira-team-eu26`);
	const control = (code: string) => issue(page, code).locator('[data-jira-issue-activation-control]');
	const card = (code: string) => issue(page, code).locator('[draggable]').first();
	await card("PAY-105").click({ position: { x: 70, y: 30 } });
	await expect(control("PAY-105")).toHaveAttribute("aria-pressed", "false");
	await expect(page.getByRole("button", { name: "Clear selection", exact: true })).toHaveCount(0);
	await card("PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
	await card("PAY-123").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
	await expect(control("PAY-105")).toHaveAttribute("aria-pressed", "true");
	await expect(control("PAY-123")).toHaveAttribute("aria-pressed", "true");
	await expect(control("PAY-107")).toHaveAttribute("aria-pressed", "true");
	await page.keyboard.press("Escape");
	await expect(control("PAY-105")).toHaveAttribute("aria-pressed", "false");
});

for (const input of ["selection controls", "modifier clicks"] as const) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`EU26 Shift adds to disjoint selections from ${input} (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.setViewportSize({ width: reducedMotion === "reduce" ? 1440 : 1800, height: 1100 });
			await page.goto(`${origin}/jira-team-eu26`);
			const card = (code: string) => issue(page, code).locator("[draggable]").first();
			const control = (code: string) => issue(page, code).locator("[data-jira-issue-activation-control]");
			const selected = () => page.locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes
				.filter((node) => node.querySelector('[data-jira-issue-activation-control][aria-pressed="true"]'))
				.map((node) => node.getAttribute("data-issue-key")));
			for (const code of ["PAY-105", "PAY-130"]) {
				if (input === "selection controls") {
					await issue(page, code).hover();
					if (code === "PAY-105") {
						await page.getByRole("button", { name: "More actions for PAY-105", exact: true }).click();
						await page.getByRole("menuitem", { name: "Select", exact: true }).click();
					} else {
						await issue(page, code).locator("[data-jira-issue-selection-control]").click();
					}
				} else {
					await card(code).click({ position: { x: 70, y: 30 }, modifiers: ["ControlOrMeta"] });
				}
			}
			await expect.poll(selected).toEqual(["PAY-105", "PAY-130"]);
			await card("PAY-123").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			await expect.poll(selected).toEqual(["PAY-105", "PAY-123", "PAY-130"]);
			await expect(control("PAY-123")).toBeFocused();
			await expect(page.getByRole("region", { name: "3 cards selected. Bulk actions available." })).toBeVisible();
			await card("PAY-130").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
			await expect.poll(selected).toEqual(["PAY-105", "PAY-123", "PAY-130"]);
			await page.screenshot({ path: `output/agent-browser/jira-additive-selection/eu26-${input.replaceAll(" ", "-")}-${reducedMotion}.png` });
			await issue(page, "PAY-105").hover();
			await issue(page, "PAY-105").locator("[data-jira-issue-selection-control]").click();
			await expect.poll(selected).toEqual(["PAY-123", "PAY-130"]);
			await page.keyboard.press("Escape");
			await expect.poll(selected).toEqual([]);
		});
	}
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`EU26 keyboard ranges shrink while keeping independent selections (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.setViewportSize({ width: reducedMotion === "reduce" ? 1440 : 1800, height: 1100 });
		await page.goto(`${origin}/jira-team-eu26`);
		const card = (code: string) => issue(page, code).locator("[draggable]").first();
		const selected = () => page.locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes
			.filter((node) => node.querySelector('[data-jira-issue-activation-control][aria-pressed="true"]'))
			.map((node) => node.getAttribute("data-issue-key")));
		await card("PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["ControlOrMeta"] });
		await page.keyboard.press("Shift+ArrowDown");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107"]);
		await page.keyboard.press("Shift+ArrowUp");
		await expect.poll(selected).toEqual(["PAY-105"]);
		await expect(issue(page, "PAY-105").locator("[data-jira-issue-activation-control]")).toBeFocused();
		await card("PAY-130").click({ position: { x: 70, y: 30 }, modifiers: ["ControlOrMeta"] });
		await expect.poll(selected).toEqual(["PAY-105", "PAY-130"]);
		await page.keyboard.press("Shift+ArrowUp");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-123", "PAY-130"]);
		await page.keyboard.press("Shift+ArrowUp");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107", "PAY-123", "PAY-130"]);
		await page.keyboard.press("Shift+ArrowDown");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-123", "PAY-130"]);
		await page.keyboard.press("Shift+ArrowDown");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-130"]);
		await expect(issue(page, "PAY-130").locator("[data-jira-issue-activation-control]")).toBeFocused();
		await page.screenshot({ path: `output/agent-browser/jira-additive-selection/eu26-keyboard-shrunk-${reducedMotion}.png` });
		await page.keyboard.press("Escape");
		await expect.poll(selected).toEqual([]);
	});
}

test("EU26 menu Select is keyboard accessible and restores card focus", async ({ page }) => {
	await page.goto(`${origin}/jira-team-eu26`);
	await issue(page, "PAY-105").hover();
	await page.getByRole("button", { name: "More actions for PAY-105", exact: true }).click();
	const menu = page.getByRole("menu").last();
	for (const action of ["Select", "Archive", "Delete"]) {
		await expect(menu.getByRole("menuitem", { name: action, exact: true })).toBeEnabled();
	}
	const select = menu.getByRole("menuitem", { name: "Select", exact: true });
	await expect(select).toHaveAttribute("aria-description", "Shift plus click");
	await page.screenshot({ path: "output/agent-browser/dnd/eu26-card-menu.png" });
	await select.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("menu")).toHaveCount(0);
	const control = issue(page, "PAY-105").locator('[data-jira-issue-activation-control]');
	await expect(control).toHaveAttribute("aria-pressed", "true");
	await expect(control).toBeFocused();
});

for (const action of ["Archive", "Delete"]) {
	test(`EU26 menu ${action} removes only its issue from board and list`, async ({ page }) => {
		await page.goto(`${origin}/jira-team-eu26`);
		await expect(issue(page, "PAY-105")).toBeVisible();
		const initialCount = await column(page, "In progress").locator("[data-issue-key]").count();
		await issue(page, "PAY-105").hover();
		await page.getByRole("button", { name: "More actions for PAY-105", exact: true }).click();
		await page.getByRole("menuitem", { name: action, exact: true }).click();
		await expect(issue(page, "PAY-105")).toHaveCount(0);
		await expect(column(page, "In progress").locator("[data-issue-key]")).toHaveCount(initialCount - 1);
		await expect(issue(page, "PAY-107")).toBeVisible();
		await page.getByRole("tab", { name: "List", exact: true }).click();
		await expect(page.getByRole("row").filter({ hasText: "PAY-105" })).toHaveCount(0);
		await expect(page.getByRole("row").filter({ hasText: "PAY-107" })).toBeVisible();
	});
}

async function startDrag(page: Page, code: string) {
	// Pointer transport temporarily disables native draggable during pickup.
	const card = issue(page, code).locator("[draggable]").first();
	await card.scrollIntoViewIfNeeded();
	const box = await card.boundingBox();
	if (!box) throw new Error(`Missing card ${code}`);
	await page.mouse.move(box.x + 70, box.y + 35);
	await page.mouse.down();
	await page.mouse.move(box.x + 90, box.y + 40, { steps: 5 });
	await expect(card).toHaveAttribute("data-dragging", "true");
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`EU26 single-card drag toolbar appears on pickup and restores selection after cancel (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitemcheckbox", { name: "Auto arrange", exact: true }).click();
		await page.keyboard.press("Escape");
		const toolbar = page.getByRole("region", { name: "Move card. Auto arrange available.", exact: true });
		await startDrag(page, "PAY-118");
		await expect(toolbar).toBeVisible();
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(page.locator('[data-slot="jira-toolbar-positioner"]')).toHaveCount(0);
		await expect(issue(page, "PAY-118")).toHaveAttribute("data-board-column-title", "To do");
		await issue(page, "PAY-118").locator("[draggable]").first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const selection = page.getByRole("region", { name: "1 card selected. Bulk actions available.", exact: true });
		await expect(selection).toBeVisible();
		await startDrag(page, "PAY-118");
		await expect(toolbar).toBeVisible();
		await expect(toolbar.getByRole("button", { name: "Select all", exact: true })).toHaveCount(0);
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(selection).toBeVisible();
		await expect(selection.getByRole("button", { name: "Select all", exact: true })).toBeVisible();
	});
}

async function enterStatus(page: Page, status: string) {
	const zone = page.locator(`[data-issue-status-zone="${status}"]`);
	const box = await zone.boundingBox();
	if (!box) throw new Error(`Missing zone ${status}`);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.locator(`[data-issue-drop-entered="${status}"]`)).toBeVisible();
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`move status wells match the create well's horizontal magnetic range (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
		await startDrag(page, "PAY-118");
		for (const status of ["In progress", "Paused"]) {
			const zone = column(page, "In progress").locator(`[data-issue-status-zone="${status}"]`);
			await expect(zone).toBeVisible();
			const box = (await zone.boundingBox())!;
			const readGeometry = () => zone.evaluate((node) => {
				const well = node.matches(".border-dashed") ? node : node.querySelector(".border-dashed")!;
				const bounds = well.getBoundingClientRect();
				const hitArea = node.getBoundingClientRect();
				const label = well.querySelector("[data-jira-dropzone-magnetic-label]")!;
				const transform = new DOMMatrixReadOnly(getComputedStyle(label).transform);
				return { x: bounds.left - hitArea.left, y: bounds.top - hitArea.top, width: bounds.width, height: bounds.height, hitX: hitArea.left, labelX: transform.m41, labelY: transform.m42 };
			});
			for (const direction of [-1, 1]) {
				// Native dragover drives the same magnet even while pointermove is suspended.
				// Dispatch at document level to sample the spring without committing a status.
				await page.evaluate((point) => document.dispatchEvent(new DragEvent("dragover", { bubbles: true, ...point })), {
					clientX: direction < 0 ? box.x : box.x + box.width,
					clientY: direction < 0 ? box.y + 1 : box.y + box.height - 1,
				});
				await expect.poll(async () => (await readGeometry()).x).toBeCloseTo(reducedMotion === "reduce" ? 0 : direction * 8, 1);
				const geometry = await readGeometry();
				expect(geometry.y).toBeCloseTo(0, 1);
				expect(geometry.labelY).toBeCloseTo(reducedMotion === "reduce" ? 0 : direction * 4 * (1 - 2 / box.height), 1);
				expect(geometry.labelX).toBeCloseTo(reducedMotion === "reduce" ? 0 : direction * 4, 1);
				expect(geometry.hitX).toBeCloseTo(box.x, 1);
				expect(geometry.width).toBeCloseTo(box.width, 1);
				expect(geometry.height).toBeCloseTo(box.height, 1);
			}
			await page.evaluate(() => document.dispatchEvent(new DragEvent("dragover", { bubbles: true, clientX: 0, clientY: 0 })));
			await expect.poll(async () => (await readGeometry()).x).toBeCloseTo(0, 1);
		}
		await enterStatus(page, "Paused");
		await page.screenshot({ path: `output/agent-browser/dnd/magnetic-move-status-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(issue(page, "PAY-118")).toHaveAttribute("data-board-column-title", "In progress");
	});

	test(`Default empty In progress keeps both status targets usable (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.setViewportSize({ width: 1440, height: 800 });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/projects/jira-team-eu26`);
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitemcheckbox", { name: "Move visual", exact: true }).click();
		await page.keyboard.press("Escape");
		await expect(issue(page, "PAY-112")).toBeVisible();
		await expect(issue(page, "PAY-112").getByRole("button", { name: "Codex: Needs input", exact: true })).toBeVisible({ timeout: 55_000 });
		await page.getByRole("button", { name: /^Needs input:/ }).click();
		const progress = column(page, "In progress");
		await expect(progress.locator("[data-issue-key]")).toHaveCount(0);
		const expand = page.getByRole("button", { name: "Expand In progress column", exact: true });
		await expand.focus();
		await page.keyboard.press("Enter");
		const restingHeight = await progress.locator("[data-jira-kanban-column-content]").evaluate((node) => node.getBoundingClientRect().height);
		await startDrag(page, "PAY-112");
		const choices = progress.getByRole("group", { name: "Choose a status in In progress" });
		await expect(choices).toBeVisible();
		for (const status of ["In progress", "Paused"]) {
			const zone = progress.locator(`[data-issue-status-zone="${status}"]`);
			const box = await zone.boundingBox();
			if (!box) throw new Error(`Missing zone ${status}`);
			expect(box.height).toBeGreaterThanOrEqual(120);
			for (const child of await zone.locator(":scope > *").all()) {
				const childBox = await child.boundingBox();
				if (!childBox) throw new Error(`Missing content in ${status}`);
				expect(childBox.y).toBeGreaterThanOrEqual(box.y);
				expect(childBox.y + childBox.height).toBeLessThanOrEqual(box.y + box.height);
			}
		}
		await page.screenshot({ path: `output/agent-browser/dnd/empty-status-choices-${reducedMotion}.png` });
		const body = progress.locator('[aria-label="Choose a status in In progress"]').locator("..");
		const choosingHeight = await body.evaluate((node) => node.getBoundingClientRect().height);
		await enterStatus(page, "Paused");
		await expect.poll(() => body.evaluate((node) => node.getBoundingClientRect().height)).toBe(choosingHeight);
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect.poll(() => progress.locator("[data-jira-kanban-column-content]").evaluate((node) => node.getBoundingClientRect().height)).toBe(restingHeight);
		await startDrag(page, "PAY-112");
		await enterStatus(page, "Paused");
		await page.mouse.up();
		await page.getByRole("button", { name: /^Needs input:/ }).click();
		await expect(issue(page, "PAY-112")).toHaveAttribute("data-board-column-title", "In progress");
		await page.getByRole("tab", { name: "List", exact: true }).click();
		await expect(page.getByRole("row").filter({ hasText: "Confirm the sandbox key retention window before replay" })).toContainText("Paused");
	});

	test(`collapsed drop border hugs the visible cell (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.setViewportSize({ width: 1440, height: 800 });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/projects/jira-team-eu26`);
		await column(page, "To do").hover({ position: { x: 20, y: 15 } });
		await page.getByRole("button", { name: "Collapse To do column", exact: true }).click();
		const collapsed = column(page, "To do");
		await expect(collapsed).toHaveAttribute("data-collapsed", "true");
		await startDrag(page, "PAY-112");
		const cell = await collapsed.locator(":scope > div").boundingBox();
		const shell = await collapsed.boundingBox();
		if (!cell || !shell) throw new Error("Missing collapsed cell");
		// Empty space remains a drop target; its feedback still hugs the cell.
		await page.mouse.move(shell.x + shell.width / 2, cell.y + cell.height + 100, { steps: 5 });
		await page.mouse.move(shell.x + shell.width / 2, cell.y + cell.height + 100);
		const ring = collapsed.locator("[data-jira-kanban-collapsed-drop-ring]");
		await expect(ring).toHaveClass(/\bborder-border-selected\b/);
		expect((await ring.boundingBox())!.height).toBeLessThanOrEqual(cell.height + 4);
		await expect.poll(() => ring.evaluate((node) =>
			node.getAnimations().some((animation) => animation.playState === "running"),
		)).toBe(false);
		await page.screenshot({ path: `output/agent-browser/dnd/collapsed-border-${reducedMotion}.png` });
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(issue(page, "PAY-112")).toHaveAttribute("data-board-column-title", "In review");
		await expect(ring).not.toHaveClass(/\bborder-border-selected\b/);
	});

	test(`collapsed In progress accepts an issue drop (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/projects/jira-team-eu26`);
		await column(page, "In progress").hover({ position: { x: 20, y: 15 } });
		await page.getByRole("button", { name: "Collapse In progress column", exact: true }).click();
		const progress = column(page, "In progress");
		await expect(progress).toHaveAttribute("data-collapsed", "true");
		await startDrag(page, "PAY-112");
		const cell = await progress.locator(":scope > div").boundingBox();
		if (!cell) throw new Error("Missing collapsed In progress cell");
		await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2, { steps: 5 });
		await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2);
		await page.mouse.up();
		await expect(progress).toHaveAttribute("data-collapsed", "true");
		const expand = page.getByRole("button", { name: "Expand In progress column", exact: true });
		await expand.focus();
		await page.keyboard.press("Enter");
		await expect(issue(page, "PAY-112")).toHaveAttribute("data-board-column-title", "In progress");
		await page.getByRole("tab", { name: "List", exact: true }).click();
		await expect(page.getByRole("row").filter({ hasText: "Confirm the sandbox key retention window before replay" })).toContainText("In progress");
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`issue-only preview and two-stage status drop (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/preview/projects/jira-team-eu26`);
		await expect(issue(page, "PAY-105")).toBeVisible();
		const sourceHeight = await issue(page, "PAY-105").evaluate((node) => node.getBoundingClientRect().height);
		const sourceCard = (await issue(page, "PAY-105").locator('[data-slot="jira-issue-card"]').boundingBox())!;
		await startDrag(page, "PAY-105");
		const traveller = page.locator("[data-issue-cohort-preview]");
		await expect(traveller).toHaveAttribute("data-issue-cohort-count", "1");
		await expect(traveller.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCount(0);
		await expect(traveller).not.toContainText(/Working|Needs input/);
		const previewFace = (await traveller.boundingBox())!;
		expect(previewFace.width).toBe(sourceCard.width);
		expect(previewFace.height).toBe(sourceCard.height);
		await expect(traveller.locator('[data-jira-issue-selection-control], [aria-label^="More actions for "]')).toHaveCount(0);
		await expect.poll(() => issue(page, "PAY-105").evaluate((node) => node.getBoundingClientRect().height)).toBe(sourceHeight);
		await expect(traveller).toHaveAttribute("aria-hidden", "true");
		await expect(traveller).toHaveAttribute("inert", "");
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(traveller).toHaveCount(0);
		await expect(page.locator("[data-issue-status-zone]")).toHaveCount(0);

		await startDrag(page, "PAY-118");
		await expect(traveller).toHaveCount(1);
		const transitionHeader = column(page, "To do").locator("[data-transitioning]");
		await expect(transitionHeader).toHaveText("Transition to...");
		await expect(transitionHeader.locator("[data-board-column-count]")).toHaveCount(0);
		await expect(transitionHeader).not.toContainText("4");
		await expect(transitionHeader.getByRole("button")).toHaveCount(0);
		const inProgress = column(page, "In progress");
		await expect(inProgress.locator("[data-issue-status-zone]")).toHaveCount(2);
		const inProgressBounds = await inProgress.boundingBox();
		if (!inProgressBounds) throw new Error("Missing In progress column");
		// Crossing the header keeps the two body choices available.
		await page.mouse.move(inProgressBounds.x + inProgressBounds.width / 2, inProgressBounds.y + 12, { steps: 3 });
		await expect(inProgress.locator("[data-issue-status-zone]")).toHaveCount(2);
		await expect(inProgress.locator("[data-jira-kanban-column-drop-ring]")).not.toHaveClass(/\b(?:border|outline)-border-selected\b/);
		await page.screenshot({ timeout: 5_000, path: `output/agent-browser/dnd/choices-${reducedMotion}.png` });
		await enterStatus(page, "Paused");
		await expect(column(page, "In progress")).toContainText("To do → Paused");
		const next = await issue(page, "PAY-107").boundingBox();
		if (!next) throw new Error("Missing insertion anchor");
		await page.mouse.move(next.x + 100, next.y + 20, { steps: 5 });
		// Chromium may emit dragenter on the final step; another move emits dragover.
		await page.mouse.move(next.x + 100, next.y + 20);
		await expect(page.locator('[data-issue-drop-before="PAY-107"] [data-insertion-line]')).toBeVisible();
		await page.screenshot({ timeout: 5_000, path: `output/agent-browser/dnd/entered-${reducedMotion}.png` });
		await page.mouse.up();
		await expect(issue(page, "PAY-118")).toHaveAttribute("data-board-column-title", "In progress");
		await expect(column(page, "In progress").locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(5);
		await expect.poll(() => column(page, "In progress").locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.issueKey))).toEqual(["PAY-105", "PAY-118", "PAY-107", "PAY-123", "PAY-130"]);
		await page.getByRole("tab", { name: "List", exact: true }).click();
		await expect(page.getByRole("row").filter({ hasText: "Carry card-artwork metadata" })).toContainText("Paused");
	});
}

test("leaving a chosen zone resets it; a second drag can choose another status", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/preview/projects/jira-team-eu26`);
	await startDrag(page, "PAY-118");
	await enterStatus(page, "Paused");
	const todo = await column(page, "To do").boundingBox();
	if (!todo) throw new Error("Missing source column");
	await page.mouse.move(todo.x + 120, todo.y + 100, { steps: 4 });
	await expect(column(page, "In progress").locator("[data-issue-status-zone]")).toHaveCount(2);
	await enterStatus(page, "In progress");
	await page.keyboard.press("Escape");
	await page.mouse.up();
	await expect(issue(page, "PAY-118")).toHaveAttribute("data-board-column-title", "To do");
	await startDrag(page, "PAY-118");
	await expect(column(page, "In progress").locator("[data-issue-status-zone]")).toHaveCount(2);
	await enterStatus(page, "In progress");
	await page.mouse.up();
	await expect(issue(page, "PAY-118")).toHaveAttribute("data-board-column-title", "In progress");
});

test("a running issue reorders in its column and scrolls to the last slot", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 800 });
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/preview/projects/jira-team-eu26`);
	await startDrag(page, "PAY-105");
	const list = column(page, "In progress").locator("[data-jira-kanban-card-list]");
	const bounds = await list.boundingBox();
	if (!bounds) throw new Error("Missing card scrollport");
	// Use the exposed right gutter; the floating bulk toolbar covers the middle.
	const dropX = bounds.x + bounds.width - 16;
	await page.mouse.move(dropX, bounds.y + bounds.height - 5, { steps: 5 });
	await page.mouse.move(dropX, bounds.y + bounds.height - 5);
	await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	await expect(column(page, "In progress").locator('[data-issue-drop-before="end"]')).toHaveCount(1);
	await page.mouse.up();
	await expect.poll(() => column(page, "In progress").locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.issueKey))).toEqual(["PAY-107", "PAY-123", "PAY-130", "PAY-105"]);
	await expect(issue(page, "PAY-105")).toContainText("Working");
	await expect(page.locator("[data-issue-drop-entered]")).toHaveCount(0);
});

test("Default grouped statuses reject header drops and use 2px split-zone strokes", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/preview/projects/jira-team-eu26`);
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page.getByRole("menuitemcheckbox", { name: "Move visual", exact: true }).click();
	await page.keyboard.press("Escape");
	await startDrag(page, "PAY-127");
	const progress = column(page, "In progress");
	const bounds = await progress.boundingBox();
	if (!bounds) throw new Error("Missing In progress column");
	await page.mouse.move(bounds.x + 120, bounds.y + 20, { steps: 5 });
	await page.mouse.move(bounds.x + 120, bounds.y + 20);
	await expect(progress).not.toHaveClass(/\bborder-ring\b/);
	const zones = progress.getByRole("group", { name: "Choose a status in In progress" });
	await expect(zones).toBeVisible();
	await expect(zones).toHaveCSS("border-top-width", "2px");
	await expect(zones).toHaveCSS("border-right-width", "2px");
	await expect(progress.locator('[data-issue-status-zone="Paused"]')).toHaveCSS("border-top-width", "2px");
	await expect(progress.locator("[data-issue-transition-arrow]")).toHaveCount(2);
	for (const status of ["In progress", "Paused"]) {
		const zone = progress.locator(`[data-issue-status-zone="${status}"]`);
		await expect(zone.locator("[data-issue-transition-arrow]")).toBeVisible();
		await expect(zone.locator("[data-issue-transition-arrow]")).toHaveClass(/text-icon-subtle/);
	}
	await page.screenshot({ path: "output/agent-browser/dnd/header-body-only.png" });
	await page.mouse.up();
	await expect(issue(page, "PAY-127")).toHaveAttribute("data-board-column-title", "To do");

	await startDrag(page, "PAY-127");
	await enterStatus(page, "Paused");
	await expect(progress).not.toHaveClass(/\boutline-2\b/);
	await page.mouse.move(bounds.x + 120, bounds.y + 20, { steps: 5 });
	await page.mouse.move(bounds.x + 120, bounds.y + 20);
	await expect(progress).not.toHaveClass(/\bborder-ring\b/);
	await expect(progress.locator("[data-issue-drop-entered]")).toHaveCount(0);
	await expect(zones).toBeVisible();
	await page.mouse.up();
	await expect(issue(page, "PAY-127")).toHaveAttribute("data-board-column-title", "To do");
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`EU26 matches Jira Dragging fused selection and cohort preview (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.setViewportSize({ width: reducedMotion === "reduce" ? 1440 : 1800, height: 1100 });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/projects/jira-team-eu26`);
		const card = (code: string) => issue(page, code).locator('[draggable]').first();
		const backdrop = (code: string) => issue(page, code).locator('[data-slot="jira-issue-agent-backdrop"]');
		for (const code of ["PAY-118", "PAY-124"]) await expect(backdrop(code)).toHaveCSS("opacity", "0");
		await expect(backdrop("PAY-105")).toHaveCSS("opacity", "1");
		await page.screenshot({ path: `output/agent-browser/dnd/eu26-no-session-rest-${reducedMotion}.png` });
		for (const code of ["PAY-105", "PAY-107"]) await card(code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await expect(page.getByRole("button", { name: "Clear selection", exact: true })).toBeVisible();
		for (const code of ["PAY-105", "PAY-107"]) {
			await expect(backdrop(code)).toHaveClass(/bg-bg-selected/);
			await expect(issue(page, code).locator('[data-slot="jira-issue-surface"]')).toHaveClass(/bg-surface/);
		}
		await expect(backdrop("PAY-105")).toHaveCSS("border-bottom-left-radius", "0px");
		await expect(backdrop("PAY-107")).toHaveCSS("border-top-left-radius", "0px");
		await expect.poll(async () => {
			const first = (await backdrop("PAY-105").boundingBox())!;
			const second = (await backdrop("PAY-107").boundingBox())!;
			return Math.abs(first.y + first.height - second.y);
		}).toBeLessThan(0.5);
		await page.mouse.move(1000, 150);
		await page.screenshot({ path: `output/agent-browser/dnd/eu26-fused-selection-${reducedMotion}.png` });

		// Keyboard ranges grow and shrink while retaining the initial selection.
		await issue(page, "PAY-107").locator('[data-jira-issue-activation-control]').focus();
		await page.keyboard.press("Shift+ArrowDown");
		await expect(backdrop("PAY-123")).toHaveClass(/bg-bg-selected/);
		await page.keyboard.press("Shift+ArrowUp");
		await expect(backdrop("PAY-123")).not.toHaveClass(/bg-bg-selected/);
		await startDrag(page, "PAY-105");
		const traveller = page.locator('[data-issue-cohort-preview]');
		await expect(traveller).toHaveAttribute("data-issue-cohort-count", "2");
		await expect(traveller.locator('[data-issue-deck-layer]')).toHaveCount(1);
		await expect(traveller.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/dnd/eu26-cohort-preview-${reducedMotion}.png` });
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(traveller).toHaveCount(0);
		await expect(issue(page, "PAY-105")).toHaveAttribute("data-board-column-title", "In progress");
		await expect(backdrop("PAY-105")).toHaveClass(/bg-bg-selected/);
		await startDrag(page, "PAY-105");
		const done = (await column(page, "Done").boundingBox())!;
		await page.mouse.move(done.x + 90, done.y + 100, { steps: 5 });
		await page.mouse.move(done.x + 90, done.y + 100);
		await page.mouse.up();
		for (const code of ["PAY-105", "PAY-107"]) await expect(issue(page, code)).toHaveAttribute("data-board-column-title", "Done");
		await expect(page.getByRole("button", { name: "Clear selection", exact: true })).toHaveCount(0);
		for (const code of ["PAY-118", "PAY-124"]) await card(code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });

		// An ordinary outside press dismisses selection; popup actions preserve it.
		await page.getByRole("heading", { name: "Jira Design", exact: true }).click();
		await expect(page.getByRole("button", { name: "Clear selection", exact: true })).toHaveCount(0);
		for (const code of ["PAY-118", "PAY-124"]) await card(code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await expect(backdrop("PAY-118")).toHaveClass(/bg-bg-selected/);
		await expect(backdrop("PAY-118")).toHaveCSS("opacity", "1");
		await expect(issue(page, "PAY-118").locator('[data-slot="jira-issue-agent-row-wrap"]')).toHaveCount(0);
		await page.getByRole("button", { name: "Add agent", exact: true }).click();
		await expect(page.getByRole("button", { name: "Clear selection", exact: true })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(backdrop("PAY-118")).toHaveClass(/bg-bg-selected/);
		await expect(page.locator('[data-slot="popover-content"]:visible, [role="menu"]:visible, [role="dialog"]:visible')).toHaveCount(0);
		await page.keyboard.press("Escape");
		await expect(page.getByRole("button", { name: "Clear selection", exact: true })).toHaveCount(0);
		await expect(backdrop("PAY-118")).toHaveCSS("opacity", "0");
	});
}
