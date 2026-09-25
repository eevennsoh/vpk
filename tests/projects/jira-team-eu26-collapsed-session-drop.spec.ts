import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

const origin = (process.env.PLAYWRIGHT_BASE_URL
	?? execFileSync(process.execPath, [".agents/skills/vpk-verify/scripts/control-vpk", "url"], { encoding: "utf8" }).trim()).replace(/\/$/u, "");

test.use({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });

async function openBoard(
	page: Page,
	title: string,
	needsInput = false,
	beforeDrag?: () => Promise<void>,
) {
	await page.goto(`${origin}/jira-team-eu26`);
	await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
	const options = page.getByRole("button", { name: "Unlink sessions column options" });
	if (await options.isVisible()) {
		await options.click();
		await page.getByRole("menuitem", { name: "Expand", exact: true }).click();
	}
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
	if (await expand.isVisible()) await expand.click();
	if (needsInput) {
		await page.getByRole("heading", { name: "Jira Design", exact: true }).click();
		await expect(page.getByTestId("agent-session-row-lw-sync-release-gate")).toBeVisible({ timeout: 55_000 });
		await page.getByRole("button", { name: /^Needs input:/ }).click();
	}
	const column = page.locator(`[data-jira-kanban-column="${title}"]`);
	const collapse = page.getByRole("button", { name: `Collapse ${title} column`, exact: true });
	if (await collapse.isVisible()) {
		await collapse.focus();
		await page.keyboard.press("Enter");
	}
	await expect(column).toHaveAttribute("data-collapsed", "true");
	await beforeDrag?.();
	const source = page.locator("[data-agent-session-column]").getByTestId(needsInput ? "agent-session-row-lw-sync-release-gate" : "agent-session-row-lw-scope-thread");
	await expect(source).toBeVisible({ timeout: needsInput ? 55_000 : 5000 });
	await source.hover();
	const box = (await source.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + 12);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 20, box.y + 32, { steps: 5 });
	return { column, source };
}

test("live reduced-motion changes replace the collapsed trace with static feedback", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	const { column, source } = await openBoard(page, "To do", false, async () => {
		await page.emulateMedia({ reducedMotion: "reduce" });
	});
	const cell = column.locator("[data-collapsed-session-drop-surface]");
	const box = (await cell.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
	await expect(column).toHaveAttribute("data-armed", "true");
	await expect(cell.locator("[data-collapsed-session-drop-static]")).toBeVisible();
	await expect(cell.locator('[data-slot="jira-issue-attach-trace"]')).toHaveCount(0);
	await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, pointerType: "mouse" })));
	await page.mouse.up();
	await expect(source).toBeVisible();
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`collapsed trace follows the issue proximity ramp before hover (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		const { column, source } = await openBoard(page, "To do");
		const cell = column.locator("[data-collapsed-session-drop-surface]");
		const box = (await cell.boundingBox())!;
		const x = box.x + box.width / 2;
		const trace = cell.locator('[data-slot="jira-issue-attach-trace"]');
		const opacity: number[] = [];
		for (const distance of [125, 100, 60, 15]) {
			await page.mouse.move(x, box.y - distance, { steps: 6 });
			await expect(column).not.toHaveAttribute("data-armed", "true");
			if (reducedMotion === "reduce" || distance >= 120) {
				await expect(trace).toHaveCount(0);
				await expect(cell.locator("[data-collapsed-session-drop-static]")).toHaveCount(0);
			} else {
				await expect(trace).toBeVisible();
				const ramp = 1 - distance / 120;
				const expected = ramp * ramp * (3 - 2 * ramp);
				await expect.poll(() => trace.evaluate((node) => Number(getComputedStyle(node).opacity))).toBeCloseTo(expected, 2);
				opacity.push(await trace.evaluate((node) => Number(getComputedStyle(node).opacity)));
				await page.screenshot({ path: `output/agent-browser/collapsed-session-drop/proximity-${distance}px.png` });
			}
		}
		if (reducedMotion === "no-preference") {
			expect(opacity[0]).toBeLessThan(opacity[1]);
			expect(opacity[1]).toBeLessThan(opacity[2]);
		}
		await page.mouse.move(box.x - 60, box.y + box.height + 100, { steps: 6 });
		await expect(column).not.toHaveAttribute("data-armed", "true");
		if (reducedMotion === "no-preference") {
			await expect(trace).toBeVisible();
			await expect.poll(() => trace.evaluate((node) => Number(getComputedStyle(node).opacity))).toBeCloseTo(0.5, 2);
		} else {
			await expect(trace).toHaveCount(0);
		}
		await page.mouse.move(x, box.y + box.height / 2, { steps: 6 });
		await expect(column).toHaveAttribute("data-armed", "true");
		await expect(reducedMotion === "reduce" ? cell.locator("[data-collapsed-session-drop-static]") : trace).toBeVisible();
		await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, pointerType: "mouse" })));
		await page.mouse.up();
		await expect(trace).toHaveCount(0);
		await expect(source).toBeVisible();
	});
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const title of ["To do", "In progress", "Done"]) {
		test(`unlinked session creates in collapsed ${title} (${reducedMotion})`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			const { column, source } = await openBoard(page, title);
			await expect(column).toHaveAttribute("data-board-agent-session-drop-zone", "create");
			const cell = column.locator("[data-collapsed-session-drop-surface]");
			const box = (await cell.boundingBox())!;
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
			await expect(column).toHaveAttribute("data-armed", "true");
			const feedback = reducedMotion === "reduce"
				? cell.locator("[data-collapsed-session-drop-static]")
				: cell.locator('[data-slot="jira-issue-attach-trace"]');
			await expect(feedback).toBeVisible();
			const feedbackBox = (await feedback.boundingBox())!;
			expect(Math.abs(feedbackBox.height - box.height)).toBeLessThanOrEqual(2);
			expect(feedbackBox.height).toBeLessThan((await column.boundingBox())!.height);
			if (reducedMotion === "no-preference") {
				const pointerX = await feedback.evaluate((node) => node.style.getPropertyValue("--card-glow-pointer-x"));
				await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2, { steps: 3 });
				await expect.poll(() => feedback.evaluate((node) => node.style.getPropertyValue("--card-glow-pointer-x"))).not.toBe(pointerX);
			}
			await page.screenshot({ path: `output/agent-browser/collapsed-session-drop/${title.replaceAll(" ", "-")}-${reducedMotion}.png` });
			await page.mouse.up();
			await expect(source).toHaveCount(0);
			await expect(column).not.toHaveAttribute("data-armed", "true");
			await expect(feedback).toHaveCount(0);
			await page.getByRole("button", { name: `Expand ${title} column`, exact: true }).focus();
			await page.keyboard.press("Enter");
			await expect(column.locator("[data-issue-key]").filter({ hasText: "Keep or delete the adapter finished in a local agent session" })).toHaveCount(1);
		});
	}
}

test("Needs input session drops through the empty lane below a collapsed column", async ({ page }) => {
	test.setTimeout(90_000);
	const { column, source } = await openBoard(page, "To do", true);
	const cell = (await column.locator("[data-collapsed-session-drop-surface]").boundingBox())!;
	const lane = (await column.boundingBox())!;
	await page.mouse.move(lane.x + lane.width / 2, cell.y + cell.height + 100, { steps: 5 });
	await expect(column).toHaveAttribute("data-armed", "true");
	await expect(column.locator('[data-slot="jira-issue-attach-trace"]')).toBeVisible();
	await page.screenshot({ path: "output/agent-browser/collapsed-session-drop/needs-input-full-lane.png" });
	await page.mouse.up();
	await expect(source).toHaveCount(0);
	await page.getByRole("button", { name: /^Needs input:/ }).click();
	const expand = page.getByRole("button", { name: "Expand To do column", exact: true });
	if (await expand.isVisible()) {
		await expand.focus();
		await page.keyboard.press("Enter");
	}
	await expect(column.locator("[data-issue-key]").filter({ hasText: "Release gate decision" })).toHaveCount(1);
});

test("leaving or cancelling clears collapsed-column feedback without consuming the session", async ({ page }) => {
	const { column, source } = await openBoard(page, "To do");
	const cell = (await column.locator("[data-collapsed-session-drop-surface]").boundingBox())!;
	await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2, { steps: 5 });
	await expect(column).toHaveAttribute("data-armed", "true");
	await page.mouse.move(1100, 150, { steps: 5 });
	await expect(column).not.toHaveAttribute("data-armed", "true");
	await expect(column.locator('[data-slot="jira-issue-attach-trace"]')).toHaveCount(0);
	await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2, { steps: 5 });
	await expect(column).toHaveAttribute("data-armed", "true");
	await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1, pointerType: "mouse" })));
	await page.mouse.up();
	await expect(column).not.toHaveAttribute("data-armed", "true");
	await expect(source).toBeVisible();
});
