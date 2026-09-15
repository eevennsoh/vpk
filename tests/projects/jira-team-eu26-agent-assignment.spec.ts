import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1800, height: 1100 } });

for (const { issueKey, state, agent } of [
	{ issueKey: "PAY-105", state: "Working", agent: "Cursor" },
	{ issueKey: "PAY-112", state: "Needs input", agent: "Codex" },
	{ issueKey: "PAY-101", state: "Finished", agent: "Claude" },
]) {
	test(`${state} session rows share the assignment flyout`, async ({ page }) => {
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		const row = page.locator(`[data-issue-key="${issueKey}"] [data-slot="jira-issue-agent-row"]`);
		const trigger = row.getByRole("button", { name: `Open ${agent} in Rovo chat: ${state}`, exact: true });
		await trigger.hover();
		const flyout = page.locator('[data-slot="hover-card-content"][aria-label="Agent assignment"]');
		await expect(flyout).toBeVisible();
		await expect(trigger).toHaveAttribute("aria-expanded", "true");
		await expect(flyout).toContainText(agent);
		const assign = flyout.getByRole("button", { name: "Assign agent", exact: true });
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
		const trigger = page.getByRole("button", { name: "Open Claude in Rovo chat: Finished", exact: true });
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
