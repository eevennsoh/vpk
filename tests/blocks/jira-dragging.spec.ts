import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

async function selectedBorderColor(page: Page) {
	return page.evaluate(() => {
		const probe = document.createElement("span");
		probe.style.borderColor = "var(--ds-border-selected)";
		document.body.append(probe);
		const color = getComputedStyle(probe).borderTopColor;
		probe.remove();
		return color;
	});
}

async function recordNativeDragPointer(page: Page) {
	await page.evaluate(() => {
		const record = (event: DragEvent) => {
			document.documentElement.dataset.nativeIssuePointer = `${event.clientX},${event.clientY}`;
		};
		document.addEventListener("dragenter", record, true);
		document.addEventListener("dragover", record, true);
	});
}

async function settleNativeDragPointer(page: Page, x: number, y: number) {
	// CDP mousemove can return before Chromium delivers its native drag event.
	await expect(page.locator("html")).toHaveAttribute("data-native-issue-pointer", `${x},${y}`);
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function backdropGeometry(page: Page, title: string) {
	return page.locator(`[data-jira-kanban-column="${title}"]`).evaluate((column) => {
		const backdrop = column.querySelector<HTMLElement>("[data-jira-kanban-column-backdrop]")!;
		const content = column.querySelector<HTMLElement>("[data-jira-kanban-column-content]")!;
		const rect = backdrop.getBoundingClientRect();
		const contentRect = content.getBoundingClientRect();
		const style = getComputedStyle(backdrop);
		const insets = style.clipPath.split("round")[0].replace("inset(", "").trim().split(/\s+/);
		const bottom = parseFloat(insets[2] ?? insets[0]);
		return {
			clip: style.clipPath,
			background: style.backgroundColor,
			radius: style.borderRadius,
			paintedBottom: rect.bottom - bottom,
			contentBottom: contentRect.bottom,
		};
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const title of ["In review", "Done"]) {
		test(`${title} drop border hugs content and full-height targets still accept drops (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
			await page.waitForLoadState("networkidle");
			const review = page.locator(`[data-jira-kanban-column="${title}"]`);
			const selectedColor = await selectedBorderColor(page);
			const geometry = () => review.evaluate((column) => {
				const backdrop = column.querySelector<HTMLElement>('[data-jira-kanban-column-backdrop]')!;
				const ring = column.querySelector<HTMLElement>('[data-jira-kanban-column-drop-ring]') ?? column;
				const box = ring.getBoundingClientRect();
				const paint = backdrop.getBoundingClientRect();
				const clip = getComputedStyle(backdrop).clipPath.split("round")[0].replace("inset(", "").trim().split(/\s+/);
				const croppedBottom = parseFloat(clip[2] ?? clip[0]);
				const outer = column.getBoundingClientRect();
				const inset = parseFloat(getComputedStyle(column).borderBottomWidth);
				return {
					top: box.top, bottom: box.bottom, height: box.height,
					expectedBottom: paint.bottom - croppedBottom + inset,
					columnTop: outer.top, columnBottom: outer.bottom, columnHeight: outer.height,
					color: getComputedStyle(ring).borderTopColor,
					background: getComputedStyle(ring).backgroundColor,
				};
			});
			const initial = await geometry();
			expect(initial.columnHeight).toBeGreaterThan(500);
			for (const [index, code] of ["PAY-105", "PAY-107"].entries()) {
				const card = page.locator(`[data-issue-key="${code}"] [draggable]`).first();
				await card.hover({ position: { x: 70, y: 30 } });
				const source = (await card.boundingBox())!;
				const target = (await review.boundingBox())!;
				await page.mouse.move(source.x + 70, source.y + 30);
				await page.mouse.down();
				await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
				await expect(card).toHaveAttribute("data-dragging", "true");
				const content = (await review.locator('[data-jira-kanban-column-content]').boundingBox())!;
				// Exercise both the real UI and the full-height invisible remainder.
				for (const y of [target.y + target.height - 70, content.y + content.height - 12, target.y + target.height - 90]) {
					await page.mouse.move(target.x + 90, y, { steps: 5 });
					await page.mouse.move(target.x + 91, y);
					await expect.poll(async () => (await geometry()).color).toBe(index === 0 ? selectedColor : "rgba(0, 0, 0, 0)");
					await expect.poll(async () => (await geometry()).background).toBe("rgba(0, 0, 0, 0)");
					if (y === content.y + content.height - 12) {
						await expect(review.locator('[data-issue-drop-entered]')).toHaveAttribute("data-issue-drop-entered", title);
						if (index === 0) {
							await expect(review.locator('[data-insertion-line]')).toHaveCount(0);
						} else {
							await expect(review.locator('[data-insertion-line]')).toHaveCSS("background-color", selectedColor);
						}
					}
					await expect.poll(() => page.locator('[data-jira-kanban-column="To do"] [data-jira-kanban-column-drop-ring]').evaluate((node) => getComputedStyle(node).borderTopColor)).toBe("rgba(0, 0, 0, 0)");
					await expect.poll(() => page.locator('[data-jira-kanban-column="To do"] [data-jira-kanban-column-drop-ring]').evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
					await expect.poll(async () => {
						const box = await geometry();
						return Math.abs(box.bottom - box.expectedBottom);
					}).toBeLessThan(1);
					const box = await geometry();
					expect(box.columnHeight).toBe(initial.columnHeight);
					expect(box.top).toBeCloseTo(box.columnTop, 0);
					expect(box.height).toBeLessThan(box.columnHeight - 200);
				}
				await page.screenshot({ path: `output/agent-browser/jira-dragging/drop-border-${title.replaceAll(" ", "-")}-${index}-${reducedMotion}.png`, timeout: 5000 });
				await page.mouse.up();
				await expect(review.locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(index + 1);
				await expect.poll(async () => (await geometry()).color).toBe("rgba(0, 0, 0, 0)");
				await expect.poll(async () => (await geometry()).background).toBe("rgba(0, 0, 0, 0)");
			}
		});
	}

	for (const status of ["In progress", "Paused"]) {
		test(`empty In progress offers both workflow targets and commits ${status} (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
			await page.waitForLoadState("networkidle");
			await recordNativeDragPointer(page);
			const selectedColor = await selectedBorderColor(page);
			const column = (title: string) => page.locator(`[data-jira-kanban-column="${title}"]`);
			await expect(page.locator('[data-jira-kanban-column]')).toHaveCount(4);
			await expect(column("To do").locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(4);
			for (const title of ["In progress", "In review", "Done"]) {
				await expect(column(title).locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(0);
			}
			const card = page.locator('[data-issue-key="PAY-105"] [draggable]').first();
			async function start() {
				const source = (await card.boundingBox())!;
				await page.mouse.move(source.x + 70, source.y + 30);
				await page.mouse.down();
				await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
				await expect(card).toHaveAttribute("data-dragging", "true");
			}
			await start();
			const progress = column("In progress");
			await progress.evaluate((column) => {
				let status = "";
				let start = 0;
				document.addEventListener("dragover", (event) => {
					const zone = (event.target as Element).closest<HTMLElement>("[data-issue-status-zone]");
					if (zone && column.contains(zone) && zone.dataset.issueStatusZone !== status) {
						status = zone.dataset.issueStatusZone!;
						start = performance.now();
					}
				}, true);
				new MutationObserver(() => {
					if (column.querySelector("[data-issue-drop-entered]")) {
						(column as HTMLElement).dataset.statusDwellElapsed = String(performance.now() - start);
					}
				}).observe(column, { subtree: true, attributes: true, attributeFilter: ["data-issue-drop-entered"] });
			});
			const choices = progress.getByRole("group", { name: "Choose a status in In progress", exact: true });
			const ring = progress.locator('[data-jira-kanban-column-drop-ring]');
			await expect(choices).toBeVisible();
			await expect(progress.getByText("To do →", { exact: true })).toBeVisible();
			await expect(choices.locator('[data-issue-status-zone]')).toHaveCount(2);
			await expect(ring).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
			await expect(choices).toHaveCSS("border-top-width", "0px");
			for (const option of ["In progress", "Paused"]) {
				const zone = choices.locator(`[data-issue-status-zone="${option}"]`);
				await expect(zone).toContainText("Transition to");
				await expect(zone).toContainText(option);
			}
			const bounds = (await progress.boundingBox())!;
			await page.mouse.move(bounds.x + 100, bounds.y + 12, { steps: 3 });
			await expect(choices).toBeVisible();
			await expect(ring).toHaveCSS("border-top-color", selectedColor);
			await page.screenshot({ path: `output/agent-browser/jira-dragging/empty-dual-targets-${status.replaceAll(" ", "-")}-${reducedMotion}.png` });
			const zone = (await choices.locator(`[data-issue-status-zone="${status}"]`).boundingBox())!;
			const zoneX = Math.round(zone.x + zone.width / 2);
			const zoneY = Math.round(zone.y + zone.height / 2);
			await page.mouse.move(zoneX, zoneY, { steps: 5 });
			await expect(progress.locator('[data-issue-drop-entered]')).toHaveAttribute("data-issue-drop-entered", status);
			expect(Number(await progress.getAttribute("data-status-dwell-elapsed"))).toBeGreaterThanOrEqual(450);
			await expect(ring).toHaveCSS("border-top-color", selectedColor);
			await expect.poll(async () => {
				const progressHeight = (await ring.boundingBox())!.height;
				const reviewHeight = (await column("In review").locator('[data-jira-kanban-column-drop-ring]').boundingBox())!.height;
				return Math.abs(progressHeight - reviewHeight);
			}).toBeLessThan(1);
			await expect(progress).toContainText(`To do → ${status}`);
			await page.mouse.move(zoneX + 1, zoneY);
			await settleNativeDragPointer(page, zoneX + 1, zoneY);
			const traveller = page.locator('[data-issue-cohort-preview]');
			const firstPose = (await traveller.boundingBox())!;
			await page.mouse.move(zoneX + 21, zoneY);
			await settleNativeDragPointer(page, zoneX + 21, zoneY);
			await expect.poll(async () => (await traveller.boundingBox())!.x - firstPose.x).toBeCloseTo(20, 0);
			const unusedY = Math.round(bounds.y + bounds.height - 80);
			await page.mouse.move(zoneX, unusedY, { steps: 5 });
			await page.mouse.move(zoneX + 1, unusedY);
			await settleNativeDragPointer(page, zoneX + 1, unusedY);
			await expect(progress.locator('[data-issue-drop-entered]')).toHaveAttribute("data-issue-drop-entered", status);
			await expect(ring).toHaveCSS("border-top-color", selectedColor);
			await page.screenshot({ path: `output/agent-browser/jira-dragging/entered-${status.replaceAll(" ", "-")}-${reducedMotion}.png` });
			await page.mouse.up();
			await expect(progress.locator('[data-issue-key="PAY-105"]')).toHaveCount(1);
			await expect(column("To do").locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(3);
			await expect(progress.getByRole("button", { name: "Cursor: Working", exact: true })).toBeVisible();
			// The next drag exposes the committed status, then exercises In review.
			await start();
			const review = column("In review");
			const target = (await review.locator('[data-jira-kanban-column-content]').boundingBox())!;
			await page.mouse.move(target.x + 90, target.y + target.height - 12, { steps: 5 });
			await page.mouse.move(target.x + 91, target.y + target.height - 12);
			await expect(review).toContainText(`${status} → In review`);
			await page.mouse.up();
			await expect(review.locator('[data-issue-key="PAY-105"]')).toHaveCount(1);
			await expect(progress.locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(0);
		});
	}

	test(`dual status choices fill empty and populated columns (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const progress = page.locator('[data-jira-kanban-column="In progress"]');
		for (const [count, code] of ["PAY-105", "PAY-107"].entries()) {
			const card = page.locator(`[data-issue-key="${code}"] [draggable]`).first();
			await card.hover({ position: { x: 70, y: 30 } });
			const source = (await card.boundingBox())!;
			await page.mouse.move(source.x + 70, source.y + 30);
			await page.mouse.down();
			await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
			await expect(card).toHaveAttribute("data-dragging", "true");
			const choices = progress.getByRole("group", { name: "Choose a status in In progress", exact: true });
			await expect(choices).toBeVisible();
			await expect.poll(async () => {
				const column = (await progress.boundingBox())!;
				const panel = (await choices.boundingBox())!;
				return column.y + column.height - panel.y - panel.height;
			}).toBeLessThan(16);
			const column = (await progress.boundingBox())!;
			const panel = (await choices.boundingBox())!;
			expect(panel.height).toBeGreaterThan(column.height - 80);
			await page.screenshot({ path: `output/agent-browser/jira-dragging-side/choices-count-${count}-${reducedMotion}.png` });
			const paused = (await choices.locator('[data-issue-status-zone="Paused"]').boundingBox())!;
			await page.mouse.move(paused.x + 90, paused.y + paused.height / 2, { steps: 5 });
			await page.mouse.move(paused.x + 91, paused.y + paused.height / 2);
			await expect(progress.locator('[data-issue-drop-entered]')).toHaveAttribute("data-issue-drop-entered", "Paused");
			await page.mouse.up();
			await expect(progress.locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(count + 1);
		}
	});

	test(`unassigned space does not choose a status or keep a pending dwell (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		await recordNativeDragPointer(page);
		const progress = page.locator('[data-jira-kanban-column="In progress"]');
		const card = page.locator('[data-issue-key="PAY-105"] [draggable]').first();
		for (const space of ["frame", "pending-frame", "pending-below"]) {
			const hoverChoice = space !== "frame";
			const source = (await card.boundingBox())!;
			await page.mouse.move(source.x + 70, source.y + 30);
			await page.mouse.down();
			await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
			await expect(card).toHaveAttribute("data-dragging", "true");
			const choices = progress.getByRole("group", { name: "Choose a status in In progress", exact: true });
			await expect(choices).toBeVisible();
			const panel = (await choices.boundingBox())!;
			const paused = (await choices.locator('[data-issue-status-zone="Paused"]').boundingBox())!;
			const y = Math.round(paused.y + paused.height / 2);
			if (hoverChoice) {
				const x = Math.round(paused.x + 90);
				await page.mouse.move(x, y, { steps: 3 });
				await page.mouse.move(x + 1, y);
				await settleNativeDragPointer(page, x + 1, y);
			}
			// Neither the frame nor the small bottom gutter belongs to a status.
			const column = (await progress.boundingBox())!;
			const blankX = Math.round(panel.x + (space === "pending-below" ? 90 : 1));
			const blankY = space === "pending-below" ? Math.round(column.y + column.height - 3) : y;
			await page.mouse.move(blankX, blankY, { steps: 3 });
			await page.mouse.move(blankX, blankY + 1);
			await settleNativeDragPointer(page, blankX, blankY + 1);
			if (hoverChoice) await page.waitForTimeout(650);
			await expect(progress.locator('[data-issue-drop-entered]')).toHaveCount(0);
			await page.mouse.up();
			await expect(progress.locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(0);
			await expect(page.locator('[data-jira-kanban-column="To do"] [data-issue-key="PAY-105"]')).toHaveCount(1);
		}
	});

	test(`fixed-anchor ranges shrink, reverse and extend across columns (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const card = (code: string) => page.locator(`[data-issue-key="${code}"] [draggable]`).first();
		const selected = () => page.locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes.filter((node) => node.querySelector('[data-jira-issue-activation-control][aria-pressed="true"]')).map((node) => node.getAttribute("data-issue-key")));
		const click = (code: string, modifiers: ("Shift" | "ControlOrMeta")[] = ["Shift"]) => card(code).click({ position: { x: 70, y: 30 }, modifiers });
		await click("PAY-105");
		await click("PAY-130");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107", "PAY-123", "PAY-130"]);
		await click("PAY-107");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107"]);
		await click("PAY-105");
		await expect.poll(selected).toEqual(["PAY-105"]);
		await page.keyboard.press("Escape");
		await click("PAY-107");
		await click("PAY-130");
		await click("PAY-105");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107"]);
		await click("PAY-107");
		await expect.poll(selected).toEqual(["PAY-107"]);
		await click("PAY-130", []);
		await expect.poll(selected).toEqual(["PAY-107"]);
		await click("PAY-123", ["ControlOrMeta"]);
		await expect.poll(selected).toEqual(["PAY-107", "PAY-123"]);
		await click("PAY-130");
		await expect.poll(selected).toEqual(["PAY-123", "PAY-130"]);
		await page.getByRole("checkbox", { name: "Select PAY-123", exact: true }).click();
		await expect.poll(selected).toEqual(["PAY-130"]);
		await click("PAY-107");
		await expect.poll(selected).toEqual(["PAY-107"]);

		// A native drag gives the second column a card without changing the fixtures.
		const source = (await card("PAY-130").boundingBox())!;
		const done = (await page.locator('[data-jira-kanban-column="Done"]').boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await page.mouse.move(done.x + 90, done.y + 100, { steps: 5 });
		await page.mouse.move(done.x + 91, done.y + 100);
		await page.mouse.up();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-issue-key="PAY-130"]')).toHaveCount(1);
		await click("PAY-105");
		await click("PAY-123");
		await click("PAY-130", ["ControlOrMeta"]);
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107", "PAY-123", "PAY-130"]);
		await click("PAY-107");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107", "PAY-130"]);
		await click("PAY-130");
		await expect.poll(selected).toEqual(["PAY-130"]);
	});

	test(`pointer selection focuses cards without the keyboard ring (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/components/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const issue = (code: string) => page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`);
		const activation = (code: string) => issue(code).locator('[data-jira-issue-activation-control]');
		const surface = (code: string) => issue(code).locator('[data-slot="jira-issue-surface"]');
		const click = (code: string, modifiers?: ("Shift" | "ControlOrMeta")[]) => issue(code).locator('[draggable]').first().click({ position: { x: 70, y: 30 }, modifiers });
		for (const [code, modifier] of [["PAY-105", "Shift"], ["PAY-107", "ControlOrMeta"]] as const) {
			if (modifier === "Shift") await page.keyboard.down("Shift");
			await click(code, modifier === "Shift" ? undefined : [modifier]);
			await expect(activation(code)).toBeFocused();
			await expect(activation(code)).toHaveAttribute("aria-pressed", "true");
			expect(await activation(code).evaluate((node) => node.matches(":focus-visible"))).toBe(false);
			await expect(surface(code)).toHaveCSS("outline-style", "none");
			if (modifier === "Shift") {
				await page.screenshot({ path: `output/agent-browser/jira-shift-focus-side/shift-click-${reducedMotion}.png` });
				await page.keyboard.up("Shift");
			}
		}
		await page.keyboard.press("ArrowUp");
		await expect(activation("PAY-105")).toBeFocused();
		await expect(surface("PAY-105")).toHaveCSS("outline-width", "3px");
		await expect(surface("PAY-105")).toHaveCSS("outline-style", "solid");
		// A pointer selection must also clear the ring on an already focused card.
		await page.keyboard.down("Shift");
		await click("PAY-105");
		await expect(activation("PAY-105")).toBeFocused();
		await expect(surface("PAY-105")).toHaveCSS("outline-style", "none");
		await page.keyboard.up("Shift");
	});

	test(`keyboard navigation resizes ranges and leaves editors and other controls alone (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/components/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const control = (code: string) => page.locator(`[data-issue-key="${code}"] [data-jira-issue-activation-control]`);
		const selected = () => page.locator('[data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes.filter((node) => node.querySelector('[data-jira-issue-activation-control][aria-pressed="true"]')).map((node) => node.getAttribute("data-issue-key")));
		await control("PAY-105").focus();
		await page.keyboard.press("ArrowUp");
		await expect(control("PAY-105")).toBeFocused();
		await page.keyboard.press("ArrowDown");
		await expect(control("PAY-107")).toBeFocused();
		expect(await control("PAY-107").evaluate((node) => node.matches(":focus-visible"))).toBe(true);
		await expect.poll(selected).toEqual([]);
		await page.keyboard.press("Shift+ArrowDown");
		await expect(control("PAY-123")).toBeFocused();
		expect(await control("PAY-123").evaluate((node) => node.matches(":focus-visible"))).toBe(false);
		await expect(page.locator('[data-board-agent-session-drop-zone="issue"][data-issue-key="PAY-123"] [data-slot="jira-issue-surface"]')).toHaveCSS("outline-style", "none");
		await expect.poll(selected).toEqual(["PAY-107", "PAY-123"]);
		await page.screenshot({ path: `output/agent-browser/side-selection-focus/range-${reducedMotion}.png` });
		await page.keyboard.press("Shift+ArrowUp");
		await expect.poll(selected).toEqual(["PAY-107"]);
		expect(await control("PAY-107").evaluate((node) => node.matches(":focus-visible"))).toBe(false);
		await page.keyboard.press("Shift+ArrowUp");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107"]);
		await page.keyboard.press("Shift+ArrowDown");
		await expect.poll(selected).toEqual(["PAY-107"]);
		await page.keyboard.press("ControlOrMeta+a");
		await expect.poll(selected).toEqual(["PAY-107"]);
		await page.keyboard.press("Shift+ArrowUp");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107"]);
		const search = page.getByRole("searchbox", { name: "Search components", exact: true });
		await search.fill("Jira");
		await page.keyboard.press("ControlOrMeta+a");
		await page.keyboard.press("Shift+ArrowDown");
		await page.keyboard.press("Escape");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107"]);
		await search.fill("");
		await page.getByRole("button", { name: "Pull request failed #1851: Port 3DS flow", exact: true }).focus();
		await page.keyboard.press("ControlOrMeta+a");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107"]);
		await page.getByRole("button", { name: "Collapse To do column", exact: true }).click();
		await page.locator('[data-jira-kanban-scrollport]').focus();
		await page.keyboard.press("ControlOrMeta+a");
		await expect.poll(selected).toEqual([]);
		await page.getByRole("button", { name: "Expand To do column", exact: true }).focus();
		await page.keyboard.press("Enter");
		await page.locator('[data-jira-kanban-scrollport]').focus();
		await page.keyboard.press("ControlOrMeta+a");
		await expect.poll(selected).toEqual(["PAY-105", "PAY-107"]);
		await control("PAY-105").focus();
		await page.keyboard.press("Escape");
		await expect.poll(selected).toEqual([]);
		await page.screenshot({ path: `output/agent-browser/jira-dragging/keyboard-selection-${reducedMotion}.png` });
	});

	test(`Escape closes popups, cancels a drag preserving its range, then clears (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const card = (code: string) => page.locator(`[data-issue-key="${code}"] [draggable]`).first();
		for (const code of ["PAY-105", "PAY-107"]) await card(code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const toolbar = page.getByRole("region", { name: "2 cards selected. Bulk actions available." });
		await toolbar.getByRole("button", { name: "More actions", exact: true }).click();
		await expect(page.getByRole("menu")).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("menu")).toHaveCount(0);
		await expect(toolbar).toBeVisible();
		await toolbar.getByRole("button", { name: "Add agent", exact: true }).click();
		await expect(page.getByRole("combobox", { name: "Search agents", exact: true })).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(toolbar.getByRole("button", { name: "Add agent", exact: true })).toHaveAttribute("aria-expanded", "false");
		await expect(page.getByRole("menu")).toHaveCount(0);
		await expect(toolbar).toBeVisible();
		const source = (await card("PAY-105").boundingBox())!;
		const done = (await page.locator('[data-jira-kanban-column="Done"]').boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await expect(page.locator('[data-issue-cohort-preview]')).toHaveAttribute("data-issue-cohort-count", "2");
		await page.mouse.move(done.x + 90, done.y + 100, { steps: 5 });
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(page.locator('[data-issue-cohort-preview]')).toHaveCount(0);
		await expect(toolbar).toBeVisible();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-board-agent-session-drop-zone="issue"]')).toHaveCount(0);
		await page.locator('[data-issue-key="PAY-105"] [data-jira-issue-activation-control]').focus();
		await page.keyboard.press("Escape");
		await expect(page.locator('[data-slot="jira-toolbar"]')).toHaveCount(0);
	});

	test(`selection replaces only its column's ellipses with checkboxes (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const card = (code: string) => page.locator(`[data-issue-key="${code}"] [draggable]`).first();
		const source = (await card("PAY-130").boundingBox())!;
		const done = (await page.locator('[data-jira-kanban-column="Done"]').boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await expect(card("PAY-130")).toHaveAttribute("data-dragging", "true");
		await page.mouse.move(done.x + 90, done.y + 100, { steps: 5 });
		await page.mouse.move(done.x + 91, done.y + 100);
		await page.mouse.up();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-issue-key="PAY-130"]')).toHaveCount(1);
		await card("PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await page.mouse.move(900, 30);
		const selected = page.getByRole("checkbox", { name: "Select PAY-105", exact: true });
		await expect(selected).toBeChecked();
		await expect(selected).toHaveAttribute("data-slot", "checkbox");
		await expect(selected).toHaveCSS("width", "16px");
		await expect(selected).toHaveCSS("height", "16px");
		await expect(selected.locator('[data-slot="checkbox-indicator"]')).toBeVisible();
		for (const code of ["PAY-107", "PAY-123"]) {
			const checkbox = page.getByRole("checkbox", { name: `Select ${code}`, exact: true });
			await expect(checkbox).toBeVisible();
			await expect(checkbox).not.toBeChecked();
			await expect(checkbox).toHaveAttribute("data-slot", "checkbox");
			await expect(checkbox.locator('[data-slot="checkbox-indicator"]')).toBeHidden();
		}
		await expect(page.getByRole("button", { name: "More actions for PAY-130", exact: true })).toHaveCount(1);
		await expect(page.getByRole("checkbox", { name: "Select PAY-130", exact: true })).toHaveCount(0);
		const second = page.getByRole("checkbox", { name: "Select PAY-107", exact: true });
		await second.click();
		await expect(second).toBeChecked();
		await expect(page.getByRole("region", { name: "2 cards selected. Bulk actions available." })).toBeVisible();
		await expect(page.getByRole("menu")).toHaveCount(0);
		await page.keyboard.press("Tab");
		await second.focus();
		await expect.poll(() => second.evaluate((node) => node.matches(":focus-visible"))).toBe(true);
		await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
		await expect.poll(() => second.evaluate((node) => node.getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
		const focusChrome = (node: Element) => {
			const style = getComputedStyle(node);
			return { borderWidth: style.borderWidth, radius: style.borderRadius, halo: style.boxShadow };
		};
		const checkedFocus = await second.evaluate(focusChrome);
		expect(checkedFocus.halo).not.toBe("none");
		await page.keyboard.press("Space");
		await expect(second).not.toBeChecked();
		await expect(second).toBeFocused();
		await expect.poll(() => second.evaluate(focusChrome)).toEqual(checkedFocus);
		await expect(selected).toBeChecked();
		await page.screenshot({ path: `output/agent-browser/jira-dragging/selection-checkboxes-${reducedMotion}.png` });
		await selected.click();
		await expect(page.locator('[data-jira-issue-selection-control]')).toHaveCount(0);
		await expect(page.getByRole("button", { name: "More actions for PAY-105", exact: true })).toHaveCount(1);
		await expect(page.locator('[data-slot="jira-toolbar"]')).toHaveCount(0);
	});

	test(`selected issue backdrops fuse while white cards travel as one deck (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		await recordNativeDragPointer(page);
		const issue = (code: string) => page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`);
		const backdrop = (code: string) => issue(code).locator('[data-slot="jira-issue-agent-backdrop"]');
		const card = (code: string) => issue(code).locator('[draggable]').first();
		const tops = () => page.locator('[data-jira-kanban-column="To do"] [data-board-agent-session-drop-zone="issue"]').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
		for (const code of ["PAY-105", "PAY-107"]) await expect(backdrop(code)).toHaveCSS("opacity", "1");
		for (const code of ["PAY-123", "PAY-130"]) await expect(backdrop(code)).toHaveCSS("opacity", "0");
		const restingTops = await tops();
		for (const code of ["PAY-105", "PAY-107", "PAY-123"]) await card(code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await page.mouse.move(900, 30);
		for (const code of ["PAY-105", "PAY-107", "PAY-123"]) {
			await expect(backdrop(code)).toHaveClass(/bg-bg-selected/);
			await expect(issue(code).locator('[data-slot="jira-issue-surface"]')).toHaveClass(/bg-surface/);
		}
		await expect(backdrop("PAY-105")).toHaveCSS("border-bottom-left-radius", "0px");
		await expect(backdrop("PAY-107")).toHaveCSS("border-top-left-radius", "0px");
		await expect(backdrop("PAY-107")).toHaveCSS("border-bottom-left-radius", "0px");
		await expect(backdrop("PAY-123")).toHaveCSS("border-top-left-radius", "0px");
		await expect(backdrop("PAY-123")).toHaveCSS("border-bottom-left-radius", "10px");
		await expect(issue("PAY-123").locator('[data-slot="jira-issue-agent-row-wrap"]')).toHaveCount(0);
		await expect.poll(async () => {
			const first = (await backdrop("PAY-105").boundingBox())!;
			const second = (await backdrop("PAY-107").boundingBox())!;
			return Math.abs(first.y + first.height - second.y);
		}).toBeLessThan(0.5);
		// Fused cards keep equal gutters above and below the agent row.
		for (const [code, next] of [["PAY-105", "PAY-107"], ["PAY-107", "PAY-123"]]) {
			await expect.poll(async () => {
				const face = (await issue(code).locator('[data-slot="jira-issue-surface"]').boundingBox())!;
				const chin = (await issue(code).locator('[data-slot="jira-issue-agent-row"] button').first().boundingBox())!;
				const nextFace = (await issue(next).locator('[data-slot="jira-issue-surface"]').boundingBox())!;
				return { above: chin.y - face.y - face.height, below: nextFace.y - chin.y - chin.height };
			}).toEqual({ above: 8, below: 8 });
		}
		const before = await tops();
		expect(before[0]).toEqual(restingTops[0]);
		expect(before[1]).toBeLessThan(restingTops[1]);
		expect(before[2]).toBeLessThan(restingTops[2]);
		await page.screenshot({ path: `output/agent-browser/jira-dragging/fused-selection-${reducedMotion}.png` });

		async function start(code: string) {
			const box = (await card(code).boundingBox())!;
			await page.mouse.move(box.x + 70, box.y + 30);
			await page.mouse.down();
			await page.mouse.move(box.x + 95, box.y + 35, { steps: 5 });
			await expect(card(code)).toHaveAttribute("data-dragging", "true");
		}
		await start("PAY-105");
		const traveller = page.locator('[data-issue-cohort-preview]');
		await expect(traveller).toHaveAttribute("data-issue-cohort-count", "3");
		await expect(traveller).toHaveAttribute("aria-hidden", "true");
		await expect(traveller).toHaveAttribute("inert", "");
		await expect(traveller.locator('[data-issue-deck-layer]')).toHaveCount(2);
		await expect(traveller.locator('[data-slot="badge"]')).toHaveText("3");
		await expect(traveller.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCount(0);
		const done = (await page.locator('[data-jira-kanban-column="Done"]').boundingBox())!;
		await page.mouse.move(done.x + 90, done.y + 240, { steps: 5 });
		await page.mouse.move(done.x + 90, done.y + 240);
		await settleNativeDragPointer(page, done.x + 90, done.y + 240);
		await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
		const firstPose = (await traveller.boundingBox())!;
		await page.mouse.move(done.x + 110, done.y + 256);
		await settleNativeDragPointer(page, done.x + 110, done.y + 256);
		await expect.poll(async () => (await traveller.boundingBox())!.x - firstPose.x).toBeCloseTo(20, 0);
		expect((await traveller.boundingBox())!.y - firstPose.y).toBeCloseTo(16, 0);
		expect(await tops()).toEqual(before);
		if (reducedMotion === "no-preference") await page.emulateMedia({ reducedMotion: "reduce" });
		await expect.poll(() => traveller.evaluate((node) => node.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length)).toBe(0);
		await page.screenshot({ path: `output/agent-browser/jira-dragging/issue-deck-${reducedMotion}.png` });
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(traveller).toHaveCount(0);
		await expect(page.locator('[data-issue-cohort-drag-image]')).toHaveCount(0);
		await expect(page.locator('[data-jira-kanban-column="To do"] [data-board-agent-session-drop-zone="issue"]')).toHaveCount(4);

		// A chin-free member leads the next deck; all three cards move together.
		await page.emulateMedia({ reducedMotion });
		for (const code of ["PAY-105", "PAY-123"]) await card(code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await start("PAY-123");
		await expect(traveller).toHaveAttribute("data-issue-cohort-count", "3");
		await expect(traveller).toContainText("Record the three missing decline-code fixtures");
		await expect(traveller.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCount(0);
		// Simulate a host selection change while native drag still owns the pointer.
		await page.getByRole("button", { name: "Select all", exact: true }).evaluate((button) => (button as HTMLButtonElement).click());
		await expect(traveller).toHaveCount(0);
		await page.mouse.move(done.x + 90, done.y + 240, { steps: 5 });
		await page.mouse.up();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-board-agent-session-drop-zone="issue"]')).toHaveCount(0);
		await page.getByRole("button", { name: "Clear selection", exact: true }).click();
		await expect.poll(tops).toEqual(restingTops);
		for (const code of ["PAY-105", "PAY-123"]) await card(code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await start("PAY-123");
		await page.mouse.move(done.x + 90, done.y + 240, { steps: 5 });
		await page.mouse.move(done.x + 91, done.y + 240);
		await page.mouse.up();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-board-agent-session-drop-zone="issue"]')).toHaveCount(3);
		await expect(traveller).toHaveCount(0);
		await expect(page.locator('[data-issue-cohort-drag-image]')).toHaveCount(0);
	});

	test(`attached agent focus belongs to the full-width row surface (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/components/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		await page.keyboard.press("Tab");
		for (const name of ["Cursor: Working", "Claude with Maya Ferreira"]) {
			const row = page.getByRole("button", { name, exact: true });
			const surface = page.locator('[data-slot="jira-issue-agent-row"]').filter({ has: row });
			const geometry = () => surface.evaluate((node) => {
				const shell = node.getBoundingClientRect();
				const handle = node.querySelector("button")!.getBoundingClientRect();
				return { width: shell.width, height: shell.height, handleWidth: handle.width, handleHeight: handle.height, insetLeft: handle.left - shell.left, insetTop: handle.top - shell.top };
			});
			const before = await geometry();
			const cardWidth = await row.evaluate((node) => node.closest("article")!.querySelector('[data-slot="jira-issue-surface"]')!.getBoundingClientRect().width);
			expect(before.width).toEqual(cardWidth);
			await row.focus();
			await expect(row).toBeFocused();
			await expect(surface).toHaveCSS("border-radius", "6px");
			await expect(surface).toHaveCSS("outline-width", "1px");
			await expect(surface).toHaveCSS("outline-style", "solid");
			await expect.poll(() => surface.evaluate((node) => getComputedStyle(node).outlineColor)).not.toBe("rgba(0, 0, 0, 0)");
			await expect.poll(() => surface.evaluate((node) => getComputedStyle(node).boxShadow)).toContain("3px");
			await expect(row).toHaveCSS("box-shadow", "none");
			await expect(row).toHaveCSS("border-color", "rgba(0, 0, 0, 0)");
			expect(before.width).toBeGreaterThan(before.handleWidth);
			expect(await geometry()).toEqual(before);
			await page.screenshot({ path: `output/agent-browser/side-agent-row-focus/${name.startsWith("Cursor") ? "owner" : "viewer"}-${reducedMotion}.png` });
			await page.keyboard.press("Enter");
			await expect(row).toHaveAttribute("aria-expanded", "true");
			await page.keyboard.press("Escape");
			await expect(row).toHaveAttribute("aria-expanded", "false");
			await expect(row).toBeFocused();
			await expect.poll(() => surface.evaluate((node) => getComputedStyle(node).boxShadow)).toContain("3px");
		}
	});

	test(`card list avoids a column focus ring while cards keep keyboard focus (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		const list = page.locator('[data-jira-kanban-column="To do"] [data-jira-kanban-card-list]');
		await list.waitFor();
		await page.keyboard.press("Tab");
		await list.focus();
		await expect(list).toBeFocused();
		await expect(list).toHaveAttribute("tabindex", "-1");
		expect(await list.evaluate((node) => node.matches(":focus-visible"))).toBe(true);
		expect(await list.evaluate((node) => getComputedStyle(node).boxShadow)).not.toContain("3px");
		await expect(list).toHaveCSS("outline-style", "none");

		const card = page.getByRole("button", { name: "PAY-105: Port confirmPaymentIntent and the 3-D Secure challenge flow", exact: true });
		await card.focus();
		expect(await card.evaluate((node) => node.matches(":focus-visible"))).toBe(true);
		const surface = page.locator('[data-issue-key="PAY-105"] [data-slot="jira-issue-surface"]');
		await expect(surface).toHaveCSS("outline-width", "3px");
		await expect(surface).toHaveCSS("outline-style", "solid");
		await expect(surface).toHaveCSS("border-radius", "8px");
		await expect(surface).toHaveCSS("border-width", "1px");
		expect(await surface.evaluate((node) => getComputedStyle(node).outlineColor)).toMatch(/0\.5\)$/);
		expect(await card.evaluate((node) => getComputedStyle(node.parentElement!).boxShadow)).not.toContain("3px");

		// Arrow navigation moves focus and keeps the next card inside its scrollport.
		await page.locator('[data-jira-dragging]').evaluate((node) => { node.style.height = "360px"; });
		await expect.poll(() => list.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
		await page.keyboard.press("ArrowDown");
		await expect(page.locator('[data-issue-key="PAY-107"] [data-jira-issue-activation-control]')).toBeFocused();
		await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	});

	test(`selection shows the shared bulk toolbar and applies its actions (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		const card = (code: string) => page.locator(`[data-issue-key="${code}"] [draggable]`).first();
		await expect(page.locator('[data-slot="jira-toolbar"]')).toHaveCount(0);
		await card("PAY-105").click({ position: { x: 70, y: 30 } });
		await expect(page.locator('[data-slot="jira-toolbar"]')).toHaveCount(0);
		await card("PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["ControlOrMeta"] });
		await expect(page.getByRole("region", { name: "1 card selected. Bulk actions available." })).toBeVisible();
		await page.getByRole("button", { name: "Clear selection", exact: true }).click();
		await card("PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await expect(page.getByRole("region", { name: "1 card selected. Bulk actions available." })).toBeVisible();
		await page.getByRole("button", { name: "Select all", exact: true }).click();
		const all = page.getByRole("region", { name: "4 cards selected. Bulk actions available." });
		await expect(all).toBeVisible();
		await all.getByRole("button", { name: "Clear selection", exact: true }).click();
		await card("PAY-105").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await card("PAY-107").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await card("PAY-123").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const toolbar = page.getByRole("region", { name: "3 cards selected. Bulk actions available." });
		await expect(toolbar).toBeVisible();
		const selectAll = toolbar.getByRole("button", { name: "Select all", exact: true });
		expect(await selectAll.evaluate((button) => button.nextElementSibling?.matches('span[aria-hidden="true"]'))).toBe(true);
		await expect(toolbar.getByRole("button", { name: "Ask Rovo", exact: true }).locator('svg[viewBox="0 0 16 16"]')).toHaveCount(1);
		await expect(toolbar.locator('[data-slot="jira-toolbar"]')).toHaveAttribute("data-color-mode", "dark");
		await expect(toolbar.getByRole("button", { name: "Ask Rovo", exact: true })).toBeVisible();
		await expect(toolbar.getByRole("button", { name: "Use skills", exact: true })).toHaveCount(0);
		await expect(toolbar.getByRole("button", { name: "Change status", exact: true })).toHaveCount(0);
		await expect(toolbar.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/jira-dragging/selection-toolbar-${reducedMotion}.png` });
		await toolbar.getByRole("button", { name: "More actions", exact: true }).click();
		await page.getByRole("menuitem", { name: "Change status", exact: true }).hover();
		await page.getByRole("menuitem", { name: "Done", exact: true }).click();
		await expect(page.locator('[data-jira-kanban-column="Done"] [data-board-agent-session-drop-zone="issue"]')).toHaveCount(3);
		await toolbar.getByRole("button", { name: "Clear selection", exact: true }).click();
		await expect(toolbar).toBeHidden();

		// Selecting with the keyboard opens the same toolbar; Escape clears it.
		const selector = page.getByRole("button", { name: "PAY-130: Localise eleven v2 decline strings into nine languages", exact: true });
		await selector.focus();
		await page.keyboard.press("Shift+Space");
		const single = page.getByRole("region", { name: "1 card selected. Bulk actions available." });
		await expect(single).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(single).toBeHidden();
		await card("PAY-130").click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await single.getByRole("button", { name: "More actions", exact: true }).click();
		await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
		await expect(page.locator('[data-issue-key="PAY-130"]')).toHaveCount(0);
		await expect(single).toBeHidden();
	});

	test(`Ask Rovo launches the standalone Rovo workspace (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.locator('[data-issue-key="PAY-105"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await page.getByRole("button", { name: "Ask Rovo", exact: true }).click();
		await expect(page).toHaveURL(/\/rovo$/, { timeout: 20_000 });
	});

	test(`pickup keeps source column geometry stable (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const column = page.locator('[data-jira-kanban-column="To do"]');
		const geometry = () => column.evaluate((node) => {
			const content = node.querySelector<HTMLElement>('[data-jira-kanban-column-content]')!;
			return {
				headerHeight: content.firstElementChild!.getBoundingClientRect().height,
				contentHeight: content.getBoundingClientRect().height,
				cardTops: [...node.querySelectorAll('[data-board-agent-session-drop-zone="issue"]')].map((card) => card.getBoundingClientRect().top),
			};
		});
		// Cover both cards with and without session chins, including repeated pickup.
		for (const code of ["PAY-105", "PAY-123", "PAY-105"]) {
			const card = column.locator(`[data-issue-key="${code}"] [draggable]`).first();
			const box = (await card.boundingBox())!;
			await page.mouse.move(box.x + 70, box.y + 30);
			const before = await geometry();
			await page.mouse.down();
			await page.mouse.move(box.x + 95, box.y + 35, { steps: 5 });
			await expect(card).toHaveAttribute("data-dragging", "true");
			for (let frame = 0; frame < 12; frame++) {
				await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
				const during = await geometry();
				expect(during.headerHeight).toBe(before.headerHeight);
				expect(during.contentHeight).toBe(before.contentHeight);
				for (let index = 0; index < before.cardTops.length; index++) {
					expect(Math.abs(during.cardTops[index] - before.cardTops[index])).toBeLessThanOrEqual(0.5);
				}
			}
			await page.keyboard.press("Escape");
			await page.mouse.up();
			await expect(card).not.toHaveAttribute("data-dragging", "true");
			expect(await geometry()).toEqual(before);
		}
	});

	test(`content-sized columns paint their backdrop with plain footers (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost"}/preview/blocks/jira-dragging`);
		const progress = page.locator('[data-jira-kanban-column="To do"]');
		const done = page.locator('[data-jira-kanban-column="Done"]');
		await expect(progress.locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(4);
		await expect(done.locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(0);
		for (const title of ["To do", "Done"]) {
			await expect.poll(async () => {
				const geometry = await backdropGeometry(page, title);
				return Math.abs(geometry.paintedBottom - geometry.contentBottom);
			}).toBeLessThan(1.5);
			const geometry = await backdropGeometry(page, title);
			expect(geometry.background).not.toBe("rgba(0, 0, 0, 0)");
			expect(geometry.radius).not.toBe("0px");
		}

		const card = progress.locator('[data-issue-key="PAY-105"] [draggable]').first();
		const box = (await card.boundingBox())!;
		const target = (await done.boundingBox())!;
		await page.mouse.move(box.x + 70, box.y + 30);
		await page.mouse.down();
		await page.mouse.move(box.x + 95, box.y + 35, { steps: 5 });
		await expect(card).toHaveAttribute("data-dragging", "true");
		await page.mouse.move(target.x + 80, target.y + target.height / 2, { steps: 5 });
		await page.mouse.move(target.x + 81, target.y + target.height / 2);
		await page.mouse.up();
		await expect(done.locator('[data-issue-key="PAY-105"]')).toBeVisible();
		for (const title of ["To do", "Done"]) {
			await expect.poll(async () => {
				const geometry = await backdropGeometry(page, title);
				return Math.abs(geometry.paintedBottom - geometry.contentBottom);
			}).toBeLessThan(1.5);
		}
		await page.screenshot({ path: `output/agent-browser/jira-dragging/backdrop-drop-${reducedMotion}.png` });
	});
}
