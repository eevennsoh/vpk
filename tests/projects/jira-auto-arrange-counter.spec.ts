import { expect, test, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "https://vpk.localhost";
test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

type CounterProbe = {
	clearing: boolean;
	entered: boolean;
	exited: boolean;
	traceVisible: boolean;
	traceEndedMs?: number;
};
type SmartCounterProbe = { detached: boolean; faded: boolean; cycled: boolean; retraced: boolean };
declare global {
	interface Window {
		__autoArrangeCounterProbe: CounterProbe;
		__smartCounterProbe: SmartCounterProbe;
	}
}

async function observeContinuingCounter(page: Page, target: string) {
	await page.evaluate(target => {
		const original = document.querySelector<HTMLElement>('[data-jira-kanban-column="Done"] [data-auto-arrange-count]')!;
		const background = original.querySelector("span")!;
		const transforms = new Map([...background.querySelectorAll("span")].map(node => [node, getComputedStyle(node).transform]));
		const probe: SmartCounterProbe = { detached: false, faded: false, cycled: false, retraced: false };
		window.__smartCounterProbe = probe;
		const sample = () => {
			if (window.__smartCounterProbe !== probe) return;
			if (!original.isConnected || !background.isConnected) probe.detached = true;
			else {
				const style = getComputedStyle(original);
				const scale = style.transform === "none" ? 1 : new DOMMatrixReadOnly(style.transform).m11;
				if (Number(style.opacity) < 0.999 || scale < 0.999) probe.faded = true;
				if (original.getAttribute("data-auto-arrange-count") === target) {
					if ([...transforms].some(([node, transform]) => node.isConnected && getComputedStyle(node).transform !== transform)) probe.cycled = true;
					if ([...original.querySelectorAll("svg path")].some(path => Number(path.getAttribute("opacity")) > 0)) probe.retraced = true;
				}
			}
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	}, target);
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`auto arrange counter fades and scales in and out with a quick trace (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26`);
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitemcheckbox", { name: "Auto arrange", exact: true }).click();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
		await page.evaluate(() => {
			const probe: CounterProbe = { clearing: false, entered: false, exited: false, traceVisible: false };
			window.__autoArrangeCounterProbe = probe;
			let start: number | undefined;
			const sample = (now: number) => {
				const node = document.querySelector<HTMLElement>("[data-auto-arrange-count]");
				if (node) {
					start ??= now;
					const style = getComputedStyle(node);
					const opacity = Number(style.opacity);
					const scale = style.transform === "none" ? 1 : new DOMMatrixReadOnly(style.transform).m11;
					if (opacity > 0 && opacity < 1 && scale < 1) {
						if (probe.clearing) probe.exited = true;
						else probe.entered = true;
					}
					const visible = [...node.querySelectorAll("svg path")].some(path => Number(path.getAttribute("opacity")) > 0);
					if (visible) probe.traceVisible = true;
					else if (probe.traceVisible && probe.traceEndedMs === undefined) probe.traceEndedMs = now - start;
				}
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		await page.locator('[data-issue-key="PAY-118"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const counter = page.locator("[data-auto-arrange-count]").first();
		await expect(counter).toBeVisible();
		if (reducedMotion === "no-preference") {
			await expect.poll(() => page.evaluate(() => window.__autoArrangeCounterProbe.entered)).toBe(true);
			await expect.poll(() => page.evaluate(() => window.__autoArrangeCounterProbe.traceEndedMs)).toBeDefined();
			expect(await page.evaluate(() => window.__autoArrangeCounterProbe.traceEndedMs!)).toBeLessThan(1100);
		} else {
			await expect(counter).toHaveCSS("opacity", "1");
			expect(await page.evaluate(() => window.__autoArrangeCounterProbe.entered)).toBe(false);
			expect(await page.evaluate(() => window.__autoArrangeCounterProbe.traceVisible)).toBe(false);
		}
		await page.screenshot({ path: `output/agent-browser/auto-arrange-counter/ready-${reducedMotion}.png` });
		await page.evaluate(() => { window.__autoArrangeCounterProbe.clearing = true; });
		await page.getByRole("button", { name: "Clear selection", exact: true }).click();
		await expect(counter).toHaveCount(0);
		if (reducedMotion === "no-preference") {
			expect(await page.evaluate(() => window.__autoArrangeCounterProbe.exited)).toBe(true);
		}
	});

	test(`a continuing column cycles its count and retraces without hiding the badge (${reducedMotion})`, async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem("ui-design-variants", JSON.stringify({ autoArrange: true })));
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26-end`);
		await page.locator('[data-issue-key="TEU-1"] [draggable]').first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		const counter = page.locator('[data-jira-kanban-column="Done"] [data-auto-arrange-count]');
		await expect(counter).toHaveAttribute("data-auto-arrange-count", "1");
		await expect(counter).toHaveCSS("opacity", "1");
		for (const target of ["2", "1"]) {
			await observeContinuingCounter(page, target);
			await page.getByRole("checkbox", { name: "Select TEU-2", exact: true }).click();
			await expect(counter).toHaveAttribute("data-auto-arrange-count", target);
			if (reducedMotion === "no-preference") {
				await expect.poll(() => page.evaluate(() => window.__smartCounterProbe.cycled)).toBe(true);
				await expect.poll(() => page.evaluate(() => window.__smartCounterProbe.retraced)).toBe(true);
			} else {
				expect(await page.evaluate(() => window.__smartCounterProbe.cycled)).toBe(false);
				expect(await page.evaluate(() => window.__smartCounterProbe.retraced)).toBe(false);
			}
			expect(await page.evaluate(() => window.__smartCounterProbe.detached)).toBe(false);
			expect(await page.evaluate(() => window.__smartCounterProbe.faded)).toBe(false);
			await expect(counter).toHaveCSS("opacity", "1");
			await page.screenshot({ path: `output/agent-browser/auto-arrange-counter/count-${target}-${reducedMotion}.png` });
		}
		await page.getByRole("button", { name: "Clear selection", exact: true }).click();
		await expect(counter).toHaveCount(0);
	});
}
