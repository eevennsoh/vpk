import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("saved board filters apply their conditions and can be pinned", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Filter board", exact: true }).click();
	await page.getByRole("menuitem", { name: "Saved Open submenu" }).hover();
	const saved = page.getByRole("menu", { name: "Saved filters" });
	await expect(saved.getByRole("menuitemcheckbox")).toHaveText(["Open pull requests", "Reviews needing agent input", "Tasks in progress", "Priya’s work"]);
	for (const row of await saved.getByRole("menuitemcheckbox").all()) {
		const icon = row.locator('[data-slot="icon-tile"]');
		await expect(icon).toHaveAttribute("aria-hidden", "true");
		await expect(icon).toHaveCSS("width", "16px");
		await expect(icon).toHaveCSS("height", "16px");
		await expect(icon.locator("svg")).toHaveCSS("width", "12px");
		await expect(icon.locator("svg")).toHaveCSS("height", "12px");
	}
	await saved.getByRole("menuitemcheckbox", { name: "Reviews needing agent input" }).click();
	await expect(saved.getByRole("menuitemcheckbox", { name: "Reviews needing agent input" })).toHaveAttribute("aria-checked", "true");
	await saved.getByRole("menuitem", { name: "Clear", exact: true }).hover();
	await saved.getByRole("menuitem", { name: "Clear", exact: true }).focus();
	const selected = saved.getByRole("menuitemcheckbox", { name: "Reviews needing agent input" });
	const gap = await selected.evaluate((row) => {
		const label = row.querySelector(".truncate")!.getBoundingClientRect();
		const indicator = row.querySelector('[data-slot="dropdown-menu-checkbox-item-indicator"]')!.getBoundingClientRect();
		return indicator.left - label.right;
	});
	expect(gap).toBeGreaterThanOrEqual(8);
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("group", { name: "Status is In review" })).toBeVisible();
	await expect(page.getByRole("group", { name: "Agent status is Needs input" })).toBeVisible();
	await expect(page.getByRole("button", { name: "PAY-112: Confirm the sandbox key retention window before replay" })).toBeVisible();
	await expect(page.getByRole("button", { name: "PAY-118: Carry card-artwork metadata into the next wallet epic" })).toHaveCount(0);
	await page.getByRole("button", { name: "Filter board (2)", exact: true }).click();
	await page.getByRole("menuitem", { name: "Saved Open submenu" }).hover();
	const openPullRequests = saved.getByRole("menuitemcheckbox", { name: "Open pull requests" });
	await openPullRequests.hover();
	const measureAction = (element: Element) => {
		const button = element.getBoundingClientRect();
		const icon = element.querySelector("svg")!.getBoundingClientRect();
		return { button: [button.width, button.height], icon: [icon.width, icon.height], inset: [icon.left - button.left, icon.top - button.top] };
	};
	const pin = saved.getByRole("menuitem", { name: "Pin Open pull requests" });
	const deleteAction = saved.getByRole("menuitem", { name: "Delete Open pull requests" });
	expect(await deleteAction.evaluate(measureAction)).toEqual(await pin.evaluate(measureAction));
	expect(await deleteAction.evaluate(measureAction)).toEqual({ button: [24, 24], icon: [12, 12], inset: [6, 6] });
	await saved.getByRole("menuitem", { name: "Pin Open pull requests" }).click();
	await openPullRequests.click();
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");
	await expect(page.getByRole("group", { name: "Pull request is Open" })).toBeVisible();
	await expect(page.getByRole("button", { name: "PAY-107: Move retry and backoff out of LegacyGatewayAdapter" })).toBeVisible();
	await page.getByRole("button", { name: "Filter board (1)", exact: true }).click();
	const pinned = page.getByRole("menuitemcheckbox", { name: "Open pull requests" });
	await expect(pinned).toBeVisible();
	await expect(pinned.locator('[data-slot="icon-tile"] svg')).toHaveCSS("width", "12px");
});

test("saved work and assignee filters show their matching cards", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	for (const [filter, card] of [
		["Tasks in progress", "PAY-105: Port confirmPaymentIntent and the 3-D Secure challenge flow"],
		["Priya’s work", "PAY-115: Rewrite the customer ship note after the wallet cut"],
	] as const) {
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Filter board", exact: true }).click();
		await page.getByRole("menuitem", { name: "Saved Open submenu" }).hover();
		await page.getByRole("menu", { name: "Saved filters" }).getByRole("menuitemcheckbox", { name: filter, exact: true }).click();
		await page.keyboard.press("Escape");
		await page.keyboard.press("Escape");
		await expect(page.getByRole("button", { name: card, exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "PAY-118: Carry card-artwork metadata into the next wallet epic" })).toHaveCount(0);
		await page.getByRole("button", { name: "Clear all filters" }).click();
		await expect(page.getByRole("button", { name: "PAY-118: Carry card-artwork metadata into the next wallet epic" })).toBeVisible();
	}
});

test("Board Card uses the board work item actions menu", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board (Card)", exact: true }).click();
	const trigger = page.getByRole("button", { name: "More actions for PD-40", exact: true });
	await trigger.focus();
	await trigger.press("Enter");
	const menu = page.getByRole("menu");
	await expect(menu.getByRole("menuitem")).toHaveText([
		"Edit summary", "Link", "Edit labels", "Add flag", "Move up", "Move down",
		"Move work item", "Change status", "Copy link", "Copy key", "Delete",
	]);
	await expect(menu.getByRole("menuitem", { name: "Move up", exact: true })).toBeDisabled();
	await menu.getByRole("menuitem", { name: "Link Open submenu", exact: true }).focus();
	await page.keyboard.press("ArrowRight");
	await expect(page.getByRole("menuitem", { name: "Confluence item", exact: true })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
	test(`board work-item menu labels match the subtle icons (${theme})`, async ({ page }) => {
		await page.goto(appUrl("/butter-v1"));
		if (theme === "dark") await page.getByRole("button", { name: "Cycle theme, current theme: Light" }).click();
		const trigger = page.getByRole("button", { name: "More actions for PAY-118", exact: true });
		await trigger.focus();
		await trigger.press("Enter");
		const menu = page.getByRole("menu");
		await expect(menu.getByRole("menuitem", { name: "Move up", exact: true })).toBeDisabled();
		const colors = await menu.evaluate((element) => {
			const context = document.createElement("canvas").getContext("2d");
			if (!context) throw new Error("Cannot compare menu colors");
			const normalize = (color: string) => { context.fillStyle = color; return context.fillStyle; };
			const subtle = normalize(getComputedStyle(element).getPropertyValue("--ds-icon-subtle").trim());
			return [...element.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])')].map((row) => ({
				label: row.textContent?.trim(),
				text: normalize(getComputedStyle(row).color),
				icons: [...row.querySelectorAll("svg")].map((icon) => normalize(getComputedStyle(icon).color)),
				subtle,
			}));
		});
		expect(colors.length).toBeGreaterThan(5);
		for (const row of colors) {
			expect(row.text, row.label).toBe(row.subtle);
			for (const icon of row.icons) expect(icon, row.label).toBe(row.subtle);
		}
		const edit = menu.getByRole("menuitem", { name: "Edit summary", exact: true });
		await edit.hover();
		const hovered = await edit.evaluate((row) => ({ text: getComputedStyle(row).color, icon: getComputedStyle(row.querySelector("svg")!).color }));
		expect(hovered.text).toBe(hovered.icon);
		const link = menu.getByRole("menuitem", { name: "Link Open submenu", exact: true });
		await link.focus();
		await link.press("ArrowRight");
		await expect(page.getByRole("menuitem", { name: "Work item", exact: true })).toHaveCSS("color", hovered.text);
	});
}

test("opening Link keeps the work item menu rows in place", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	const boardButton = page.getByRole("button", { name: "Select Board", exact: true });
	await boardButton.click();
	await boardButton.evaluate(async (element) => {
		await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})));
	});
	const trigger = page.getByRole("button", { name: "More actions for PAY-105", exact: true });
	await trigger.focus();
	await trigger.press("Enter");
	const link = page.getByRole("menuitem", { name: "Link Open submenu", exact: true });
	const labels = page.getByRole("menuitem", { name: "Edit labels", exact: true });
	const gap = async () => {
		const [linkBox, labelsBox] = await Promise.all([link.boundingBox(), labels.boundingBox()]);
		if (!linkBox || !labelsBox) throw new Error("Expected visible menu rows");
		return labelsBox.y - (linkBox.y + linkBox.height);
	};
	const originalGap = await gap();
	expect(originalGap).toBe(2);
	await link.focus();
	await link.press("ArrowRight");
	await expect(page.getByRole("menuitem", { name: "Confluence item", exact: true })).toBeVisible();
	await expect(link.locator('xpath=../span[@data-base-ui-focus-guard]')).toHaveCount(2);
	expect(await gap()).toBe(originalGap);
});

test("selecting a gallery item animates its highlight", { tag: "@smoke" }, async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	const button = page.getByRole("button", { name: "Select Work item" });
	await expect(button).toBeVisible();
	await button.click();
	const surface = button.locator("[style*='mask-image']").first();
	await expect(surface).toBeAttached();
	// The highlight grows on a Web Animation. Read that animation, not how many frames the runner paints;
	// with fill "forwards" it stays readable even if it has already finished.
	const reveal = await surface.evaluate(async (element) => {
		const animation = element.getAnimations().find((candidate) => (candidate.effect as KeyframeEffect | null)?.getKeyframes().some((frame) => "transform" in frame));
		if (!animation) return null;
		const keyframes = (animation.effect as KeyframeEffect).getKeyframes();
		const scale = (frame: ComputedKeyframe) => new DOMMatrixReadOnly(String(frame.transform)).a;
		const timing = { duration: Number(animation.effect!.getTiming().duration), from: scale(keyframes[0]), to: scale(keyframes[keyframes.length - 1]) };
		await animation.finished;
		return timing;
	});
	expect(reveal, "selecting starts a transform animation on the highlight").not.toBeNull();
	expect(reveal!.duration).toBeGreaterThan(0);
	expect(reveal!.from).toBeLessThan(1);
	expect(reveal!.to).toBe(1);
	// Once it finishes, the highlight covers the whole selected item.
	const [item, painted] = await Promise.all([button.boundingBox(), surface.boundingBox()]);
	if (!item || !painted) throw new Error("Expected the selected item and its highlight to have boxes");
	expect(painted.x).toBeLessThanOrEqual(item.x + 1);
	expect(painted.y).toBeLessThanOrEqual(item.y + 1);
	expect(painted.x + painted.width).toBeGreaterThanOrEqual(item.x + item.width - 1);
	expect(painted.y + painted.height).toBeGreaterThanOrEqual(item.y + item.height - 1);
});

test("the standalone board hides an open sidebar chat and restores its draft", { tag: "@smoke" }, async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.getByRole("button", { name: "Ask Rovo", exact: true }).click();
	const composer = page.getByRole("textbox", { name: "Chat message input", exact: true });
	await composer.fill("Keep this draft");
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	await expect(composer).toBeHidden();
	await expect(page.getByRole("region", { name: "Payments SDK v2 Kanban board" })).toBeVisible();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await expect(composer).toBeVisible();
	await expect(composer).toContainText("Keep this draft");
});

test("the standalone board is centered and remains scrollable on narrow screens", { tag: "@smoke" }, async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const first = board.locator('[data-jira-kanban-column="To do"]');
	const last = board.locator('[data-jira-kanban-column="Done"]');
	await expect(first).toBeVisible();
	// The board lays out after the gallery selection settles; wait for the columns to centre.
	await expect.poll(async () => {
		const [viewport, firstBounds, lastBounds] = await Promise.all([board.boundingBox(), first.boundingBox(), last.boundingBox()]);
		if (!viewport || !firstBounds || !lastBounds) return Infinity;
		return Math.abs((firstBounds.x - viewport.x) - (viewport.x + viewport.width - lastBounds.x - lastBounds.width));
	}, { message: "board columns centred in the viewport" }).toBeLessThan(2);
	await page.setViewportSize({ width: 700, height: 900 });
	await expect.poll(() => board.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
	const start = await first.boundingBox();
	const narrowViewport = await board.boundingBox();
	if (!start || !narrowViewport) throw new Error("Narrow board has no bounds");
	expect(start.x).toBeGreaterThanOrEqual(narrowViewport.x);
	await board.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
	await expect.poll(async () => {
		const end = await last.boundingBox();
		const visible = await board.boundingBox();
		return end && visible ? end.x + end.width - (visible.x + visible.width) : Infinity;
	}).toBeLessThanOrEqual(1);
});
