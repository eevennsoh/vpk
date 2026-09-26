import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

const origin = (process.env.PLAYWRIGHT_BASE_URL
	?? execFileSync(process.execPath, [".agents/skills/vpk-verify/scripts/control-vpk", "url"], { encoding: "utf8" }).trim()).replace(/\/$/u, "");
const issue = (page: Page, code: string) => page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`);
const column = (page: Page, title: string) => page.locator(`[data-jira-kanban-column="${title}"]`);
const storySections = [
	{ title: "Context", stories: ["Desktop search & chat", "Code context", "Rovo for Work & Mobile", "Artifacts"] },
	{ title: "Collaboration", stories: ["Loom Desktop recording", "Whiteboard → Figma → Loom collaboration", "AI Planner & human–agent collaboration"] },
	{ title: "Confidence", stories: ["Loom AI overlays", "Loom PR previews", "Jira Agent Sessions & real-time boards", "DX: session quality & comparative ROI", "Strategy Collection: Focus & Talent", "Enterprise governance & Guard"] },
];
const issueTitles = storySections.flatMap((section) => section.stories);

test.use({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });

async function openBoard(page: Page) {
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
	await expect(page.getByRole("heading", { name: "Team ’26 EU keynote", exact: true })).toBeVisible();
}

async function startDrag(page: Page, code: string) {
	const card = issue(page, code).locator('[draggable="true"]').first();
	await card.scrollIntoViewIfNeeded();
	const box = await card.boundingBox();
	if (!box) throw new Error(`Missing card ${code}`);
	await page.mouse.move(box.x + 70, box.y + 35);
	await page.mouse.down();
	await page.mouse.move(box.x + 90, box.y + 40, { steps: 5 });
	await expect(card).toHaveAttribute("data-dragging", "true");
}

async function dropIntoDone(page: Page) {
	const target = column(page, "Done");
	const box = await target.boundingBox();
	if (!box) throw new Error("Missing Done column");
	await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 6 });
	// Native HTML dragover can follow dragenter on the next pointer movement.
	await page.mouse.move(box.x + box.width / 2, box.y + 101);
	await page.mouse.up();
}

for (const width of [1440, 1920]) {
	test(`thirteen keynote stories use three section columns and Done at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1080 });
		await openBoard(page);
		await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(4);
		for (const section of storySections) {
			await expect(column(page, section.title).locator("[data-issue-key]")).toHaveCount(section.stories.length);
		}
		await expect(page.locator('[data-jira-kanban-column="Coherence"]')).toHaveCount(0);
		await expect(column(page, "Done").locator("[data-issue-key]")).toHaveCount(0);
		for (const [index, title] of issueTitles.entries()) {
			const card = issue(page, `TEU-${index + 1}`);
			await expect(card).toContainText(title);
			await card.scrollIntoViewIfNeeded();
			const cover = card.locator('[data-slot="jira-issue-cover"] img');
			await expect(cover).toHaveCount(1);
			await expect.poll(() => cover.evaluate((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
			const height = await cover.evaluate((node) => node.getBoundingClientRect().height);
			expect(height).toBeGreaterThan(0);
			expect(height).toBeLessThanOrEqual(120);
		}
		const geometry = await page.locator("[data-jira-kanban-scrollport]").evaluate((node) => {
			const columns = [...node.querySelectorAll<HTMLElement>("[data-jira-kanban-column]")];
			return {
				widths: columns.map((element) => element.getBoundingClientRect().width),
				rightInset: node.getBoundingClientRect().right - columns.at(-1)!.getBoundingClientRect().right,
				horizontalOverflow: node.scrollWidth - node.clientWidth,
			};
		});
		expect(Math.max(...geometry.widths) - Math.min(...geometry.widths)).toBeLessThanOrEqual(1);
		expect(geometry.widths[0]).toBeGreaterThanOrEqual(280);
		expect(geometry.rightInset).toBeLessThanOrEqual(32);
		expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
		await expect(page.getByRole("button", { name: "Select all", exact: true })).toHaveCount(0);
	});
}

test("retained sessions start collapsed and remain unchanged as rehearsal time advances", async ({ page }) => {
	await page.clock.install();
	await openBoard(page);
	const sessions = page.locator("[data-agent-session-column]");
	await expect(sessions).toHaveAttribute("data-collapsed", "true");
	await expect(sessions.locator("[data-agent-session-column-rail]")).toBeVisible();
	const expand = page.getByRole("button", { name: "Expand Unlink sessions column", exact: true });
	await expand.focus();
	await page.keyboard.press("Enter");
	await expect(sessions).not.toHaveAttribute("data-collapsed", "true");
	const rows = sessions.locator('[data-testid^="agent-session-row-"]');
	await expect(rows.first()).toBeVisible();
	expect(await rows.count()).toBeGreaterThan(0);
	const before = await rows.allTextContents();
	await page.getByRole("heading", { name: "Team ’26 EU keynote", exact: true }).click();
	await page.clock.fastForward(120_000);
	await expect(rows).toHaveText(before);
	await expect(sessions.getByTestId("agent-session-row-lw-sync-webhook-gap")).toHaveCount(0);
});

test("MCB views the board with four presenter filters and no faces in column headers", async ({ page }) => {
	await openBoard(page);
	await expect(page.locator('[data-current-user-id="mcb"] img')).toHaveAttribute("src", "/avatar-user/mcb.png");
	const filters = page.getByRole("button", { name: /^Filter board by /u });
	await expect(filters).toHaveCount(4);
	for (const name of ["MCB", "Tamar", "Sherif", "Taroon"]) {
		await expect(page.getByRole("button", { name: `Filter board by ${name}`, exact: true })).toBeVisible();
	}
	for (const section of storySections) {
		const header = column(page, section.title)
			.getByRole("button", { name: `Collapse ${section.title} column`, exact: true })
			.locator("..").locator("..");
		await expect(header.locator('img[src^="/avatar-user/"]')).toHaveCount(0);
	}
	for (const [code, presenter] of [["TEU-1", "mcb"], ["TEU-2", "mcb"], ["TEU-3", "tamar"], ["TEU-4", "tamar"]]) {
		await expect(issue(page, code).locator(`img[src="/avatar-user/${presenter}.png"]`)).toHaveCount(1);
	}
});

test("existing single-card and selected-cohort drag moves work items into Done", async ({ page }) => {
	await openBoard(page);
	await startDrag(page, "TEU-1");
	await dropIntoDone(page);
	await expect(issue(page, "TEU-1")).toHaveAttribute("data-board-column-title", "Done");
	const second = issue(page, "TEU-2").locator('[draggable="true"]').first();
	const third = issue(page, "TEU-3").locator('[draggable="true"]').first();
	await second.click({ modifiers: ["Meta"] });
	await third.click({ modifiers: ["Meta"] });
	await expect(second).toHaveAttribute("data-selected", "true");
	await expect(third).toHaveAttribute("data-selected", "true");
	await startDrag(page, "TEU-2");
	await dropIntoDone(page);
	await expect(issue(page, "TEU-2")).toHaveAttribute("data-board-column-title", "Done");
	await expect(issue(page, "TEU-3")).toHaveAttribute("data-board-column-title", "Done");
	for (const code of ["TEU-1", "TEU-2", "TEU-3"]) {
		const coverHeight = await issue(page, code).locator('[data-slot="jira-issue-cover"] img').evaluate((node) => node.getBoundingClientRect().height);
		expect(coverHeight).toBeGreaterThan(0);
		expect(coverHeight).toBeLessThanOrEqual(120);
	}
	await expect(column(page, "Done").locator("[data-issue-key]")).toHaveCount(3);
	await expect(column(page, "Context").locator("[data-issue-key]")).toHaveCount(1);
	await expect(column(page, "Collaboration").locator("[data-issue-key]")).toHaveCount(3);
	await expect(column(page, "Confidence").locator("[data-issue-key]")).toHaveCount(6);
});
