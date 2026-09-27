import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

const origin = (process.env.PLAYWRIGHT_BASE_URL
	?? execFileSync(process.execPath, [".agents/skills/vpk-verify/scripts/control-vpk", "url"], { encoding: "utf8" }).trim()).replace(/\/$/u, "");
const issue = (page: Page, code: string) => page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`);
const column = (page: Page, title: string) => page.locator(`[data-jira-kanban-column="${title}"]`);
const storySections = [
	{ title: "Context", stories: ["Search across your work", "Ground AI in your codebase", "Pick up work anywhere", "Turn ideas into outputs"] },
	{ title: "Collaboration", stories: ["Record. Share. Collaborate.", "From ideas to shared outcomes", "Humans and agents. One plan."] },
	{ title: "Confidence", stories: ["Make every video clearer", "Preview code changes in video", "See agent work as it happens", "Measure session quality and ROI", "Align talent and investment", "Govern AI at every level"] },
];
const issueTitles = storySections.flatMap((section) => section.stories);
const coverHeadings = [
	"Desktop search & chat", "Code context", "Rovo for Work & Mobile", "Rovo Artifacts",
	"Loom desktop recording", "Whiteboard → Figma → Loom", "AI Planner",
	"Loom AI overlays", "Loom PR previews", "Jira Agent Sessions", "DX session quality & ROI", "Strategy Collection", "Enterprise governance & Guard",
];
const coverApps = [
	["Rovo"], ["Bitbucket", "GitHub", "GitLab"], ["Rovo"], ["Rovo"],
	["Loom"], ["Confluence", "Figma", "Loom"], ["Jira"],
	["Loom"], ["Loom", "Bitbucket"], ["Jira"], ["DX"], ["Focus", "Talent"], ["Guard"],
];

test.use({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });

async function openBoard(page: Page) {
	await page.goto(`${origin}/preview/projects/jira-team-eu26-end`, { waitUntil: "networkidle" });
	await expect(page.getByRole("heading", { name: "Team ’26 EU keynote", exact: true })).toBeVisible();
}

async function startDrag(page: Page, code: string) {
	// Pointer transport temporarily disables native draggable during pickup.
	const card = issue(page, code).locator("[draggable]").first();
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
		const coverColors = new Set<string>();
		for (const [index, title] of issueTitles.entries()) {
			const card = issue(page, `TEU-${index + 1}`);
			await expect(card).toContainText(title);
			await card.scrollIntoViewIfNeeded();
			const cover = card.locator('[data-slot="jira-issue-cover"]');
			await expect(cover).toHaveCount(1);
			await expect(cover).not.toHaveAttribute("aria-hidden", "true");
			const heading = cover.locator('[data-slot="jira-issue-cover-heading"]');
			const subheading = cover.locator('[data-slot="jira-issue-cover-subheading"]');
			await expect(heading).toBeVisible();
			await expect(heading).toHaveText(coverHeadings[index]);
			await expect(heading).toHaveCSS("font-size", "20px");
			await expect(heading).toHaveCSS("text-transform", "capitalize");
			await expect(heading).toHaveCSS("white-space", "pre-line");
			await expect(heading).toHaveCSS("text-align", "left");
			await expect(subheading).toHaveCount(0);
			const apps = cover.locator('[data-slot="jira-issue-cover-apps"]');
			const stack = apps.locator('[data-slot="jira-issue-cover-app-stack"]');
			await expect(apps).toBeVisible();
			for (const name of coverApps[index]) {
				await expect(apps.getByRole("img", { name, exact: true }).first()).toBeVisible();
			}
			await expect(stack).toHaveCount(coverApps[index].length > 1 ? 1 : 0);
			if (coverApps[index].length > 1) {
				await expect(stack.locator(":scope > div")).toHaveCount(coverApps[index].length);
			} else {
				await expect(apps.locator(":scope > *")).toHaveCount(1);
			}
			const logoBounds = await apps.boundingBox();
			const headingBounds = await heading.boundingBox();
			const titleBounds = await card.getByText(title, { exact: true }).boundingBox();
			expect(logoBounds!.y + logoBounds!.height).toBeLessThan(headingBounds!.y);
			expect(Math.abs(logoBounds!.x - headingBounds!.x)).toBeLessThanOrEqual(1);
			expect(Math.abs(headingBounds!.x - titleBounds!.x)).toBeLessThanOrEqual(0.1);
			const pattern = cover.locator('[data-slot="jira-issue-cover-pattern"]');
			const patternBounds = await pattern.boundingBox();
			const coverBounds = await cover.boundingBox();
			for (const dimension of ["x", "y", "width", "height"] as const) {
				expect(Math.abs(patternBounds![dimension] - coverBounds![dimension])).toBeLessThanOrEqual(0.1);
			}
			await expect(pattern).toHaveAttribute("aria-hidden", "true");
			await expect(pattern).toHaveCSS("pointer-events", "none");
			await expect(pattern).not.toHaveCSS("mask-image", "none");
			await expect(pattern.locator('[style*="data:image/svg+xml"]')).toHaveCSS("mask-repeat", "round");
			await expect(cover).toHaveCSS("mask-image", "none");
			await expect(heading).toHaveCSS("mask-image", "none");
			const geometry = await cover.evaluate((node) => {
				const coverBounds = node.getBoundingClientRect();
				const cardBounds = node.closest("article,button")!.getBoundingClientRect();
				const heading = node.querySelector<HTMLElement>('[data-slot="jira-issue-cover-heading"]')!;
				return {
					height: coverBounds.height,
					leftGap: coverBounds.left - cardBounds.left,
					rightGap: cardBounds.right - coverBounds.right,
					topGap: coverBounds.top - cardBounds.top,
					color: getComputedStyle(node).backgroundColor,
					textColor: getComputedStyle(heading).color,
					headingFont: getComputedStyle(heading).fontFamily,
					headingWeight: getComputedStyle(heading).fontWeight,
					headingLines: heading.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(heading).lineHeight),
					textOverflow: heading.scrollWidth > heading.clientWidth || heading.getBoundingClientRect().bottom > coverBounds.bottom,
				};
			});
			expect(geometry.height).toBe(144);
			expect(geometry.leftGap).toBe(0);
			expect(geometry.rightGap).toBe(0);
			expect(geometry.topGap).toBe(0);
			expect(geometry.color).toBe("rgb(255, 255, 255)");
			expect(geometry.textColor).toBe("rgb(16, 18, 20)");
			expect(geometry.headingFont).toContain("Atlassian Sans");
			expect(geometry.headingWeight).toBe("400");
			expect(geometry.headingLines).toBeLessThanOrEqual(2.05);
			expect(geometry.headingLines).toBeGreaterThanOrEqual(1.95);
			expect(geometry.textOverflow).toBe(false);
			coverColors.add(geometry.color);
		}
		expect(coverColors.size).toBe(1);
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

test("all feature headings fit within two lines in narrow board columns", async ({ page }) => {
	await page.setViewportSize({ width: 1024, height: 900 });
	await openBoard(page);
	for (let index = 0; index < coverHeadings.length; index += 1) {
		const heading = issue(page, `TEU-${index + 1}`).locator('[data-slot="jira-issue-cover-heading"]');
		await heading.scrollIntoViewIfNeeded();
		await expect(heading).toHaveText(coverHeadings[index]);
		const geometry = await heading.evaluate((node) => {
			const bounds = node.getBoundingClientRect();
			const coverBounds = node.closest('[data-slot="jira-issue-cover"]')!.getBoundingClientRect();
			return { lines: bounds.height / Number.parseFloat(getComputedStyle(node).lineHeight), overflow: node.scrollWidth > node.clientWidth, insideCover: bounds.top >= coverBounds.top && bounds.bottom <= coverBounds.bottom };
		});
		expect(geometry.lines).toBeLessThanOrEqual(2.05);
		expect(geometry.overflow).toBe(false);
		expect(geometry.insideCover).toBe(true);
	}
});

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

test("covers stay flush while selection and keyboard focus reveal the border and scrollbars stay inside their columns", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await openBoard(page);
	const card = issue(page, "TEU-1");
	const cover = card.locator('[data-slot="jira-issue-cover"]');
	const article = card.locator("article");
	const geometry = async () => cover.evaluate((node) => {
		const bounds = node.getBoundingClientRect();
		const cardBounds = node.closest("article")!.getBoundingClientRect();
		return { width: bounds.width, height: bounds.height, leftGap: bounds.left - cardBounds.left, rightGap: cardBounds.right - bounds.right, topGap: bounds.top - cardBounds.top };
	});
	const idle = await geometry();
	expect(idle.leftGap).toBe(0);
	expect(idle.rightGap).toBe(0);
	expect(idle.topGap).toBe(0);

	await cover.click();
	await expect(article).toHaveAttribute("data-selected", "true");
	await expect(cover).toHaveCSS("clip-path", "inset(1px 1px 0px round 7px 7px 0px 0px)");
	expect(await geometry()).toEqual(idle);
	await page.getByRole("button", { name: "Clear selection", exact: true }).click();
	await page.keyboard.press("Tab");
	await card.locator("[data-jira-issue-activation-control]").focus();
	await expect(cover).toHaveCSS("clip-path", "inset(1px 1px 0px round 7px 7px 0px 0px)");
	expect(await geometry()).toEqual(idle);

	const viewport = page.getByRole("region", { name: "Context work items", exact: true });
	const scrollbar = viewport.locator("..").locator('[data-slot="scroll-area-scrollbar"]');
	await viewport.hover();
	await expect(scrollbar).toHaveCSS("opacity", "1");
	const thumbBounds = await scrollbar.locator('[data-slot="scroll-area-thumb"]').boundingBox();
	const columnBounds = await column(page, "Context").boundingBox();
	expect(thumbBounds!.x).toBeGreaterThanOrEqual(columnBounds!.x);
	expect(thumbBounds!.x + thumbBounds!.width).toBeLessThanOrEqual(columnBounds!.x + columnBounds!.width);
	await page.mouse.wheel(0, 150);
	await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
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
		const coverHeight = await issue(page, code).locator('[data-slot="jira-issue-cover"]').evaluate((node) => node.getBoundingClientRect().height);
		expect(coverHeight).toBeGreaterThan(0);
		expect(coverHeight).toBeLessThanOrEqual(144);
	}
	await expect(column(page, "Done").locator("[data-issue-key]")).toHaveCount(3);
	await expect(column(page, "Context").locator("[data-issue-key]")).toHaveCount(1);
	await expect(column(page, "Collaboration").locator("[data-issue-key]")).toHaveCount(3);
	await expect(column(page, "Confidence").locator("[data-issue-key]")).toHaveCount(6);
});
