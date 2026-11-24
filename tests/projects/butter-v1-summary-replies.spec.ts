import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("expanded thread curves and spine use the same opaque color", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	await thread.getByRole("button", { name: /^Show \d+ replies/u }).click();
	const stem = thread.locator("[data-jira-activity-thread-stem]");
	const branch = thread.locator("[data-jira-activity-thread-branch]:visible").first();
	await expect(stem).toHaveCSS("opacity", "1");
	await expect(branch).toHaveCSS("opacity", "1");
	const color = await stem.evaluate((node) => getComputedStyle(node).backgroundColor);
	expect(color).toMatch(/^rgb\(/u);
	await expect(branch).toHaveCSS("border-bottom-color", color);
	const token = await branch.evaluate((node) => {
		const probe = document.createElement("span");
		probe.style.color = "var(--ds-background-accent-gray-subtler)";
		node.append(probe);
		const result = getComputedStyle(probe).color;
		probe.remove();
		return result;
	});
	expect(color).toBe(token);
});

test("collapsed sessions hide thread lines while expanded replies remain connected", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	await activity.getByRole("button", { name: /Other agent activity/u }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-sarah-onboarding-copy"]:visible');
	const continuation = thread.locator("[data-jira-activity-replies-disclosure] > [data-jira-activity-thread-continuation]");
	await expect(thread.locator("[data-jira-activity-thread-stem]:visible, [data-jira-activity-thread-continuation]:visible, [data-jira-activity-thread-branch]:visible")).toHaveCount(0);
	await thread.getByRole("button", { name: /^Show \d+ repl/u }).click();
	await expect(thread.locator("[data-jira-activity-thread-stem]")).toBeVisible();
	await expect(continuation).toBeHidden();
	await expect(thread.getByRole("button", { name: "Hide replies", exact: true })).toBeVisible();
	await thread.getByRole("button", { name: "Hide replies", exact: true }).click();
	await expect(thread.locator("[data-jira-activity-thread-stem]:visible, [data-jira-activity-thread-continuation]:visible, [data-jira-activity-thread-branch]:visible")).toHaveCount(0);
});

test("collapsed pinned sessions show a dashed stem and expanded replies stay connected", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-sarah-onboarding-copy"]:visible');
	for (const view of ["Agent sessions", "Timeline"]) {
		await activity.getByRole("tab", { name: view, exact: true }).click();
		if (view === "Agent sessions") await activity.getByRole("button", { name: /Other agent activity/u }).click();
		const hide = thread.getByRole("button", { name: "Hide replies", exact: true });
		if (await hide.isVisible()) await hide.click();
		const stem = thread.locator("[data-jira-activity-thread-stem]");
		if (view === "Timeline") await expect(stem).toBeVisible();
		else await expect(stem).toBeHidden();
		await thread.hover();
		await thread.getByRole("button", { name: "Pin comment" }).click();
		await expect(stem).toBeVisible();
		await expect(stem).toHaveCSS("background-image", /repeating-linear-gradient/u);
		const show = thread.getByRole("button", { name: /^Show \d+ repl/u });
		await show.click();
		await expect(stem).toHaveCSS("background-image", "none");
		await hide.click();
		await expect(stem).toBeVisible();
		await expect(stem).toHaveCSS("background-image", /repeating-linear-gradient/u);
		await thread.getByRole("button", { name: "Unpin comment" }).click();
		if (view === "Timeline") await expect(stem).toBeVisible();
		else await expect(stem).toBeHidden();
	}
});

test("pinning and unpinning keep session participants settled", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	const participants = thread.locator("[data-summary-avatar-stack] > span");
	await expect(participants.first()).toHaveCSS("opacity", "1");
	await participants.first().evaluate((node) => { Reflect.set(window, "__pinAvatarNode", node); });
	for (const name of ["Pin comment", "Unpin comment"]) {
		await thread.getByRole("button", { name, exact: true }).click();
		await expect.poll(() => participants.first().evaluate((node) => Reflect.get(window, "__pinAvatarNode") === node)).toBe(true);
		await expect(participants.first()).toHaveCSS("opacity", "1");
	}
});

test("pinning in Timeline preserves the summarized avatar stack", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const thread = page.getByRole("region", { name: "Activity", exact: true }).locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	await thread.hover();
	await thread.getByRole("button", { name: "Summarize thread" }).click();
	const participants = thread.locator("[data-summary-avatar-stack] > span");
	await expect(participants.first()).toHaveCSS("opacity", "1");
	await participants.first().evaluate((node) => { Reflect.set(window, "__pinAvatarNode", node); });
	for (const name of ["Pin comment", "Unpin comment"]) {
		await thread.getByRole("button", { name, exact: true }).click();
		await expect.poll(() => participants.first().evaluate((node) => Reflect.get(window, "__pinAvatarNode") === node)).toBe(true);
		await expect(participants.first()).toHaveCSS("opacity", "1");
	}
});

test("expanded session reply branches do not repaint the thread stem", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	await activity.getByRole("button", { name: /Other agent activity/u }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-sarah-onboarding-copy"]:visible');
	const show = thread.getByRole("button", { name: /^Show \d+ repl/u });
	if (await show.isVisible()) await show.click();
	await expect(thread.getByRole("button", { name: "Hide replies" })).toBeVisible();
	const stem = thread.locator("[data-jira-activity-thread-stem]");
	const branch = thread.locator("[data-jira-activity-thread-branch]:visible").first();
	await expect(stem).toHaveCount(1);
	await expect(branch).toHaveCSS("clip-path", "inset(0px 0px 0px 1px)");
	const stemBox = await stem.boundingBox();
	const branchBox = await branch.boundingBox();
	expect(stemBox && branchBox && Math.abs(stemBox.x - branchBox.x) <= 1 && stemBox.y <= branchBox.y && stemBox.y + stemBox.height >= branchBox.y + branchBox.height).toBe(true);
});

test("pinned sessions keep only the filled pin visible at rest", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	await thread.hover();
	const unpinnedBox = await thread.getByRole("button", { name: "Pin comment" }).boundingBox();
	await thread.getByRole("button", { name: "Pin comment" }).click();
	await page.mouse.move(0, 0);
	await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
	const pin = thread.getByRole("button", { name: "Unpin comment" });
	await expect(pin).toHaveAttribute("aria-pressed", "true");
	await expect(thread.getByText("Pinned", { exact: true })).toHaveCount(0);
	await expect.poll(() => pin.evaluate((button) => {
		let opacity = 1;
		for (let node: Element | null = button; node && node !== document.body; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
		return opacity;
	})).toBe(1);
	await expect(pin).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	const restPin = await pin.boundingBox();
	const header = await thread.locator('[data-slot="jira-activity-comment-header"]:not([data-jira-activity-reply-header])').boundingBox();
	const avatar = await thread.locator("[data-summary-avatar-stack]").boundingBox();
	expect(header && avatar && header.height <= 33 && Math.abs(header.y + header.height / 2 - avatar.y - avatar.height / 2) <= 1).toBe(true);
	expect(restPin && header && Math.abs(restPin.x + restPin.width - header.x - header.width) <= 1).toBe(true);
	await expect.poll(() => thread.getByRole("button", { name: "Summarize thread" }).evaluate((button) => {
		let opacity = 1;
		for (let node: Element | null = button; node && node !== document.body; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
		return opacity;
	})).toBe(0);
	const motion = page.evaluate(() => new Promise<number[]>((resolve) => {
		const positions: number[] = [];
		const started = performance.now();
		function sample() {
			const pin = [...document.querySelectorAll<HTMLElement>('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"] button[aria-label="Unpin comment"]')].find((button) => button.getBoundingClientRect().width > 0);
			if (pin && pin.getBoundingClientRect().width) positions.push(pin.getBoundingClientRect().x);
			if (performance.now() - started < 600) requestAnimationFrame(sample);
			else resolve(positions);
		}
		requestAnimationFrame(sample);
	}));
	await thread.hover();
	await expect.poll(() => thread.getByRole("button", { name: "Summarize thread" }).evaluate((button) => {
		let opacity = 1;
		for (let node: Element | null = button; node && node !== document.body; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
		return opacity;
	})).toBe(1);
	const hoveredPin = await pin.boundingBox();
	expect(restPin && hoveredPin && unpinnedBox && Math.abs(hoveredPin.x - restPin.x) <= 1 && Math.abs(unpinnedBox.x - restPin.x) <= 1).toBe(true);
	const positions = await motion;
	if (!restPin || !hoveredPin) throw new Error("Missing pin geometry");
	expect(positions.length > 1 && positions.every((x) => Math.abs(x - restPin.x) <= 1)).toBe(true);
	await pin.click();
	await expect(thread.getByRole("button", { name: "Pin comment" })).toHaveAttribute("aria-pressed", "false");
	await activity.getByRole("tab", { name: "Timeline", exact: true }).click();
	await thread.getByRole("button", { name: "Pin comment" }).click();
	await page.mouse.move(0, 0);
	await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
	const timelinePin = thread.getByRole("button", { name: "Unpin comment" });
	await expect.poll(() => timelinePin.evaluate((button) => {
		let opacity = 1;
		for (let node: Element | null = button; node && node !== document.body; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
		return opacity;
	})).toBe(1);
	await expect(timelinePin).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect(thread.getByText("Pinned", { exact: true })).toHaveCount(0);
	const timelineHeader = await thread.locator('[data-slot="jira-activity-comment-header"]:not([data-jira-activity-reply-header])').boundingBox();
	const timelineAvatar = await thread.locator("[data-summary-avatar-stack]").boundingBox();
	expect(timelineHeader && timelineAvatar && timelineHeader.height <= 33 && Math.abs(timelineHeader.y + timelineHeader.height / 2 - timelineAvatar.y - timelineAvatar.height / 2) <= 1).toBe(true);
});

test("reply disclosure animates between the participant stack and the agent-owner pair", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	for (const view of ["Timeline", "Agent sessions"]) {
		await activity.getByRole("tab", { name: view, exact: true }).click();
		const pair = thread.locator('[data-summary-avatar-pair] [data-slot="human-agent-avatar"]');
		const extra = thread.locator("[data-summary-avatar-stack] > span").first();
		const title = thread.getByText("Venn added Cursor", { exact: true });
		if (view === "Timeline") {
			await expect(pair).toHaveAttribute("data-composition", "group");
			await expect(extra).toHaveCSS("opacity", "1");
			await thread.getByRole("button", { name: /^Show \d+ replies/u }).click();
			await expect(pair).toHaveAttribute("data-composition", "compact");
			await expect(extra).toHaveCSS("opacity", "0");
			await thread.getByRole("button", { name: "Hide replies", exact: true }).click();
			await expect(pair).toHaveAttribute("data-composition", "group");
			await expect(extra).toHaveCSS("opacity", "1");
			await thread.getByRole("button", { name: "Summarize thread" }).click();
		}
		await expect(pair).toHaveAttribute("data-composition", "group");
		await expect(extra).toHaveCSS("opacity", "1");
		const stackedTitle = await title.boundingBox();
		const frames = page.evaluate(() => new Promise<number[]>((resolve) => {
			const samples: number[] = [];
			const start = performance.now();
			function sample() {
				const avatar = [...document.querySelectorAll<HTMLElement>('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"] [data-summary-avatar-stack] > span')].find((node) => node.getBoundingClientRect().height > 0);
				if (avatar) samples.push(Number(getComputedStyle(avatar).opacity));
				if (performance.now() - start < 700) requestAnimationFrame(sample); else resolve(samples);
			}
			requestAnimationFrame(sample);
		}));
		await thread.getByRole("button", { name: /^Show \d+ replies/u }).click();
		await expect(pair).toHaveAttribute("data-composition", "compact");
		await expect(extra).toHaveCSS("opacity", "0");
		await expect(thread.getByRole("img", { name: "Cursor, used by Venn" })).toBeAttached();
		await expect(thread.getByText("Summary", { exact: true })).toBeVisible();
		await expect.poll(async () => (await title.boundingBox())?.x ?? 0).toBeLessThan((stackedTitle?.x ?? 0) - 10);
		expect((await frames).some((opacity) => opacity > 0.01 && opacity < 0.99)).toBe(true);
		await thread.getByRole("button", { name: "Hide replies", exact: true }).click();
		await expect(pair).toHaveAttribute("data-composition", "group");
		await expect(extra).toHaveCSS("opacity", "1");
		await expect.poll(async () => Math.abs(((await title.boundingBox())?.x ?? 0) - (stackedTitle?.x ?? 0))).toBeLessThanOrEqual(1);
	}
});

test("summary reply disclosures work in both activity views", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');

	for (const view of ["Timeline", "Agent sessions"]) {
		await activity.getByRole("tab", { name: view, exact: true }).click();
		if (view === "Timeline") await thread.getByRole("button", { name: "Summarize thread" }).click();
		const summary = thread.locator('[id][aria-hidden="false"]:has-text("Summary")');
		await expect(summary).toBeVisible();
		await expect(thread.getByRole("button", { name: "Show replies", exact: true })).toHaveCount(0);
		const disclosure = thread.getByRole("button", { name: /^Show \d+ replies/u });
		const disclosureBox = await disclosure.boundingBox();
		const summaryBox = await summary.boundingBox();
		expect(disclosureBox && summaryBox && disclosureBox.y < summaryBox.y).toBe(true);
		const summaryBranch = summary.locator("[data-summary-thread-branch]");
		await expect(summaryBranch).toBeVisible();
		await expect(summary.locator(":scope > .min-h-0")).toHaveCSS("overflow-x", "visible");
		const summaryCurve = await summaryBranch.boundingBox();
		const disclosureStem = thread.locator("[data-jira-activity-replies-disclosure] > [data-jira-activity-thread-continuation]");
		await expect(disclosureStem).toBeVisible();
		const continuation = await disclosureStem.boundingBox();
		const summaryHeading = await summary.getByText("Summary", { exact: true }).boundingBox();
		expect(summaryCurve && continuation && Math.abs(summaryCurve.x - continuation.x) <= 1 && Math.abs(summaryCurve.y - (continuation.y + continuation.height)) <= 1).toBe(true);
		expect(summaryCurve && summaryHeading && Math.abs(summaryCurve.y + summaryCurve.height - (summaryHeading.y + summaryHeading.height / 2)) <= 1).toBe(true);
		await expect(disclosureStem).toHaveCSS("mask-image", "none");
		await expect(thread.locator("[data-jira-activity-end-fade]:visible")).toHaveCount(0);
		await expect(summaryBranch).toHaveCSS("border-bottom-color", await disclosureStem.evaluate((node) => getComputedStyle(node).backgroundColor));
		if (view === "Agent sessions") {
			const stem = thread.locator("[data-jira-activity-thread-stem]");
			await expect(stem).toHaveCount(1);
			const line = await stem.boundingBox();
			expect(line && continuation && line.y < continuation.y && Math.abs(line.y + line.height - continuation.y) <= 1).toBe(true);
		}
		await disclosure.focus();
		await disclosure.press("Enter");
		const hide = thread.getByRole("button", { name: "Hide replies", exact: true });
		await expect(hide).toHaveAttribute("aria-expanded", "true");
		await expect(thread.getByText("Did you check the account setup step?", { exact: true })).toBeVisible();
		await expect(summary).toBeVisible();
		await expect(summaryBranch).toBeVisible();
		const replyBox = await thread.getByText("Did you check the account setup step?", { exact: true }).boundingBox();
		const expandedSummaryBox = await summary.boundingBox();
		expect(replyBox && expandedSummaryBox && replyBox.y < expandedSummaryBox.y).toBe(true);
		if (view === "Agent sessions") {
			const stem = thread.locator("[data-jira-activity-thread-stem]");
			const branches = thread.locator("[data-jira-activity-thread-branch]:visible");
			const line = await stem.boundingBox();
			const branch = await branches.first().boundingBox();
			const expandedDisclosure = await hide.boundingBox();
			expect(line && branch && expandedDisclosure && line.y < expandedDisclosure.y && line.y + line.height <= branch.y && Math.abs(line.x - branch.x) <= 1).toBe(true);
			await expect(stem).toHaveCSS("opacity", "1");
			const stemColor = await stem.evaluate((node) => getComputedStyle(node).backgroundColor);
			for (const curve of await branches.all()) {
				await expect(curve).toHaveCSS("opacity", "1");
				await expect(curve).toHaveCSS("border-bottom-color", stemColor);
			}
			const lastContinuation = thread.getByRole("group", { name: "Replies" }).locator(":scope > div").last().locator(":scope > [data-jira-activity-thread-continuation]");
			const lastLine = await lastContinuation.boundingBox();
			const finalCurve = await summaryBranch.boundingBox();
			expect(lastLine && finalCurve && Math.abs(lastLine.y + lastLine.height - finalCurve.y) <= 1).toBe(true);
		}
		await thread.getByRole("button", { name: "Summarize thread" }).click();
		await expect(thread.getByRole("button", { name: /^Show \d+ replies/u })).toBeVisible();
		await expect(thread.getByText("Did you check the account setup step?", { exact: true })).toBeHidden();
		await expect(summary).toBeVisible();
		await thread.getByRole("button", { name: /^Show \d+ replies/u }).click();
		await expect(thread.getByText("Did you check the account setup step?", { exact: true })).toBeVisible();
		await thread.getByRole("button", { name: "Hide replies", exact: true }).click();
	}
});

test("automatic session summaries finish the attributed pair before showing other participants", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	await page.evaluate(() => {
		const capture = { active: true, frames: [] as Array<{ opacity: number; x: number; y: number; width: number; height: number }> };
		Reflect.set(window, "__automaticAvatarSequence", capture);
		const sample = () => {
			if (!capture.active) return;
			const panel = document.querySelector('[role="tabpanel"]:not([hidden])');
			const thread = panel?.querySelector('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]');
			const extra = thread?.querySelector<HTMLElement>("[data-summary-avatar-stack] > span");
			const human = thread?.querySelector<HTMLElement>('[data-summary-avatar-pair] [data-slot="avatar-group"] [data-avatar-role="human"]');
			if (extra && human) {
				const box = human.getBoundingClientRect();
				capture.frames.push({ opacity: Number(getComputedStyle(extra).opacity), x: box.x, y: box.y, width: box.width, height: box.height });
			}
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	await activity.getByRole("tab", { name: "Agent sessions", exact: true }).click();
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	await expect(thread.getByRole("button", { name: /^Show \d+ replies/u })).toBeVisible();
	const human = thread.locator('[data-summary-avatar-pair] [data-slot="avatar-group"] [data-avatar-role="human"]');
	const extra = thread.locator("[data-summary-avatar-stack] > span").first();
	await expect(extra).toHaveCSS("opacity", "1");
	const humanBox = await human.boundingBox();
	if (!humanBox) throw new Error("Missing attributed human avatar");
	const frames = await page.evaluate(() => {
		const capture = Reflect.get(window, "__automaticAvatarSequence");
		capture.active = false;
		return capture.frames as Array<{ opacity: number; x: number; y: number; width: number; height: number }>;
	});
	const firstExtra = frames.find((frame) => frame.opacity > 0.05);
	if (!firstExtra) throw new Error("No participant entrance observed");
	expect(Math.abs(firstExtra.x - humanBox.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(firstExtra.y - humanBox.y)).toBeLessThanOrEqual(1);
	expect(Math.abs(firstExtra.width - humanBox.width)).toBeLessThanOrEqual(1);
	expect(Math.abs(firstExtra.height - humanBox.height)).toBeLessThanOrEqual(1);
});

test("thread summaries show their text immediately with reduced motion", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');
	for (const view of ["Timeline", "Agent sessions"]) {
		await activity.getByRole("tab", { name: view, exact: true }).click();
		const summarize = thread.getByRole("button", { name: "Summarize thread" });
		await summarize.focus();
		await summarize.press("Enter");
		const summary = thread.locator('[id][aria-hidden="false"]:has-text("Summary")');
		await expect(summary.getByText(/Annie asked Marcus to check account setup/u)).toBeVisible();
		await expect(summary.locator("[data-suggestion-text-reveal]")).toHaveCount(0);
		await expect(thread.locator('[data-summary-avatar-pair] [data-slot="human-agent-avatar"]')).toHaveAttribute("data-animated", "false");
		await thread.getByRole("button", { name: /^Show \d+ replies/u }).click();
	}
});
