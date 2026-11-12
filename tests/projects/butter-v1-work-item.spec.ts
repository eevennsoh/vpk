import { expect, test, type Locator } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";
import { activityHeaderTimeLabel } from "@/components/blocks/jira-work-item/project-butter/activity-data";

test("work item opens local agents from Development instead of the header", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	await expect(workItem.getByRole("group", { name: "Open in an app" })).toHaveCount(0);
	await workItem.getByRole("region", { name: "Development" }).getByRole("button", { name: "Open in", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Local software agents" }).getByRole("button", { name: "Copy prompt" })).toBeVisible();
});

test("timeline labels normalize minute and hour variants", () => {
	for (const label of ["1m ago", "1min ago", "1 min ago", "1 minute ago", "1 minutes ago"]) {
		expect(activityHeaderTimeLabel(label)).toBe("1 min ago");
	}
	expect(activityHeaderTimeLabel("2 mins ago")).toBe("2 min ago");
	for (const label of ["2h ago", "2hr ago", "2 hrs ago", "2 hour ago", "2 hours ago"]) {
		expect(activityHeaderTimeLabel(label)).toBe("2 hr ago");
	}
	for (const label of ["Just now", "Yesterday", "2 days ago", "19 May"]) {
		expect(activityHeaderTimeLabel(label)).toBe(label);
	}
});

test("the sticky activity timeline uses min and hr for relative times", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.setViewportSize({ width: 1600, height: 800 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const timeline = page.getByRole("listbox", { name: "Navigate activity" });
	const headerTime = page.locator("[data-project-butter-activity-header-time]");
	await timeline.getByRole("option", { name: /Review Teamwork onboarding guide/ }).click();
	await expect(headerTime).toHaveText("2 min ago");
	await timeline.getByRole("option", { name: /Summarize onboarding feedback/ }).click();
	await expect(headerTime).toHaveText("1 hr ago");
});

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
		const activityHeader = layout.locator("[data-project-butter-activity-header]");
		await scroller.evaluate((element) => {
			const header = element.querySelector("[data-project-butter-activity-header]");
			if (!header) throw new Error("Activity header is missing");
			element.scrollTop += header.getBoundingClientRect().top - element.getBoundingClientRect().top + 100;
		});
		await expect(activityHeader.locator("[data-project-butter-activity-header-time]")).toBeVisible();
		await expect(scroller).toHaveCSS("mask-image", "none");
		await expect(activityHeader.getByRole("listbox", { name: "Navigate activity" })).toBeVisible();
		await scroller.evaluate((element) => { element.scrollTop = 200; });
		await expect(scroller).toHaveCSS("mask-image", /linear-gradient/);
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
	const triggerBounds = await field.getByRole("button", { name: "4 agents" }).boundingBox();
	const avatarBounds = await field.locator('[data-agent-name] button').first().boundingBox();
	if (!triggerBounds || !avatarBounds) throw new Error("Agent field geometry is unavailable");
	expect(avatarBounds.y + avatarBounds.height / 2).toBeCloseTo(triggerBounds.y + triggerBounds.height / 2, 0);
	await expect(field).not.toContainText(/Needs input|Working|Finished/);
	await field.getByRole("button", { name: "4 agents" }).click();
	await expect(page.getByRole("dialog", { name: "Add agent" })).toBeVisible();
});

test("work item agent avatars show lanyards beside Details without moving between agents", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const field = page.getByRole("group", { name: "Agents field" });
	const details = page.locator('[data-panel-id="details"]');
	await field.getByRole("button", { name: "Jira Coding Agent, add agent" }).hover();
	const coding = page.getByRole("article", { name: "Jira Coding Agent agent" });
	await expect(coding).toBeVisible();
	await expect(coding.locator('[data-slot="agent-lanyard-grid"]')).toHaveAttribute("data-animated", "false");
	await expect(coding.getByRole("button")).toHaveCount(0);
	await expect(coding.locator('[data-slot="agent-lanyard-surface"]')).toHaveCSS("border-left-width", "0px");
	await expect.poll(async () => {
		const surface = await coding.locator('[data-slot="agent-lanyard-surface"]').boundingBox();
		const description = await coding.locator("p").last().boundingBox();
		return surface && description ? Math.round(surface.y + surface.height - description.y - description.height) : null;
	}).toBe(16);
	await expect.poll(async () => {
		const card = await coding.boundingBox();
		const panel = await details.boundingBox();
		return card && panel ? card.x + card.width - panel.x : null;
	}).toBeCloseTo(-8, 0);
	const codingBounds = await coding.boundingBox();
	const codingAvatar = coding.locator('[data-slot="agent-lanyard-avatar"]');
	const codingAvatarBounds = await codingAvatar.boundingBox();
	const codingShape = await codingAvatar.evaluate((element) => getComputedStyle(element).maskImage);
	const detailsBounds = await details.boundingBox();
	const fieldBounds = await field.boundingBox();
	if (!codingBounds || !codingAvatarBounds || !detailsBounds || !fieldBounds) throw new Error("Lanyard, avatar, field, or Details panel is not visible");
	expect(codingBounds.x + codingBounds.width).toBeCloseTo(detailsBounds.x - 8, 0);
	expect(codingBounds.y).toBeCloseTo(fieldBounds.y, 0);
	await field.getByRole("button", { name: "Jira Scoping agent, add agent" }).hover();
	const scoping = page.getByRole("article", { name: "Jira Scoping agent agent" });
	await expect(scoping).toBeVisible();
	await expect(scoping.getByText("Breaks large projects into smaller, actionable, well-scoped tasks.")).toBeVisible();
	await expect(scoping.getByText("Atlassian", { exact: true })).toBeVisible();
	const scopingAvatar = scoping.locator('[data-slot="agent-lanyard-avatar"]');
	const scopingAvatarBounds = await scopingAvatar.boundingBox();
	if (!scopingAvatarBounds) throw new Error("Scoping agent avatar is not visible");
	expect(scopingAvatarBounds.height).toBeCloseTo(codingAvatarBounds.height, 0);
	expect(scopingAvatarBounds.x + scopingAvatarBounds.width / 2).toBeCloseTo(codingAvatarBounds.x + codingAvatarBounds.width / 2, 0);
	expect(scopingAvatarBounds.y).toBeCloseTo(codingAvatarBounds.y, 0);
	expect(codingShape).toContain("/avatar-agent-new/blue/backlog-buddy.svg");
	await expect(scopingAvatar).toHaveCSS("mask-image", codingShape);
	await expect(scoping.locator('[data-slot="avatar-hexagon-border"]')).toHaveCount(0);
	await field.getByRole("button", { name: "Claude, add agent" }).hover();
	const claudeAvatar = page.getByRole("article", { name: "Claude agent" }).locator('[data-slot="agent-lanyard-avatar"]');
	const claudeAvatarBounds = await claudeAvatar.boundingBox();
	if (!claudeAvatarBounds) throw new Error("Claude avatar is not visible");
	expect(scopingAvatarBounds.x).toBeCloseTo(claudeAvatarBounds.x, 0);
	expect(scopingAvatarBounds.y).toBeCloseTo(claudeAvatarBounds.y, 0);
	expect(scopingAvatarBounds.width).toBeCloseTo(claudeAvatarBounds.width, 0);
	await expect(claudeAvatar).toHaveCSS("mask-image", codingShape);
	for (const name of ["Claude", "Cursor", "Jira Coding Agent", "Claude"]) {
		await field.getByRole("button", { name: `${name}, add agent` }).hover();
		await expect(page.locator('[data-slot="hover-card-content"] [data-slot="agent-lanyard-surface"]')).toHaveCount(1);
	}
	await field.getByRole("button", { name: "Claude, add agent" }).hover();
	const claude = page.getByRole("article", { name: "Claude agent" });
	await expect(claude).toBeVisible();
	await expect.poll(async () => (await claude.boundingBox())?.x).toBeCloseTo(codingBounds.x, 0);
	const claudeBounds = await claude.boundingBox();
	if (!claudeBounds) throw new Error("Claude lanyard is not visible");
	expect(claudeBounds.x).toBeCloseTo(codingBounds.x, 0);
	expect(claudeBounds.y).toBeCloseTo(codingBounds.y, 0);
	await expect(claude.getByRole("button")).toHaveCount(0);
	await field.getByRole("button", { name: "Claude, add agent" }).click();
	await expect(page.getByRole("dialog", { name: "Add agent" })).toBeVisible();
	await page.keyboard.press("Escape");
	await field.getByRole("button", { name: "Cursor, add agent" }).focus();
	await expect(page.getByRole("article", { name: "Cursor agent" })).toBeVisible();
});

test("work item agent picker previews lanyards without an extra border", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	await page.getByRole("group", { name: "Agents field" }).getByRole("button", { name: "Add agent" }).click();
	const picker = page.getByRole("dialog", { name: "Add agent" });
	await picker.getByRole("button", { name: "Claude (Recommended)" }).hover();
	const popup = page.locator('[data-slot="hover-card-content"]');
	await expect(popup.getByRole("article", { name: "Claude recommended" })).toBeVisible();
	await expect(popup.getByText("Collaborate on code with an AI that gives smart suggestions and reviews.", { exact: true })).toBeVisible();
	await expect(popup.getByRole("heading", { name: "Why recommended" })).toBeVisible();
	await expect(popup.getByText("Claude can help with code suggestions and reviews.", { exact: true })).toBeVisible();
	await expect(popup.getByText("Claude can help with code suggestions and reviews.", { exact: true })).toHaveCSS("line-height", "16px");
	await expect(popup.getByRole("button")).toHaveCount(0);
	const expectContentHugged = async (content: Locator, bottomPadding = 16) => {
		await expect.poll(async () => {
			const surface = await popup.locator('[data-slot="agent-lanyard-surface"]').boundingBox();
			const lastContent = await content.boundingBox();
			return surface && lastContent ? Math.round(surface.y + surface.height - lastContent.y - lastContent.height) : null;
		}).toBe(bottomPadding);
	};
	await expectContentHugged(popup.getByText("Claude can help with code suggestions and reviews."), 12);
	await expect(popup).toHaveCSS("box-shadow", "none");
	await expect(popup).toHaveCSS("border-top-width", "0px");
	await expect(popup.locator('[data-slot="agent-lanyard-surface"]')).toHaveCSS("border-top-width", "0px");
	await picker.getByRole("button", { name: "Jira Coding Agent", exact: true }).hover();
	await expect(popup.getByRole("article", { name: "Jira Coding Agent agent" })).toBeVisible();
	await expect(popup.getByRole("heading", { name: "Why recommended" })).toHaveCount(0);
	await expect(popup.getByRole("button")).toHaveCount(0);
	await expectContentHugged(popup.getByRole("img", { name: "Connected apps: Jira, Bitbucket" }));
	for (const name of ["Cursor", "Codex", "Release Notes Drafter"]) {
		await picker.getByRole("button", { name, exact: true }).hover();
		await expect(popup.getByRole("heading", { name, exact: true })).toBeVisible();
		await expect(popup.getByRole("button")).toHaveCount(0);
	}
	await picker.getByRole("button", { name: "Claude (Recommended)" }).click();
	await expect(picker).toBeHidden();
});

for (const input of ["pointer", "keyboard"] as const) {
	test(`the first selected agent stays still and the field loses focus (${input})`, async ({ page }) => {
		await page.setViewportSize({ width: 1800, height: 1100 });
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select e2e Journey" }).click();
		await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
		const field = page.getByRole("group", { name: "Agents field" });
		const trigger = field.getByRole("button", { name: "Add agent" });
		await trigger.click();
		await page.getByRole("dialog", { name: "Add agent" }).getByRole("textbox", { name: "Search agents" }).press("Escape");
		await expect(trigger).toBeFocused();
		await trigger.click();
		const choice = page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "The Council", exact: true });
		if (input === "pointer") await choice.hover();
		else await choice.focus();
		await page.evaluate(() => {
			const samples: { opacity: number; scale: number; x: number }[] = [];
			Object.assign(window, { firstAgentSamples: samples });
			const observer = new MutationObserver(() => {
				const avatar = document.querySelector<HTMLElement>('[data-agent-name="the council"]');
				if (!avatar) return;
				observer.disconnect();
				const sample = () => {
					const style = getComputedStyle(avatar);
					const matrix = new DOMMatrixReadOnly(style.transform);
					samples.push({ opacity: Number(style.opacity), scale: matrix.a, x: matrix.e });
					if (samples.length < 30) requestAnimationFrame(sample);
				};
				sample();
				requestAnimationFrame(sample);
			});
			observer.observe(document.body, { childList: true, subtree: true });
		});
		if (input === "pointer") await choice.click();
		else await choice.press("Enter");
		await expect(field.getByRole("button", { name: "The Council", exact: true })).toBeVisible();
		await expect(field.getByText("The Council", { exact: true })).toBeVisible();
		await expect.poll(() => field.evaluate((element) => element.contains(document.activeElement))).toBe(false);
		await expect.poll(() => page.evaluate(() => (window as unknown as { firstAgentSamples: unknown[] }).firstAgentSamples.length)).toBeGreaterThanOrEqual(30);
		const samples = await page.evaluate(() => (window as unknown as { firstAgentSamples: { opacity: number; scale: number; x: number }[] }).firstAgentSamples);
		for (const sample of samples) {
			expect(sample.opacity).toBe(1);
			expect(sample.scale).toBeCloseTo(1, 3);
			expect(sample.x).toBeCloseTo(0, 3);
		}
	});
}

test("selecting an agent already in the stack visibly scales its avatar in", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const field = page.getByRole("group", { name: "Agents field" });
	await field.getByRole("button", { name: "4 agents" }).click();
	await page.evaluate(() => {
		const samples: { scale: number; opacity: number; visible: boolean; x: number }[] = [];
		Object.assign(window, { agentEntranceSamples: samples });
		const observer = new MutationObserver(() => {
			const avatar = document.querySelector<HTMLElement>('[data-agent-id="butter-coding"]');
			const scroller = avatar?.closest<HTMLElement>('[data-slot="scroll-fade"]');
			if (!avatar || !scroller) return;
			observer.disconnect();
			const sample = () => {
				const style = getComputedStyle(avatar);
				const bounds = avatar.getBoundingClientRect();
				const viewport = scroller.getBoundingClientRect();
				const transform = new DOMMatrixReadOnly(style.transform);
				samples.push({ scale: transform.a, opacity: Number(style.opacity), visible: bounds.left >= viewport.left && bounds.right <= viewport.right, x: transform.e });
				if (samples.length < 50) requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		observer.observe(document.body, { childList: true, subtree: true });
	});
	await page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "Jira Coding Agent", exact: true }).click();
	await expect.poll(() => page.evaluate(() => (window as unknown as { agentEntranceSamples: { scale: number; opacity: number; visible: boolean }[] }).agentEntranceSamples.some((sample) => sample.visible && sample.opacity > 0.15 && sample.scale < 0.9))).toBe(true);
	await expect.poll(() => page.evaluate(() => (window as unknown as { agentEntranceSamples: { scale: number; opacity: number; visible: boolean }[] }).agentEntranceSamples.some((sample) => sample.visible && sample.scale > 1.05))).toBe(true);
	const samples = await page.evaluate(() => (window as unknown as { agentEntranceSamples: { x: number; opacity: number }[] }).agentEntranceSamples);
	expect(samples.every((sample) => Math.abs(sample.x) < 0.01 && sample.opacity === 1)).toBe(true);
	await expect(field.getByRole("button", { name: "4 agents" })).toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`the work item agent stack scrolls without a scrollbar when it overflows (${reducedMotion})`, async ({ page }) => {
		test.setTimeout(120_000);
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.emulateMedia({ reducedMotion });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Work item" }).click();
		const field = page.getByRole("group", { name: "Agents field" });
		const scroller = field.locator('[data-slot="scroll-fade"]');
		await expect(scroller).toHaveCSS("mask-image", "none");
		const agents = ["Figma", "Canva", "Release Notes Drafter", "Readiness Checker", "Code Reviewer", "Pipeline Troubleshooter", "Meeting Insights Reporter", "Product Requirements Guide", "Feedback Analyzer", "Notion", "Slack", "Google Drive", "Atlassian", "AI Insights Agent", "RFP Drafter", "Research Companion", "ChatGPT Wrapper App", "Social Media Writer", "Progress Tracker", "Decision Director"];
		for (const name of agents) {
			await field.getByRole("button", { name: "Jira Coding Agent, add agent" }).click();
			const picker = page.getByRole("dialog", { name: "Add agent" });
			await picker.getByRole("textbox", { name: "Search agents" }).fill(name);
			await picker.getByRole("button", { name, exact: true }).click();
		}
		await expect.poll(() => scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
		await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
		await expect(scroller).toHaveCSS("mask-image", /linear-gradient/);
		await expect(scroller).toHaveCSS("--scroll-mask-fade-size", "3rem");
		await expect(scroller).toHaveCSS("scrollbar-width", "none");
		const trigger = field.getByRole("button", { name: /^\d+ agents?$/u });
		await trigger.focus();
		await trigger.press("ArrowLeft");
		const afterLeft = await scroller.evaluate((element) => element.scrollLeft);
		await trigger.press("ArrowLeft");
		await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeLessThan(afterLeft);
		await trigger.press("ArrowRight");
		await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
		const beforeWheel = await scroller.evaluate((element) => element.scrollLeft);
		await scroller.hover();
		await page.mouse.wheel(100, 0);
		await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(beforeWheel);
		await page.mouse.wheel(-5000, 0);
		await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBe(0);
		await expect.poll(() => scroller.evaluate((element) => element.style.maskImage)).toContain("black 0,");
		await page.mouse.wheel(5000, 0);
		await expect.poll(() => scroller.evaluate((element) => element.scrollLeft + element.clientWidth >= element.scrollWidth - 1)).toBe(true);
		await expect.poll(() => scroller.evaluate((element) => element.style.maskImage)).toContain("black 100%");
	});
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
			{ name: "Agent & app selector", content: page.getByRole("region", { name: "Project Butter agent selector" }) },
			{ name: "Duplicative sessions", content: page.getByRole("region", { name: "Work item full screen view" }) },
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
	await workItem.getByRole("group", { name: "Agents field" }).getByRole("button", { name: /^\d+ agents?$/u }).click();
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

	await workItem.getByRole("group", { name: "Agents field" }).getByRole("button", { name: /^\d+ agents?$/u }).click();
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

test("board and list work items open full screen and return to their source", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	for (const view of ["Board", "List"] as const) {
		await page.getByRole("button", { name: `Select ${view}` }).click();
		if (view === "Board") {
			await page.locator('[data-issue-key="PAY-118"][data-board-column-title] [data-slot="jira-issue-card"]').click();
		} else {
			await page.getByRole("region", { name: "Payments SDK v2 migration work items list" }).getByRole("button", { name: "PAY-118", exact: true }).click();
		}
		const item = page.getByRole("dialog", { name: "Project butter" });
		await expect(item.getByRole("region", { name: "Work item full screen view" })).toBeVisible();
		await expect(item.getByRole("button", { name: "Collapse work item" })).toHaveCount(0);
		const bounds = await item.boundingBox();
		if (!bounds) throw new Error("Work item bounds are unavailable");
		expect(bounds).toMatchObject({ x: 0, y: 0, width: 1600, height: 1000 });
		await item.getByRole("button", { name: "Close Project butter work item" }).click();
		await expect(item).toBeHidden();
		await expect(page.getByRole("button", { name: `Select ${view}` })).toBeVisible();
	}
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
		const item = page.getByRole("dialog", { name: "Project butter" });
		await expect(item.getByRole("region", { name: "Work item full screen view" })).toBeVisible();
		await expect(item.getByText("Agents", { exact: true })).toBeVisible();
		const itemBounds = await item.boundingBox();
		await item.getByRole("button", { name: "Close Project butter work item" }).click();
		await page.getByRole("button", { name: "Select Work item" }).click();
		const screen = page.getByRole("region", { name: "Work item full screen view" });
		await expect(screen).toBeVisible();
		const screenBounds = await screen.boundingBox();
		if (!boardBounds || !itemBounds || !screenBounds) throw new Error("Work item bounds are unavailable");
		expect(itemBounds).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });
		expect(Math.abs(screenBounds.y + screenBounds.height - viewport.height)).toBeLessThanOrEqual(2);
		const keyRow = await screen.locator("[data-project-butter-header-key-row]").boundingBox();
		if (!keyRow) throw new Error("Work item header bounds are unavailable");
		expect(Math.abs(keyRow.y + 24 - boardBounds.y)).toBeLessThanOrEqual(2);
	});
}
