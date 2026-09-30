import { expect, test } from "@playwright/test";

import {
	activateAndWaitForScrollSettlement,
	clickWhenControlReenables,
} from "@/tests/helpers/jira-interaction-contracts";
import { appUrl } from "@/tests/helpers/origin";

const JIRA_WORK_ITEM_URL = appUrl("/preview/blocks/jira-work-item-demo-experimental");

const JIRA_WORK_ITEM_V2_URL = appUrl("/preview/blocks/jira-work-item-demo-experimental-v2");

const JIRA_WORK_ITEM_V3_URL = appUrl("/preview/blocks/jira-work-item-demo-experimental-v3");

const JIRA_GOLDEN_JOURNEYS_V3_URL = appUrl("/jira-golden-journeys-v3");

test("rapid metadata toggles settle with visible title actions", async ({ page }) => {
	await page.goto(JIRA_WORK_ITEM_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const toggle = page.getByRole("button", { name: /metadata panel/u });
	await expect(toggle).toHaveAccessibleName("Hide metadata panel");

	const toggleBackAsSoonAsEnabled = clickWhenControlReenables(
		toggle,
		"Show metadata panel",
	);

	await toggle.click();
	await toggleBackAsSoonAsEnabled;
	await expect(toggle).toHaveAccessibleName("Hide metadata panel");
	await expect(toggle).toBeEnabled();

	const titleActions = page.locator("[data-jira-work-item-title] + div");
	await expect(titleActions).not.toHaveAttribute("aria-hidden");
	await expect(titleActions).not.toHaveAttribute("inert");
	await expect(titleActions).toHaveCSS("opacity", "1");
});

test("v2 comment prompt keeps its resting height when focused", async ({ page }) => {
	await page.goto(JIRA_WORK_ITEM_V2_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const composer = page.getByRole("form", {
		name: "Comment, @mention an agent, or / for skills",
	});
	const prompt = page.getByRole("textbox", {
		name: "Comment, @mention an agent, or / for skills",
	});
	await expect(composer).toBeVisible();
	const restingHeight = await composer.evaluate((element) => getComputedStyle(element).height);

	await prompt.click();
	await expect(prompt).toBeFocused();
	await expect.poll(
		() => composer.evaluate((element) => getComputedStyle(element).height),
	).toBe(restingHeight);
});

test("opening v3 resolves section links to the visible desktop scrollport", async ({ page }) => {
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const sectionNav = page.getByRole("navigation", { name: "Work item sections" });
	const activityLink = sectionNav.getByRole("link", { name: /^Activity/u });
	const sectionScrollport = page.locator(
		"[data-jira-work-item-scroll-region]:has([data-work-item-section-id='activity'])",
	);
	await expect(sectionNav).toBeVisible();
	await expect(sectionScrollport).toHaveCSS("overflow-y", "auto");

	await activityLink.focus();
	await expect(activityLink).toBeFocused();
	const scroll = await activateAndWaitForScrollSettlement(
		sectionScrollport,
		() => page.keyboard.press("Enter"),
	);

	await expect(activityLink).toHaveAttribute("aria-current", "location");
	const activityCount = activityLink.locator("span").last();
	await expect.poll(() => activityCount.evaluate((element) => getComputedStyle(element).color))
		.toBe(await activityLink.evaluate((element) => getComputedStyle(element).color));
	expect(scroll.timedOut).toBe(false);
	expect(scroll.scrollEvents).toBeGreaterThan(0);
	await expect.poll(() => sectionScrollport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("v3 section navigation links use 12px type", async ({ page }) => {
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const sectionNav = page.getByRole("navigation", { name: "Work item sections" });
	const pullRequests = page.getByRole("combobox", { name: /^Pull requests/u });
	const navigationList = sectionNav.getByRole("list");
	const navigationRow = page.locator("[data-work-item-header-navigation]");
	const sectionScrollport = page.locator(
		"[data-jira-work-item-scroll-region]:has([data-work-item-section-id='activity'])",
	);
	await expect(navigationList.getByRole("combobox", { name: /^Pull requests/u })).toBeVisible();
	await expect(sectionNav).toHaveCSS("overflow-x", "auto");
	await expect(sectionNav).toHaveCSS("overflow-y", "hidden");
	await expect(navigationRow).toHaveAttribute("data-header-variant", "expanded");
	await expect(navigationRow).toHaveCSS("border-bottom-color", "rgba(0, 0, 0, 0)");
	for (const linkName of [/^Description/u, /^Activity/u, /^Insights/u]) {
		const link = sectionNav.getByRole("link", { name: linkName });
		await expect(link).toHaveCSS("font-size", "12px");
		await expect(link).toHaveCSS("font-weight", "500");
		await expect(link).toHaveCSS("line-height", "16px");
		await expect(link).toHaveCSS("height", "32px");
		await expect(link).toHaveCSS("padding-left", "0px");
		await expect(link).toHaveCSS("padding-right", "0px");
	}
	await expect(pullRequests).toHaveCSS("font-size", "12px");
	await expect(pullRequests).toHaveCSS("font-weight", "500");
	await expect(pullRequests).toHaveCSS("line-height", "16px");
	await expect(pullRequests).toHaveCSS("height", "32px");
	await expect(pullRequests).toHaveCSS("padding-left", "0px");
	await expect(pullRequests).toHaveCSS("padding-right", "0px");
	for (const control of [
		sectionNav.getByRole("link", { name: /^Description/u }),
		sectionNav.getByRole("link", { name: /^Activity/u }),
		sectionNav.getByRole("link", { name: /^Insights/u }),
		pullRequests,
	]) {
		await expect(control).toHaveCSS("border-left-width", "6px");
		await expect(control).toHaveCSS("border-right-width", "6px");
		await expect(control).toHaveCSS("border-left-color", "rgba(0, 0, 0, 0)");
		await expect(control).toHaveCSS("border-right-color", "rgba(0, 0, 0, 0)");
	}

	const descriptionLink = sectionNav.getByRole("link", { name: /^Description/u });
	const activityLink = sectionNav.getByRole("link", { name: /^Activity/u });
	const insightsLink = sectionNav.getByRole("link", { name: /^Insights/u });
	const title = page.getByRole("textbox", { name: "Work item title" });
	const defaultTextColor = await title.evaluate((element) => getComputedStyle(element).color);
	await expect.poll(() => descriptionLink.evaluate((element) => getComputedStyle(element).color))
		.toBe(defaultTextColor);
	await expect.poll(() => descriptionLink.evaluate((element) => {
		const probe = document.createElement("div");
		probe.className = "bg-bg-neutral-bold";
		element.append(probe);
		const expected = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return getComputedStyle(element, "::after").backgroundColor === expected;
	})).toBe(true);
	const insightsRestingColor = await insightsLink.evaluate((element) => getComputedStyle(element).color);
	const pullRequestsRestingColor = await pullRequests.evaluate((element) => getComputedStyle(element).color);
	expect(insightsRestingColor).not.toBe(defaultTextColor);
	expect(pullRequestsRestingColor).not.toBe(defaultTextColor);
	await page.keyboard.press("Tab");
	await insightsLink.focus();
	await expect.poll(() => insightsLink.evaluate(
		(element) => getComputedStyle(element).boxShadow,
	)).toContain("inset");
	await pullRequests.focus();
	await expect.poll(() => pullRequests.evaluate(
		(element) => getComputedStyle(element).boxShadow,
	)).toContain("inset");
	await insightsLink.hover();
	await expect.poll(() => insightsLink.evaluate((element) => getComputedStyle(element).color))
		.toBe(defaultTextColor);
	await expect.poll(() => insightsLink.evaluate(
		(element) => getComputedStyle(element).borderBottomLeftRadius,
	)).not.toBe("0px");
	await expect.poll(() => insightsLink.evaluate(
		(element) => getComputedStyle(element).borderBottomRightRadius,
	)).not.toBe("0px");
	await expect.poll(() => insightsLink.evaluate(
		(element) => getComputedStyle(element).borderTopLeftRadius,
	)).not.toBe("0px");
	const hoverBackground = await insightsLink.evaluate(
		(element) => getComputedStyle(element).backgroundColor,
	);
	expect(hoverBackground).toBe("rgba(0, 0, 0, 0)");
	await pullRequests.hover();
	await expect.poll(() => pullRequests.evaluate((element) => getComputedStyle(element).color))
		.toBe(defaultTextColor);
	await expect.poll(() => pullRequests.evaluate(
		(element) => getComputedStyle(element).borderBottomLeftRadius,
	)).not.toBe("0px");
	await expect.poll(() => pullRequests.evaluate(
		(element) => getComputedStyle(element).borderBottomRightRadius,
	)).not.toBe("0px");
	await expect.poll(() => pullRequests.evaluate(
		(element) => getComputedStyle(element).borderTopLeftRadius,
	)).not.toBe("0px");
	await expect.poll(() => pullRequests.evaluate((element) => getComputedStyle(element).backgroundColor))
		.toBe(hoverBackground);
	for (const control of [insightsLink, pullRequests]) {
		expect(await control.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			return document.elementFromPoint(bounds.left + 2, bounds.top + bounds.height / 2) === element;
		})).toBe(true);
	}

	const pullRequestsList = page.getByRole("listbox", { name: "Pull requests" });
	await expect(pullRequestsList).toBeVisible();
	await pullRequests.click();
	await expect(pullRequestsList).toBeVisible();
	await page.getByRole("option").first().hover();
	await page.waitForTimeout(150);
	await expect(pullRequestsList).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(pullRequestsList).toBeHidden();

	await sectionScrollport.evaluate((element) => element.scrollTo({ top: 48 }));
	await expect(navigationRow).toHaveAttribute("data-header-variant", "compact");
	await expect.poll(() => navigationRow.evaluate((element) => {
		const probe = document.createElement("div");
		probe.style.border = "1px solid var(--ds-border-disabled)";
		document.body.append(probe);
		const expected = getComputedStyle(probe).borderColor;
		probe.remove();
		return getComputedStyle(element).borderBottomColor === expected;
	})).toBe(true);
	await insightsLink.hover();
	await expect(insightsLink).toHaveCSS("border-bottom-left-radius", "0px");
	await expect(insightsLink).toHaveCSS("border-bottom-right-radius", "0px");
	await pullRequests.hover();
	await expect(pullRequests).toHaveCSS("border-bottom-left-radius", "0px");
	await expect(pullRequests).toHaveCSS("border-bottom-right-radius", "0px");
	await title.hover();
	await expect(pullRequestsList).toBeHidden();
	await sectionScrollport.evaluate((element) => element.scrollTo({ top: 0 }));
	await expect(navigationRow).toHaveAttribute("data-header-variant", "expanded");

	const descriptionLabel = descriptionLink.locator("span").first();
	await expect.poll(async () => Math.abs(
		await descriptionLabel.evaluate((element) => element.getBoundingClientRect().left)
		- await title.evaluate((element) => element.getBoundingClientRect().left)
	)).toBeLessThan(1);
	const descriptionLeft = await descriptionLabel.evaluate((element) => element.getBoundingClientRect().left);
	const bodyLeft = await page.locator(
		"[data-jira-work-item-column-body]:not([data-jira-work-item-metadata-rail-body])",
	).evaluate(
		(element) => element.getBoundingClientRect().left,
	);
	expect(Math.abs(descriptionLeft - bodyLeft)).toBeLessThan(1);

	const tabBounds = await Promise.all(
		[descriptionLink, activityLink, insightsLink, pullRequests].map((control) => (
			control.evaluate((element) => {
				const bounds = element.getBoundingClientRect();
				return { left: bounds.left, right: bounds.right };
			})
		)),
	);
	for (let index = 1; index < tabBounds.length; index += 1) {
		expect(Math.abs(tabBounds[index].left - tabBounds[index - 1].right - 16)).toBeLessThan(1);
	}

	await expect.poll(async () => {
		const [navigationBottom, descriptionBottom, pullRequestsBottom] = await Promise.all([
			page.locator("[data-work-item-header-navigation]").evaluate(
				(element) => element.getBoundingClientRect().bottom,
			),
			descriptionLink.evaluate((element) => element.getBoundingClientRect().bottom),
			pullRequests.evaluate((element) => element.getBoundingClientRect().bottom),
		]);
		return Math.max(
			Math.abs(navigationBottom - descriptionBottom),
			Math.abs(navigationBottom - pullRequestsBottom),
		);
	}).toBeLessThan(2);
});

test("v3 metadata disclosure counts omit the unicode separator", async ({ page }) => {
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const details = page.getByRole("region", { name: "Work item details" });
	const disclosureLabels = await details
		.locator("[data-slot='collapsible-trigger']")
		.allTextContents();
	const disclosureTitles = details.locator("[data-slot='artifact-pane-section-title']");

	expect(disclosureLabels.length).toBeGreaterThan(0);
	expect(disclosureLabels.some((label) => label.includes("·"))).toBe(false);
	expect(await disclosureTitles.count()).toBeGreaterThan(0);
	for (const title of await disclosureTitles.all()) {
		await expect(title).toHaveCSS("font-size", "12px");
		await expect(title).toHaveCSS("font-weight", "500");
		await expect(title).toHaveCSS("line-height", "16px");
	}
});

test("v3 work item header compacts after the body starts scrolling", async ({ page }) => {
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const headerBand = page.locator("[data-jira-work-item-header-band]");
	const titleBlock = page.locator("[data-jira-work-item-title-block]");
	const codingAgentAction = page.getByRole("button", { name: "Open in Claude" });
	const sectionScrollport = page.locator(
		"[data-jira-work-item-scroll-region]:has([data-work-item-section-id='activity'])",
	);

	await expect(titleBlock).toHaveAttribute("data-header-variant", "expanded");
	await expect(titleBlock).toHaveCSS("padding-bottom", "16px");
	const expandedHeight = await headerBand.evaluate((element) => element.getBoundingClientRect().height);
	await expect(codingAgentAction).toBeVisible();

	await sectionScrollport.evaluate((element) => element.scrollTo({ top: 48 }));
	await expect(titleBlock).toHaveAttribute("data-header-variant", "compact");
	await expect(titleBlock).toHaveCSS("padding-bottom", "0px");
	await expect(codingAgentAction).toBeHidden();
	await expect.poll(() => headerBand.evaluate((element) => element.getBoundingClientRect().height))
		.toBeLessThan(expandedHeight);

	await sectionScrollport.evaluate((element) => element.scrollTo({ top: 0 }));
	await expect(titleBlock).toHaveAttribute("data-header-variant", "expanded");
	await expect(titleBlock).toHaveCSS("padding-bottom", "16px");
});

test("v3 compact header swaps a scaled fade-out for an opacity-only final title", async ({ page }) => {
	await page.setViewportSize({ width: 1424, height: 900 });
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const titleBlock = page.locator("[data-jira-work-item-title-block]");
	const sectionScrollport = page.locator(
		"[data-jira-work-item-scroll-region]:has([data-work-item-section-id='activity'])",
	);
	await expect(titleBlock).toHaveAttribute("data-header-variant", "expanded");

	const transitionSamples = await sectionScrollport.evaluate(async (element) => {
		const initialTitle = document.querySelector("[data-jira-work-item-title]");
		if (!(initialTitle instanceof HTMLElement)) {
			throw new Error("Expected the expanded work-item title.");
		}
		const expandedFontSize = Number.parseFloat(getComputedStyle(initialTitle).fontSize);

		element.scrollTo({ top: 48 });
		const samples = [];
		for (let frame = 0; frame < 24; frame += 1) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const title = document.querySelector("[data-jira-work-item-title]");
			const controls = document.querySelector("[data-jira-work-item-resource-row-content]");
			if (!(title instanceof HTMLElement) || !(controls instanceof HTMLElement)) {
				throw new Error("Expected the work-item title and header controls.");
			}

			const titleTransition = title.parentElement;
			if (!(titleTransition instanceof HTMLElement)) {
				throw new Error("Expected the work-item title transition wrapper.");
			}
			const titleBounds = title.getBoundingClientRect();
			const controlBounds = controls.getBoundingClientRect();
			const overlapWidth = Math.max(
				0,
				Math.min(titleBounds.right, controlBounds.right)
					- Math.max(titleBounds.left, controlBounds.left),
			);
			const overlapHeight = Math.max(
				0,
				Math.min(titleBounds.bottom, controlBounds.bottom)
					- Math.max(titleBounds.top, controlBounds.top),
			);
			const transform = getComputedStyle(titleTransition).transform;
			samples.push({
				fontSize: Number.parseFloat(getComputedStyle(title).fontSize),
				opacity: Number.parseFloat(getComputedStyle(titleTransition).opacity),
				overlapArea: overlapWidth * overlapHeight,
				scaleX: transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a,
			});
		}
		return { expandedFontSize, samples };
	});

	await expect(titleBlock).toHaveAttribute("data-header-variant", "compact");
	const compactFontSize = transitionSamples.samples.at(-1)?.fontSize;
	expect(compactFontSize).toBeDefined();
	const expandedExitSamples = transitionSamples.samples.filter(
		(sample) => Math.abs(sample.fontSize - transitionSamples.expandedFontSize) < 0.5,
	);
	const compactEnterSamples = transitionSamples.samples.filter(
		(sample) => Math.abs(sample.fontSize - (compactFontSize ?? 0)) < 0.5,
	);
	expect(expandedExitSamples.some((sample) => sample.opacity < 0.99 && sample.scaleX < 0.999)).toBe(true);
	expect(Math.min(...expandedExitSamples.map((sample) => sample.scaleX))).toBeGreaterThanOrEqual(0.95);
	expect(compactEnterSamples.some((sample) => sample.opacity < 0.99)).toBe(true);
	expect(compactEnterSamples.every((sample) => Math.abs(sample.scaleX - 1) < 0.001)).toBe(true);
	expect(Math.max(...transitionSamples.samples.map((sample) => sample.overlapArea))).toBeLessThan(1);
});

test("v3 work item title uses medium weight before and after compaction", async ({ page }) => {
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const title = page.getByRole("textbox", { name: "Work item title" });
	const titleBlock = page.locator("[data-jira-work-item-title-block]");
	const sectionScrollport = page.locator(
		"[data-jira-work-item-scroll-region]:has([data-work-item-section-id='activity'])",
	);

	await expect(titleBlock).toHaveAttribute("data-header-variant", "expanded");
	await expect(title).toHaveCSS("font-weight", "500");

	await sectionScrollport.evaluate((element) => element.scrollTo({ top: 48 }));
	await expect(titleBlock).toHaveAttribute("data-header-variant", "compact");
	await expect(title).toHaveCSS("font-weight", "500");
});

test("golden journeys v3 title compaction does not mix font shorthand and fontWeight", async ({ page }) => {
	const fontStyleWarnings: string[] = [];
	page.on("console", (message) => {
		if (message.text().includes("Removing a style property during rerender (fontWeight)")) {
			fontStyleWarnings.push(message.text());
		}
	});

	await page.goto(JIRA_GOLDEN_JOURNEYS_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Start Claude working on SHOP-4821" }).click();
	await page.getByRole("button", { name: "Build" }).click();

	const titleBlock = page.locator("[data-jira-work-item-title-block]");
	const sectionScrollport = page.locator(
		"[data-jira-work-item-scroll-region]:has([data-work-item-section-id='activity'])",
	);
	await expect(titleBlock).toHaveAttribute("data-header-variant", "expanded");
	await sectionScrollport.evaluate((element) => element.scrollTo({ top: 48 }));
	await expect(titleBlock).toHaveAttribute("data-header-variant", "compact");

	expect(fontStyleWarnings).toEqual([]);
});

test("golden journeys v3 header collapse control stays static", async ({ page }) => {
	await page.goto(JIRA_GOLDEN_JOURNEYS_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Start Claude working on SHOP-4821" }).click();
	await page.getByRole("button", { name: "Build" }).click();
	await page.waitForTimeout(700);

	const header = page.locator("[data-jira-work-item-title-block]");
	const collapse = page.getByRole("button", { exact: true, name: "Collapse" });
	await expect(collapse).toBeVisible();
	await expect(collapse).not.toHaveAttribute("aria-expanded");

	const variantBeforeClick = await header.getAttribute("data-header-variant");
	await collapse.click();
	await expect(header).toHaveAttribute("data-header-variant", variantBeforeClick ?? "expanded");
	await expect(page.getByRole("button", { exact: true, name: "Expand header" })).toHaveCount(0);
	await expect(page.getByRole("button", { exact: true, name: "Collapse header" })).toHaveCount(0);
});

test("v3 header compacts the status and Add controls only after scrolling", async ({ page }) => {
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const status = page.getByRole("button", { name: /^Change status\./u });
	const add = page.getByRole("button", { name: "Add to work item" });
	const titleBlock = page.locator("[data-jira-work-item-title-block]");
	const sectionScrollport = page.locator(
		"[data-jira-work-item-scroll-region]:has([data-work-item-section-id='activity'])",
	);

	await expect(status).toHaveCSS("height", "32px");
	await expect(add).toHaveCSS("height", "32px");
	await expect(add).toHaveCSS("width", "32px");

	await sectionScrollport.evaluate((element) => element.scrollTo({ top: 48 }));
	await expect(titleBlock).toHaveAttribute("data-header-variant", "compact");
	await expect(status).toHaveCSS("height", "24px");
	await expect(add).toHaveCSS("height", "24px");
	await expect(add).toHaveCSS("width", "24px");

	await add.click();
	const openInSubmenu = page.getByRole("menuitem", { name: /^Open in/u });
	await expect(openInSubmenu).toBeVisible();
	await openInSubmenu.hover();
	const codexOption = page.getByRole("menuitem", { name: "Codex" });
	await expect(codexOption).toBeVisible();
	await codexOption.click();

	await sectionScrollport.evaluate((element) => element.scrollTo({ top: 0 }));
	await expect(titleBlock).toHaveAttribute("data-header-variant", "expanded");
	await expect(page.getByRole("button", { name: "Open in Codex" })).toBeVisible();
});

test("v3 header compaction keeps the docked prompt input stationary", async ({ page }) => {
	await page.setViewportSize({ width: 1424, height: 900 });
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const dialog = page.locator("[data-base-ui-focusable][data-open]");
	const titleBlock = page.locator("[data-jira-work-item-title-block]");
	const sectionScrollport = page.locator(
		"[data-jira-work-item-scroll-region]:has([data-work-item-section-id='activity'])",
	);
	await expect(dialog).toHaveCSS("scale", "none");
	await expect(dialog).toHaveCSS("opacity", "1");
	await expect(titleBlock).toHaveAttribute("data-header-variant", "expanded");

	const maximumPromptMovement = await sectionScrollport.evaluate(async (element) => {
		const prompt = document.querySelector(
			"[data-jira-work-item-composer-state='sticky'] [contenteditable='true']",
		);
		if (!(prompt instanceof HTMLElement)) {
			throw new Error("Expected the docked work-item prompt input.");
		}

		const initialTop = prompt.getBoundingClientRect().top;
		element.scrollTo({ top: 48 });
		let maximumDelta = 0;
		for (let frame = 0; frame < 16; frame += 1) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			maximumDelta = Math.max(
				maximumDelta,
				Math.abs(prompt.getBoundingClientRect().top - initialTop),
			);
		}
		return maximumDelta;
	});

	await expect(titleBlock).toHaveAttribute("data-header-variant", "compact");
	expect(maximumPromptMovement).toBeLessThan(1);
});

test("v3 compact header removes layout motion when reduced motion is requested", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const titleBlock = page.locator("[data-jira-work-item-title-block]");
	const sectionScrollport = page.locator(
		"[data-jira-work-item-scroll-region]:has([data-work-item-section-id='activity'])",
	);
	await sectionScrollport.evaluate((element) => element.scrollTo({ top: 48 }));

	await expect(titleBlock).toHaveAttribute("data-header-variant", "compact");
	await expect(titleBlock).toHaveCSS("transform", "none");
});

test("golden journeys v3 Insights keeps the work item visible and resizes beside it", async ({ page }) => {
	await page.setViewportSize({ width: 1424, height: 900 });
	await page.goto(JIRA_GOLDEN_JOURNEYS_V3_URL, { waitUntil: "domcontentloaded" });

	const sectionNav = page.getByRole("navigation", { name: "Work item sections" });
	await sectionNav.getByRole("link", { name: /^Insights/u }).click();

	const resizeHandle = page.getByRole("separator", { name: "Resize insights and work item" });
	await expect(resizeHandle).toBeVisible();
	await expect(page.locator("[data-insights-work-item-split-insights]")).toBeVisible();
	await expect(page.locator("[data-work-item-section-id='description']")).toBeVisible();
	await expect(page.locator("[data-work-item-section-id='activity']")).toBeVisible();

	const startWidth = Number(await resizeHandle.getAttribute("aria-valuenow"));
	await resizeHandle.focus();
	await page.keyboard.press("ArrowRight");
	await expect.poll(async () => Number(await resizeHandle.getAttribute("aria-valuenow")))
		.toBeGreaterThan(startWidth);
});

test("v3 section links keep working in the narrow reduced-motion layout", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(JIRA_WORK_ITEM_V3_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Open work item" }).click();

	const sectionNav = page.getByRole("navigation", { name: "Work item sections" });
	const activityLink = sectionNav.getByRole("link", { name: /^Activity/u });
	const activitySection = page.locator("[data-work-item-section-id='activity']");
	await expect(sectionNav).toBeVisible();
	await activityLink.click();

	await expect(activityLink).toHaveAttribute("aria-current", "location");
	await expect.poll(() => activitySection.evaluate((section) => {
		let ancestor = section.parentElement;
		while (ancestor) {
			const overflowY = window.getComputedStyle(ancestor).overflowY;
			if (/auto|scroll/u.test(overflowY) && ancestor.scrollHeight > ancestor.clientHeight) {
				return ancestor.scrollTop;
			}
			ancestor = ancestor.parentElement;
		}
		return -1;
	})).toBeGreaterThan(0);
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});
