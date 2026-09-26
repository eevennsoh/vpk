import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

const origin = (process.env.PLAYWRIGHT_BASE_URL
	?? execFileSync(process.execPath, [".agents/skills/vpk-verify/scripts/control-vpk", "url"], { encoding: "utf8" }).trim())
	.replace(/\/$/u, "");
const project = process.env.PLAYWRIGHT_JIRA_PROJECT ?? "jira-team-eu26";

async function openBoard(page: Page) {
	await page.setViewportSize({ width: 1440, height: 1100 });
	await page.goto(`${origin}/${project}`);
	await expect(page.getByRole("heading", { name: "Jira Design", exact: true })).toBeVisible();
	await expect(page.locator("[data-agent-session-column-expansion]")).toBeVisible();
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
	if (await expand.isVisible()) {
		await expand.click();
	} else if (!await page.getByRole("button", { name: "Collapse Unlink sessions column" }).isVisible()) {
		const options = page.getByRole("button", { name: "Unlink sessions column options" });
		await options.click();
		const pin = page.getByRole("menuitem", { name: "Pin", exact: true });
		if (await pin.isVisible()) {
			await pin.click();
			await options.click();
		}
		await page.getByRole("menuitem", { name: "Expand", exact: true }).click();
	}
	await expect(page.locator("[data-agent-session-column-expansion]"))
		.toHaveAttribute("data-agent-session-column-expansion", "expanded");
	await expect(page.locator("[data-agent-session-column]")).toHaveCSS("width", "280px");
	await page.getByRole("heading", { name: "Jira Design", exact: true }).hover();
	await expect(page.locator('[data-slot="hover-card-content"]')).toHaveCount(0);
	const source = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-scope-thread");
	await expect(source).toBeVisible();
	return source;
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`one button grows from 24px to 32px at drag start and returns (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion, colorScheme: "light" });
		const source = await openBoard(page);
		const column = page.locator('[data-jira-kanban-column="To do"]');
		const button = column.getByRole("button", { name: "Create in To do" });
		await expect(button).toHaveCSS("height", "24px");
		const original = (await button.elementHandle())!;
		await page.evaluate(() => {
			const trace = { stage: "enter", frames: [] as { stage: string; kind: string; opacity: number; offset: number; height: number; nativeHeight: number; stale: boolean; addOpacity: number; labelOpacity: number }[], running: true };
			Object.assign(window, { sharedControlTrace: trace });
			const started = performance.now();
			function sample() {
				for (const copy of document.querySelectorAll('[data-jira-dropzone-control="To do"] [data-jira-dropzone-copy-motion]')) {
					const style = getComputedStyle(copy);
					const add = copy.querySelector('[data-jira-dropzone-copy-layer="add"]');
					const label = copy.querySelector('[data-jira-dropzone-copy-layer="label"]');
					const control = document.querySelector<HTMLElement>('[data-jira-dropzone-control="To do"]')!;
					trace.frames.push({
						stage: trace.stage,
						kind: copy.getAttribute("data-jira-dropzone-copy-motion")!,
						height: control.getBoundingClientRect().height,
						nativeHeight: control.offsetHeight,
						stale: copy.getAttribute("data-jira-dropzone-copy-motion") !== (control.getAttribute("aria-label")?.startsWith("Drop to create work item") ? "label" : "add"),
						opacity: Number(style.opacity),
						addOpacity: add ? Number(getComputedStyle(add).opacity) : 0,
						labelOpacity: label ? Number(getComputedStyle(label).opacity) : 0,
						offset: style.transform === "none" ? 0 : new DOMMatrixReadOnly(style.transform).m42,
					});
				}
				if (trace.running && performance.now() - started < 10000) requestAnimationFrame(() => setTimeout(sample, 0));
			}
			requestAnimationFrame(() => setTimeout(sample, 0));
		});
		const sourceBox = (await source.boundingBox())!;
		await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
		await page.mouse.down();
		await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 20, sourceBox.y + sourceBox.height / 2 + 20, { steps: 5 });
		const target = column.getByRole("button", { name: /^Drop to create work item in To do/ });
		await expect(target).toBeVisible();
		expect(await original.evaluate((node) => node === document.querySelector('[data-jira-dropzone-control="To do"]'))).toBe(true);
		await page.mouse.move(900, 100, { steps: 8 });
		await expect(target).toHaveCSS("height", "32px");
		await expect(target).toHaveCSS("background-color", "rgb(255, 255, 255)");
		await expect(target).toHaveAttribute("aria-disabled", "true");
		await page.waitForTimeout(180);
		await expect(target.locator('[data-jira-dropzone-copy-motion="add"]')).toHaveCount(0);
		await page.screenshot({ path: `output/agent-browser/dropzone-motion-side/shared-control-${reducedMotion}.png` });
		const sensor = column.locator("[data-create-work-item-proximity]");
		const sensorBox = (await sensor.boundingBox())!;
		await page.evaluate(() => {
			(window as typeof window & { sharedControlTrace: { stage: string } }).sharedControlTrace.stage = "expand";
		});
		await page.mouse.move(sensorBox.x + sensorBox.width / 2, sensorBox.y + sensorBox.height / 2, { steps: 8 });
		await expect.poll(async () => (await target.boundingBox())!.height).toBeCloseTo(sensorBox.height, 0);
		expect(await sensor.boundingBox()).toEqual(sensorBox);
		await expect(target).toHaveCSS("background-color", "rgb(233, 242, 254)");
		await page.mouse.move(900, 100, { steps: 8 });
		await expect(target).toHaveCSS("height", "32px");

		await page.evaluate(() => {
			(window as typeof window & { sharedControlTrace: { stage: string } }).sharedControlTrace.stage = "exit";
		});
		await page.mouse.up();
		await expect(button).toBeVisible();
		await expect(button).toHaveCSS("height", "24px");
		expect(await original.evaluate((node) => node === document.querySelector('[data-jira-dropzone-control="To do"]'))).toBe(true);
		await page.waitForTimeout(180);
		await expect(button.locator('[data-jira-dropzone-copy-motion="label"]')).toHaveCount(0);
		await expect(button.locator('[data-jira-dropzone-copy-motion="add"]')).toHaveCSS("opacity", "1");
		const frames = await page.evaluate(() => {
			const trace = (window as typeof window & { sharedControlTrace: { running: boolean; frames: { stage: string; kind: string; opacity: number; offset: number; height: number; nativeHeight: number; stale: boolean; addOpacity: number; labelOpacity: number }[] } }).sharedControlTrace;
			trace.running = false;
			return trace.frames;
		});
		const { writeFile } = await import("node:fs/promises");
		await writeFile(`output/agent-browser/dropzone-motion-side/shared-control-frames-${reducedMotion}.json`, JSON.stringify(frames, null, 2));
		expect(frames.filter((frame) => frame.stale)).toEqual([]);
		if (reducedMotion === "reduce") {
			expect(frames.every((frame) => Math.abs(frame.offset) < 0.01)).toBe(true);
		} else {
			expect(frames.some((frame) => frame.stage === "enter" && frame.height > 24 && frame.height < 32)).toBe(true);
			expect(frames.some((frame) => frame.stage === "expand" && frame.height > 32.1 && frame.height < sensorBox.height - 0.1)).toBe(true);
			expect(frames.some((frame) => frame.stage === "exit" && frame.height > 24 && frame.height < 32)).toBe(true);
			for (const stage of ["enter", "exit"]) {
				expect(frames.some((frame) => frame.stage === stage && frame.addOpacity > 0.01 && frame.addOpacity < 0.99 && frame.labelOpacity > 0.01 && frame.labelOpacity < 0.99)).toBe(true);
			}
			expect(frames.every((frame) => Math.abs(frame.height - frame.nativeHeight) < 0.6)).toBe(true);
			expect(frames.every((frame) => frame.opacity === 1 && Math.abs(frame.offset) < 0.01)).toBe(true);
		}
	});
}
