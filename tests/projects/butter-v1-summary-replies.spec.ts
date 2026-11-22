import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("showing replies from a summary is immediate in both activity views", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery", exact: true }).click();
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const thread = activity.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]:visible');

	for (const view of ["Timeline", "Agent sessions"]) {
		await activity.getByRole("tab", { name: view, exact: true }).click();
		if (view === "Agent sessions") await thread.getByRole("button", { name: "Show replies", exact: true }).click();
		const repliesGroup = thread.getByRole("group", { name: "Replies" });
		const replyHeader = thread.locator("[data-jira-activity-reply-header]").first();
		const replyPadding = await replyHeader.evaluate((element) => getComputedStyle(element).paddingLeft);
		await thread.evaluate((element) => {
			const capture = { active: true, frames: [] as Array<{ opacity: number; x: number; y: number; width: number; height: number }> };
			Reflect.set(element, "__avatarSequence", capture);
			const sample = () => {
				if (!capture.active || !element.isConnected) return;
				const extra = element.querySelector<HTMLElement>("[data-summary-avatar-stack] > span");
				const human = element.querySelector<HTMLElement>('[data-summary-avatar-pair] [data-slot="avatar-group"] [data-avatar-role="human"]');
				if (extra && human) {
					const box = human.getBoundingClientRect();
					capture.frames.push({ opacity: Number(getComputedStyle(extra).opacity), x: box.x, y: box.y, width: box.width, height: box.height });
				}
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		const summarize = thread.getByRole("button", { name: "Summarize thread" });
		await summarize.focus();
		await summarize.press("Enter");
		const closingReplyAnimations = await thread.locator('[aria-label="Replies"]').evaluate((element) => element.parentElement?.parentElement?.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length ?? 0);
		expect(closingReplyAnimations).toBe(0);
		const restore = thread.getByRole("button", { name: "Show replies", exact: true });
		await expect(restore).toBeVisible();
		const summary = thread.locator('[id][aria-hidden="false"]:has-text("Thread summary")');
		await expect(summary).toHaveCSS("transition-property", "grid-template-rows, opacity");
		const reveal = summary.locator("[data-suggestion-text-reveal]");
		if (view === "Timeline") {
			await expect(reveal).toBeVisible();
			await expect(reveal.locator(".sr-only")).toContainText("Annie asked Cursor to check account setup");
			const colors = await reveal.locator('[aria-hidden="true"] span[style*="color"]').evaluateAll((nodes) => [...new Set(nodes.map((node) => (node as HTMLElement).style.color))]);
			expect(colors.length).toBeGreaterThan(1);
		} else {
			await expect(reveal).toHaveCount(0);
			await expect(summary.getByText(/Annie asked Cursor to check account setup/u)).toBeVisible();
		}
		expect(await replyHeader.evaluate((element) => getComputedStyle(element).paddingLeft)).toBe(replyPadding);
		const pair = thread.locator("[data-summary-avatar-pair]");
		const identity = pair.locator('[data-slot="human-agent-avatar"]');
		await expect(identity).toHaveAttribute("data-composition", "group");
		const group = identity.locator('[data-slot="avatar-group"]');
		const agent = group.locator('[data-avatar-role="agent"]');
		const human = group.locator('[data-avatar-role="human"]');
		await expect(agent).toHaveCSS("transform", "none");
		await expect(human).toHaveCSS("transform", "none");
		const extra = thread.locator("[data-summary-avatar-stack] > span").first();
		await expect(extra).toHaveCSS("opacity", "1");
		await expect.poll(async () => {
			const humanBox = await human.boundingBox();
			const extraBox = await extra.boundingBox();
			return humanBox && extraBox ? Math.abs(extraBox.x - humanBox.x - 16) : Infinity;
		}).toBeLessThanOrEqual(1);
		const [agentBox, humanBox, extraBox] = await Promise.all([agent.boundingBox(), human.boundingBox(), extra.boundingBox()]);
		if (!agentBox || !humanBox || !extraBox) throw new Error("Missing summary avatars");
		const frames = await thread.evaluate((element) => {
			const capture = Reflect.get(element, "__avatarSequence");
			capture.active = false;
			return capture.frames as Array<{ opacity: number; x: number; y: number; width: number; height: number }>;
		});
		const firstExtra = frames.find((frame) => frame.opacity > 0.05);
		expect(firstExtra).toBeDefined();
		if (!firstExtra) throw new Error("No participant entrance observed");
		expect(Math.abs(firstExtra.x - humanBox.x)).toBeLessThanOrEqual(1);
		expect(Math.abs(firstExtra.y - humanBox.y)).toBeLessThanOrEqual(1);
		expect(Math.abs(firstExtra.width - humanBox.width)).toBeLessThanOrEqual(1);
		expect(Math.abs(firstExtra.height - humanBox.height)).toBeLessThanOrEqual(1);
		expect(Math.abs(humanBox.x - agentBox.x - 16)).toBeLessThanOrEqual(1);
		expect(Math.abs(extraBox.x - humanBox.x - 16)).toBeLessThanOrEqual(1);
		expect(Number(await pair.evaluate((element) => getComputedStyle(element).zIndex))).toBeGreaterThan(Number(await extra.evaluate((element) => getComputedStyle(element).zIndex)));
		const humanArtwork = human.locator('[data-slot="avatar-group-visual"]');
		await expect.poll(() => humanArtwork.evaluate((element) => (element as HTMLElement).style.maskImage)).not.toBe("");
		const mask = await humanArtwork.evaluate((element) => (element as HTMLElement).style.maskImage);
		await group.dispatchEvent("pointerover");
		await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
		expect(await humanArtwork.evaluate((element) => (element as HTMLElement).style.maskImage)).toBe(mask);
		if (view === "Agent sessions") {
			const stem = thread.locator("[data-jira-activity-thread-stem]");
			const continuation = thread.locator("[data-summary-thread-continuation]");
			await expect(continuation).toBeVisible();
			await expect.poll(async () => {
				const stemBox = await stem.boundingBox();
				const continuationBox = await continuation.boundingBox();
				const headingBox = await thread.getByText("Thread summary", { exact: true }).boundingBox();
				if (!stemBox || !continuationBox || !headingBox) return false;
				return Math.abs(stemBox.y + stemBox.height - continuationBox.y) <= 1
					&& continuationBox.y + continuationBox.height > headingBox.y + headingBox.height;
			}).toBe(true);
		}
		await thread.evaluate((element) => {
			element.addEventListener("transitionrun", (event) => {
				if (event.target instanceof Element && event.target.closest("[data-summary-avatar-stack]")) element.setAttribute("data-stack-exited", "true");
			});
		});
		await page.mouse.move(0, 0);
		await restore.focus();
		await restore.press("Enter");
		await expect(reveal).toHaveCount(0);
		await expect(thread.getByText("Did you check the account setup step?", { exact: true })).toBeVisible();
		await expect(thread).toHaveAttribute("data-stack-exited", "true");
		await expect(repliesGroup.locator("[data-avatar-enter]")).toHaveCount(0);
		const replyAnimations = await repliesGroup.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length);
		expect(replyAnimations).toBe(0);
		const transitions = await thread.evaluate((element) => {
			const summary = element.querySelector('[id][aria-hidden="true"][inert]');
			const replies = element.querySelector('[aria-label="Replies"]')?.parentElement?.parentElement;
			return [summary, replies]
				.flatMap((node) => node ? node.getAnimations({ subtree: false }) : [])
				.filter((animation) => animation instanceof CSSTransition)
				.map((animation) => animation.transitionProperty);
		});
		expect(transitions).toEqual([]);
		await expect(identity).toHaveAttribute("data-composition", "compact");
		await expect(thread.getByRole("button", { name: "Summarize thread" })).toBeFocused();
		await summarize.press("Enter");
		await expect(restore).toBeVisible();
		await restore.click();
		await expect(identity).toHaveAttribute("data-composition", "compact");
		await expect(identity.locator("[data-avatar-role]")).toHaveCount(2);
		const compactAgent = identity.locator('[data-avatar-role="agent"] [data-slot="avatar"]');
		const compactHuman = identity.locator('[data-avatar-role="human"] [data-slot="avatar"]');
		await expect(compactAgent).toHaveCSS("width", "24px");
		await expect(compactHuman).toHaveCSS("width", "12px");
		await expect(thread.getByText("Did you check the account setup step?", { exact: true })).toBeVisible();
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
	await expect(thread.getByRole("button", { name: "Show replies", exact: true })).toBeVisible();
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
		const summary = thread.locator('[id][aria-hidden="false"]:has-text("Thread summary")');
		await expect(summary.getByText(/Annie asked Cursor to check account setup/u)).toBeVisible();
		await expect(summary.locator("[data-suggestion-text-reveal]")).toHaveCount(0);
		await expect(thread.locator('[data-summary-avatar-pair] [data-slot="human-agent-avatar"]')).toHaveAttribute("data-animated", "false");
		await thread.getByRole("button", { name: "Show replies", exact: true }).click();
	}
});
