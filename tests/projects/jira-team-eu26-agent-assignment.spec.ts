import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1800, height: 1100 } });

test("List session identities align with Add agent and working uses the experimental spinner", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	await page.getByRole("tab", { name: "List" }).click();
	const emptyCell = page.locator('[data-issue-key="PAY-125"] td').nth(4);
	const emptyLabel = emptyCell.getByText("Add agent", { exact: true });
	await expect(emptyLabel).toBeVisible();
	await expect(emptyCell.getByRole("button", { name: "Add agent", exact: true })).toBeVisible();
	const emptyBox = await emptyLabel.boundingBox();
	expect(emptyBox).not.toBeNull();
	if (!emptyBox) return;

	for (const issueKey of ["PAY-105", "PAY-123", "PAY-112", "PAY-101"]) {
		const cell = page.locator(`[data-issue-key="${issueKey}"] td`).nth(4);
		const identity = cell.locator('[data-slot="jira-issue-agent-row"] button > div > span:first-child');
		await expect(identity).toBeVisible();
		const identityBox = await identity.boundingBox();
		expect(identityBox).not.toBeNull();
		if (identityBox) expect(Math.abs(identityBox.x - emptyBox.x)).toBeLessThan(1);
	}

	for (const issueKey of ["PAY-105", "PAY-123"]) {
		const spinner = page.locator(`[data-issue-key="${issueKey}"] td`).nth(4).locator('[data-slot="spinner"]');
		await expect(spinner).toHaveAttribute("data-iconic-orb", "");
	}
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.reload();
	await page.getByRole("tab", { name: "List" }).click();
	const reducedSpinner = page.locator('[data-issue-key="PAY-105"] td').nth(4).locator('[data-slot="spinner"]');
	await expect(reducedSpinner).toHaveAttribute("data-iconic-orb", "");
	await expect(reducedSpinner.locator("g")).not.toHaveClass(/spinner-experimental-orb-rotator-motion/u);
});

test("List assigned menu uses Add agent and opens the selector", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	await page.getByRole("tab", { name: "List" }).click();
	const assignedCell = page.locator('[data-issue-key="PAY-105"] td').nth(4);
	await assignedCell.getByRole("button", { name: "Edit agents", exact: true }).click();
	const menu = page.locator('[data-slot="popover-content"][aria-label="Agent assignment"]');
	await expect(menu).toBeVisible();
	await menu.getByRole("button", { name: "Add agent", exact: true }).click();
	await expect(menu.getByRole("textbox", { name: "Search agents" })).toBeVisible();
});

test("compact assignment flyout centers status and more actions in each row", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	const workingRow = page.locator('[data-issue-key="PAY-123"] [data-slot="jira-issue-agent-row"] button[aria-label="2 agents: Working"]');
	await expect(workingRow).toHaveText("Working");
	await workingRow.hover();
	const flyout = page.locator('[data-slot="hover-card-content"][aria-label="Agent assignment"]');
	await expect(flyout).toBeVisible();

	const cursor = flyout.getByTestId("agent-session-row-test-agent");
	const claude = flyout.getByTestId("agent-session-row-claude-code");
	for (const { row, label } of [
		{ row: cursor, label: "Cursor, used by Jordan Okafor" },
		{ row: claude, label: "Claude, used by Venn" },
	]) {
		const identity = row.getByRole("group", { name: label, exact: true });
		await expect(identity).toBeVisible();
		expect(await identity.locator('[data-slot="avatar"]').evaluateAll((avatars) => (
			avatars.map((avatar) => avatar.getAttribute("data-shape"))
		))).toEqual(["hexagon", "circle"]);
		const agent = await identity.locator('[data-shape="hexagon"]').boundingBox();
		const human = await identity.locator('[data-shape="circle"]').boundingBox();
		if (agent === null || human === null) throw new Error("Session avatars are not laid out");
		expect(agent.x).toBeLessThan(human.x);
	}
	await expect(cursor.getByRole("button", {
		name: "A team member is collaborating with an agent on this work. Only they have access.",
	})).toBeVisible();
	const loader = page.locator('[data-issue-key="PAY-123"] .agent-loading');
	await expect(loader).toBeVisible();
	await expect(loader.locator('[data-slot="human-agent-avatar"]')).toHaveCount(0);
	for (const issueKey of ["PAY-105", "PAY-107", "PAY-112", "PAY-101"]) {
		const indicator = page.locator(`[data-issue-key="${issueKey}"] [data-slot="jira-issue-agent-row"]`);
		await expect(indicator).toBeVisible();
		await expect(indicator.locator('[data-slot="human-agent-avatar"]')).toHaveCount(0);
	}
	await claude.hover();
	const controls = [
		{ row: cursor, control: cursor.getByRole("button", { name: "Working" }) },
		{ row: claude, control: claude.getByRole("button", { name: "More actions for Claude" }) },
	];
	for (const { row, control } of controls) {
		await expect(control).toBeVisible();
		const article = await row.locator("article").boundingBox();
		const trailing = await control.boundingBox();
		expect(article).not.toBeNull();
		expect(trailing).not.toBeNull();
		if (article === null || trailing === null) throw new Error("Assignment row is not laid out");
		expect(Math.abs(
			trailing.y + trailing.height / 2 - article.y - article.height / 2,
		)).toBeLessThanOrEqual(1);
	}
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`finished assignment shows the human invoker (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await page.getByRole("button", { name: "Claude: Finished", exact: true }).hover();
		const row = page.getByTestId("agent-session-row-pay-101-inventory-claude-session");
		const identity = row.getByRole("group", { name: "Claude, used by Maya Ferreira", exact: true });
		await expect(identity).toBeVisible();
		expect(await identity.locator('[data-slot="avatar"]').evaluateAll((avatars) => (
			avatars.map((avatar) => avatar.getAttribute("data-shape"))
		))).toEqual(["hexagon", "circle"]);
		await expect(identity.locator('[data-shape="circle"] img')).toHaveAttribute(
			"src", /chloe-lee\/color\/asow-teamwork-blue-64\.png/u,
		);
	});

	test(`assignment flyouts align with the activity row (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		const flyout = page.locator('[data-slot="hover-card-content"][aria-label="Agent assignment"]');

		for (const issueKey of ["PAY-123", "PAY-105", "PAY-112", "PAY-101"]) {
			const row = page.locator(`[data-issue-key="${issueKey}"] [data-slot="jira-issue-agent-row"]`);
			await row.locator('[data-slot="hover-card-trigger"]').hover();
			await expect(flyout).toBeVisible();
			await expect(flyout).toHaveAttribute("data-side", /^(right|left)$/u);
			await expect.poll(async () => {
				const activityBounds = await row.boundingBox();
				const menuBounds = await flyout.boundingBox();
				if (activityBounds === null || menuBounds === null) return Number.POSITIVE_INFINITY;
				return Math.abs(menuBounds.y - activityBounds.y);
			}).toBeLessThanOrEqual(1);
			await page.keyboard.press("Escape");
			await expect(flyout).toBeHidden();
		}
	});
}

test("keyboard cloud session selection moves focus into the opened chat", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	const trigger = page.getByRole("button", { name: "GitHub Copilot: Working", exact: true });
	await trigger.focus();
	await page.keyboard.press("Enter");

	const flyout = page.locator('[data-slot="hover-card-content"][aria-label="Agent assignment"]');
	await expect(flyout).toBeVisible();
	await page.keyboard.press("Tab");
	const session = flyout.getByRole("button", {
		name: /^GitHub Copilot GitHub Copilot, used by Venn GitHub Copilot Cloud session/u,
	});
	await expect(session).toBeFocused();
	await page.keyboard.press("Enter");

	const composer = page.getByRole("textbox", { name: "Chat message input" });
	await expect(composer).toBeVisible();
	await expect(composer).toBeFocused();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`local assignment separates Continue in from Dismiss (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await page.getByRole("button", { name: "2 agents: Working", exact: true }).hover();
		const flyout = page.locator('[data-slot="hover-card-content"][aria-label="Agent assignment"]');
		const row = flyout.getByTestId("agent-session-row-claude-code");
		const session = row.getByRole("button", { name: /^Claude Claude, used by Venn Claude Local session/u });
		await session.click();
		const menu = page.getByRole("menu");
		await expect(menu).toContainText("Continue in");
		await expect(menu.getByRole("menuitem", { name: "Claude", exact: true })).toBeVisible();
		await expect(menu.getByRole("menuitem", { name: "Terminal Copy prompt", exact: true })).toBeVisible();
		await expect(menu.getByRole("menuitem", { name: "Dismiss", exact: true })).toHaveCount(0);
		await expect(page.getByRole("textbox", { name: "Chat message input" })).toHaveCount(0);
		await menu.getByRole("menuitem", { name: "Terminal Copy prompt", exact: true }).click();
		await expect(menu.getByRole("menuitem", { name: "Terminal Copy prompt", exact: true })).toHaveAttribute("data-selected", "true");
		await page.keyboard.press("Escape");
		await expect(session).toBeFocused();
		await expect(flyout).toBeVisible();
		await row.locator("article").click({ position: { x: 4, y: 4 } });
		await expect(menu).toContainText("Continue in");
		await page.keyboard.press("Escape");
		await expect(session).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(menu).toContainText("Continue in");
		await page.keyboard.press("Escape");
		await row.hover();
		await row.getByRole("button", { name: "More actions for Claude", exact: true }).click();
		await expect(menu.getByRole("menuitem")).toHaveText(["Dismiss"]);
		await expect(menu).not.toContainText("Continue in");
		await page.screenshot({ path: `output/agent-browser/local-assignment-dismiss-${reducedMotion}.png` });
		await menu.getByRole("menuitem", { name: "Dismiss", exact: true }).click();
		await expect(page.locator('[data-issue-key="PAY-123"]').getByRole("button", { name: "Cursor: Working", exact: true })).toBeVisible();
		await expect(page.getByRole("textbox", { name: "Chat message input" })).toHaveCount(0);
	});
}

test("List local sessions use Continue in and menus fit a narrow viewport", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	await page.getByRole("tab", { name: "List" }).click();
	await page.locator('[data-issue-key="PAY-105"] td').nth(4).getByRole("button", { name: "Edit agents", exact: true }).click();
	const assignment = page.locator('[data-slot="popover-content"][aria-label="Agent assignment"]');
	await assignment.getByRole("button", { name: /^Cursor Cursor, used by Venn Cursor Local session/u }).click();
	await expect(page.getByRole("menu")).toContainText("Continue in");
	await expect(page.getByRole("textbox", { name: "Chat message input" })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");
	await page.getByRole("tab", { name: "Board" }).click();
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.getByRole("button", { name: "2 agents: Working", exact: true }).hover();
	const flyout = page.locator('[data-slot="hover-card-content"][aria-label="Agent assignment"]');
	await flyout.getByRole("button", { name: /^Claude Claude, used by Venn Claude Local session/u }).click();
	const menu = page.getByRole("menu");
	await expect(menu).toContainText("Continue in");
	const bounds = await menu.boundingBox();
	if (bounds === null) throw new Error("Continue in menu is not laid out");
	expect(bounds.x).toBeGreaterThanOrEqual(0);
	expect(bounds.y).toBeGreaterThanOrEqual(0);
	expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
	expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
	await page.screenshot({ path: "output/agent-browser/local-assignment-narrow.png" });
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`untracked local cards separate continuation and dismissal (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
		const row = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-scope-thread");
		await row.scrollIntoViewIfNeeded();
		const article = row.locator("article");
		await article.hover();
		await expect(page.locator('[data-slot="hover-card-content"]:visible')).toHaveCount(1);
		await article.click();
		const menu = page.getByRole("menu");
		await expect(menu).toContainText("Continue in");
		await article.hover();
		await expect(page.locator('[data-slot="hover-card-content"]:visible')).toHaveCount(0);
		await article.click();
		await expect(menu).toBeHidden();
		await article.click();
		await expect(menu).toContainText("Continue in");
		await page.getByRole("heading", { name: "Jira Design" }).click();
		await expect(menu).toBeHidden();
		await article.hover();
		await expect(page.locator('[data-slot="hover-card-content"]:visible')).toHaveCount(1);
		await article.click();
		await expect(menu).toContainText("Continue in");
		await expect(menu.getByRole("menuitem", { name: "Terminal Copy prompt", exact: true })).toBeEnabled();
		await expect(menu.getByRole("menuitem", { name: "Dismiss", exact: true })).toHaveCount(0);
		await expect(page.getByRole("textbox", { name: "Chat message input" })).toHaveCount(0);
		await expect(page.getByText(/^Resume command copied for/u)).toHaveCount(0);
		await menu.getByRole("menuitem", { name: "Terminal Copy prompt", exact: true }).click();
		await expect(menu.getByRole("menuitem", { name: "Terminal Copy prompt", exact: true })).toHaveAttribute("data-selected", "true");
		await page.keyboard.press("Escape");
		await expect(article).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(menu).toContainText("Continue in");
		await page.keyboard.press("Escape");
		await row.hover();
		await row.getByRole("button", { name: /^More actions for/u }).click();
		await expect(menu.getByRole("menuitem")).toHaveText(["Dismiss"]);
		await expect(menu).not.toContainText("Continue in");
	});
}

for (const { issueKey, state, agent } of [
	{ issueKey: "PAY-105", state: "Working", agent: "Cursor" },
	{ issueKey: "PAY-112", state: "Needs input", agent: "Codex" },
	{ issueKey: "PAY-101", state: "Finished", agent: "Claude" },
]) {
	test(`${state} session rows share the assignment flyout`, async ({ page }) => {
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		const row = page.locator(`[data-issue-key="${issueKey}"] [data-slot="jira-issue-agent-row"]`);
		const trigger = row.getByRole("button", { name: `${agent}: ${state}`, exact: true });
		await trigger.hover();
		const flyout = page.locator('[data-slot="hover-card-content"][aria-label="Agent assignment"]');
		await expect(flyout).toBeVisible();
		await expect(trigger).toHaveAttribute("aria-expanded", "true");
		await expect(flyout).toContainText(agent);
		const assign = flyout.getByRole("button", { name: "Add agent", exact: true });
		await assign.hover();
		await expect(flyout).toBeVisible();
		await assign.click();
		await expect(page.getByRole("option").filter({ hasText: "Readiness Checker" })).toBeVisible();
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Finished session flyout supports keyboard access (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await page.getByRole("button", { name: "More actions for PAY-101", exact: true }).focus();
		await page.keyboard.press("Tab");
		const trigger = page.getByRole("button", { name: "Claude: Finished", exact: true });
		await expect(trigger).toBeFocused();
		const flyout = page.locator('[data-slot="hover-card-content"][aria-label="Agent assignment"]');
		await expect(flyout).toBeVisible();
		await expect(trigger).toHaveAttribute("aria-expanded", "true");
		await expect(flyout).toHaveCSS("opacity", "1");
		await page.screenshot({ path: `output/agent-browser/finished-flyout-${reducedMotion}.png` });
		await page.keyboard.press("Escape");
		await expect(flyout).toBeHidden();
		await expect(trigger).toHaveAttribute("aria-expanded", "false");
	});

	test(`manual assignment keeps card content inside its shell (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await page.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-118"]').hover();
		await page.getByRole("button", { name: "More actions for PAY-118", exact: true }).click();
		await page.getByRole("menuitem", { name: "Assign agents Open submenu", exact: true }).click();
		const agent = page.getByRole("option").filter({ hasText: "Readiness Checker" });
		await expect(agent).toBeVisible();

		// Arm before the click so the first painted frame after assignment is covered.
		const samples = page.evaluate(async () => {
			const offsets: number[] = [];
			const started = performance.now();
			let movedAt: number | undefined;
			while (performance.now() - started < 5_000) {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				const moved = document.querySelector('[data-issue-key="PAY-118"][data-board-column-title="In progress"]');
				if (!moved) continue;
				movedAt ??= performance.now();
				const existing = document.querySelector('[data-issue-key="PAY-105"][data-board-column-title="In progress"]')!;
				const shell = existing.querySelector('[data-slot="jira-issue-agent-shell"]')!;
				const content = existing.querySelector('[data-slot="jira-issue-card"]')!;
				offsets.push(Math.abs(content.getBoundingClientRect().top - shell.getBoundingClientRect().top));
				if (performance.now() - movedAt > 800) break;
			}
			return offsets;
		});
		await agent.click();
		const offsets = await samples;
		expect(offsets.length).toBeGreaterThan(2);
		expect(Math.max(...offsets)).toBeLessThan(1);
		await expect(page.locator('[data-issue-key="PAY-118"][data-board-column-title="In progress"]')).toHaveCount(1);
		await page.screenshot({ path: `output/agent-browser/assignment-${reducedMotion}.png` });
	});

	test(`session attach reflows the surrounding Jira cards (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();

		const sourceRow = page.locator("[data-agent-session-column]")
			.getByTestId("agent-session-row-lw-scope-thread");
		if (!await sourceRow.isVisible()) {
			await page.getByRole("button", { name: "Expand Unlink sessions column" }).click();
		}
		await sourceRow.scrollIntoViewIfNeeded();
		const source = sourceRow.locator("article");
		await expect(source).toBeVisible();

		const target = page.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-118"]');
		const followingCard = page.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-124"]');
		const followingCardShell = followingCard.locator('[data-slot="jira-issue-agent-shell"]');
		await expect.poll(() => target.evaluate((card) => (
			card.parentElement?.style.transform || "none"
		))).toBe("none");
		await target.evaluate(() => new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		}));
		const followingBox = await followingCardShell.boundingBox();
		expect(followingBox).not.toBeNull();
		if (!followingBox) return;

		await page.evaluate(() => {
			const samplesWindow = window as typeof window & {
				__jiraCardLayoutSamples?: Array<{ top: number; transform: string }>;
				__jiraCardLayoutSampling?: boolean;
			};
			samplesWindow.__jiraCardLayoutSamples = [];
			samplesWindow.__jiraCardLayoutSampling = true;
			requestAnimationFrame(function sampleCardLayout() {
				const card = document.querySelector<HTMLElement>('[data-issue-key="PAY-124"]');
				const cardShell = card?.querySelector<HTMLElement>('[data-slot="jira-issue-agent-shell"]');
				samplesWindow.__jiraCardLayoutSamples?.push({
					top: cardShell?.getBoundingClientRect().top ?? Number.NaN,
					transform: card?.parentElement?.style.transform ?? "",
				});
				if (samplesWindow.__jiraCardLayoutSampling) {
					requestAnimationFrame(sampleCardLayout);
				}
			});
		});

		try {
			const sourcePoint = await source.evaluate((article) => {
				const rect = article.getBoundingClientRect();
				const interactiveSelector = "button, a, input, select, textarea, [role=menuitem], [data-session-drag-ignore], [data-slot=dropdown-menu-trigger]";
				for (const y of [rect.bottom - 6, rect.top + 6, rect.top + rect.height / 2]) {
					for (const x of [rect.left + 6, rect.right - 6, rect.left + rect.width / 2]) {
						const hit = document.elementFromPoint(x, y);
						if (hit instanceof Element && article.contains(hit) && !hit.closest(interactiveSelector)) {
							return { x, y };
						}
					}
				}
				throw new Error("No non-interactive drag point found in the agent session");
			});
			await page.mouse.move(sourcePoint.x, sourcePoint.y);
			await page.mouse.down();
			await page.mouse.move(sourcePoint.x + 8, sourcePoint.y + 8, { steps: 4 });
			await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(1);
			const liveTargetBox = await target.boundingBox();
			expect(liveTargetBox).not.toBeNull();
			if (!liveTargetBox) return;
			await page.mouse.move(
				liveTargetBox.x + liveTargetBox.width / 2,
				liveTargetBox.y + liveTargetBox.height / 2,
				{ steps: 12 },
			);
			await expect(target).toHaveAttribute("data-board-agent-session-target", "attach");
			await expect(target.locator('[data-slot="jira-issue-attach-chin"]')).toBeVisible();
			await expect.poll(
				() => followingCardShell.evaluate((card) => card.getBoundingClientRect().top),
				{ timeout: 1_500 },
			).toBeGreaterThan(followingBox.y + 39);
		} finally {
			await page.evaluate(() => {
				const samplesWindow = window as typeof window & { __jiraCardLayoutSampling?: boolean };
				samplesWindow.__jiraCardLayoutSampling = false;
			});
			await page.mouse.up();
		}

		const samples = await page.evaluate(() => (
			(window as typeof window & {
				__jiraCardLayoutSamples?: Array<{ top: number; transform: string }>;
			}).__jiraCardLayoutSamples ?? []
		));
		const settledTop = Math.max(...samples.map((sample) => sample.top));
		expect(settledTop - followingBox.y).toBeCloseTo(40, 0);
		if (reducedMotion === "reduce") {
			expect(samples.every((sample) => sample.transform === "" || sample.transform === "none")).toBe(true);
		} else {
			const intermediateTops = new Set(
				samples
					.map((sample) => Math.round(sample.top * 10) / 10)
					.filter((top) => top > followingBox.y && top < settledTop),
			);
			expect(intermediateTops.size).toBeGreaterThan(2);
			expect(samples.some((sample) => sample.transform.startsWith("translate3d("))).toBe(true);
		}
	});
}

test("the between-card create marker escapes the card-list clip", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();

	const sourceRow = page.locator("[data-agent-session-column]")
		.getByTestId("agent-session-row-lw-scope-thread");
	if (!await sourceRow.isVisible()) {
		await page.getByRole("button", { name: "Expand Unlink sessions column" }).click();
	}
	const source = sourceRow.locator("article");
	await source.scrollIntoViewIfNeeded();
	await expect(source).toBeVisible();

	const sourcePoint = await source.evaluate((article) => {
		const rect = article.getBoundingClientRect();
		return { x: rect.left + 6, y: rect.bottom - 6 };
	});
	await page.mouse.move(sourcePoint.x, sourcePoint.y);
	await page.mouse.down();
	try {
		await page.mouse.move(sourcePoint.x + 8, sourcePoint.y + 8, { steps: 4 });
		await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(1);
		const upperCard = page.locator('[data-issue-key="PAY-105"]');
		const lowerCard = page.locator('[data-issue-key="PAY-107"]');
		const upperBox = await upperCard.boundingBox();
		const lowerBox = await lowerCard.boundingBox();
		expect(upperBox).not.toBeNull();
		expect(lowerBox).not.toBeNull();
		if (!upperBox || !lowerBox) return;
		await page.mouse.move(
			upperBox.x + upperBox.width / 2,
			(upperBox.y + upperBox.height + lowerBox.y) / 2,
		);

		const marker = page.locator("[data-board-insertion-marker]");
		await expect(marker).toBeVisible();
		const visibility = await marker.evaluate((element) => new Promise<{
			intersectionWidth: number;
			listLeft: number;
			markerLeft: number;
			markerWidth: number;
		}>((resolve) => {
			const markerRect = element.getBoundingClientRect();
			const listRect = element.closest("[data-jira-kanban-card-list]")?.getBoundingClientRect();
			const observer = new IntersectionObserver(([entry]) => {
				observer.disconnect();
				resolve({
					intersectionWidth: entry.intersectionRect.width,
					listLeft: listRect?.left ?? Number.NaN,
					markerLeft: markerRect.left,
					markerWidth: markerRect.width,
				});
			});
			observer.observe(element);
		}));
		expect(visibility.markerLeft).toBeLessThan(visibility.listLeft);
		expect(visibility.intersectionWidth).toBeCloseTo(visibility.markerWidth, 1);
	} finally {
		await page.mouse.up();
	}
});

for (const flag of ["jiraWorkItemOpen", "jiraPulseOpen"] as const) {
	test(`temporarily hidden chat preserves host focus on ${flag} remount`, async ({ page }) => {
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await page.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
		const composer = page.getByRole("textbox", { name: "Chat message input" });
		await expect(composer).toBeFocused();
		await page.evaluate((key) => { document.documentElement.dataset[key] = "true"; }, flag);
		await expect(composer).toBeHidden();
		const restored = page.getByRole("button", { name: "Settings", exact: true });
		await restored.focus();
		await page.evaluate((key) => { delete document.documentElement.dataset[key]; }, flag);
		await expect(composer).toBeVisible();
		await expect(restored).toBeFocused();
		await page.waitForTimeout(250);
		await expect(restored).toBeFocused();
		await page.locator('[data-rovo-chat-placement="floating"]').getByRole("button", { name: "Close", exact: true }).click();
		await expect(composer).toBeHidden();
		await page.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
		await expect(composer).toBeFocused();
	});
}
