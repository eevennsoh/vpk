import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("AI suggestions starts with an empty work item and opens the Rovo review list", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	const description = page.getByRole("textbox", { name: "Work item description" });
	const launcher = page.getByRole("button", { name: "Review AI suggestions" });
	const nudge = page.getByRole("button", { name: /^\d+ suggestions$/ });
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	const descriptionSuggestion = "Help merchants adopt Payments SDK v2 with a clear onboarding path";
	const animatedLogo = launcher.locator("svg linearGradient").first();
	await expect(animatedLogo).toBeAttached();
	await expect(description).toHaveText("");
	await expect(page.getByRole("heading", { name: "Improve merchant onboarding for Payments SDK v2" })).toBeVisible();
	await expect(nudge).toHaveText("6 suggestions");
	await expect(panel).toHaveCount(0);
	await expect(animatedLogo).not.toBeAttached();
	await launcher.focus();
	await expect(launcher).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	const opening = await launcher.evaluateHandle((button) => {
		const surface = button.closest(".fixed");
		if (!surface) throw new Error("The floating Rovo surface was not found");
		const launcherColor = getComputedStyle(surface).backgroundColor;
		const motion = {
			sawHiddenStackDuringExpansion: false,
			sawFannedStack: false,
			showedStackEarly: false,
			listRevealHeightRatio: 0,
			listRevealDelay: 0,
			visibleStackFrames: 0,
			openingHeight: 0,
			colorChangedDuringGrowth: false,
			dialogPaintedBackground: false,
			sampledListFrames: 0,
			finalHorizontalOffset: 0,
			minSecondRowGap: Number.MAX_VALUE,
			maxSecondRowGap: 0,
			overlappingShadowFrames: 0,
			sawVisibleOverlap: false,
			clippedAtTop: false,
			visibleFaceTransform: false,
			sawBlurReveal: false,
			sawRearBlur: false,
			sawBlankRearFace: false,
			headShadowChanged: false,
			done: false,
		};
		let firstPanelFrame: number | undefined;
		let firstShadow: string | undefined;
		const isBlurred = (style: CSSStyleDeclaration) => style.filter !== "none" && style.filter !== "blur(0px)";
		const castsShadow = (card: Element) => [...getComputedStyle(card).boxShadow.matchAll(/rgba?\(([^)]+)\)\s+([-\d.]+)px\s+([-\d.]+)px\s+([\d.]+)px/gu)]
			.some(([, color, x, y, blur]) => Number(color.split(",")[3] ?? 1) > 0.02 && [x, y, blur].some((value) => Number(value) !== 0));
		const measure = (now: number) => {
			const list = surface.querySelector('[role="list"][aria-label="Suggestions"]');
			const stack = surface.querySelector('[role="dialog"] [aria-roledescription="suggestion stack"]');
			const dialog = (list ?? stack)?.closest<HTMLElement>('[role="dialog"]');
			if (dialog?.offsetHeight) {
				firstPanelFrame ??= now;
				const heightRatio = dialog.getBoundingClientRect().height / dialog.offsetHeight;
				motion.dialogPaintedBackground ||= getComputedStyle(dialog).backgroundColor !== "rgba(0, 0, 0, 0)";
				if (stack && getComputedStyle(stack).visibility === "visible") motion.visibleStackFrames += 1;
				if (list) {
					if (motion.sampledListFrames === 0) {
						motion.listRevealHeightRatio = heightRatio;
						motion.listRevealDelay = now - firstPanelFrame;
					}
					const bounds = list.getBoundingClientRect();
					const cards = Array.from(list.querySelectorAll(':scope > [role="listitem"] > div'));
					const papers = cards.map((card) => card.getBoundingClientRect());
					const scrollportTop = list.closest("[data-scrollport]")?.getBoundingClientRect().top ?? bounds.top;
					motion.clippedAtTop ||= papers.slice(0, 3).some((paper) => paper.top < scrollportTop - 0.5);
					const headShadow = getComputedStyle(cards[0]).boxShadow;
					firstShadow ??= headShadow;
					motion.headShadowChanged ||= headShadow !== firstShadow;
					const faces = cards.flatMap((card) => {
						const face = card.querySelector("[data-suggestion-card-face]");
						return face ? [getComputedStyle(face)] : [];
					});
					const [faceStyle, ...rearFaces] = faces;
					if (faceStyle?.visibility === "visible" && Number(faceStyle.opacity) > 0) {
						motion.visibleFaceTransform ||= faceStyle.transform !== "none";
						motion.sawBlurReveal ||= isBlurred(faceStyle);
					}
					motion.sawRearBlur ||= rearFaces.some(isBlurred);
					motion.sawBlankRearFace ||= rearFaces.some((face) => face.visibility !== "visible" || Number(face.opacity) < 0.99);
					motion.finalHorizontalOffset = Math.max(0, ...papers.map((paper) =>
						Math.abs(paper.left + paper.right - bounds.left - bounds.right) / 2));
					if (papers[0] && papers[1]) {
						const rowGap = papers[1].top - papers[0].top;
						motion.minSecondRowGap = Math.min(motion.minSecondRowGap, rowGap);
						motion.maxSecondRowGap = Math.max(motion.maxSecondRowGap, rowGap);
						if (papers[1].top < papers[0].bottom - 1) {
							motion.sawVisibleOverlap ||= Number(getComputedStyle(cards[1]).opacity) > 0.1;
							if (castsShadow(cards[0]) && castsShadow(cards[1])) motion.overlappingShadowFrames += 1;
						}
					}
					motion.sampledListFrames += 1;
					if (motion.sampledListFrames >= 36 && faces.length === cards.length && faces.every((face) => face.opacity === "1")) {
						motion.done = true;
						return;
					}
				}
				if (stack && heightRatio < 0.94) {
					motion.openingHeight = dialog.offsetHeight;
					motion.colorChangedDuringGrowth ||= getComputedStyle(surface).backgroundColor !== launcherColor;
					motion.sawFannedStack ||= [...stack.querySelectorAll(':scope > [aria-hidden="true"] > div')].some((paper) => {
						const transform = getComputedStyle(paper).transform;
						return transform !== "none" && Math.abs(new DOMMatrixReadOnly(transform).b) > 0.01;
					});
					if (getComputedStyle(stack).visibility === "hidden") motion.sawHiddenStackDuringExpansion = true;
					else motion.showedStackEarly = true;
				}
			}
			requestAnimationFrame(measure);
		};
		requestAnimationFrame(measure);
		return motion;
	});
	await launcher.press("Enter");
	await expect(panel).toBeFocused();
	await expect(panel.getByRole("list", { name: "Suggestions", exact: true }).locator(':scope > [role="listitem"]')).toHaveCount(6);
	await expect(panel.getByText("Robi Lopez", { exact: true })).toBeVisible();
	await expect(panel.getByRole("button", { name: "Accept acceptance criteria", exact: true })).toBeVisible();
	await expect.poll(() => opening.evaluate((motion) => motion.done)).toBe(true);
	const entrance = await opening.jsonValue();
	expect(entrance.sawHiddenStackDuringExpansion).toBe(true);
	expect(entrance.sawFannedStack).toBe(true);
	expect(entrance.showedStackEarly).toBe(false);
	expect(entrance.listRevealHeightRatio).toBeGreaterThanOrEqual(0.998);
	expect(entrance.listRevealDelay).toBeLessThan(500);
	expect(entrance.visibleStackFrames).toBe(0);
	expect(entrance.finalHorizontalOffset).toBeLessThan(1);
	expect(entrance.maxSecondRowGap - entrance.minSecondRowGap).toBeGreaterThan(20);
	expect(entrance.sawVisibleOverlap).toBe(true);
	expect(entrance.overlappingShadowFrames).toBe(0);
	expect(entrance.clippedAtTop).toBe(false);
	expect(entrance.headShadowChanged).toBe(false);
	expect(entrance.visibleFaceTransform).toBe(false);
	expect(entrance.sawBlurReveal).toBe(true);
	expect(entrance.sawRearBlur).toBe(false);
	expect(entrance.sawBlankRearFace).toBe(false);
	expect(entrance.openingHeight).toBe(await panel.evaluate((dialog: HTMLElement) => dialog.offsetHeight));
	expect(entrance.colorChangedDuringGrowth).toBe(true);
	expect(entrance.dialogPaintedBackground).toBe(false);
	await expect.poll(() => panel.evaluate((dialog) => {
		const surface = dialog.closest(".fixed");
		if (!surface) throw new Error("The floating Rovo surface was not found");
		const style = getComputedStyle(surface);
		const reference = document.createElement("span");
		reference.style.boxShadow = "var(--ds-shadow-overlay)";
		surface.append(reference);
		const overlayShadow = getComputedStyle(reference).boxShadow;
		reference.remove();
		return {
			border: style.borderWidth,
			outline: style.outlineStyle,
			radius: style.borderRadius,
			usesOverlayShadow: overlayShadow !== "none" && style.boxShadow === overlayShadow,
		};
	})).toEqual({ border: "0px", outline: "none", radius: "8px", usesOverlayShadow: true });
	await expect(panel.getByRole("button", { name: /^Show as (stack|list)$/ })).toHaveCount(0);
	await expect(panel.getByRole("button", { name: "Check for new suggestions" })).toHaveCount(0);
	await expect(panel.getByRole("button", { name: /^Why .+ was suggested$/ })).toHaveCount(0);
	const acceptDescription = panel.getByRole("button", { name: "Accept description", exact: true });
	const descriptionActions = acceptDescription.locator("..");
	const assigneeActions = panel.getByRole("button", { name: "Accept assignee", exact: true }).locator("..");
	await expect(descriptionActions).toHaveCSS("opacity", "0");
	await expect(assigneeActions).toHaveCSS("opacity", "0");
	await panel.getByText(/^Help merchants adopt Payments SDK v2/).hover();
	await expect(descriptionActions).toHaveCSS("opacity", "1");
	await expect(assigneeActions).toHaveCSS("opacity", "0");
	await page.mouse.move(0, 0);
	await expect(descriptionActions).toHaveCSS("opacity", "0");
	await panel.getByRole("button", { name: "Dismiss description", exact: true }).focus();
	await page.keyboard.press("Tab");
	await expect(acceptDescription).toBeFocused();
	await expect(descriptionActions).toHaveCSS("opacity", "1");
	await page.keyboard.press("Enter");
	await expect(description).toContainText(descriptionSuggestion);
	await page.keyboard.press("Escape");
	await expect(panel).toHaveCount(0);
	await expect(launcher).toBeFocused();
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await expect(launcher).toBeHidden();
	await expect(page.getByRole("button", { name: "Open Rovo chat", exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await expect(description).toContainText(descriptionSuggestion);
	await page.getByRole("button", { name: "Reset", exact: true }).click();
	await expect(description).toHaveText("");
	await expect(nudge).toBeVisible();
	const viewport = page.viewportSize();
	await nudge.click();
	await page.setViewportSize({ width: 1280, height: 720 });
	await expect(panel.getByRole("list", { name: "Suggestions", exact: true })).toBeVisible();
	if (viewport) await page.setViewportSize(viewport);
	await panel.getByRole("button", { name: "Accept all", exact: true }).click();
	await expect(panel).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Open Rovo chat", exact: true })).toBeFocused();
	await expect(page.getByText("All caught up", { exact: true })).toHaveCount(0);
	await expect(description).toContainText(descriptionSuggestion);
	await expect(page.getByRole("button", { name: "Change assignee" })).toContainText("Robi Lopez");
	await expect(page.getByRole("region", { name: "Acceptance criteria" }).getByRole("listitem")).toHaveCount(3);
	await page.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	const firstPrompt = chat.getByRole("button", { name: /^(Suggest work item fields|Find related RFPs)/ }).first();
	await expect(firstPrompt).toHaveAccessibleName("Suggest work item fields");
	await expect(firstPrompt.locator("svg")).toBeVisible();
	await expect(chat.getByRole("button", { name: /Last 7 days of work/ })).toHaveCount(0);
	await firstPrompt.click();
	await expect(chat).toHaveCount(0);
	await expect(panel.getByText("All caught up", { exact: true })).toBeVisible();
	await expect(description).toContainText(descriptionSuggestion);
});

test("Suggest work item fields brings dismissed suggestions back for review", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review AI suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	await panel.getByRole("button", { name: "Dismiss all", exact: true }).click();
	await page.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	await chat.getByRole("button", { name: "Suggest work item fields", exact: true }).click();
	await expect(chat).toHaveCount(0);
	await expect(panel).toBeFocused();
	await expect(panel.getByRole("list", { name: "Suggestions", exact: true }).locator(':scope > [role="listitem"]')).toHaveCount(6);
	await expect(panel.getByRole("button", { name: /^Accept (?!all)/ })).toHaveCount(6);
	await expect(page.getByRole("textbox", { name: "Work item description" })).toHaveText("");
});

test("wheel input over a suggestion's text scrolls the review list", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review AI suggestions" }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	const list = panel.getByRole("list", { name: "Suggestions", exact: true });
	const scrollport = panel.locator("[data-scrollport]");
	await expect.poll(() => scrollport.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
	await list.getByText(/^Help merchants adopt Payments SDK v2/).hover();
	await page.mouse.wheel(0, 900);
	await expect.poll(() => scrollport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await expect(list.getByRole("button", { name: "Accept acceptance criteria" })).toBeInViewport();
});

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const card = (page: Page, key: string) => page.locator(`[data-issue-key="${key}"][data-board-column-title]`);

test("the work item starts with Cursor and Jira Coding agent sessions", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	const field = workItem.getByRole("group", { name: "Agents field" });
	await expect(field.getByRole("button", { name: "2 agents" })).toBeVisible();
	await expect(field.getByRole("button", { name: "Cursor, add agent" })).toBeAttached();
	await expect(field.getByRole("button", { name: "Jira Coding agent, add agent" })).toBeAttached();
	await expect(field.getByRole("button", { name: /Claude|Jira Scoping agent/ })).toHaveCount(0);
	await expect(workItem.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]')).toContainText("Review the onboarding flow");
	await expect(workItem.locator('[data-jira-activity-entry-id="invocation-butter-claude"]')).toHaveCount(0);
	await expect(workItem.locator('[data-jira-activity-entry-id="invocation-butter-scoping"]')).toHaveCount(0);
});

test("starting an agent adds a long-form session card to its activity thread", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const workItem = page.getByRole("region", { name: "Work item full screen view" });
	await workItem.getByRole("group", { name: "Agents field" }).getByRole("button", { name: "2 agents" }).click();
	await page.getByRole("dialog", { name: "Add agent" }).getByRole("button", { name: "Figma", exact: true }).click();
	const activity = workItem.getByRole("region", { name: "Activity" });
	const session = activity.locator("[data-project-butter-session-start]").first();
	const sessionHeader = session.locator('xpath=ancestor::*[@data-jira-activity-entry-id][1]').locator('[data-slot="jira-activity-comment-header"]').first();
	await expect(sessionHeader).toContainText("Venn added Figma");
	await expect(activity.locator('[data-jira-activity-entry-id^="agent-added-"]')).toHaveCount(0);
	await expect(session.getByRole("button", { name: "Private to Venn" })).toHaveCount(0);
	await expect(session.locator('xpath=ancestor::*[@data-jira-activity-entry-id][1]').locator('[data-slot="human-agent-avatar"]').first()).toHaveAttribute("aria-label", "Figma, used by Venn");
	await expect(session).toContainText("Redesign onboarding flow for new users");
	await expect(session).toContainText("Figma");
	await expect(session.getByRole("button", { name: "Working", exact: true })).toBeAttached();
	await expect(session.locator("[data-agent-list-title]")).toHaveText("Redesign onboarding flow for new users");
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	const reply = chat.getByRole("textbox", { name: "Chat message input" });
	await session.getByRole("button", { name: /^Redesign onboarding flow for new users/ }).click();
	await expect(reply).toBeVisible();
	await expect(chat.getByRole("log")).toContainText("Redesign onboarding flow for new users");
	await chat.getByRole("button", { name: "Close", exact: true }).click();
	await expect(reply).toHaveCount(0);
	await session.getByRole("button", { name: /^Redesign onboarding flow for new users/ }).click();
	await expect(reply).toBeVisible();
});

test("reply disclosure icon has no background on the hovered activity row", async ({ page }) => {
	await page.goto(appUrl("/preview/projects/butter-v1?embedded=1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]');
	const toggle = thread.getByRole("button", { name: /Show 4 more replies/ });
	await toggle.hover();
	const icon = thread.locator('button[aria-controls] > span[aria-hidden]');
	// The icon keeps a surface fill that masks the timeline; on the hovered row it is painted with the row's hover color so no separate box shows.
	const matchesHoveredRow = () => icon.evaluate((element) => {
		const rowHover = getComputedStyle(element.closest("li")!, "::after").backgroundColor;
		return rowHover !== "rgba(0, 0, 0, 0)" && getComputedStyle(element).backgroundImage === `linear-gradient(in oklab, ${rowHover} 0px, ${rowHover} 100%)`;
	});
	await expect.poll(matchesHoveredRow).toBe(true);
	await toggle.click();
	await expect(page.getByRole("button", { name: "Hide replies" })).toHaveAttribute("aria-expanded", "true");
	await expect.poll(matchesHoveredRow).toBe(true);
});

test("activity timeline dots are centered on the dashed line", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-999").locator('[data-slot="jira-issue-card"]').click();
	const rail = page.getByRole("listbox", { name: "Navigate activity" });
	await expect(rail).toBeVisible();
	const line = rail.locator(":scope > span").first();
	const dot = rail.locator('[data-slot="scrubber-playhead"]');
	await expect.poll(async () => {
		const [lineBox, dotBox] = await Promise.all([line.boundingBox(), dot.boundingBox()]);
		return lineBox && dotBox ? Math.abs(lineBox.y + lineBox.height / 2 - dotBox.y - dotBox.height / 2) : null;
	}).toBeLessThan(0.1);
});

test("the Butter board work item combines comments and changes under Activity", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-999").locator('[data-slot="jira-issue-card"]').click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	const activity = dialog.getByRole("region", { name: "Activity" });
	await expect(activity.getByRole("heading", { name: "Activity" })).toBeVisible();
	await expect(dialog.getByRole("tablist", { name: "Activity views" })).toHaveCount(0);
	const summary = dialog.getByRole("textbox", { name: "Work item summary" });
	await summary.fill("Improve onboarding for merchants");
	await summary.press("Enter");
	await expect(activity).toContainText("updated summary");
	await page.keyboard.press("m");
	const comment = dialog.getByRole("textbox", { name: "Comment editor" });
	await comment.fill("Ready for review");
	await comment.press("Enter");
	await expect(activity).toContainText("Ready for review");
	await expect(activity).toContainText("updated summary");
});

test("empty activity starts with who created the work item and places the comment bar 24 pixels below it", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/jira-work-item#project-butter"));
	await page.getByRole("switch", { name: "Empty" }).check();
	await page.getByRole("button", { name: "Modal", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	const tabs = dialog.locator('[data-jira-activity-entry-id="butter-empty-created"]');
	await expect(tabs).toContainText("created this work item");
	const comment = dialog.locator("[data-project-butter-comment-editor]");
	await expect(comment).toBeVisible();
	await expect.poll(async () => {
		const [tabsBox, commentBox] = await Promise.all([tabs.boundingBox(), comment.boundingBox()]);
		return tabsBox && commentBox ? commentBox.y - (tabsBox.y + tabsBox.height) : null;
	}).toBe(24);
});

test("short work item activity ends without a viewport of blank space", async ({ page }) => {
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-118").locator('[data-slot="jira-issue-card"]').click();
	const feed = page.locator("[data-project-butter-activity-feed]");
	await expect(feed.locator("[data-jira-activity-entry-id]").last()).toBeVisible();
	await expect.poll(() => feed.evaluate((element) => {
		const last = element.querySelectorAll("[data-jira-activity-entry-id]");
		return element.getBoundingClientRect().bottom - last[last.length - 1].getBoundingClientRect().bottom;
	})).toBeLessThan(64);
});

test("the first work item opens without waiting for additional JavaScript", async ({ page }) => {
	test.setTimeout(60_000);
	await page.goto(appUrl("/butter"));
	const board = page.locator("[data-butter-board-surface]");
	await expect(board).toBeVisible({ timeout: 30_000 });
	await page.evaluate(() => {
		Object.assign(window, { workItemEntryTransitions: [] as string[] });
		document.addEventListener("transitionrun", (event) => {
			if (event.target instanceof HTMLElement && event.target.matches('[role="dialog"][data-slot="dialog-content"]')) {
				(window as typeof window & { workItemEntryTransitions: string[] }).workItemEntryTransitions.push(event.propertyName);
			}
		}, true);
	});
	let releaseChunks!: () => void;
	const chunksReleased = new Promise<void>((resolve) => { releaseChunks = resolve; });
	await page.route("**/_next/static/**/*.js", async (route) => {
		await chunksReleased;
		await route.continue();
	});
	try {
		await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
		await expect(page.getByRole("dialog", { name: "Project butter" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Port confirmPaymentIntent and the 3-D Secure challenge flow" })).toBeVisible();
		await expect(page.getByText("Opening work item", { exact: false })).toHaveCount(0);
	} finally {
		releaseChunks();
	}
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeVisible();
	await expect.poll(() => page.evaluate(() => (window as typeof window & { workItemEntryTransitions: string[] }).workItemEntryTransitions)).toContain("opacity");
	await page.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeHidden();
	await page.evaluate(() => { (window as typeof window & { workItemEntryTransitions: string[] }).workItemEntryTransitions = []; });
	await card(page, "PAY-107").locator('[data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("heading", { name: "Move retry and backoff out of LegacyGatewayAdapter" })).toBeVisible();
	await expect.poll(() => page.evaluate(() => (window as typeof window & { workItemEntryTransitions: string[] }).workItemEntryTransitions)).toContain("opacity");
});

test("the first work item opens without motion when reduced motion is requested", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	const dialog = page.getByRole("dialog", { name: "Project butter" });
	await expect(dialog).toBeVisible();
	await expect(dialog).toHaveCSS("transition-property", "none");
	await expect(dialog).toHaveCSS("opacity", "1");
});

test("opening work items leaves every synced session visible after overlapping arrivals", async ({ page }) => {
	test.setTimeout(240_000);
	await page.goto(appUrl("/butter"));
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible();
	const column = page.locator("[data-agent-session-column]");
	await expect(column.locator('[data-testid^="agent-session-row-"]').first()).toBeAttached();
	await card(page, "PAY-105").locator('[data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeVisible();
	await page.getByRole("button", { name: "Close Project butter work item" }).click();
	await expect(page.locator("[data-butter-board-surface]")).toHaveAttribute("data-agent-session-sync", "settled", { timeout: 220_000 });
	await expect.poll(() => column.locator('[data-testid^="agent-session-row-"]').evaluateAll((rows) => rows.filter((row) => {
		const style = getComputedStyle(row);
		return Number(style.opacity) < 0.99 || style.visibility !== "visible";
	}).length), { timeout: 10_000 }).toBe(0);
	await expect(column.locator('[data-testid^="agent-session-row-"]')).toHaveCount(48);
	await card(page, "PAY-107").locator('[data-slot="jira-issue-card"]').click();
	await expect(page.getByRole("heading", { name: "Move retry and backoff out of LegacyGatewayAdapter" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog", { name: "Project butter" })).toBeHidden();
	await expect(column.locator('[data-testid^="agent-session-row-"]')).toHaveCount(48);
});
