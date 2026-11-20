import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("accepting suggestions with reduced motion fills the fields without the indicator", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect(item.getByRole("textbox", { name: "Work item description" })).toContainText("guided quickstart");
	await expect(item.locator("[data-project-butter-suggestion-cursor]")).toHaveCount(0);
});

test("filling keeps the rail stable and a revealing field usable", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	const firstField = item.locator("[data-project-butter-detail-fields] [data-field-id]").first();
	await expect(firstField).toHaveAttribute("data-field-id", "assignee");
	const before = await firstField.boundingBox();
	if (!before) throw new Error("The first Details field is not visible");
	await page.getByRole("button", { name: "Accept all" }).click();
	await expect(item.locator("[data-project-butter-suggestion-cursor]")).toBeVisible();
	const during = await firstField.boundingBox();
	if (!during) throw new Error("The first Details field disappeared during filling");
	expect(Math.abs(during.y - before.y)).toBeLessThan(2);
	const dueDateRow = item.locator('[data-field-id="dueDate"]');
	await expect(dueDateRow.locator("[data-suggestion-text-reveal]")).toBeVisible();
	const date = dueDateRow.getByRole("button", { name: "Change due date" });
	await date.focus();
	await expect(date).toBeFocused();
	await expect.poll(() => date.evaluate((element) => getComputedStyle(element.parentElement!).opacity)).toBe("1");
	await date.click();
	await expect(date).toHaveAttribute("aria-expanded", "true");
	await page.keyboard.press("Escape");
	await date.blur();
	await expect(dueDateRow.locator("[data-suggestion-text-reveal]")).toHaveCount(0);
	await expect(date).toContainText("Dec 15, 2026");
});

test("each accepted field settles while later fields are still revealing", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-999"][data-board-column-title] [data-slot="jira-issue-card"]').click();
	const item = page.getByRole("dialog", { name: "Project butter" });
	await item.getByRole("button", { name: /suggestions$/ }).click();
	await page.getByRole("button", { name: "Accept all" }).click();
	const first = item.locator('[data-field-id="dueDate"]');
	const last = item.locator('[data-field-id="storyPoints"]');
	await expect(first.locator("[data-suggestion-text-reveal]")).toBeVisible();
	const settledInOrder = await item.evaluate((root) => new Promise<boolean>((resolve) => {
		const first = root.querySelector('[data-field-id="dueDate"] [data-project-butter-field-control]')!;
		const last = root.querySelector('[data-field-id="storyPoints"]')!;
		const lastControl = last.querySelector("[data-project-butter-field-control]")!;
		const deadline = performance.now() + 8000;
		function sample(now: number) {
			if (last.querySelector("[data-suggestion-text-reveal]") && Number(getComputedStyle(first).opacity) >= 0.5 && Number(getComputedStyle(lastControl).opacity) <= 0.05) {
				return resolve(true);
			}
			if (now > deadline) return resolve(false);
			requestAnimationFrame(sample);
		}
		requestAnimationFrame(sample);
	}));
	expect(settledInOrder).toBe(true);
	await expect(last.locator("[data-suggestion-text-reveal]")).toHaveCount(0);
	await expect(last.locator("[data-project-butter-field-control]")).toHaveCSS("opacity", "1");
});

test("Butter v1 Accept all reveals values inline on the first batch and on rechecks", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	// Constrain the assignee display so its second word is clipped during the sweep.
	await page.addStyleTag({ content: '[data-field-id="assignee"] [aria-label="Change assignee"] > span { max-inline-size: 54px; }' });
	await page.getByRole("button", { name: "Select AI suggestions" }).click();
	await page.getByRole("button", { name: "Review AI suggestions" }).click();

	const traversal = await page.evaluateHandle(() => {
		const selector = "[data-project-butter-suggestion-cursor]";
		const seen = { cursor: false };
		const observer = new MutationObserver((records) => {
			seen.cursor ||= records.some((record) => Array.from(record.addedNodes).some((node) =>
				node instanceof Element && (node.matches(selector) || node.querySelector(selector) !== null)));
		});
		observer.observe(document.body, { childList: true, subtree: true });
		return { seen, observer };
	});
	const accept = page.getByRole("button", { name: "Accept all", exact: true });
	const assignee = page.locator('[data-field-id="assignee"]');
	await expect(assignee.locator('[data-unassigned="person"]')).toBeVisible();
	const handoff = await accept.evaluateHandle((button) => {
		const fields = ["assignee", "dueDate", "parent", "labels"].map((id) => ({ id, rainbowStarted: false, rainbowEnd: 0, controlStart: 0, clipped: false, rising: false }));
		const result = { fields, earlyAvatar: false, avatarStart: 0, labelsStaggered: false };
		button.addEventListener("click", () => {
			const deadline = performance.now() + 5000;
			let frame = 0;
			function sample(now: number) {
				frame += 1;
				for (const field of fields) {
					const row = document.querySelector(`[data-field-id="${field.id}"]`);
					const bands = Array.from(row?.querySelectorAll("[data-suggestion-rainbow-band]") ?? []);
					const clip = row?.querySelector("[data-suggestion-text-reveal]")?.parentElement?.getBoundingClientRect();
					const visibleBands = clip ? bands.filter((band) => {
						const { left, right, top, bottom } = band.getBoundingClientRect();
						return left < clip.right && right > clip.left && top < clip.bottom && bottom > clip.top;
					}) : bands;
					field.clipped ||= visibleBands.length < bands.length;
					const band = visibleBands.at(-1);
					const opacity = band ? Number(getComputedStyle(band).opacity) : 0;
					const control = row?.querySelector("[data-project-butter-field-control]");
					if (opacity > 0.1) field.rainbowStarted = true;
					if (!field.rainbowStarted) continue;
					if (field.id === "assignee" && row?.querySelector('[data-slot="avatar"]:not([data-unassigned])')) {
						if (opacity > 0.005) result.earlyAvatar = true;
						result.avatarStart ||= frame;
					}
					if (!field.rainbowEnd && opacity <= 0.005) field.rainbowEnd = frame;
					const finalOpacity = control ? Number(getComputedStyle(control).opacity) : 0;
					const tags = field.id === "labels" ? Array.from(control?.querySelectorAll('[data-slot="tag-group"] > [data-slot="tag"]') ?? []) : [];
					const firstTag = tags.at(0);
					const lastTag = tags.at(-1);
					const firstOpacity = firstTag ? Number(getComputedStyle(firstTag).opacity) : 1;
					const enteringValue = firstTag ?? control;
					if (enteringValue && finalOpacity * firstOpacity > 0.01) {
						const offset = new DOMMatrixReadOnly(getComputedStyle(enteringValue).transform).m42;
						field.rising ||= offset > 0 && offset < 4;
					}
					if (firstTag && lastTag && finalOpacity > 0.99 && firstOpacity >= 0.25) {
						result.labelsStaggered ||= Number(getComputedStyle(lastTag).opacity) === 0;
					}
					if (!field.controlStart && finalOpacity > 0.01 && firstOpacity > 0.01) field.controlStart = frame;
				}
				if (now < deadline && (!result.avatarStart || !result.labelsStaggered || fields.some((field) => !field.rainbowEnd || !field.controlStart || !field.rising))) requestAnimationFrame(sample);
			}
			requestAnimationFrame(sample);
		}, { once: true, capture: true });
		return result;
	});
	const description = page.locator("[data-description-reveal]");
	const labels = page.locator('[data-field-id="labels"] [data-suggestion-text-reveal]');
	await accept.click();
	await expect(description).toBeVisible();
	await expect(labels).toContainText("onboarding");
	for (const [field, visual] of [["assignee", '[data-slot="avatar"]'], ["dueDate", '[data-slot="icon-tile"] svg']]) {
		const row = page.locator(`[data-field-id="${field}"]`);
		await expect(row.locator("[data-suggestion-text-reveal]")).toBeVisible();
		const opacity = await row.locator(visual).evaluate((element) => {
			let opacity = 1;
			for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
				opacity *= Number(getComputedStyle(ancestor).opacity);
				if (ancestor.hasAttribute("data-field-id")) break;
			}
			return opacity;
		});
		expect(opacity).toBeGreaterThanOrEqual(0.99);
	}
	await expect(labels).toHaveCount(0, { timeout: 8000 });
	await expect.poll(() => handoff.evaluate(({ fields, labelsStaggered }) => ({
		risingFields: fields.filter((field) => field.rainbowEnd > 0 && field.controlStart > 0 && field.rising).map((field) => field.id),
		labelsStaggered,
	}))).toEqual({ risingFields: ["assignee", "dueDate", "parent", "labels"], labelsStaggered: true });
	const result = await handoff.jsonValue();
	expect(result.earlyAvatar).toBe(false);
	for (const field of result.fields) {
		expect(field.controlStart, field.id).toBeGreaterThanOrEqual(field.rainbowEnd);
		expect(field.controlStart - field.rainbowEnd, field.id).toBeLessThanOrEqual(3);
	}
	expect(result.fields.find((field) => field.id === "parent")?.clipped).toBe(true);
	const assigneeReveal = result.fields.find((field) => field.id === "assignee")!;
	expect(assigneeReveal.clipped).toBe(true);
	expect(result.avatarStart).toBeGreaterThanOrEqual(assigneeReveal.rainbowEnd);
	expect(result.avatarStart - assigneeReveal.rainbowEnd).toBeLessThanOrEqual(3);
	await expect(assignee.locator('[data-unassigned="person"]')).toHaveCount(0);
	await expect(assignee.getByRole("button", { name: "Change assignee" })).toContainText("Robi Lopez");

	await page.getByRole("button", { name: "Open Rovo chat" }).click();
	await page.getByRole("button", { name: "Suggest work item fields" }).click();
	await page.getByRole("button", { name: "Check again", exact: true }).click();
	await expect(page.getByRole("button", { name: "Accept components", exact: true })).toBeVisible();
	await accept.click();

	const components = page.locator('[data-field-id="components"]');
	const fixVersion = page.locator('[data-field-id="fixVersion"]');
	await expect(components.locator("[data-suggestion-text-reveal]")).toContainText("Payments SDK");
	await expect(fixVersion.locator("[data-suggestion-text-reveal]")).toContainText("v2.0");
	await expect(fixVersion.locator("[data-suggestion-text-reveal]")).toHaveCount(0, { timeout: 8000 });
	await expect(fixVersion).toContainText("v2.0");
	expect(await traversal.evaluate(({ seen, observer }) => {
		observer.disconnect();
		return seen.cursor;
	})).toBe(false);
});
