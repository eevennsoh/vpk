import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const AGENT_SESSION_URL = appUrl("/components/blocks/agent-session");

for (const [width, side] of [[1280, "right"], [1000, "left"]] as const) {
	test(`teammate session tooltip opens on the ${side} at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 720 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(appUrl("/components/blocks/agent-assignment"));
		await page.getByRole("button", { name: "Edit agents", exact: true }).first().click();
		await page.getByRole("button", { name: /(?:\d+ )?other sessions?/iu }).click();
		const card = page.getByTestId("agent-session-row-readiness-checker").locator("article");
		await page.mouse.move(0, 0);
		await card.hover({ position: { x: 8, y: 8 } });
		const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: "only Priya Raman can act on it" });
		await expect(tooltip).toBeVisible();
		await expect(tooltip).toHaveAttribute("data-side", side);
		const cardBox = await card.boundingBox();
		const tooltipBox = await tooltip.boundingBox();
		if (cardBox === null || tooltipBox === null) throw new Error("Session card and tooltip must be visible");
		if (side === "right") expect(tooltipBox.x).toBeGreaterThanOrEqual(cardBox.x + cardBox.width);
		else expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(cardBox.x);
	});
}

test("long session lifecycle glyphs match the short row's 24px slot", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(`${AGENT_SESSION_URL}#local-—-long`);
	for (const [section, states] of [
		["Local — long", ["Finished"]],
		["Cloud — long", ["Working", "Needs input", "Finished"]],
	] as const) {
		const example = page.getByRole("heading", { name: section }).locator("xpath=../../..");
		for (const state of states) {
			const indicator = example.getByRole("button", { name: state, exact: true }).first();
			const glyph = state === "Working" ? indicator.locator('[data-slot="spinner"]') : indicator.locator('[data-slot="icon-tile"]');
			const slot = state === "Working" ? glyph.locator("..") : glyph;
			await expect(slot).toHaveCSS("width", "24px");
			await expect(slot).toHaveCSS("height", "24px");
			if (state === "Working") {
				await expect(glyph).toHaveCSS("width", "16.75px");
				await expect(glyph).toHaveCSS("height", "16.75px");
			} else {
				await expect(glyph.locator("svg")).toHaveCSS("width", "12px");
				await expect(glyph.locator("svg")).toHaveCSS("height", "12px");
			}
		}
	}
});

test("viewer and owner working indicators stay centered in the assignment menu", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board" }).click();
	const trigger = page.getByRole("button", { name: "2 agents: Working" });
	await trigger.focus();
	await page.keyboard.press("Enter");
	const menu = page.locator('[aria-label="Agent assignment"]');
	await expect(menu).toBeVisible();
	const indicators = menu.locator('[aria-label="Working"]');
	await expect(indicators).toHaveCount(2);
	for (const indicator of await indicators.all()) {
		const slot = await indicator.boundingBox();
		const spinner = await indicator.locator('[data-slot="spinner"]').boundingBox();
		if (slot === null || spinner === null) throw new Error("Working indicator must be visible");
		expect(spinner.x + spinner.width / 2).toBeCloseTo(slot.x + slot.width / 2, 1);
		expect(spinner.y + spinner.height / 2).toBeCloseTo(slot.y + slot.height / 2, 1);
	}
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Jira agent chin swaps its status for a chevron on hover and keyboard focus (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const demo = page.locator("#agent-activity-states-experimental-v2");
		for (const state of ["1 agent as owner", "1-n agents as owner", "Needs input"]) {
			await page.goto(appUrl("/components/blocks/jira-issue#agent-activity-states-experimental-v2"));
			await demo.getByRole("button", { name: state, exact: true }).click();
			const row = demo.locator('[data-slot="jira-issue-agent-row"]').first();
			const status = row.locator('[data-slot="jira-issue-agent-status-icon"]');
			const chevron = row.locator('[data-slot="jira-issue-agent-chevron"]');
			await page.mouse.move(0, 0);
			await expect(status).toBeVisible();
			await expect(chevron).toBeHidden();
			const restingBox = await row.locator('[data-slot="jira-issue-agent-status-affordance"]').boundingBox();
			await row.hover();
			await expect(status).toBeHidden();
			await expect(chevron).toBeVisible();
			await expect(chevron.locator("svg")).toHaveCSS("width", "12px");
			await expect(chevron.locator("svg")).toHaveCSS("height", "12px");
			const hoveredBox = await row.locator('[data-slot="jira-issue-agent-status-affordance"]').boundingBox();
			if (restingBox === null || hoveredBox === null) throw new Error("Status affordance is not laid out");
			expect(await chevron.boundingBox()).toEqual(hoveredBox);
			expect(hoveredBox.width).toBeCloseTo(restingBox.width, 2);
			expect(hoveredBox.height).toBeCloseTo(restingBox.height, 2);
			await page.mouse.move(0, 0);
			await expect(status).toBeVisible();
			await expect(chevron).toBeHidden();
			const trigger = row.locator("button").first();
			await trigger.focus();
			await page.keyboard.press("Shift+Tab");
			await page.keyboard.press("Tab");
			await expect(trigger).toBeFocused();
			await expect(status).toBeHidden();
			await expect(chevron).toBeVisible();
			await page.keyboard.press("Enter");
			const flyout = page.locator('[data-slot="popover-content"][aria-label="Agent assignment"]');
			await expect(flyout).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(flyout).toBeHidden();
		}
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const width of [1440, 900]) {
		test(`Jira Expired option retains the session list while deleting at ${width}px (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.setViewportSize({ width, height: 900 });
			await page.goto(appUrl("/components/blocks/jira-issue#agent-activity-states-experimental-v2"), { waitUntil: "domcontentloaded" });
			const demo = page.locator("#agent-activity-states-experimental-v2");
			await demo.getByRole("button", { name: "Expired", exact: true }).click();
			await demo.locator('[data-slot="jira-issue-agent-row"] button').click();
			const flyout = page.locator('[data-slot="popover-content"][aria-label="Agent assignment"]');
			await expect(flyout).toBeVisible();
			await expect(flyout.locator("article")).toHaveCount(4);
			await expect.poll(() => flyout.evaluate((node) => (
				node.getAnimations().filter((animation) => animation.playState === "running").length
			))).toBe(0);
			await expect(flyout.getByRole("button", { name: "New session", exact: true })).toBeVisible();
			const viewer = flyout.locator("li").filter({ hasText: "Cursor with Andrew Park" });
			const info = viewer.getByRole("button", { name: "Someone is using an agent. Only they can see the work.", exact: true });
			await page.mouse.move(0, 0);
			await expect(info).toBeVisible();
			await expect(info).toHaveCSS("opacity", "1");
			await expect(info.locator("..")).toHaveCSS("opacity", "1");
			await expect(viewer.getByRole("button", { name: /^(Working|Needs input|Finished)$/u })).toHaveCount(0);
			await expect(viewer.locator('[data-agent-session-lifecycle-current]')).toHaveCount(0);
			await viewer.locator("article").hover({ position: { x: 8, y: 8 } });
			const viewerTooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Someone is using an agent." });
			await expect(viewerTooltip).toBeVisible();
			await expect(viewerTooltip).toHaveCSS("width", "240px");
			await expect(viewerTooltip).toHaveCSS("white-space", "normal");
			await expect(viewerTooltip).toHaveText("Someone is using an agent. Only they can see the work.");
			await expect(viewerTooltip).toHaveJSProperty("textContent", "Someone is using an agent. Only they can see the work.");
			await page.mouse.move(0, 0);
			await expect(viewerTooltip).toBeHidden();
			await info.focus();
			await page.keyboard.press("Tab");
			await page.keyboard.press("Shift+Tab");
			await expect(info).toBeFocused();
			await expect(viewerTooltip).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(viewerTooltip).toBeHidden();
			await expect(flyout).toBeVisible();
			const expired = flyout.getByTestId("agent-session-row-claude-expired-session");
			await expect(expired).toContainText("Claude session expired");
			await expect(expired).toContainText("29d");
			await expired.locator("article").hover();
			const tooltip = page.locator('[data-slot="tooltip-content"]').filter({
				hasText: "Agent sessions are only kept for 28 days. This session can't be resumed.",
			});
			await expect(tooltip).toBeVisible();
			const more = expired.getByRole("button", { name: "More actions for Claude session expired" });
			const size = await more.boundingBox();
			expect(size?.width).toBe(24);
			expect(size?.height).toBe(24);
			await more.click();
			await expect(tooltip).toBeHidden();
			await expect(page.getByRole("menuitem")).toHaveText(["Delete"]);
			await expect(flyout).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(more).toBeFocused();
			await page.keyboard.press("Enter");
			await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
			await expect(expired).toHaveCount(0);
			await expect(flyout.locator("article")).toHaveCount(3);
			await expect(flyout).toBeVisible();
		});

		test(`expired row explains retention and offers Delete at ${width}px (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.setViewportSize({ width, height: 900 });
			await page.goto(`${AGENT_SESSION_URL}#cloud-—-long`, { waitUntil: "domcontentloaded" });
			const cloudLong = page.getByRole("heading", { name: "Cloud — long" }).locator("xpath=../../..");
			const expired = cloudLong.locator("section").filter({
				has: page.getByText("Expired", { exact: true }),
			}).getByTestId("agent-session-row-cloud-figma-with-austin");
			const more = expired.getByRole("button", { name: "More actions for Figma with Austin" });
			await expect(more).toBeVisible();
			const size = await more.boundingBox();
			expect(size?.width).toBe(24);
			expect(size?.height).toBe(24);
			const tooltip = page.locator('[data-slot="tooltip-content"]').filter({
				hasText: "Agent sessions are only kept for 28 days. This session can't be resumed.",
			});
			await expired.locator("article").hover({ position: { x: 8, y: 8 } });
			await expect(tooltip).toBeVisible();
			await expect(tooltip).toHaveText("Agent sessions are only kept for 28 days. This session can't be resumed.");
			await expect(tooltip).toHaveCSS("width", "240px");
			await expect(tooltip).toHaveCSS("white-space", "normal");
			await expect(tooltip).toHaveJSProperty("textContent", "Agent sessions are only kept for 28 days. This session can't be resumed.");
			await more.click();
			await expect(tooltip).toBeHidden();
			await expect(page.getByRole("menuitem")).toHaveText(["Delete"]);
			await page.keyboard.press("Escape");
			await expect(more).toBeFocused();
			await page.keyboard.press("Enter");
			await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
			await expect(expired).toHaveCount(0);
		});
	}
}

test("cloud long tool calls align with metadata and Working controls with the row", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(AGENT_SESSION_URL, { waitUntil: "domcontentloaded" });
	const cloudLongHeading = page.getByRole("heading", { name: "Cloud — long" });
	await expect(cloudLongHeading).toBeVisible();

	const workingRows = cloudLongHeading
		.locator("xpath=../../..")
		.getByTestId("agent-session-row-cloud-suspension-refactor");
	await expect(workingRows).toHaveCount(2);

	for (const row of await workingRows.all()) {
		const agent = await row.locator('[title="Claude"]').boundingBox();
		const toolCall = await row.locator("[data-agent-session-tool-call]").boundingBox();
		const workingControl = row.getByRole("button", { name: "Working", exact: true });
		const working = await workingControl.count() > 0
			? await workingControl.boundingBox()
			: await row.getByRole("button", { name: "Someone is using an agent. Only they can see the work.", exact: true }).boundingBox();
		const article = await row.locator("article").boundingBox();
		expect(agent).not.toBeNull();
		expect(toolCall).not.toBeNull();
		expect(working).not.toBeNull();
		if (agent === null || toolCall === null || working === null || article === null) {
			throw new Error("Cloud session metadata is not laid out");
		}

		const agentCenter = agent.y + agent.height / 2;
		const toolCallCenter = toolCall.y + toolCall.height / 2;
		const workingCenter = working.y + working.height / 2;
		expect(Math.abs(toolCallCenter - agentCenter)).toBeLessThanOrEqual(1);
		expect(Math.abs(workingCenter - article.y - article.height / 2)).toBeLessThanOrEqual(1);
	}

	const ownerRow = workingRows.first();
	await ownerRow.scrollIntoViewIfNeeded();
	const cycle = await ownerRow.evaluate(async (row) => {
		const agent = row.querySelector('span[title="Claude"]');
		const firstTitle = row.querySelector("[data-agent-session-tool-call]")?.getAttribute("title");
		if (agent === null || firstTitle === null || firstTitle === undefined) {
			return { changed: false, maxOffset: Number.POSITIVE_INFINITY };
		}

		const started = performance.now();
		let changedAt: number | null = null;
		let maxOffset = 0;
		while (performance.now() - started < 4_500 &&
			(changedAt === null || performance.now() - changedAt < 350)) {
			const call = row.querySelector("[data-agent-session-tool-call]");
			if (call !== null) {
				const callRect = call.getBoundingClientRect();
				const agentRect = agent.getBoundingClientRect();
				maxOffset = Math.max(maxOffset, Math.abs(
					(callRect.top + callRect.bottom - agentRect.top - agentRect.bottom) / 2,
				));
				if (changedAt === null && call.getAttribute("title") !== firstTitle) {
					changedAt = performance.now();
				}
			}
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return { changed: changedAt !== null, maxOffset };
	});
	expect(cycle.changed).toBe(true);
	expect(cycle.maxOffset).toBeLessThanOrEqual(1);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const width of [1440, 900]) {
		test(`long session status and hover controls center in each row at ${width}px (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.setViewportSize({ width, height: 900 });
			await page.goto(`${AGENT_SESSION_URL}#cloud-—-long`, { waitUntil: "domcontentloaded" });
			for (const section of ["Local — long", "Cloud — long"]) {
				const rows = page.getByRole("heading", { name: section }).locator("xpath=../../..")
					.locator('[data-testid^="agent-session-row-"]');
				await expect(rows).toHaveCount(section === "Local — long" ? 6 : 7);
				for (const row of await rows.all()) {
					const article = row.locator("article");
					await article.scrollIntoViewIfNeeded();
					let restingTextWidth: number | undefined;
					for (const hovered of [false, true]) {
						if (hovered) {
							await article.hover();
						} else {
							await page.mouse.move(0, 0);
						}
						const geometry = await article.evaluate((node) => {
							const bounds = node.getBoundingClientRect();
							const title = node.querySelector("[data-agent-list-title]")?.parentElement;
							const metadata = title?.nextElementSibling;
							if (!title || !metadata) throw new Error("Missing session title or metadata");
							const titleBounds = title.getBoundingClientRect();
							const metadataBounds = metadata.getBoundingClientRect();
							const offsets = Array.from(node.querySelectorAll("button[aria-label]")).map((button) => {
								const control = button.getBoundingClientRect();
								return Math.abs(control.y + control.height / 2 - bounds.y - bounds.height / 2);
							});
							return { offsets, textWidth: titleBounds.width, textEdgeOffset: Math.abs(titleBounds.right - metadataBounds.right) };
						});
						expect(geometry.textEdgeOffset).toBeLessThanOrEqual(1);
						if (restingTextWidth === undefined) restingTextWidth = geometry.textWidth;
						expect(Math.abs(geometry.textWidth - restingTextWidth)).toBeLessThanOrEqual(1);
						for (const offset of geometry.offsets) {
							expect(offset, `${section} ${await row.getAttribute("data-testid")} hover=${hovered}`).toBeLessThanOrEqual(1);
						}
					}
				}
			}
		});
	}
}
