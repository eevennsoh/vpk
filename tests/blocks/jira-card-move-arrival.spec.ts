import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const sameColumn of [false, true]) {
		test(`issue-card drop reuses session-created card arrival (${sameColumn ? "reorder" : "between columns"}, ${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost"}/preview/blocks/jira-dragging`);
			await page.waitForLoadState("networkidle");
			const code = sameColumn ? "PAY-130" : "PAY-105";
			const title = sameColumn ? "To do" : "Done";
			await page.evaluate(({ code, title }) => {
				const samples: { scale: number; opacity: number; slotHeight: number }[] = [];
				Object.assign(window, { cardMoveArrivalSamples: samples, cardMoveArrivalWatching: true });
				function sample() {
					const card = document.querySelector(`[data-jira-kanban-column="${title}"] [data-issue-key="${code}"][data-jira-creating-arrival="true"]`);
					const face = card?.querySelector<HTMLElement>('[data-slot="jira-creating-card"]');
					const slot = card?.querySelector<HTMLElement>('[data-slot="jira-creating-slot"]');
					if (face && slot) {
						const style = getComputedStyle(face);
						samples.push({ scale: new DOMMatrixReadOnly(style.transform).a, opacity: Number(style.opacity), slotHeight: slot.getBoundingClientRect().height });
					}
					if ((window as typeof window & { cardMoveArrivalWatching: boolean }).cardMoveArrivalWatching) requestAnimationFrame(sample);
				}
				requestAnimationFrame(sample);
			}, { code, title });
			const source = (await page.locator(`[data-issue-key="${code}"] [draggable="true"]`).first().boundingBox())!;
			const original = sameColumn ? await page.locator(`[data-issue-key="${code}"] [data-jira-issue-activation-control]`).elementHandle() : null;
			const target = page.locator(`[data-jira-kanban-column="${title}"]`);
			const bounds = (await target.boundingBox())!;
			await page.mouse.move(source.x + 70, source.y + 30);
			await page.mouse.down();
			await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
			const y = sameColumn ? (await target.locator('[data-issue-key="PAY-105"]').boundingBox())!.y + 10 : bounds.y + 80;
			await page.mouse.move(bounds.x + 90, y, { steps: 5 });
			await page.mouse.move(bounds.x + 91, y);
			await page.mouse.up();
			const moved = target.locator(`[data-issue-key="${code}"]`);
			await expect(moved).toHaveCount(1);
			if (reducedMotion !== "reduce" || sameColumn) await expect.poll(() => page.evaluate(() => (window as typeof window & { cardMoveArrivalSamples: unknown[] }).cardMoveArrivalSamples.length)).toBeGreaterThan(0);
			await expect(moved).not.toHaveAttribute("data-jira-creating-arrival", "true");
			if (reducedMotion === "reduce" && !sameColumn) {
				await expect(moved.locator('[data-slot="jira-creating-card"]')).toHaveCSS("opacity", "1");
				await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
			}
			const samples = await page.evaluate(() => {
				const state = window as typeof window & { cardMoveArrivalWatching: boolean; cardMoveArrivalSamples: { scale: number; opacity: number; slotHeight: number }[] };
				state.cardMoveArrivalWatching = false;
				return state.cardMoveArrivalSamples;
			});
			if (reducedMotion === "reduce") {
				expect(samples.every((sample) => Math.abs(sample.scale - 1) < 0.01)).toBe(true);
			} else {
				expect(samples.some((sample) => sample.scale > 0.8 && sample.scale < 0.99 && sample.opacity > 0 && sample.opacity < 1)).toBe(true);
				const height = (await moved.boundingBox())!.height;
				if (sameColumn) expect(samples.some((sample) => sample.slotHeight > 0 && sample.slotHeight < height - 2)).toBe(true);
				else expect(samples.every((sample) => Math.abs(sample.slotHeight - height) < 2)).toBe(true);
			}
			if (sameColumn) await expect(target.locator('[data-issue-key]').first()).toHaveAttribute("data-issue-key", code);
			if (original) expect(await original.evaluate((node) => node.isConnected)).toBe(true);
			await page.screenshot({ path: `output/agent-browser/side-card-move/arrival-${sameColumn ? "reorder" : "cross-column"}-${reducedMotion}.png` });
		});
	}
	test(`selected cohort flies one card and plays the entrance for every landed card (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const card = (code: string) => page.locator(`[data-issue-key="${code}"] [draggable="true"]`).first();
		await card("PAY-105").click({ modifiers: ["Shift"], position: { x: 70, y: 30 } });
		await card("PAY-107").click({ modifiers: ["Shift"], position: { x: 70, y: 30 } });
		await page.evaluate(() => {
			const seen = new Set<string>();
			Object.assign(window, { cohortMoveArrivals: seen, cohortMoveWatching: true });
			function sample() {
				for (const node of document.querySelectorAll<HTMLElement>('[data-jira-kanban-column="Done"] [data-jira-creating-arrival="true"]')) seen.add(node.dataset.issueKey!);
				if ((window as typeof window & { cohortMoveWatching: boolean }).cohortMoveWatching) requestAnimationFrame(sample);
			}
			requestAnimationFrame(sample);
		});
		const source = (await card("PAY-105").boundingBox())!;
		const done = page.locator('[data-jira-kanban-column="Done"]');
		const target = (await done.boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		await page.mouse.move(target.x + 90, target.y + 80, { steps: 5 });
		await page.mouse.move(target.x + 91, target.y + 80);
		await page.mouse.up();
		await expect(done.locator('[data-issue-key]')).toHaveCount(2);
		// One flight (the grabbed card) represents the cohort, but every landed card plays the entrance.
		if (reducedMotion !== "reduce") await expect.poll(() => page.evaluate(() => [...(window as typeof window & { cohortMoveArrivals: Set<string> }).cohortMoveArrivals].sort())).toEqual(["PAY-105", "PAY-107"]);
		await expect(done.locator('[data-jira-creating-arrival="true"]')).toHaveCount(0);
		if (reducedMotion === "reduce") await expect(page.locator("[data-issue-drop-flight]")).toHaveCount(0);
		await page.evaluate(() => { (window as typeof window & { cohortMoveWatching: boolean }).cohortMoveWatching = false; });
	});
}

test("a no-op drop cannot replay when another card later leaves its column", async ({ page }) => {
	await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost"}/preview/blocks/jira-dragging`);
	await page.waitForLoadState("networkidle");
	const card = page.locator('[data-issue-key="PAY-107"]');
	const bounds = (await card.locator('[draggable="true"]').first().boundingBox())!;
	await page.mouse.move(bounds.x + 70, bounds.y + 30);
	await page.mouse.down();
	await page.mouse.move(bounds.x + 95, bounds.y + 35, { steps: 5 });
	await page.mouse.move(bounds.x + 96, bounds.y + 35);
	await page.mouse.up();
	await expect(card).not.toHaveAttribute("data-jira-creating-arrival", "true");
	await page.evaluate(() => {
		const card = document.querySelector('[data-issue-key="PAY-107"]')!;
		Object.assign(window, { staleMoveArrivals: [] as string[] });
		new MutationObserver((records) => {
			for (const record of records) {
				if (record.oldValue === "true" || card.getAttribute("data-jira-creating-arrival") === "true") {
					(window as typeof window & { staleMoveArrivals: string[] }).staleMoveArrivals.push("arrival");
				}
			}
		}).observe(card, { attributes: true, attributeFilter: ["data-jira-creating-arrival"], attributeOldValue: true });
	});
	await page.locator('[data-issue-key="PAY-105"] [draggable="true"]').first().click({ modifiers: ["Shift"], position: { x: 70, y: 30 } });
	await page.locator('[data-slot="jira-toolbar"]').getByRole("button", { name: "More actions", exact: true }).click();
	await page.getByRole("menuitem", { name: "Change status", exact: true }).hover();
	await page.getByRole("menuitem", { name: "Done", exact: true }).click();
	await expect(page.locator('[data-jira-kanban-column="To do"] [data-issue-key]').first()).toHaveAttribute("data-issue-key", "PAY-107");
	expect(await page.evaluate(() => (window as typeof window & { staleMoveArrivals: string[] }).staleMoveArrivals)).toEqual([]);
});

for (const moveCreated of [false, true]) {
	test(`a move ${moveCreated ? "takes over its created card" : "preserves another creation in flight"}`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost"}/jira-team-eu26`);
		await expect(page.locator("[data-agent-session-column-expansion]")).toBeVisible();
		const expand = page.getByRole("button", { name: "Expand Unlink sessions column", exact: true });
		if (await expand.isVisible()) {
			await expand.click();
		} else if (!await page.getByRole("button", { name: "Collapse Unlink sessions column", exact: true }).isVisible()) {
			const options = page.getByRole("button", { name: "Unlink sessions column options", exact: true });
			await options.click();
			const pin = page.getByRole("menuitem", { name: "Pin", exact: true });
			if (await pin.isVisible()) { await pin.click(); await options.click(); }
			await page.getByRole("menuitem", { name: "Expand", exact: true }).click();
		}
		const column = page.locator('[data-jira-kanban-column="To do"]');
		await expect(column.locator("[data-issue-key]")).toHaveCount(4);
		const keys = await column.locator("[data-issue-key]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-issue-key")));
		const source = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-scope-thread");
		await source.scrollIntoViewIfNeeded();
		const sourceBox = (await source.boundingBox())!;
		await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
		await page.mouse.down();
		await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2 + 20, { steps: 5 });
		await expect(column.locator('[data-board-agent-session-drop-zone="create"]')).toBeVisible();
		const well = (await column.locator("[data-create-work-item-proximity]").boundingBox())!;
		await page.mouse.move(well.x + well.width / 2, well.y + well.height - 8, { steps: 5 });
		await expect.poll(async () => (await column.locator('[data-jira-dropzone-control="To do"]').boundingBox())!.height).toBeCloseTo(Math.max(64, well.height), 0);
		await page.mouse.up();
		await expect(page.locator("[data-jira-dropzone-flight]")).toHaveCount(0);
		const createdCode = (await column.locator("[data-issue-key]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-issue-key"))))
			.find((code) => !keys.includes(code))!;
		const created = column.locator(`[data-issue-key="${createdCode}"]`);
		const face = created.locator('[data-slot="jira-creating-card"]');
		await face.evaluate((node) => node.getAnimations().forEach((animation) => { animation.pause(); animation.currentTime = 80; }));
		await expect(created).toHaveAttribute("data-jira-creating-arrival", "true");
		const code = moveCreated ? createdCode : "PAY-118";
		const moveTo = async (title: string) => {
			const moving = page.locator(`[data-issue-key="${code}"] [draggable="true"]`).first();
			await moving.scrollIntoViewIfNeeded();
			const bounds = (await moving.boundingBox())!;
			await page.mouse.move(bounds.x + 70, bounds.y + 30);
			await page.mouse.down();
			await page.mouse.move(bounds.x + 95, bounds.y + 35, { steps: 5 });
			const destination = page.locator(`[data-jira-kanban-column="${title}"]`);
			const target = (await destination.boundingBox())!;
			await page.mouse.move(target.x + 90, target.y + 80, { steps: 5 });
			await page.mouse.move(target.x + 91, target.y + 80);
			await page.mouse.up();
			const landed = destination.locator(`[data-issue-key="${code}"]`);
			await expect(landed).toBeVisible();
			await expect(landed).not.toHaveAttribute("data-jira-creating-arrival", "true");
		};
		await moveTo("Done");
		if (moveCreated) {
			await moveTo("To do");
		} else {
			await expect(created).toHaveAttribute("data-jira-creating-arrival", "true");
			await face.evaluate((node) => node.getAnimations().forEach((animation) => animation.play()));
			await expect(created).not.toHaveAttribute("data-jira-creating-arrival", "true");
		}
	});
}
