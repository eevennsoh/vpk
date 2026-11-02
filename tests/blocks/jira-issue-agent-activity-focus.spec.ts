import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, colorScheme: "light" });

for (const example of ["agent-activity-states-experimental-v2", "project-butter"]) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`${example} session selection focuses chat with ${reducedMotion} motion`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(appUrl(`/components/blocks/jira-issue#${example}`));
			const demo = page.locator(`#${example}`);
			await demo.scrollIntoViewIfNeeded();
			await demo.getByRole("button", { name: "1 agent as owner", exact: true }).click();

			const trigger = demo.getByRole("button", { name: "Claude: Working", exact: true });
			await trigger.focus();
			await page.keyboard.press("Enter");

			const flyout = page.getByRole("dialog", { name: "Agent assignment" });
			await expect(flyout).toBeVisible();
			await page.keyboard.press("Tab");
			const session = flyout.getByRole("button", {
				name: /^Claude Claude, used by Venn Claude Cloud session 12m/u,
			});
			await expect(session).toBeFocused();
			await page.keyboard.press("Enter");

			const composer = page.getByRole("textbox", { name: "Chat message input" });
			await expect(composer).toBeVisible();
			await expect(composer).toBeFocused();
		});
	}
}

async function openButter(page: Page) {
	await page.goto(appUrl("/components/blocks/jira-issue#project-butter"));
	const heading = page.getByRole("heading", { name: "Project butter", exact: true });
	await heading.scrollIntoViewIfNeeded();
	const demo = page.getByRole("region", { name: "Project butter playground" });
	await expect(demo).toBeVisible();
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	await heading.hover();
	return demo;
}

test("Project butter reveals work-type accents on card hover", async ({ page }) => {
	const demo = await openButter(page);
	const glyph = demo.getByRole("img", { name: "story", exact: true });
	const idleColor = await glyph.evaluate((element) => getComputedStyle(element).color);
	await demo.getByText("Implement advanced date-range filter", { exact: true }).hover();
	await expect(glyph).not.toHaveCSS("color", idleColor);
});

test("Project butter card clicks do not open a dialog and preserve selection", async ({ page }) => {
	const demo = await openButter(page);
	const title = demo.getByText("Implement advanced date-range filter", { exact: true });
	const activation = demo.getByRole("button", { name: "PD-40: Implement advanced date-range filter", exact: true });
	await title.click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await activation.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await title.click({ modifiers: ["Shift"] });
	await expect(activation).toHaveAttribute("aria-pressed", "true");
	await title.click();
	await expect(activation).toHaveAttribute("aria-pressed", "false");
	await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Project butter keeps To Do subtasks neutral", async ({ page }) => {
	const demo = await openButter(page);
	const glyph = demo.getByRole("img", { name: "story", exact: true });
	const idleColor = await glyph.evaluate((element) => getComputedStyle(element).color);
	await demo.getByRole("button", { name: "2 of 6 subtasks complete" }).click();
	const popup = page.getByRole("dialog", { name: "Subtasks", exact: true });
	for (const glyph of await popup.getByRole("img", { name: "To Do", exact: true }).all()) {
		await expect(glyph).toHaveCSS("color", idleColor);
	}
});

test("Project butter shows mixed-status subtasks with the shared segmented circle", async ({ page }) => {
	const demo = await openButter(page);
	const trigger = demo.getByRole("button", { name: "2 of 6 subtasks complete" });
	const ring = trigger.locator('[data-slot="progress-circle"]');
	await expect(ring).toHaveAttribute("aria-valuenow", "2");
	await expect(ring).toHaveAttribute("aria-valuemax", "6");
	await expect(ring.locator("circle")).toHaveCount(3);
	await trigger.click();
	const popup = page.getByRole("dialog", { name: "Subtasks", exact: true });
	await expect(popup.getByRole("button")).toHaveCount(6);
	for (const status of ["To Do", "In Progress", "Done"]) {
		await expect(popup.getByRole("img", { name: status, exact: true })).toHaveCount(2);
	}
	await popup.getByRole("button", { name: "Open PD-42: Support keyboard navigation", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "PD-42", exact: true })).toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Project butter reveals its add-agent hexagon with ${reducedMotion} motion`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const demo = await openButter(page);
		const slot = demo.locator('[data-slot="jira-issue-add-agent"]');
		const trigger = demo.getByRole("button", { name: "Add agent to PD-40" });
		await expect(slot).toHaveCSS("opacity", "0");
		await expect(trigger.locator('[data-shape="hexagon"]')).toHaveCount(1);
		const assignee = demo.locator('[data-slot="jira-issue-assignee-slot"]');
		await assignee.scrollIntoViewIfNeeded();
		await page.getByRole("button", { name: /^(?:Light|Dark|System) theme$/u }).hover();
		const before = await assignee.boundingBox();
		const hitBefore = await trigger.boundingBox();
		const recording = page.evaluate(async () => {
			const card = document.querySelector('[data-slot="jira-issue-project-butter"]');
			const action = document.querySelector('[data-slot="jira-issue-add-agent"]');
			const visual = document.querySelector('[data-slot="jira-issue-add-agent-visual"]');
			if (!card || !action || !visual) throw new Error("Project butter action is missing");
			await new Promise<void>((resolve) =>
				card.addEventListener("pointerenter", () => resolve(), { once: true }),
			);
			const frames: { opacity: number; scale: number }[] = [];
			for (let frame = 0; frame < 18; frame++) {
				frames.push({
					opacity: Number(getComputedStyle(action).opacity),
					scale: Number.parseFloat(getComputedStyle(visual).scale),
				});
				await new Promise<number>((resolve) => requestAnimationFrame(resolve));
			}
			return frames;
		});
		await demo.getByText("Implement advanced date-range filter", { exact: true }).hover();
		const frames = await recording;
		await expect(slot).toHaveCSS("opacity", "1");
		expect(await assignee.boundingBox()).toEqual(before);
		expect(await trigger.boundingBox()).toEqual(hitBefore);
		if (reducedMotion === "reduce") {
			expect(frames.every((frame) => frame.opacity === 1 && frame.scale === 1)).toBe(true);
		} else {
			expect(
				frames.some((frame) => frame.opacity > 0 && frame.opacity < 1),
				JSON.stringify(frames),
			).toBe(true);
			expect(
				frames.some((frame) => frame.scale > 0.9 && frame.scale < 1),
				JSON.stringify(frames),
			).toBe(true);
		}
		await trigger.hover();
		await expect(page.getByRole("tooltip", { name: "Add agent", exact: true })).toBeVisible();
		await page.getByRole("heading", { name: "Project butter", exact: true }).hover();
		await expect(slot).toHaveCSS("opacity", "0");
	});
}

test("Project butter's hexagon is keyboard reachable and attaches a working agent", async ({ page }) => {
	const demo = await openButter(page);
	await demo.getByRole("button", { name: "2 of 6 subtasks complete" }).focus();
	await page.keyboard.press("Tab");
	const trigger = demo.getByRole("button", { name: "Add agent to PD-40" });
	await expect(trigger).toBeFocused();
	await expect(demo.locator('[data-slot="jira-issue-add-agent"]')).toHaveCSS("opacity", "1");
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents", exact: true });
	await expect(picker).toBeVisible();
	await expect(picker.getByRole("textbox", { name: "Search agents" })).toBeFocused();
	await page.keyboard.press("ArrowDown");
	await expect(demo.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveAttribute(
		"data-agent-id",
		"rovoDev",
	);
	await page.keyboard.press("ArrowUp");
	await expect(demo.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveAttribute(
		"data-agent-id",
		"rovo",
	);
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Enter");
	const activity = demo.locator("[data-jira-issue-agent-row-handle]");
	await expect(activity).toBeVisible();
	await expect(activity).toBeFocused();
	await expect(trigger).toHaveCount(0);
	await expect(picker).not.toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Project butter previews agent names inside the casing with ${reducedMotion} motion`, async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion });
		const demo = await openButter(page);
		const shell = demo.locator("article");
		const surface = demo.locator('[data-slot="jira-issue-surface"]');
		const before = await surface.boundingBox();
		const trigger = demo.getByRole("button", { name: "Add agent to PD-40" });
		const border = trigger.locator('[data-slot="avatar-hexagon-border"]');
		const idleBorderColor = await border.evaluate((element) => getComputedStyle(element).color);
		await demo.getByText("Implement advanced date-range filter", { exact: true }).hover();
		await trigger.click();
		await expect(border).not.toHaveCSS("color", idleBorderColor);
		const menu = page.getByRole("dialog", { name: "Agents", exact: true });
		await expect(menu).toBeVisible();
		await expect(menu.getByRole("textbox", { name: "Search agents" })).toBeVisible();
		await expect(demo.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCSS("opacity", "1");
		await expect
			.poll(async () => {
				const paper = await surface.boundingBox();
				const frame = await shell.boundingBox();
				return paper && frame ? Math.abs(paper.x - frame.x - 4) + Math.abs(paper.y - frame.y - 4) : 999;
			})
			.toBeLessThan(0.5);
		const paper = await surface.boundingBox();
		expect(paper?.width).toBe((before?.width ?? 0) - 8);
		const preview = demo.locator('[data-slot="jira-issue-agent-invocation-preview"]');
		await menu.getByRole("option", { name: /^Claude/u }).hover();
		await expect(preview).toHaveAttribute("data-agent-id", "claude");
		await expect(preview.locator("img")).toHaveAttribute("src", /agent-claude\.svg/u);
		await menu.getByRole("option", { name: /^Cursor/u }).hover();
		await expect(preview).toHaveAttribute("data-agent-id", "cursor");
		await expect(preview).toHaveAttribute("data-direction", "backward");
		if (reducedMotion === "reduce") await expect(preview.locator("[data-preview-layer]")).toHaveCount(0);
		else await expect(preview.locator('[data-preview-layer="incoming"]')).toHaveText("Cursor");
		await expect(demo.locator("[data-jira-issue-agent-row-handle]")).toHaveCount(0);
		await page.keyboard.press("Escape");
		await expect(menu).not.toBeVisible();
		await expect(demo.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCSS("opacity", "0");
		await expect(preview).toHaveCount(0);
		await expect(border).toHaveCSS("color", idleBorderColor);
		await expect.poll(async () => (await shell.boundingBox())?.height).toBe(before?.height);
		await trigger.click();
		await expect(preview).toHaveAttribute("data-agent-id", "default");
		await demo.getByRole("button", { name: "Raised", exact: true }).click();
		await expect(menu).not.toBeVisible();
		await expect(demo.locator("[data-jira-issue-agent-row-handle]")).toHaveCount(0);
	});
}

test("Project butter cycles the agent under a stationary pointer when the menu scrolls", async ({ page }) => {
	const demo = await openButter(page);
	await demo.getByText("Implement advanced date-range filter", { exact: true }).hover();
	await demo.getByRole("button", { name: "Add agent to PD-40" }).click();
	const menu = page.getByRole("dialog", { name: "Agents", exact: true });
	await expect(demo.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCSS("opacity", "1");
	await menu.getByRole("option", { name: /^Claude/u }).hover();
	const preview = demo.locator('[data-slot="jira-issue-agent-invocation-preview"]');
	await expect(preview).toHaveAttribute("data-agent-id", "claude");
	const viewport = menu.locator('[data-slot="command-list"]');
	const initialScrollTop = await viewport.evaluate((element) => element.scrollTop);
	await page.mouse.wheel(0, 96);
	await expect.poll(async () => viewport.evaluate((element) => element.scrollTop)).toBe(initialScrollTop + 96);
	await expect(preview).not.toHaveAttribute("data-agent-id", "claude");
	await expect(preview).toHaveAttribute("data-direction", "forward");
	await expect(menu.locator('[data-slot="command-item"][aria-selected="true"]')).toHaveAttribute(
		"data-value",
		await preview.getAttribute("data-agent-id") ?? "",
	);
	const scrollTop = await viewport.evaluate((element) => element.scrollTop);
	await expect.poll(async () => viewport.evaluate((element) => element.scrollTop)).toBe(scrollTop);
	await page.mouse.wheel(0, -96);
	await expect.poll(async () => viewport.evaluate((element) => element.scrollTop)).toBe(initialScrollTop);
	await expect(preview).toHaveAttribute("data-agent-id", "claude");
	await expect(preview).toHaveAttribute("data-direction", "backward");
	await page.keyboard.press("Escape");
	await expect(demo.locator("[data-jira-issue-agent-row-handle]")).toHaveCount(0);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Project butter preserves the casing through assignment with ${reducedMotion} motion`, async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion });
		const demo = await openButter(page);
		await demo.getByText("Implement advanced date-range filter", { exact: true }).hover();
		await demo.getByRole("button", { name: "Add agent to PD-40" }).click();
		const menu = page.getByRole("dialog", { name: "Agents", exact: true });
		const option = menu.getByRole("option", { name: /^Claude/u });
		await option.hover();
		await expect(demo.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCSS("opacity", "1");
		const before = await demo.locator("article").boundingBox();
		const framesPromise = page.evaluate(async () => {
			const option = document.querySelector('[data-slot="command-item"][data-value="claude"]');
			const shell = document.querySelector("[data-project-butter-demo] article");
			const surface = document.querySelector('[data-project-butter-demo] [data-slot="jira-issue-surface"]');
			if (!option || !shell || !surface) throw new Error("Invocation fixture missing");
			await new Promise<void>((resolve) =>
				option.addEventListener("click", () => resolve(), { once: true, capture: true }),
			);
			const frames: { height: number; inset: number; width: number }[] = [];
			for (let i = 0; i < 24; i++) {
				const host = shell.getBoundingClientRect();
				const paper = surface.getBoundingClientRect();
				frames.push({ height: host.height, inset: paper.x - host.x, width: paper.width });
				await new Promise<number>((resolve) => requestAnimationFrame(resolve));
			}
			return frames;
		});
		await option.click();
		const frames = await framesPromise;
		expect(
			frames.every((frame) => Math.abs(frame.height - (before?.height ?? 0)) < 1),
			JSON.stringify(frames),
		).toBe(true);
		expect(
			frames.every((frame) => Math.abs(frame.inset - 4) < 0.5 && frame.width > 0),
			JSON.stringify(frames),
		).toBe(true);
		const actual = demo.locator("[data-jira-issue-agent-row-handle]");
		await expect(actual).toHaveAttribute("aria-label", "Claude: Working");
		await expect(actual).toBeFocused();
		await expect(demo.locator('[data-slot="jira-issue-agent-invocation-preview"]')).toHaveCount(0);
	});
}
