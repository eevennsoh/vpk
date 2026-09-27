import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const origin = (process.env.PLAYWRIGHT_BASE_URL
	?? execFileSync(process.execPath, [".agents/skills/vpk-verify/scripts/control-vpk", "url"], { encoding: "utf8" }).trim()).replace(/\/$/u, "");

test.use({ ignoreHTTPSErrors: true });

for (const fixture of [
	{ route: "/preview/blocks/jira-dragging", code: "PAY-105", tone: "information" },
	{ route: "/jira-team-eu26", code: "PAY-118", tone: "warning" },
] as const) {
	test(`bulk status tones are owned by ${fixture.route}`, async ({ page }) => {
		await page.setViewportSize({ width: 1800, height: 1100 });
		await page.goto(`${origin}${fixture.route}`);
		await page.locator(`[data-issue-key="${fixture.code}"] [draggable]`).first().click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await page.locator('[data-slot="jira-toolbar"]').getByRole("button", { name: "More actions", exact: true }).click();
		await page.getByRole("menuitem", { name: "Change status", exact: true }).focus();
		await page.keyboard.press("ArrowRight");
		const review = page.getByRole("menuitem", { name: "In review", exact: true }).locator('[data-slot="lozenge"]');
		const expected = await page.evaluate((tone) => {
			const probe = document.createElement("span");
			probe.style.backgroundColor = `var(--ds-background-${tone}-subtler)`;
			document.body.append(probe);
			const color = getComputedStyle(probe).backgroundColor;
			probe.remove();
			return color;
		}, fixture.tone);
		await expect(review).toHaveCSS("background-color", expected);
	});
}

for (const width of [1440, 1920]) {
	test(`bulk Change status aligns with menu items and supports keyboard activation at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1080 });
		await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
		await expect(page.getByRole("heading", { name: "Team ’26 EU keynote", exact: true })).toBeVisible();
		for (const code of ["TEU-9", "TEU-10"]) {
			await page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"] [data-slot="jira-issue-cover"]`).click({ modifiers: ["Shift"] });
		}
		const toolbar = page.locator('[data-slot="jira-toolbar"]');
		await toolbar.getByRole("button", { name: "More actions", exact: true }).click();
		const status = page.getByRole("menuitem", { name: "Change status", exact: true });
		await expect(status).toBeVisible();
		const geometry = await page.getByRole("menu").evaluate(menu => {
			return ["Edit fields", "Change status", "Merge", "Watch options", "Delete"].map(label => {
				const row = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(node => node.textContent?.trim() === label)!;
				const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
				let text = walker.nextNode();
				while (text && text.textContent?.trim() !== label) text = walker.nextNode();
				if (!text) throw new Error(`Missing label ${label}`);
				const range = document.createRange();
				range.selectNodeContents(text);
				const textBounds = range.getBoundingClientRect();
				const iconBounds = row.querySelector("svg")!.getBoundingClientRect();
				const rowBounds = row.getBoundingClientRect();
				return {
					label,
					textLeft: textBounds.left,
					iconCenter: iconBounds.left + iconBounds.width / 2,
					iconOffsetY: iconBounds.top + iconBounds.height / 2 - (rowBounds.top + rowBounds.height / 2),
					height: rowBounds.height,
				};
			});
		});
		for (const row of geometry.slice(1)) {
			expect(row.textLeft, `${row.label} label alignment`).toBeCloseTo(geometry[0].textLeft, 1);
			expect(row.iconCenter, `${row.label} icon alignment`).toBeCloseTo(geometry[0].iconCenter, 1);
			expect(row.iconOffsetY, `${row.label} vertical centering`).toBeCloseTo(0, 1);
			expect(row.height).toBe(geometry[0].height);
		}
		await status.focus();
		await status.press("ArrowRight");
		const done = page.getByRole("menuitem", { name: "Done", exact: true });
		await expect(done).toBeVisible();
		await done.focus();
		await done.press("Enter");
		await expect(page.getByRole("menu")).toHaveCount(0);
		for (const code of ["TEU-9", "TEU-10"]) {
			await expect(page.locator(`[data-jira-kanban-column="Done"] [data-issue-key="${code}"]`)).toBeVisible();
		}
	});
}
