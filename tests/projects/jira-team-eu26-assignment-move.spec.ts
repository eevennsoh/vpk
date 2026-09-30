import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1720, height: 1100 } });

const scenarios = (["default", "wac"] as const).flatMap((contentMode) =>
	(["no-preference", "reduce"] as const).map((reducedMotion) => ({ contentMode, reducedMotion })),
);

for (const { contentMode, reducedMotion } of scenarios) {
	for (const issueKey of ["PAY-118", "PAY-113"]) {
		test(`${issueKey} agent assignment glows only its own card without a move trace (${contentMode}, ${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
			if (contentMode === "wac") {
				await page.getByRole("button", { name: "Settings", exact: true }).click();
				await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
				await expect(page.getByRole("heading", { name: "Checkout roadmap", exact: true })).toBeVisible();
			}
			await page.getByRole("button", { name: `More actions for ${issueKey}`, exact: true }).focus();
			await page.keyboard.press("Enter");
			await page.getByRole("menuitem", { name: /^Assign agents/ }).focus();
			await page.keyboard.press("ArrowRight");
			const agent = page.getByRole("option", { name: /^Claude / });
			await expect(agent).toBeVisible();
			const observation = page.evaluate(async (issueKey) => {
				const offsets: number[] = [];
				const overlaps: number[] = [];
				let traceSeen = false;
				const glowOwners = new Set<string>();
				const incomingOpacities: number[] = [];
				const reflowDurations = new Set<number>();
				let revealStartedAt: number | undefined;
				let firstVisibleAt: number | undefined;
				let firstGlowAt: number | undefined;
				const positions: { t: number; y: number; scrollTop: number; transform: string }[] = [];
				const initialY = document.querySelector('[data-issue-key="PAY-105"]')!.getBoundingClientRect().top;
				let movedAt: number | undefined;
				const started = performance.now();
				while (performance.now() - started < 5_000) {
					await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
					traceSeen ||= document.querySelector('[data-issue-drop-trace]') !== null;
					for (const glow of document.querySelectorAll('[data-jira-linking-glow-halo], [data-jira-linking-glow-backdrop]')) {
						glowOwners.add(glow.closest<HTMLElement>('[data-issue-key]')?.dataset.issueKey ?? "unowned");
						firstGlowAt ??= performance.now();
					}
					const moved = document.querySelector(`[data-issue-key="${issueKey}"][data-board-column-title="In progress"]`);
					if (!moved) continue;
					movedAt ??= performance.now();
					const existing = document.querySelector('[data-issue-key="PAY-105"][data-board-column-title="In progress"]')!;
					const shell = existing.querySelector('[data-slot="jira-issue-agent-shell"]')!;
					const content = existing.querySelector('[data-slot="jira-issue-card"]')!;
					offsets.push(Math.abs(content.getBoundingClientRect().top - shell.getBoundingClientRect().top));
					const slot = moved.parentElement!;
					for (const animation of slot.getAnimations()) {
						if (animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some((frame) => frame.opacity !== undefined) && typeof animation.startTime === "number") revealStartedAt ??= animation.startTime;
					}
					for (const animation of existing.parentElement!.getAnimations()) {
						if (animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some((frame) => frame.transform !== undefined)) reflowDurations.add(Number(animation.effect.getTiming().duration));
					}
					const opacity = Number(getComputedStyle(slot).opacity);
					incomingOpacities.push(opacity);
					positions.push({ t: performance.now(), y: existing.getBoundingClientRect().top, scrollTop: existing.closest('[data-jira-kanban-card-list]')!.scrollTop, transform: getComputedStyle(existing.parentElement!.parentElement!).transform });
					if (!slot.inert && !slot.closest('[aria-hidden="true"]') && Number(getComputedStyle(slot).opacity) > 0) {
						firstVisibleAt ??= performance.now();
						const movedShell = moved.querySelector('[data-slot="jira-issue-agent-shell"]')!.getBoundingClientRect();
						const existingShell = shell.getBoundingClientRect();
						overlaps.push(Math.max(0, Math.min(movedShell.bottom, existingShell.bottom) - Math.max(movedShell.top, existingShell.top)));
					}
					if (performance.now() - movedAt > 1_000) break;
				}
				return { offsets, overlaps, traceSeen, glowOwners: [...glowOwners], incomingOpacities, visibleDelay: (firstVisibleAt ?? 0) - (revealStartedAt ?? movedAt ?? 0), firstVisibleAt, firstGlowAt, positions, initialY, reflowDurations: [...reflowDurations] };
			}, issueKey);
			await agent.click();
			const { offsets, overlaps, traceSeen, glowOwners, incomingOpacities, visibleDelay, firstVisibleAt, firstGlowAt, positions, initialY, reflowDurations } = await observation;
			await test.info().attach("movement-trajectory", { body: JSON.stringify({ positions, initialY, visibleDelay }), contentType: "application/json" });
			writeFileSync(`output/agent-browser/assignment-feedback/trajectory-${contentMode}-${issueKey}-${reducedMotion}.json`, JSON.stringify({ positions, initialY, visibleDelay }));
			expect(offsets.length).toBeGreaterThan(2);
			expect(Math.max(...offsets)).toBeLessThan(1);
			expect(overlaps.length).toBeGreaterThan(2);
			expect(Math.max(...overlaps)).toBeLessThan(1);
			expect(glowOwners).toEqual(reducedMotion === "no-preference" ? [issueKey] : []);
			expect(traceSeen).toBe(false);
			expect(incomingOpacities.every((opacity) => opacity === 0 || opacity === 1)).toBe(true);
			if (reducedMotion === "no-preference") {
				expect(visibleDelay).toBeGreaterThanOrEqual(120);
				expect(firstGlowAt! - firstVisibleAt!).toBeGreaterThanOrEqual(-20);
				const finalY = positions.at(-1)!.y;
				const intermediate = positions.filter(({ y }) => y > initialY + 1 && y < finalY - 1);
				expect(intermediate.length).toBeGreaterThan(2); // 150ms still shows multiple intermediate poses.
				expect(reflowDurations).toEqual([150]);
			} else expect(visibleDelay).toBeLessThan(100);
			await expect(page.getByRole("region", { name: "In progress work items", exact: true }).locator(`[data-issue-key="${issueKey}"]`)).toHaveCount(1);
			await expect(page.locator(`[data-issue-key="${issueKey}"] [data-slot="jira-issue-agent-row"]`)).toContainText("Working");
			await expect(page.locator('[data-issue-drop-trace]')).toHaveCount(0);
			await page.screenshot({ path: `output/agent-browser/assignment-feedback/assignment-${contentMode}-${issueKey}-${reducedMotion}.png` });
		});
	}
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`manual card moves settle existing cards before revealing the incoming card (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitemcheckbox", { name: "WAC Content", exact: true }).click();
		const source = page.locator('[data-issue-key="PAY-118"] [draggable]').first();
		const sourceBounds = (await source.boundingBox())!;
		await page.mouse.move(sourceBounds.x + 70, sourceBounds.y + 35);
		await page.mouse.down();
		await page.mouse.move(sourceBounds.x + 90, sourceBounds.y + 40, { steps: 5 });
		await expect(source).toHaveAttribute("data-dragging", "true");
		const header = page.locator('[data-jira-kanban-column="Done"] [data-slot="board-column-header"]');
		const bounds = (await header.boundingBox())!;
		await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 5 });
		await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
		const observation = page.evaluate(async () => {
			const existing = document.querySelector('[data-issue-key="PAY-101"][data-board-column-title="Done"]')!;
			const initialY = existing.getBoundingClientRect().top;
			const positions: { t: number; y: number }[] = [];
			const opacities: number[] = [];
			const reflowDurations = new Set<number>();
			let revealStartedAt: number | undefined;
			let movedAt: number | undefined;
			let visibleAt: number | undefined;
			let traceAt: number | undefined;
			const start = performance.now();
			while (performance.now() - start < 4_000) {
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				const moved = document.querySelector<HTMLElement>('[data-issue-key="PAY-118"][data-board-column-title="Done"]');
				if (!moved) continue;
				movedAt ??= performance.now();
				const slot = moved.parentElement!;
				for (const animation of slot.getAnimations()) {
					if (animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some((frame) => frame.opacity !== undefined) && typeof animation.startTime === "number") revealStartedAt ??= animation.startTime;
				}
				for (const animation of existing.parentElement!.getAnimations()) {
					if (animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some((frame) => frame.transform !== undefined)) reflowDurations.add(Number(animation.effect.getTiming().duration));
				}
				const opacity = Number(getComputedStyle(slot).opacity);
				opacities.push(opacity);
				if (!slot.inert && opacity === 1) visibleAt ??= performance.now();
				positions.push({ t: performance.now(), y: existing.getBoundingClientRect().top });
				const trace = document.querySelector('[data-issue-drop-trace]');
				if (trace?.getAnimations({ subtree: true }).some((animation) => animation.effect?.getComputedTiming().progress != null)) traceAt ??= performance.now();
				if (performance.now() - movedAt > 1_100) break;
			}
			return { opacities, delay: (visibleAt ?? 0) - (revealStartedAt ?? movedAt ?? 0), visibleAt, traceAt, positions, initialY, reflowDurations: [...reflowDurations] };
		});
		await page.mouse.up();
		const { opacities, delay, visibleAt, traceAt, positions, initialY, reflowDurations } = await observation;
		expect(opacities.length).toBeGreaterThan(2);
		expect(opacities.every((opacity) => opacity === 0 || opacity === 1)).toBe(true);
		if (reducedMotion === "no-preference") {
			expect(delay).toBeGreaterThanOrEqual(120);
			expect(traceAt! - visibleAt!).toBeGreaterThanOrEqual(-20);
			const finalY = positions.at(-1)!.y;
			const intermediate = positions.filter(({ y }) => y > initialY + 1 && y < finalY - 1);
			expect(intermediate.length).toBeGreaterThan(2); // 150ms still shows multiple intermediate poses.
			expect(reflowDurations).toEqual([150]);
		} else {
			expect(delay).toBeLessThan(100);
			expect(traceAt).toBeUndefined();
		}
		await expect(page.getByRole("region", { name: "Done work items", exact: true }).locator('[data-issue-key="PAY-118"]')).toHaveCount(1);
		await expect(page.locator('[data-issue-drop-trace]')).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/assignment-feedback/manual-reflow-${reducedMotion}.png` });
	});
}
