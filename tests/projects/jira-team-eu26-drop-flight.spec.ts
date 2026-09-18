import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const origin = (process.env.PLAYWRIGHT_BASE_URL
	?? execFileSync(process.execPath, [".agents/skills/vpk-verify/scripts/control-vpk", "url"], { encoding: "utf8" }).trim()).replace(/\/$/u, "");
const evidence = "output/agent-browser/vpk-verify/jira-team-eu26-drop";

interface FlightFrame {
	time: number;
	duration: number;
	x: number;
	y: number;
	endX: number;
	endY: number;
	targetX: number;
	targetY: number;
	opacity: number;
}

async function startFlightTrace(page: Page, selector: string, flow: "create" | "link") {
	await page.evaluate(({ selector, flow }) => {
		const trace = { frames: [] as FlightFrame[], running: true };
		Object.assign(window, { sessionDropFlightTrace: trace });
		const started = performance.now();
		const sample = () => {
			const flight = document.querySelector(`[data-jira-${flow === "create" ? "dropzone" : "linking"}-flight]`);
			const animation = flight?.getAnimations().find((candidate) => candidate.effect instanceof KeyframeEffect && candidate.effect.getKeyframes().some((frame) => frame.transform));
			const destination = document.querySelector(selector)?.getBoundingClientRect();
			if (flight && animation?.effect instanceof KeyframeEffect && destination && typeof animation.currentTime === "number") {
				const style = getComputedStyle(flight);
				const matrix = new DOMMatrixReadOnly(style.transform);
				const end = new DOMMatrixReadOnly(String(animation.effect.getKeyframes().at(-1)!.transform));
				trace.frames.push({ time: animation.currentTime, duration: Number(animation.effect.getTiming().duration), x: matrix.m41, y: matrix.m42, endX: end.m41, endY: end.m42, targetX: destination.x + destination.width / 2, targetY: destination.y + destination.height / 2, opacity: Number(style.opacity) });
			}
			if (trace.running && performance.now() - started < 3000) requestAnimationFrame(() => setTimeout(sample, 0));
		};
		requestAnimationFrame(() => setTimeout(sample, 0));
	}, { selector, flow });
}

async function readFlightTrace(page: Page) {
	return page.evaluate(() => {
		const trace = (window as typeof window & { sessionDropFlightTrace: { running: boolean; frames: FlightFrame[] } }).sessionDropFlightTrace;
		trace.running = false;
		return trace.frames;
	});
}

for (const flow of ["create", "link"] as const) {
	test(`${flow} keeps a visible toss from all six cursor positions`, async ({ page }) => {
		test.setTimeout(60_000);
		await mkdir(evidence, { recursive: true });
		await page.setViewportSize({ width: 1440, height: 1100 });
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto(`${origin}/jira-team-eu26`);
		const sources = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]');
		await expect(sources.first()).toBeVisible();
		const column = page.locator('[data-jira-kanban-column="To do"]');
		const selector = flow === "create"
			? '[data-board-agent-session-create-work-item-drop-zone="To do"]'
			: '[data-issue-key="PAY-118"] [data-slot="jira-issue-surface"]';
		for (const [vertical, fractionY] of [["top", 0.25], ["bottom", 0.75]] as const) {
			for (const [horizontal, fractionX] of [["left", 0.2], ["center", 0.5], ["right", 0.8]] as const) {
				const source = sources.first();
				await source.hover();
				const id = await source.getAttribute("data-testid");
				const box = (await source.boundingBox())!;
				await page.mouse.move(box.x + box.width / 2, box.y + 12);
				await page.mouse.down();
				await page.mouse.move(box.x + box.width / 2 + 20, box.y + 32, { steps: 5 });
				await expect(page.locator("[data-session-drag-overlay]")).toBeVisible();
				if (flow === "create") {
					const sensor = (await column.locator("[data-create-work-item-proximity]").boundingBox())!;
					await page.mouse.move(sensor.x + sensor.width / 2, sensor.y + sensor.height / 2, { steps: 5 });
					await expect(column.locator('[data-board-agent-session-drop-zone="create"]')).toHaveAttribute("data-armed", "true");
					await expect.poll(async () => (await page.locator(selector).boundingBox())!.height).toBeGreaterThanOrEqual(64);
				}
				const target = (await page.locator(selector).boundingBox())!;
				const dropped = { x: target.x + target.width * fractionX, y: target.y + target.height * fractionY };
				await page.mouse.move(dropped.x, dropped.y, { steps: 5 });
				await page.waitForTimeout(200);
				await startFlightTrace(page, selector, flow);
				await page.mouse.up();
				await expect(page.getByTestId(id!)).toHaveCount(0);
				await page.waitForTimeout(1200);
				const frames = await readFlightTrace(page);
				await writeFile(`${evidence}/${flow}-${vertical}-${horizontal}-frames.json`, JSON.stringify(frames, null, 2));
				expect(frames.length).toBeGreaterThan(5);
				expect(frames.every((frame) => frame.duration === 260)).toBe(true);
				// The apex clears the higher of cursor/landing while the chip is
				// still visible, including drops below the destination center.
				expect(Math.min(...frames.filter((frame) => frame.opacity > 0.5).map((frame) => frame.y - Math.min(dropped.y, frame.targetY)))).toBeLessThan(-15);
				expect(frames.some((frame, index) => index > 0 && frame.time > 104 && frame.opacity > 0.05 && frame.y > frames[index - 1].y)).toBe(true);
				expect(Math.max(...frames.map((frame) => Math.hypot(frame.endX - frame.targetX, frame.endY - frame.targetY)))).toBeLessThan(4);
				await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
			}
		}
		await page.screenshot({ path: `${evidence}/${flow}-six-position-arcs.png` });
	});

	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`${flow} follows the column when the last unlinked session leaves (${reducedMotion})`, async ({ page }) => {
			test.setTimeout(80_000);
			await mkdir(evidence, { recursive: true });
			await page.setViewportSize({ width: 1440, height: 1100 });
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/jira-team-eu26`);
			await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
			// Hover the first session needing input to pause arrivals through the
			// same interaction the user performs while picking up a card.
			const needy = page.locator('[data-agent-session-column] [data-testid^="agent-session-row-"]')
				.filter({ has: page.locator('[aria-label="Needs input"]') })
				.filter({ has: page.locator('[aria-label$=", used by Venn"]') });
			await expect(needy.first()).toBeVisible({ timeout: 60_000 });
			await needy.first().hover();
			await page.getByRole("button", { name: /^Needs input:/ }).click();
			const sessionColumn = page.locator("[data-agent-session-column]");
			const source = sessionColumn.locator('[data-testid^="agent-session-row-"]');
			await expect(source).toHaveCount(1);
			if (flow === "create") {
				const expand = page.getByRole("button", { name: "Expand To do column" });
				if (await expand.isVisible()) {
					await expand.focus();
					await page.keyboard.press("Enter");
				}
			}
			const sourceId = await source.getAttribute("data-testid");
			await source.hover();
			const from = (await source.boundingBox())!;
			await page.mouse.move(from.x + from.width / 2, from.y + 12);
			await page.mouse.down();
			await page.mouse.move(from.x + from.width / 2 + 20, from.y + 32, { steps: 5 });
			await expect(page.locator("[data-session-drag-overlay]")).toBeVisible();
			const column = page.locator(`[data-jira-kanban-column="${flow === "create" ? "To do" : "In review"}"]`);
			const selector = flow === "create"
				? '[data-board-agent-session-create-work-item-drop-zone="To do"]'
				: '[data-issue-key="PAY-112"] [data-slot="jira-issue-surface"]';
			if (flow === "create") {
				const sensor = (await column.locator("[data-create-work-item-proximity]").boundingBox())!;
				await page.mouse.move(sensor.x + sensor.width * 0.75, sensor.y + sensor.height * 0.6, { steps: 5 });
				await expect(column.locator('[data-board-agent-session-drop-zone="create"]')).toHaveAttribute("data-armed", "true");
				await expect.poll(async () => (await page.locator(selector).boundingBox())!.height).toBeGreaterThan(64);
			}
			const target = (await page.locator(selector).boundingBox())!;
			const dropped = { x: target.x + target.width * 0.75, y: target.y + target.height * 0.6 };
			await page.mouse.move(dropped.x, dropped.y, { steps: 5 });
			await page.waitForTimeout(200);
			await startFlightTrace(page, selector, flow);
			await page.mouse.up();
			await expect(sessionColumn.getByTestId(sourceId!)).toHaveCount(0);
			await expect(page.getByRole("button", { name: "Expand Unlink sessions column" })).toBeVisible();
			await page.waitForTimeout(1200);
			const frames = await readFlightTrace(page);
			await writeFile(`${evidence}/${flow}-${reducedMotion}-frames.json`, JSON.stringify(frames, null, 2));
			await page.screenshot({ path: `${evidence}/${flow}-${reducedMotion}.png` });
			if (reducedMotion === "reduce") {
				expect(frames).toEqual([]);
			} else {
				expect(frames.length).toBeGreaterThan(5);
				expect(frames.every((frame) => frame.duration === 260)).toBe(true);
				// Automatic empty-column collapse moves the board left by 244px.
				expect(Math.max(...frames.map((frame) => frame.targetX)) - Math.min(...frames.map((frame) => frame.targetX))).toBeGreaterThan(100);
				expect(Math.max(...frames.map((frame) => Math.hypot(frame.endX - frame.targetX, frame.endY - frame.targetY)))).toBeLessThan(4);
				for (const frame of frames) {
					// The shared horizontal collapse uses the same weight as the fade.
					expect(Math.abs(frame.x - (dropped.x * frame.opacity + frame.targetX * (1 - frame.opacity)))).toBeLessThan(4);
				}
			}
			await expect(page.locator("[data-session-drag-overlay]")).toHaveCount(0);
			if (flow === "link") await expect(page.locator('[data-issue-key="PAY-112"]').getByRole("button", { name: /^2 agents:/ })).toBeVisible();
			else await expect(column.locator("[data-issue-key]")).toHaveCount(1);
		});
	}
}
