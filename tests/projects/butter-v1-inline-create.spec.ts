import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

for (const view of ["List", "Backlog"] as const) {
	test(`${view} keeps an inline draft open for consecutive subtasks`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		const parent = "PAY-105";
		const gap = page.getByRole("button", { name: `Create work item after ${parent}`, exact: true });
		await expect(gap).toBeAttached({ timeout: 30_000 });
		await gap.focus();
		await gap.press("Enter");
		const draft = page.getByRole("textbox", { name: "New work item summary" });
		await expect(draft).toBeFocused();
		const draftRow = page.getByRole("row").filter({ has: draft });
		const parentRow = page.getByRole("row").filter({ has: page.getByRole("button", { name: parent, exact: true }) });
		const draftIcon = draftRow.getByRole("img", { name: "task", exact: true });
		const parentIcon = parentRow.getByRole("img", { name: "task", exact: true });
		const [draftBounds, parentBounds] = await Promise.all([draftIcon.boundingBox(), parentIcon.boundingBox()]);
		if (!draftBounds || !parentBounds) throw new Error("Expected work item icons to be visible");
		expect(draftBounds.width).toBe(parentBounds.width);
		expect(draftBounds.height).toBe(parentBounds.height);
		expect(Math.abs(draftBounds.x - parentBounds.x)).toBeLessThanOrEqual(1);
		const editor = draft.locator("../../..");
		const beforeHover = await editor.evaluate((element) => ({
			background: getComputedStyle(element).backgroundColor,
			border: getComputedStyle(element).borderBottomWidth,
		}));
		const cells = draftRow.locator("td");
		const rowAppearance = async () => cells.evaluateAll((elements) => elements.map((element) => {
			const style = getComputedStyle(element);
			return { background: style.backgroundColor, left: style.borderTopLeftRadius, right: style.borderTopRightRadius };
		}));
		const beforeRowHover = await rowAppearance();
		await editor.hover();
		expect(await editor.evaluate((element) => ({
			background: getComputedStyle(element).backgroundColor,
			border: getComputedStyle(element).borderBottomWidth,
		}))).toEqual(beforeHover);
		expect(await rowAppearance()).toEqual(beforeRowHover);
		expect(beforeHover.border).toBe("0px");
		expect(await draft.evaluate((element) => getComputedStyle(element).getPropertyValue("--tw-ring-shadow"))).toContain("0px");
		expect(beforeRowHover[0].background).toBe(beforeRowHover[1].background);
		expect(beforeRowHover[0].left).not.toBe("0px");
		expect(beforeRowHover[1].right).not.toBe("0px");
		const create = draftRow.getByRole("button", { name: "Create", exact: true });
		const cancel = draftRow.getByRole("button", { name: "Cancel creation" });
		const expectButtonGap = async () => {
			const [createBounds, cancelBounds] = await Promise.all([create.boundingBox(), cancel.boundingBox()]);
			if (!createBounds || !cancelBounds) throw new Error("Expected create controls to be visible");
			expect(cancelBounds.x - (createBounds.x + createBounds.width)).toBe(4);
		};
		await expect(create).toBeDisabled();
		await expect(create.locator("svg")).toBeVisible();
		await expect(create.locator("kbd")).toHaveCount(0);
		await expectButtonGap();
		const keycapBackgrounds = await editor.locator('[data-slot="kbd"]').evaluateAll((elements) =>
			elements.map((element) => getComputedStyle(element).backgroundColor));
		expect(keycapBackgrounds).toHaveLength(2);
		for (const background of keycapBackgrounds) {
			expect(background).not.toBe(beforeRowHover[0].background);
		}
		await draft.fill(`First ${view} child`);
		await expect(create).toBeEnabled();
		await expect(create.locator("svg")).toBeVisible();
		await expectButtonGap();
		await draft.press("Meta+]");
		await expect(page.getByRole("row").filter({ has: draft }).getByRole("img", { name: "subtask" })).toBeVisible();
		await draft.press("Meta+[");
		await expect(draftRow.getByRole("img", { name: "task", exact: true })).toBeVisible();
		await draft.press("Meta+]");
		await draft.press("Enter");
		const firstRow = page.getByRole("row").filter({ hasText: `First ${view} child` });
		const firstIcon = firstRow.getByRole("img", { name: "subtask" });
		await expect(firstIcon).toBeVisible();
		await expect(firstRow.getByRole("checkbox")).not.toBeChecked();
		await expect(draft).toBeFocused();
		await expect(draft).toHaveValue("");
		await expect.poll(async () => {
			const [created, next] = await Promise.all([firstIcon.boundingBox(), draftRow.getByRole("img", { name: "subtask" }).boundingBox()]);
			return created && next ? Math.abs(created.x - next.x) : Infinity;
		}).toBeLessThanOrEqual(1);
		const draftBackground = await draftRow.locator("td").first().evaluate((element) => getComputedStyle(element).backgroundColor);
		await expect.poll(() => firstRow.locator("td").first().evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(draftBackground);
		await draft.fill(`Second ${view} child`);
		await draft.press("Enter");
		const secondRow = page.getByRole("row").filter({ hasText: `Second ${view} child` });
		await expect(secondRow.getByRole("img", { name: "subtask" })).toBeVisible();
		await expect(secondRow.getByRole("checkbox")).not.toBeChecked();
		await expect.poll(() => secondRow.locator("td").first().evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(draftBackground);
		for (const row of [firstRow, secondRow]) {
			const backgrounds = await row.locator("td").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor));
			expect(backgrounds.every((background) => background === draftBackground)).toBe(true);
		}
		expect(await firstRow.locator("td").first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius)).not.toBe("0px");
		expect(await draftRow.locator("td").first().evaluate((element) => getComputedStyle(element).borderBottomLeftRadius)).not.toBe("0px");
		await expect(draft).toBeFocused();
		await draft.press("Escape");
		await expect(draft).toHaveCount(0);
	});
}

test("reduced motion moves the inline subtask draft immediately", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const gap = page.getByRole("button", { name: "Create work item after PAY-105", exact: true });
	await gap.focus();
	await gap.press("Enter");
	const draft = page.getByRole("textbox", { name: "New work item summary" });
	await draft.press("Meta+]");
	await expect(draft.locator("..")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 24, 0)");
});

test("clicking away closes only an empty inline draft", async ({ page }) => {
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const gap = page.getByRole("button", { name: "Create work item after PAY-124", exact: true });
	await gap.focus();
	await gap.press("Enter");
	const draft = page.getByRole("textbox", { name: "New work item summary" });
	await expect(draft).toBeFocused();
	await draft.fill("Keep this draft");
	await page.getByRole("searchbox", { name: "Search list" }).click();
	await expect(draft).toHaveValue("Keep this draft");
	await draft.fill("");
	await page.getByRole("searchbox", { name: "Search list" }).click();
	await expect(draft).toHaveCount(0);
});

for (const view of ["List", "Backlog"] as const) {
	test(`${view} clears the insertion line after creating and dismissing a draft`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 1050 });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		await page.mouse.move(0, 0);
		const gap = page.getByRole("button", { name: "Create work item after PAY-105", exact: true });
		await gap.focus();
		await gap.press("Enter");
		const draft = page.getByRole("textbox", { name: "New work item summary" });
		await draft.fill(`New ${view} work item`);
		await draft.press("Enter");
		await expect(page.getByRole("row").filter({ hasText: `New ${view} work item` })).toBeVisible();
		await expect(draft).toHaveValue("");
		await draft.press("Escape");
		await expect(draft).toHaveCount(0);
		await expect(page.locator("[data-insertion-line]")).toHaveCount(0);
		await expect(gap).toHaveCSS("opacity", "0");
		const row = page.getByRole("button", { name: "PAY-105", exact: true }).locator("xpath=ancestor::tr");
		await row.hover({ position: { x: 200, y: 2 } });
		await expect(page.locator("[data-insertion-line]").first()).toBeVisible();
		const beforeGap = page.getByRole("button", { name: "Create work item before PAY-105", exact: true });
		await beforeGap.click();
		await draft.fill(`Another ${view} work item`);
		await draft.press("Enter");
		await expect(draft).toHaveValue("");
		await page.getByRole("searchbox", { name: view === "List" ? "Search list" : "Search backlog" }).click();
		await expect(draft).toHaveCount(0);
		await expect(page.locator("[data-insertion-line]")).toHaveCount(0);
	});
}

for (const view of ["List", "Backlog"] as const) {
	test(`${view} opens the inline draft with a smooth expansion`, async ({ page }) => {
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		const gap = page.getByRole("button", { name: "Create work item after PAY-105", exact: true });
		await expect(gap).toBeAttached({ timeout: 30_000 });
		await gap.focus();
		await page.evaluate(() => {
			const target = window as Window & { draftEntrySamples?: Promise<number[]> };
			target.draftEntrySamples = new Promise((resolve) => {
				const observer = new MutationObserver(() => {
					const row = document.querySelector<HTMLTableRowElement>('tr[data-state="draft"]');
					if (!row) return;
					observer.disconnect();
					const heights = [row.getBoundingClientRect().height];
					const sample = () => {
						heights.push(row.getBoundingClientRect().height);
						if (heights.length < 20) requestAnimationFrame(sample);
						else resolve(heights);
					};
					requestAnimationFrame(sample);
				});
				observer.observe(document.body, { childList: true, subtree: true });
			});
		});
		await gap.press("Enter");
		const heights = await page.evaluate(() => {
			const samples = (window as Window & { draftEntrySamples?: Promise<number[]> }).draftEntrySamples;
			if (!samples) throw new Error("Expected entry animation samples");
			return samples;
		});
		expect(Math.max(...heights)).toBeGreaterThan(0);
		expect(heights.some((height) => height > 0 && height < Math.max(...heights) - 1)).toBe(true);
		await expect(page.getByRole("textbox", { name: "New work item summary" })).toBeFocused();
	});

	test(`${view} can dismiss a draft while it is opening`, async ({ page }) => {
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		const gap = page.getByRole("button", { name: "Create work item after PAY-105", exact: true });
		await gap.focus();
		await gap.press("Enter");
		await page.keyboard.press("Escape");
		await expect(page.getByRole("textbox", { name: "New work item summary" })).toHaveCount(0);
		await expect(page.locator('tr[data-state="draft"]')).toHaveCount(0);
	});

	test(`${view} opens the inline draft immediately with reduced motion`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		const gap = page.getByRole("button", { name: "Create work item after PAY-105", exact: true });
		await gap.focus();
		await gap.press("Enter");
		const draft = page.getByRole("textbox", { name: "New work item summary" });
		const heights = await draft.evaluate(async (input) => {
			const row = input.closest("tr");
			if (!row) throw new Error("Expected a draft row");
			const samples = [row.getBoundingClientRect().height];
			for (let frame = 0; frame < 5; frame++) {
				await new Promise(requestAnimationFrame);
				samples.push(row.getBoundingClientRect().height);
			}
			return samples;
		});
		expect(Math.min(...heights)).toBeGreaterThanOrEqual(39);
		expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
	});

	test(`${view} smoothly collapses the dismissed inline draft`, async ({ page }) => {
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		const gap = page.getByRole("button", { name: "Create work item after PAY-105", exact: true });
		await expect(gap).toBeAttached({ timeout: 30_000 });
		await gap.focus();
		await gap.press("Enter");
		const draft = page.getByRole("textbox", { name: "New work item summary" });
		await expect.poll(async () => (await draft.locator("xpath=ancestor::tr").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(39);
		const heights = await draft.evaluate(async (input) => {
			const row = input.closest("tr");
			if (!row) throw new Error("Expected a draft row");
			const samples = [row.getBoundingClientRect().height];
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			for (let frame = 0; frame < 30 && row.isConnected; frame++) {
				await new Promise(requestAnimationFrame);
				if (row.isConnected) samples.push(row.getBoundingClientRect().height);
			}
			return samples;
		});
		expect(heights[0]).toBeGreaterThan(0);
		expect(heights.some((height) => height > 0 && height < heights[0] - 1)).toBe(true);
		await expect(draft).toHaveCount(0);
	});

	test(`${view} dismisses the inline draft without motion when requested`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		const gap = page.getByRole("button", { name: "Create work item after PAY-105", exact: true });
		await expect(gap).toBeAttached({ timeout: 30_000 });
		await gap.focus();
		await gap.press("Enter");
		const draft = page.getByRole("textbox", { name: "New work item summary" });
		const motionObserved = await draft.evaluate(async (input) => {
			const row = input.closest("tr");
			if (!row) throw new Error("Expected a draft row");
			const initial = row.getBoundingClientRect().height;
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			for (let frame = 0; frame < 5 && row.isConnected; frame++) {
				await new Promise(requestAnimationFrame);
				const height = row.getBoundingClientRect().height;
				if (row.isConnected && height > 0 && height < initial - 1) return true;
			}
			return false;
		});
		expect(motionObserved).toBe(false);
		await expect(draft).toHaveCount(0);
	});

	test(`${view} hides other creation controls until the inline draft is dismissed`, async ({ page }) => {
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		const gaps = page.locator('[data-insertion-position]');
		const gap = page.getByRole("button", { name: "Create work item after PAY-105", exact: true });
		await expect(gap).toBeAttached({ timeout: 30_000 });
		await gap.focus();
		await gap.press("Enter");
		const draft = page.getByRole("textbox", { name: "New work item summary" });
		await draft.fill("Keep this draft");
		const otherRow = page.getByRole("row").filter({ has: page.getByRole("button", { name: "PAY-124", exact: true }) });
		await otherRow.hover({ position: { x: 200, y: 2 } });
		await expect(gaps).toHaveCount(0);
		await expect(page.locator('[data-insertion-line]')).toHaveCount(0);
		if (view === "List") {
			await page.getByRole("columnheader", { name: /^Work/ }).hover({ position: { x: 10, y: 10 } });
			await expect(page.locator('[data-boundary-control]')).toHaveCount(0);
		}
		await draft.press("Escape");
		await expect(draft).toHaveCount(0);
		await expect(gap).toBeAttached();
		if (view === "List") {
			await expect(page.locator('[data-boundary-control]').first()).toBeAttached();
		}
	});
}
