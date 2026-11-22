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
	await expect(nudge).toHaveText("5 suggestions");
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
			listRevealWidthRatio: 0,
			listRevealDelay: 0,
			visibleStackFrames: 0,
			openingHeight: 0,
			colorChangedDuringGrowth: false,
			sawLogoDuringExpansion: false,
			dialogPaintedBackground: false,
			sampledListFrames: 0,
			maxHorizontalOffset: 0,
			minSecondRowGap: Number.MAX_VALUE,
			maxSecondRowGap: 0,
			overlappingShadowFrames: 0,
			sawVisibleOverlap: false,
			clippedAtTop: false,
			lostHeadContent: false,
			sawRearBlur: false,
			sawBlankRearFace: false,
			done: false,
		};
		let firstPanelFrame: number | undefined;
		const isBlurred = (style: CSSStyleDeclaration) => style.filter !== "none" && style.filter !== "blur(0px)";
		const castsShadow = (card: Element) => [...getComputedStyle(card).boxShadow.matchAll(/rgba?\(([^)]+)\)\s+([-\d.]+)px\s+([-\d.]+)px\s+([\d.]+)px/gu)]
			.some(([, color, x, y, blur]) => Number(color.split(",")[3] ?? 1) > 0.02 && [x, y, blur].some((value) => Number(value) !== 0));
		const measure = (now: number) => {
			const list = surface.querySelector('[role="list"][aria-label="Suggestions"]');
			const stack = surface.querySelector('[role="dialog"] [aria-roledescription="suggestion stack"]');
			const dialog = (list ?? stack)?.closest<HTMLElement>('[role="dialog"]');
			if (dialog?.offsetHeight) {
				firstPanelFrame ??= now;
				const dialogBounds = dialog.getBoundingClientRect();
				const heightRatio = dialogBounds.height / dialog.offsetHeight;
				motion.dialogPaintedBackground ||= getComputedStyle(dialog).backgroundColor !== "rgba(0, 0, 0, 0)";
				if (stack && getComputedStyle(stack).visibility === "visible") motion.visibleStackFrames += 1;
				if (list) {
					if (motion.sampledListFrames === 0) {
						motion.listRevealHeightRatio = heightRatio;
						motion.listRevealWidthRatio = dialogBounds.width / dialog.offsetWidth;
						motion.listRevealDelay = now - firstPanelFrame;
					}
					const bounds = list.getBoundingClientRect();
					const cards = Array.from(list.querySelectorAll(':scope > [role="listitem"] > div'));
					const papers = cards.map((card) => card.getBoundingClientRect());
					const scrollportTop = list.closest("[data-scrollport]")?.getBoundingClientRect().top ?? bounds.top;
					motion.clippedAtTop ||= papers.some((paper, index) =>
						Number(getComputedStyle(cards[index]).opacity) > 0.1 && paper.top < scrollportTop - 0.5);
					const faces = cards.flatMap((card) => {
						const face = card.querySelector("[data-suggestion-card-face]");
						return face ? [getComputedStyle(face)] : [];
					});
					const [faceStyle, ...rearFaces] = faces;
					motion.lostHeadContent ||= faceStyle?.visibility !== "visible" || faceStyle.opacity !== "1" || isBlurred(faceStyle);
					motion.sawRearBlur ||= rearFaces.some(isBlurred);
					motion.sawBlankRearFace ||= rearFaces.some((face) => face.visibility !== "visible" || Number(face.opacity) < 0.99);
					motion.maxHorizontalOffset = Math.max(motion.maxHorizontalOffset, ...papers.map((paper) =>
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
					const logo = surface.querySelector('button[aria-label="Review AI suggestions"] svg');
					motion.sawLogoDuringExpansion ||= logo?.checkVisibility({ opacityProperty: true, visibilityProperty: true }) ?? false;
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
	await expect(panel.getByRole("list", { name: "Suggestions", exact: true }).locator(':scope > [role="listitem"]')).toHaveCount(5);
	await expect(panel.getByText("Robi Lopez", { exact: true })).toBeVisible();
	await expect(panel.getByText("Acceptance criteria", { exact: true })).toHaveCount(0);
	await expect.poll(() => opening.evaluate((motion) => motion.done)).toBe(true);
	const entrance = await opening.jsonValue();
	expect(entrance.sawHiddenStackDuringExpansion).toBe(true);
	expect(entrance.sawFannedStack).toBe(true);
	expect(entrance.showedStackEarly).toBe(false);
	expect(entrance.listRevealHeightRatio).toBeGreaterThanOrEqual(0.998);
	expect(entrance.listRevealWidthRatio).toBeGreaterThanOrEqual(0.998);
	expect(entrance.listRevealDelay).toBeLessThan(500);
	expect(entrance.visibleStackFrames).toBe(0);
	expect(entrance.maxHorizontalOffset).toBeLessThan(1);
	expect(entrance.maxSecondRowGap - entrance.minSecondRowGap).toBeGreaterThan(20);
	expect(entrance.sawVisibleOverlap).toBe(true);
	expect(entrance.overlappingShadowFrames).toBe(0);
	expect(entrance.clippedAtTop).toBe(false);
	expect(entrance.lostHeadContent).toBe(false);
	expect(entrance.sawRearBlur).toBe(false);
	expect(entrance.sawBlankRearFace).toBe(true);
	expect(await panel.evaluate((dialog: HTMLElement) => dialog.offsetHeight)).toBe(entrance.openingHeight);
	expect(entrance.colorChangedDuringGrowth).toBe(true);
	expect(entrance.sawLogoDuringExpansion).toBe(false);
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
	await expect(page.getByRole("region", { name: "Acceptance criteria" })).toHaveCount(0);
	await page.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	const firstPrompt = chat.getByRole("button", { name: /^(Suggest work item fields|Find related RFPs)/ }).first();
	await expect(firstPrompt).toHaveAccessibleName("Suggest work item fields");
	await expect(firstPrompt.locator("svg")).toBeVisible();
	await expect(chat.getByRole("button", { name: /Last 7 days of work/ })).toHaveCount(0);
	await firstPrompt.click();
	await expect(chat).toHaveCount(0);
	await expect(panel.getByText("All caught up", { exact: true })).toBeVisible();
	const checkAgain = panel.getByRole("button", { name: "Check again", exact: true });
	await expect.poll(async () => {
		const [surface, action] = await Promise.all([panel.boundingBox(), checkAgain.boundingBox()]);
		return surface && action ? surface.y + surface.height - action.y - action.height : Infinity;
	}).toBeLessThanOrEqual(32);
	await expect(description).toContainText(descriptionSuggestion);
});

test("floating suggestions use neutral previews and reveal individual accepts inline", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions" }).click();
	const details = page.getByRole("button", { name: "Details", exact: true });
	await details.click();
	await expect(details).toHaveAttribute("aria-expanded", "false");
	await page.getByRole("button", { name: "Review AI suggestions" }).click();
	await expect(details).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByRole("button", { name: "Show less details" })).toBeVisible();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	const { hoverColor, previewColor } = await panel.evaluate((dialog) => {
		const swatch = document.createElement("span");
		swatch.style.backgroundColor = "var(--ds-surface-overlay-hovered)";
		dialog.append(swatch);
		const hoverColor = getComputedStyle(swatch).backgroundColor;
		swatch.style.backgroundColor = "var(--ds-surface-sunken)";
		const previewColor = getComputedStyle(swatch).backgroundColor;
		swatch.remove();
		return { hoverColor, previewColor };
	});
	const card = panel.locator('[data-suggestion-field="assignee"]');
	const field = page.locator('[data-field-id="assignee"]');
	const assigneeControl = field.getByRole("button", { name: "Change assignee" });
	const watchIcon = async (source: typeof field) => {
		const original = await source.evaluateHandle((icon) => {
			const row = icon.closest("[data-project-butter-detail-value-row]")!.getBoundingClientRect();
			const bounds = icon.getBoundingClientRect();
			return { icon, x: bounds.x - row.x, y: bounds.y - row.y };
		});
		return async () => expect.poll(() => source.evaluate((icon, before) => {
			const row = icon.closest("[data-project-butter-detail-value-row]")!.getBoundingClientRect();
			const bounds = icon.getBoundingClientRect();
			return before.icon === icon && Math.abs(bounds.x - row.x - before.x) < 0.25 && Math.abs(bounds.y - row.y - before.y) < 0.25;
		}, original)).toBe(true);
	};
	const assigneeIconStayed = await watchIcon(assigneeControl.locator("svg"));
	await card.hover();
	const preview = field.locator('[data-suggestion-preview="assignee"]');
	await expect(preview).toHaveText("Robi Lopez");
	await expect(preview.locator("svg")).toHaveCount(0);
	await assigneeIconStayed();
	await expect(preview.getByText("Robi Lopez")).toHaveCSS("font-size", await assigneeControl.getByText("Unassigned").evaluate((element) => getComputedStyle(element).fontSize));
	const highlight = page.locator("[data-suggestion-preview-highlight]");
	await expect(highlight).toHaveAttribute("data-suggestion-preview-field", "assignee");
	await expect(highlight).toHaveCSS("background-color", previewColor);
	await expect(highlight).toHaveCSS("box-shadow", "none");
	await expect(highlight).toHaveCSS("opacity", "1");
	const outline = highlight.locator("[data-suggestion-preview-outline] rect");
	await expect(outline).toBeVisible();
	await expect(outline).toHaveAttribute("stroke-dasharray", "5 4");
	await expect(card.locator(":scope > div")).toHaveCSS("background-color", hoverColor);
	await expect(assigneeControl).toContainText("Unassigned");
	const dateControl = page.getByRole("button", { name: "Change due date", exact: true });
	const dateIconStayed = await watchIcon(dateControl.locator("svg"));
	const parentIconStayed = await watchIcon(page.locator('[data-field-icon="parent"] svg'));
	const dateRow = page.locator('[data-field-id="dueDate"] [data-project-butter-detail-value-row]');
	await panel.getByRole("list", { name: "Suggestions" }).dispatchEvent("pointerover", { pointerType: "mouse" });
	await expect(highlight).toHaveAttribute("data-suggestion-preview-field", "assignee");
	const originalHighlight = await highlight.elementHandle();
	const highlightTravel = await dateRow.evaluateHandle((row) => {
		const samples: { offset: number; opacity: number }[] = [];
		const rail = row.closest("[data-project-butter-detail-fields]");
		const deadline = performance.now() + 2000;
		const sample = (now: number) => {
			const highlight = rail?.querySelector('[data-suggestion-preview-highlight][data-suggestion-preview-field="dueDate"]');
			if (highlight) samples.push({
				offset: highlight.getBoundingClientRect().top - row.getBoundingClientRect().top,
				opacity: Number(getComputedStyle(highlight).opacity),
			});
			if (now < deadline) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
		return samples;
	});
	await panel.locator('[data-suggestion-field="dueDate"]').hover();
	await expect(highlight).toHaveAttribute("data-suggestion-preview-field", "dueDate");
	expect(await highlight.evaluate((marker, previous) => marker === previous, originalHighlight)).toBe(true);
	await originalHighlight?.dispose();
	await expect.poll(() => highlightTravel.evaluate((samples) => samples.some(({ offset }) => offset < -4))).toBe(true);
	await expect.poll(() => highlightTravel.evaluate((samples) => Math.abs(samples.at(-1)?.offset ?? Infinity))).toBeLessThan(0.5);
	expect(await highlightTravel.evaluate((samples) => samples.every(({ opacity }) => opacity === 1))).toBe(true);
	await highlightTravel.dispose();
	await assigneeIconStayed();
	const datePreview = page.locator('[data-suggestion-preview="dueDate"]');
	await expect(datePreview).toHaveText("Dec 15, 2026");
	await expect(datePreview.locator("svg")).toHaveCount(0);
	await dateIconStayed();
	await expect(datePreview.getByText("Dec 15, 2026")).toHaveCSS("font-size", await dateControl.getByText("Add due date").evaluate((element) => getComputedStyle(element).fontSize));
	await expect.poll(async () => {
		const [target, dialog] = await Promise.all([datePreview.boundingBox(), panel.boundingBox()]);
		return target && dialog ? target.y + target.height <= dialog.y : false;
	}).toBe(true);
	await panel.locator('[data-suggestion-field="parent"]').hover();
	await expect(page.locator('[data-suggestion-preview="parent"]')).toContainText("PAY-100");
	await expect(datePreview).toHaveCount(0);
	await parentIconStayed();
	await dateIconStayed();
	await page.mouse.move(0, 0);
	await expect(page.locator('[data-suggestion-preview="parent"]')).toHaveCount(0);
	await expect(highlight).toHaveCSS("opacity", "0");
	await parentIconStayed();
	const descriptionEditor = page.getByRole("group", { name: "Description editor" });
	const descriptionLayout = async () => {
		const [editor, activity] = await Promise.all([
			descriptionEditor.boundingBox(),
			page.getByRole("heading", { name: "Activity", exact: true }).boundingBox(),
		]);
		return editor && activity ? { height: editor.height, activityOffset: activity.y - editor.y } : null;
	};
	const beforePreview = await descriptionLayout();
	if (!beforePreview) throw new Error("Description and Activity must be laid out before preview");
	const resize = await descriptionEditor.evaluateHandle((editor) => {
		const heights: number[] = [];
		const observer = new ResizeObserver(([entry]) => heights.push(entry.contentRect.height));
		observer.observe(editor);
		return { heights, observer };
	});
	await panel.getByRole("button", { name: "Accept description", exact: true }).focus();
	const descriptionPreview = page.getByRole("region", { name: "Description", exact: true }).locator("[data-suggestion-preview]");
	await expect(descriptionPreview).toBeVisible();
	const previewText = descriptionPreview.locator(":scope > span");
	await expect(previewText).toHaveCSS("-webkit-line-clamp", "3");
	expect(await previewText.evaluate((text) => text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight))).toBeGreaterThanOrEqual(2);
	await expect.poll(() => descriptionPreview.evaluate((preview) => {
		const editor = preview.closest('[aria-label="Description editor"]')!.getBoundingClientRect();
		const bounds = preview.getBoundingClientRect();
		return bounds.top >= editor.top && bounds.bottom <= editor.bottom;
	})).toBe(true);
	const expanded = await descriptionLayout();
	if (!expanded) throw new Error("Description preview must remain in the work item layout");
	expect(expanded.activityOffset - beforePreview.activityOffset).toBeCloseTo(expanded.height - beforePreview.height, 0);
	expect(expanded.height).toBeGreaterThan(beforePreview.height);
	const openingFrames = await resize.evaluate(({ heights }) => heights.length);
	await expect(field.locator("[data-suggestion-preview]")).toHaveCount(0);
	await panel.getByRole("button", { name: "Accept assignee", exact: true }).focus();
	await expect(descriptionPreview).toHaveCount(0);
	await expect.poll(descriptionLayout).toEqual(beforePreview);
	const heights = await resize.evaluate(({ heights, observer }) => {
		observer.disconnect();
		return heights;
	});
	const isBetween = (height: number) => height > beforePreview.height + 1 && height < expanded.height - 1;
	expect(heights.slice(0, openingFrames).some(isBetween)).toBe(true);
	expect(heights.slice(openingFrames).some(isBetween)).toBe(true);
	const cursorHistory = await field.evaluateHandle(() => {
		const seen = { cursor: false };
		const selector = "[data-project-butter-suggestion-cursor]";
		const observer = new MutationObserver((records) => {
			seen.cursor ||= records.some((record) => Array.from(record.addedNodes).some((node) =>
				node instanceof Element && (node.matches(selector) || node.querySelector(selector) !== null)));
		});
		observer.observe(document.body, { childList: true, subtree: true });
		return { seen, observer };
	});
	await card.getByRole("button", { name: "Accept assignee" }).click();
	const reveal = field.locator("[data-suggestion-text-reveal]");
	await expect(reveal).toBeVisible();
	const unassignedAvatar = assigneeControl.locator('[data-unassigned="person"]');
	await expect(unassignedAvatar).toBeVisible();
	const revealingName = await reveal.getByText("Robi", { exact: true }).first().boundingBox();

	const labelAtSweepEnd = await reveal.evaluate((text) => new Promise<{ opacity: string; transform: string }>((resolve, reject) => {
		const outgoing = text.parentElement!;
		const incoming = outgoing.parentElement!.querySelector("[data-project-butter-field-control]")!;
		const deadline = performance.now() + 4000;
		function sample(now: number) {
			if (!outgoing.isConnected) {
				const { opacity, transform } = getComputedStyle(incoming);
				return resolve({ opacity, transform });
			}
			if (now > deadline) return reject(new Error("The assignee reveal did not finish"));
			requestAnimationFrame(sample);
		}
		requestAnimationFrame(sample);
	}));
	expect(labelAtSweepEnd).toEqual({ opacity: "1", transform: "none" });
	await expect(reveal).toHaveCount(0, { timeout: 8000 });
	const finalNameControl = assigneeControl.locator("[data-project-butter-field-control]");
	await expect.poll(() => finalNameControl.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)).toBe(0);
	const finalName = await finalNameControl.evaluate((element) => {
		const text = document.createRange();
		text.selectNodeContents(element);
		return text.getBoundingClientRect().toJSON();
	});
	if (!revealingName) throw new Error("The assignee name is missing during the reveal");
	expect(Math.abs(revealingName.x - finalName.x)).toBeLessThan(1);
	expect(Math.abs(revealingName.y - finalName.y)).toBeLessThan(1);
	await expect(unassignedAvatar).toHaveCount(0);
	await expect(field.getByRole("button", { name: "Change assignee" })).toContainText("Robi Lopez");
	expect(await cursorHistory.evaluate(({ seen, observer }) => {
		observer.disconnect();
		return seen.cursor;
	})).toBe(false);
	await panel.getByRole("button", { name: "Close suggestions" }).click();
	await expect(page.locator("[data-suggestion-preview]")).toHaveCount(0);
});

test("accepting suggestions adds fields to one Activity entry", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review AI suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	const activity = page.getByRole("region", { name: "Activity", exact: true });
	const updates = activity.getByRole("button", { name: /Venn\s*updated/ });
	for (const [field, summary] of [
		["assignee", "updated assignee"],
		["description", "updated assignee and description"],
		["due date", "updated assignee, description, and due date"],
		["labels", "updated assignee, description, due date, and labels"],
	]) {
		await panel.getByRole("button", { name: `Accept ${field}`, exact: true }).press("Enter");
		await expect(updates).toHaveCount(1);
		await expect(updates).toContainText(summary);
	}
	await panel.getByRole("button", { name: "Undo due date", exact: true }).press("Enter");
	await expect(updates).toHaveCount(1);
	await expect(updates).toContainText("updated assignee, description, and labels");
});

test("Check again finds different suggestions for the remaining empty fields", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
	await page.getByRole("button", { name: "Review AI suggestions", exact: true }).click();
	const panel = page.getByRole("dialog", { name: /^Work item suggestions/ });
	const list = panel.getByRole("list", { name: "Suggestions", exact: true });
	const footer = panel.locator("footer");
	const description = page.getByRole("textbox", { name: "Work item description" });
	const openCaughtUp = async () => {
		await page.getByRole("button", { name: "Open Rovo chat", exact: true }).click();
		await page.getByRole("button", { name: "Suggest work item fields", exact: true }).click();
		await expect(panel.getByText("All caught up", { exact: true })).toBeVisible();
	};
	const recheck = async () => {
		const opening = await panel.evaluateHandle((dialog) => {
			const samples = { sawStack: false, interactiveOverlap: false, heights: [] as number[], gaps: [] as number[] };
			const deadline = performance.now() + 6000;
			const sample = (now: number) => {
				samples.sawStack ||= dialog.querySelector('[aria-roledescription="suggestion stack"] [data-top-card]') !== null;
				const list = dialog.querySelector('[role="list"][aria-label="Suggestions"]');
				if (list && getComputedStyle(list).visibility === "visible") {
					const [lead, next] = list.querySelectorAll(':scope > [role="listitem"] > div');
					if (lead && next) {
						const gap = next.getBoundingClientRect().top - lead.getBoundingClientRect().bottom;
						samples.heights.push(dialog.getBoundingClientRect().height);
						samples.gaps.push(gap);
						samples.interactiveOverlap ||= gap < 0 && getComputedStyle(next).pointerEvents !== "none";
					}
				}
				if (samples.gaps.length < 30 && now < deadline) requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
			return samples;
		});
		await panel.getByRole("button", { name: "Check again", exact: true }).press("Enter");
		await expect(panel.getByText("Checking for anything new…")).toBeVisible();
		await expect.poll(() => opening.evaluate((samples) => samples.gaps.length)).toBe(30);
		const { sawStack, interactiveOverlap, heights, gaps } = await opening.jsonValue();
		expect(sawStack).toBe(true);
		expect(interactiveOverlap).toBe(false);
		expect(Math.min(...gaps)).toBeLessThan(-20);
		expect(gaps.at(-1)).toBeGreaterThan(5);
		expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
		await expect(list).toHaveCSS("pointer-events", "auto");
		await expect(list.getByText("New", { exact: true })).toHaveCount(0);
	};
	await panel.getByRole("button", { name: "Accept all", exact: true }).click();
	await expect(description).toContainText("Help merchants adopt Payments SDK v2");
	await openCaughtUp();

	await recheck();
	await expect(list.getByRole("button", { name: "Accept components", exact: true })).toBeVisible();
	await expect(list.getByRole("button", { name: "Accept fix version", exact: true })).toBeVisible();
	await expect(list.getByRole("listitem")).toHaveCount(2);
	await expect(footer).toContainText("0 of 2 reviewed");
	await expect.poll(async () => {
		const [cards, footerBounds] = await Promise.all([list.boundingBox(), footer.boundingBox()]);
		return cards && footerBounds ? footerBounds.y - cards.y - cards.height : Infinity;
	}).toBeCloseTo(16, 0);
	await expect(list.getByText("Payments SDK", { exact: true })).toBeVisible();
	await expect(panel).toBeFocused();
	await list.getByRole("button", { name: "Accept components", exact: true }).press("Enter");
	await expect(footer).toContainText("1 of 2 reviewed");
	await list.getByRole("button", { name: "Undo components", exact: true }).press("Enter");
	await expect(list.getByRole("button", { name: "Accept components", exact: true })).toBeVisible();
	await expect(footer).toContainText("0 of 2 reviewed");
	await panel.getByRole("button", { name: "Accept all", exact: true }).click();
	await expect(panel).toHaveCount(0);
	await expect(page.locator('[data-field-id="components"]')).toContainText("Payments SDK");
	await openCaughtUp();

	await recheck();
	await expect(list.getByRole("button", { name: "Accept story points", exact: true })).toBeVisible();
	await expect(list.getByRole("button", { name: "Accept cost center", exact: true })).toBeVisible();
	await expect(list.getByRole("listitem")).toHaveCount(2);
	await expect(footer).toContainText("0 of 2 reviewed");
	await expect(description).toContainText("Help merchants adopt Payments SDK v2");
	await panel.getByRole("button", { name: "Accept all", exact: true }).click();
	await openCaughtUp();
	await panel.getByRole("button", { name: "Check again", exact: true }).click();
	await expect(panel.getByText("Nothing new since you last checked")).toBeVisible();
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
	await expect(panel.getByRole("list", { name: "Suggestions", exact: true }).locator(':scope > [role="listitem"]')).toHaveCount(5);
	await expect(panel.getByRole("button", { name: /^Accept (?!all)/ })).toHaveCount(5);
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
	await expect(list.getByRole("button", { name: "Accept labels" })).toBeInViewport();
	await expect.poll(() => scrollport.evaluate((element) => getComputedStyle(element).maskImage)).toContain("rgb(0, 0, 0) 48px");
	await scrollport.evaluate((element) => { element.scrollTop = 0; });
	await expect.poll(() => scrollport.evaluate((element) => getComputedStyle(element).maskImage)).not.toContain("rgb(0, 0, 0) 48px");
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
	await workItem.getByRole("button", { name: "Show more details" }).click();
	for (const avatar of [
		workItem.getByRole("button", { name: "Change assignee" }).locator('[data-slot="avatar"]'),
		workItem.getByRole("button", { name: "Change reporter" }).locator('[data-slot="avatar"]'),
		field.getByRole("button", { name: "Cursor, add agent" }).locator('[data-slot="avatar"]'),
		field.getByRole("button", { name: "Jira Coding agent, add agent" }).locator('[data-slot="avatar"]'),
	]) {
		await expect(avatar).toHaveCSS("width", "16px");
		await expect(avatar).toHaveCSS("height", "16px");
	}
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

test("reply disclosure blends into the hovered activity row", async ({ page }) => {
	await page.goto(appUrl("/preview/projects/butter-v1?embedded=1"));
	await page.getByRole("button", { name: "Select Work item" }).click();
	const thread = page.locator('[data-jira-activity-entry-id="invocation-butter-cursor-forecast"]');
	const toggle = thread.getByRole("button", { name: /Show 4 replies/ });
	await toggle.hover();
	const transparent = "rgba(0, 0, 0, 0)";
	await expect.poll(() => thread.evaluate((element) => getComputedStyle(element, "::after").backgroundColor)).not.toBe(transparent);
	await expect(toggle).toHaveCSS("background-color", transparent);
	await expect(thread.locator("[data-jira-activity-reply-toggle-icon]")).toHaveCount(0);
	await toggle.click();
	const expanded = thread.getByRole("button", { name: "Hide replies" });
	await expect(expanded).toHaveAttribute("aria-expanded", "true");
	await expect(expanded).toHaveCSS("background-color", transparent);
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
