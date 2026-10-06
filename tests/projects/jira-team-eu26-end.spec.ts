import { expect, test, type Page } from "@playwright/test";

import { resolveAppOrigin } from "@/tests/helpers/origin";

const origin = resolveAppOrigin();
const issue = (page: Page, code: string) => page.locator(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`);
const column = (page: Page, title: string) => page.locator(`[data-jira-kanban-column="${title}"]`);
const storySections = [
	{ title: "Context", stories: ["Artifacts", "Rovo Desktop", "Data Context", "Code Context", "Code Context", "Code Search App", "Rovo For Work", "People Context", "Communications Context"] },
	{ title: "Collaboration", stories: ["Atlassian MCP", "Loom Desktop", "Loom Record for Agent", "Planner", "Loom Overlay", "ChatGPT Codex from Jira"] },
	{ title: "Confidence", stories: ["Loom PR Reviews", "EU AI Inference", "Agent Effectiveness", "Change Risk Assessment", "Agent Identities", "Agent Session Tracking", "Incident Command Center", "Employee Onboarding", "AI Capital Management", "Guard Scanning"] },
];
const issueTitles = storySections.flatMap((section) => section.stories);
const issueCodes = [
	"TEU-4", "TEU-1", "TEU-101", "TEU-2", "TEU-102", "TEU-3", "TEU-103", "TEU-104",
	"TEU-105", "TEU-5", "TEU-106", "TEU-7", "TEU-8", "TEU-107",
	"TEU-9", "TEU-108", "TEU-11", "TEU-109", "TEU-110", "TEU-10", "TEU-111", "TEU-112", "TEU-12", "TEU-13",
];
const coverApps = [
	["Artifacts"], ["Rovo"], ["Teamwork Graph"], ["Teamwork Graph"], ["Teamwork Graph"], ["Code Search"], ["Rovo"], ["Teamwork Graph"], ["Teamwork Graph"],
	["Teamwork Graph"], ["Loom"], ["Loom"], ["Jira", "Confluence", "Teamwork Graph"], ["Loom"], ["Jira"],
	["Loom"], [], ["DX"], ["Jira Service Management"], [], ["Jira"], ["Jira Service Management"], ["Jira Service Management"], ["Talent"], ["Guard"],
];

test.use({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });

async function openBoard(page: Page) {
	await page.goto(`${origin}/preview/projects/jira-team-eu26-end?embedded=1`, { waitUntil: "networkidle" });
	await expect(page.getByRole("heading", { name: "Team ’26 EU keynote", exact: true })).toBeVisible();
}

test("keynote cards keep More actions by the summary, omit the work item key, and hide footer metadata", async ({ page }) => {
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
	const target = issue(page, "TEU-1");
	await expect(target).toBeVisible();
	const summaryRow = target.locator('[data-slot="jira-issue-more-action"]').locator("xpath=..");
	await expect(summaryRow.getByText("Rovo Desktop", { exact: true })).toBeVisible();
	await expect.soft(summaryRow.getByRole("button", { name: "More actions for TEU-1", exact: true })).toBeVisible();
	await expect.soft(target.locator("[data-jira-issue-activation-control]")).toHaveText("Rovo Desktop");
	await expect.soft(target.getByText("TEU-1", { exact: true })).toHaveCount(0);
});

test("clicking the profile Theme label changes the theme", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("ui-theme", "light"));
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
	await page.getByRole("button", { name: "Profile menu", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "Profile settings", exact: true })).toBeVisible();
	await page.getByText("Theme", { exact: true }).click();
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
});

async function coverThemeColors(page: Page) {
	return page.evaluate(() => {
		const probe = document.createElement("div");
		probe.style.cssText = "background-color:var(--ds-surface);color:var(--ds-text);border-color:var(--ds-border)";
		document.body.append(probe);
		const styles = getComputedStyle(probe);
		const colors = { background: styles.backgroundColor, text: styles.color, grid: styles.borderColor };
		probe.remove();
		return colors;
	});
}

test("keynote covers follow live light, dark and system theme changes", async ({ page }) => {
	await page.emulateMedia({ colorScheme: "light" });
	await page.addInitScript(() => localStorage.setItem("ui-theme", "light"));
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
	const covers = page.locator('[data-jira-kanban-scrollport] [data-slot="jira-issue-cover"]');
	await expect(covers).toHaveCount(24);
	const geometry = () => covers.evaluateAll(nodes => nodes.map(node => {
		const bounds = node.getBoundingClientRect();
		return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
	}));
	const initialGeometry = await geometry();
	await page.getByRole("button", { name: "Profile menu", exact: true }).click();
	const palettes: Awaited<ReturnType<typeof coverThemeColors>>[] = [];
	for (const mode of ["light", "dark", "system", "light"] as const) {
		const themeToggle = page.getByRole("button", { name: `Theme: ${mode[0].toUpperCase()}${mode.slice(1)} theme`, exact: true });
		await expect(themeToggle).toBeVisible();
		await expect(page.locator("html")).toHaveAttribute("data-color-mode", mode === "dark" ? "dark" : "light");
		const colors = await coverThemeColors(page);
		palettes.push(colors);
		for (const cover of await covers.all()) {
			await expect(cover.locator('img[src^="/illustration/jira-team-eu26-end/"]')).toBeVisible();
			const surfaces = await cover.evaluate(node => ({
				apps: getComputedStyle(node).getPropertyValue("--ds-surface"),
				page: getComputedStyle(document.documentElement).getPropertyValue("--ds-surface"),
			}));
			expect(surfaces.apps).toBe(surfaces.page);
		}
		expect(await geometry()).toEqual(initialGeometry);
		if (palettes.length < 4) {
			await themeToggle.click();
		}
	}
	await page.keyboard.press("Escape");
	expect(palettes[1]).not.toEqual(palettes[0]);
	expect(palettes[2]).toEqual(palettes[0]);
	expect(palettes[3]).toEqual(palettes[0]);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`keynote header keeps its presenters and previews all coding agent lanyards with motion=${reducedMotion}`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "domcontentloaded" });
		const facepile = page.getByRole("group", { name: "Board assignees", exact: true });
		await expect(facepile.getByRole("button")).toHaveCount(7);
		for (const name of ["MCB", "Tamar", "Sherif", "Taroon"]) {
			await expect(facepile.getByRole("button", { name: `Filter board by ${name}`, exact: true })).toBeVisible();
		}
		const popup = page.locator('[data-slot="hover-card-content"]');
		for (const name of ["Claude", "Jira Coding Agent", "Cursor"]) {
			const avatar = facepile.getByRole("button", { name: `Preview ${name}`, exact: true });
			await expect(avatar.locator('[data-slot="avatar"]')).toHaveAttribute("data-shape", "hexagon");
			await avatar.hover();
			await expect(popup.getByRole("heading", { name, exact: true })).toBeVisible();
			await page.mouse.move(0, 0);
			await expect(popup).toBeHidden();
			await avatar.focus();
			await expect(popup.getByRole("heading", { name, exact: true })).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(popup).toBeHidden();
			await avatar.blur();
		}
		await facepile.getByRole("button", { name: "Filter board by MCB", exact: true }).click();
		await expect(facepile.getByRole("button", { name: "Filter board by MCB", exact: true })).toHaveAttribute("aria-pressed", "true");
	});
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

test("column header drop feedback keeps equal space above and below its transition label", async ({ page }) => {
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
	await startDrag(page, "TEU-1");

	const header = column(page, "Context").locator('[data-slot="board-column-header"]');
	const headerBox = await header.boundingBox();
	if (!headerBox) throw new Error("Missing Context column header");
	const x = headerBox.x + headerBox.width / 2;
	const y = headerBox.y + headerBox.height / 2;
	await page.mouse.move(x, y, { steps: 5 });
	await page.mouse.move(x, y);

	await expect(header).toHaveAttribute("data-issue-drop-hovered", "true");
	await expect(header).toContainText("Transition to...");
	const clearance = await header.evaluate((node) => {
		const feedback = node.querySelector<HTMLElement>("[data-board-column-title-drop-feedback]")!.getBoundingClientRect();
		const label = node.querySelector<HTMLElement>("[data-board-column-header-copy-motion]")!.getBoundingClientRect();
		return {
			bottom: feedback.bottom - label.bottom,
			top: label.top - feedback.top,
		};
	});
	expect(clearance.bottom).toBeCloseTo(clearance.top, 1);
	await page.keyboard.press("Escape");
	await page.mouse.up();
});

async function dropIntoDone(page: Page) {
	const target = column(page, "Done");
	const box = await target.boundingBox();
	if (!box) throw new Error("Missing Done column");
	await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 6 });
	// Native HTML dragover can follow dragenter on the next pointer movement.
	await page.mouse.move(box.x + box.width / 2, box.y + 101);
	await page.mouse.up();
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const action of ["Archive", "Delete"]) {
		test(`${action} reverses the create entrance with motion=${reducedMotion}`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
			const target = issue(page, "TEU-1");
			await expect(target).toBeVisible();
			const trigger = target.getByRole("button", { name: "More actions for TEU-1", exact: true });
			await trigger.focus();
			await trigger.press("Enter");
			const menuItem = page.getByRole("menuitem", { name: action, exact: true });
			await expect(menuItem).toBeVisible();
			await page.evaluate(() => {
				const card = document.querySelector('[data-board-agent-session-drop-zone="issue"][data-issue-key="TEU-1"]')!;
				const slot = card.querySelector('[data-slot="jira-creating-slot"]')!;
				const face = card.querySelector('[data-slot="jira-creating-card"]')!;
				const sibling = document.querySelector('[data-board-agent-session-drop-zone="issue"][data-issue-key="TEU-101"]')!;
				const samples: { height: number; opacity: number; scale: number; top: number; inert: boolean; removing: boolean }[] = [];
				const baseline = { height: slot.getBoundingClientRect().height, top: sibling.getBoundingClientRect().top, cardTop: card.getBoundingClientRect().top };
				const probe = { baseline, samples, done: false };
				Object.assign(window, { jiraRemovalProbe: probe });
				function sample() {
					const style = getComputedStyle(face);
					samples.push({
						height: slot.getBoundingClientRect().height,
						opacity: Number(style.opacity),
						scale: style.transform === "none" ? 1 : new DOMMatrixReadOnly(style.transform).a,
						top: sibling.getBoundingClientRect().top,
						inert: Boolean(card.closest("[inert]")),
						removing: slot.hasAttribute("data-jira-creating-removing"),
					});
					if (card.isConnected) requestAnimationFrame(sample);
					else probe.done = true;
				}
				requestAnimationFrame(sample);
			});
			await menuItem.click();
			await expect(target).toHaveCount(0);
			await expect(column(page, "Context").locator('[data-board-agent-session-drop-zone="issue"]')).toHaveCount(8);
			const probe = await page.evaluate(() => (window as unknown as {
				jiraRemovalProbe: {
					baseline: { height: number; top: number; cardTop: number };
					samples: { height: number; opacity: number; scale: number; top: number; inert: boolean; removing: boolean }[];
				};
			}).jiraRemovalProbe);
			if (reducedMotion === "no-preference") {
				const closing = probe.samples.filter(sample => sample.removing && sample.height > 1 && sample.height < probe.baseline.height - 1);
				expect(closing.length).toBeGreaterThan(1);
				expect(closing.every(sample => sample.inert)).toBe(true);
				expect(closing.some(sample => sample.opacity < 1 && sample.scale < 1)).toBe(true);
				expect(closing.some(sample => sample.top < probe.baseline.top - 1)).toBe(true);
			} else {
				expect(probe.samples.some(sample => sample.removing && sample.height > 1 && sample.height < probe.baseline.height - 1)).toBe(false);
			}
			await expect(page.getByRole("menu")).toHaveCount(0);
			await expect(issue(page, "TEU-101")).toBeVisible();
			await expect.poll(() => issue(page, "TEU-101").evaluate(node => node.getBoundingClientRect().top)).toBeCloseTo(probe.baseline.cardTop, 0);
			await page.screenshot({ path: `output/agent-browser/jira-removal/${action.toLowerCase()}-${reducedMotion}.png` });
		});
	}
}

for (const width of [1440, 1920, 1024]) {
	test(`24 keynote stories show their artwork and app logos at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1080 });
		await openBoard(page);
		await expect(page.locator("[data-jira-kanban-column]")).toHaveCount(4);
		for (const section of storySections) {
			const cards = column(page, section.title).locator('[data-board-agent-session-drop-zone="issue"]');
			await expect(cards).toHaveCount(section.stories.length);
			await expect(cards.locator('[data-jira-issue-activation-control]')).toHaveText(section.stories);
		}
		await expect(column(page, "Done").locator("[data-issue-key]")).toHaveCount(0);
		for (const [index, title] of issueTitles.entries()) {
			const card = issue(page, issueCodes[index]);
			await card.scrollIntoViewIfNeeded();
			await expect(card.getByText(title, { exact: true }).last()).toBeVisible();
			const cover = card.locator('[data-slot="jira-issue-cover"]');
			const artwork = cover.locator('img[src^="/illustration/jira-team-eu26-end/"]');
			await expect(artwork).toBeVisible();
			await expect(artwork).toHaveCSS("object-fit", "cover");
			await expect.poll(() => artwork.evaluate(node => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0)).toBe(true);
			await expect(cover.locator('[data-slot="jira-issue-cover-heading"]')).toHaveCount(0);
			await expect(cover.locator('[data-slot="jira-issue-cover-pattern"]')).toHaveCount(0);
			const apps = cover.locator('[data-slot="jira-issue-cover-apps"]');
			await expect(apps).toHaveCount(coverApps[index].length ? 1 : 0);
			for (const name of coverApps[index]) {
				await expect(apps.getByRole("img", { name, exact: true }).first()).toBeVisible();
			}
			const geometry = await cover.evaluate(node => {
				const bounds = node.getBoundingClientRect();
				const card = node.closest("article,button")!.getBoundingClientRect();
				const apps = node.querySelector('[data-slot="jira-issue-cover-apps"]')?.getBoundingClientRect();
				return { height: bounds.height, leftGap: bounds.left - card.left, rightGap: card.right - bounds.right, topGap: bounds.top - card.top,
					appLeft: apps ? apps.left - bounds.left : null, appTop: apps ? apps.top - bounds.top : null, appHeight: apps?.height };
			});
			expect(geometry.height).toBe(140);
			expect(geometry.leftGap).toBe(0);
			expect(geometry.rightGap).toBe(0);
			expect(geometry.topGap).toBe(0);
			if (coverApps[index].length) {
				expect(geometry.appLeft).toBe(16);
				expect(geometry.appTop).toBe(16);
				expect(geometry.appHeight).toBe(20);
			}
		}
	});
}

for (const width of [1440, 1920]) {
	test(`third-row human avatars fit without scrolling at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await openBoard(page);
		for (const [section, code] of [["Context", "TEU-101"], ["Collaboration", "TEU-106"], ["Confidence", "TEU-11"]]) {
			const viewport = page.getByRole("region", { name: `${section} work items`, exact: true });
			const avatar = issue(page, code).locator('[data-slot="avatar"]').first();
			await expect(avatar).toBeInViewport({ ratio: 1 });
			const avatarBounds = await avatar.boundingBox();
			const viewportBounds = await viewport.boundingBox();
			expect(avatarBounds!.y).toBeGreaterThanOrEqual(viewportBounds!.y);
			expect(avatarBounds!.y + avatarBounds!.height).toBeLessThanOrEqual(viewportBounds!.y + viewportBounds!.height);
			expect(await viewport.evaluate((node) => node.scrollTop)).toBe(0);
		}
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

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`covers reveal the whole selection inset without shifting content (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
		const card = issue(page, "TEU-1");
		const cover = card.locator('[data-slot="jira-issue-cover"]');
		const article = card.locator("article");
		const geometry = async () => cover.evaluate((node) => {
			const bounds = node.getBoundingClientRect();
			const cardBounds = node.closest("article")!.getBoundingClientRect();
			const artwork = node.querySelector("img")!.getBoundingClientRect();
			return { width: bounds.width, height: bounds.height, leftGap: bounds.left - cardBounds.left, rightGap: cardBounds.right - bounds.right, topGap: bounds.top - cardBounds.top, artworkX: artwork.x - cardBounds.x, artworkY: artwork.y - cardBounds.y };
		});
		const idle = await geometry();
		expect(idle.leftGap).toBe(0);
		expect(idle.rightGap).toBe(0);
		expect(idle.topGap).toBe(0);

		await cover.click({ modifiers: ["Shift"] });
		await expect(article).toHaveAttribute("data-selected", "true");
		await expect(cover).toHaveCSS("clip-path", "inset(4px 4px 0px round 7px 7px 0px 0px)");
		expect(await geometry()).toEqual(idle);
		await issue(page, "TEU-2").locator('[data-slot="jira-issue-cover"]').click({ modifiers: ["Shift"] });
		await expect(issue(page, "TEU-2").locator('[data-slot="jira-issue-cover"]')).toHaveCSS("clip-path", /^inset\(0px 4px(?: 0px)? round 7px 7px 0px 0px\)$/u);
		await page.screenshot({ path: `output/agent-browser/cover-selection/joined-${reducedMotion}.png` });
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
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitemcheckbox", { name: "Move visual", exact: true }).click();
		await page.keyboard.press("Escape");
		await cover.click({ modifiers: ["Shift"] });
		await expect(article).toHaveAttribute("data-selected", "true");
		await expect(cover).toHaveCSS("clip-path", "inset(1px 1px 0px round 7px 7px 0px 0px)");
	});
}

test("MCB views the board with four presenter filters and no faces in column headers", async ({ page }) => {
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
	await expect(page.getByRole("heading", { name: "Team ’26 EU keynote", exact: true })).toBeVisible();
	await expect(page.locator('[data-current-user-id="mike"] img')).toHaveAttribute("src", "/avatar-user/mike.png");
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
	for (const [code, presenter] of [["TEU-1", "mike"], ["TEU-2", "mike"], ["TEU-3", "tamar"], ["TEU-4", "tamar"]]) {
		await expect(issue(page, code).locator(`img[src="/avatar-user/${presenter}.png"]`)).toHaveCount(1);
	}
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const width of [1440, 1024]) {
		test(`drag previews keep the full card size and hide actions (${width}, ${reducedMotion})`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
			const codes = ["TEU-1", "TEU-2", "TEU-3"];
			const resting = await Promise.all(codes.map(code => issue(page, code).locator('[data-slot="jira-issue-card"]').evaluate(node => {
				const { width, height } = node.getBoundingClientRect();
				return { width, height };
			})));
			const traveller = page.locator('[data-issue-cohort-preview]');
			async function checkPreview(code: string, count: number) {
				await startDrag(page, code);
				await expect(traveller).toHaveAttribute("data-issue-cohort-count", String(count));
				const front = traveller.locator('[data-issue-cohort-front]');
				const size = await front.evaluate(node => {
					const { width, height } = node.getBoundingClientRect();
					return { width, height };
				});
				expect(size).toEqual(resting[codes.indexOf(code)]);
				await expect(front.locator('[data-jira-issue-selection-control], [aria-label^="More actions for "]')).toHaveCount(0);
				await expect(front.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCount(0);
				const surface = await front.locator('[data-slot="jira-issue-surface"]').boundingBox();
				expect(surface?.width).toBeCloseTo(size.width, 1);
				expect(surface?.height).toBeCloseTo(size.height, 1);
				await expect(front.locator('[data-slot="jira-issue-cover"]')).toHaveCSS("clip-path", "inset(0px round 8px 8px 0px 0px)");
				await page.screenshot({ path: `output/agent-browser/issue-drag-preview/${width}-${reducedMotion}-${count}-${code}.png` });
				await page.keyboard.press("Escape");
				await page.mouse.up();
				await expect(traveller).toHaveCount(0);
			}
			await checkPreview("TEU-1", 1);
			for (const code of codes) await issue(page, code).locator("[draggable]").first().click({ modifiers: ["Meta"] });
			// Exercise first, middle and last members of the fused selection.
			for (const code of codes) {
				await expect(issue(page, code).getByRole("checkbox", { name: `Select ${code}`, exact: true })).toBeChecked();
				await checkPreview(code, 3);
				await expect(issue(page, code).getByRole("checkbox", { name: `Select ${code}`, exact: true })).toBeChecked();
			}
		});
	}
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`single-card Done drops celebrate small and completing the board celebrates big (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.addInitScript(() => {
			const sizes: string[] = [];
			Object.assign(window, { doneCelebrationSizes: sizes });
			new MutationObserver((records) => {
				for (const record of records) {
					const layer = record.target;
					if (layer instanceof HTMLElement && layer.dataset.finaleConfetti === "playing" && record.oldValue !== "playing") {
						sizes.push(layer.dataset.finaleConfettiSize ?? "");
					}
				}
			}).observe(document, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["data-finale-confetti"] });
		});
		await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
		const sizes = () => page.evaluate(() => (window as typeof window & { doneCelebrationSizes: string[] }).doneCelebrationSizes);
		for (const [index, code] of ["TEU-1", "TEU-2"].entries()) {
			await startDrag(page, code);
			await dropIntoDone(page);
			await expect(issue(page, code)).toHaveAttribute("data-board-column-title", "Done");
			await expect.poll(sizes).toEqual(reducedMotion === "reduce" ? [] : Array(index + 1).fill("small"));
			await expect(page.locator('[data-jira-team-eu26-end-finale]')).toHaveCount(0);
			if (reducedMotion === "no-preference") {
				const layer = page.locator('[data-finale-confetti]');
				await expect(layer).toHaveAttribute("aria-hidden", "true");
				await expect(layer).toHaveJSProperty("inert", true);
				await expect(layer).toHaveCSS("pointer-events", "none");
				await expect(layer).toHaveAttribute("data-finale-confetti", "idle", { timeout: 10000 });
			}
		}
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitem", { name: "Play closing", exact: true }).click();
		await expect.poll(sizes, { timeout: 15000 }).toEqual(reducedMotion === "reduce" ? [] : ["small", "small", "large"]);
		await expect(page.locator('[data-jira-team-eu26-end-finale]')).toBeVisible({ timeout: 20000 });
		await expect(column(page, "Done").locator("[data-issue-key]")).toHaveCount(24);
	});
}

test("existing single-card and selected-cohort drag moves work items into Done", async ({ page }) => {
	await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
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
		expect(coverHeight).toBeLessThanOrEqual(140);
	}
	await expect(column(page, "Done").locator("[data-issue-key]")).toHaveCount(3);
	await expect(column(page, "Context").locator("[data-issue-key]")).toHaveCount(6);
	await expect(column(page, "Collaboration").locator("[data-issue-key]")).toHaveCount(6);
	await expect(column(page, "Confidence").locator("[data-issue-key]")).toHaveCount(10);
	await page.setViewportSize({ width: 1440, height: 720 });
	const doneViewport = page.getByRole("region", { name: "Done work items", exact: true });
	await expect.poll(() => doneViewport.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(1);
	await doneViewport.hover();
	await page.screenshot({ path: "output/agent-browser/done-scrollbar/done-hover.png" });
	await expect(column(page, "Done").locator('[data-slot="scroll-area-scrollbar"]')).toHaveCSS("opacity", "1");
	await expect(doneViewport).toHaveCSS("scrollbar-width", "none");
	await page.mouse.wheel(0, 150);
	await expect.poll(() => doneViewport.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
	await expect(column(page, "Confidence").locator('[data-slot="scroll-area-scrollbar"]')).toHaveCount(1);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const codes of [["TEU-1"], ["TEU-1", "TEU-2"], ["TEU-2", "TEU-5"]]) {
		test(`toolbar Delete reverses selected cards ${codes.join(", ")} with motion=${reducedMotion}`, async ({ page }) => {
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
			for (const code of codes) {
				await issue(page, code).locator("[draggable]").first().click({ modifiers: ["Meta"] });
			}
			const toolbar = page.locator('[data-slot="jira-toolbar"]');
			await expect(toolbar).toContainText(`${codes.length}`);
			await toolbar.getByRole("button", { name: "More actions", exact: true }).click();
			const deleteItem = page.getByRole("menuitem", { name: "Delete", exact: true });
			await expect(deleteItem).toBeEnabled();
			await page.evaluate((codes) => {
				const cards = codes.map(code => {
					const node = document.querySelector(`[data-board-agent-session-drop-zone="issue"][data-issue-key="${code}"]`)!;
					const slot = node.querySelector('[data-slot="jira-creating-slot"]')!;
					const face = node.querySelector('[data-slot="jira-creating-card"]')!;
					return { code, node, slot, face, height: slot.getBoundingClientRect().height };
				});
				const samples: { code: string; height: number; baseline: number; opacity: number; scale: number; removing: boolean; inert: boolean }[] = [];
				Object.assign(window, { jiraToolbarRemovalSamples: samples });
				function sample() {
					for (const card of cards) {
						if (!card.node.isConnected) continue;
						const style = getComputedStyle(card.face);
						samples.push({ code: card.code, height: card.slot.getBoundingClientRect().height, baseline: card.height,
							opacity: Number(style.opacity), scale: style.transform === "none" ? 1 : new DOMMatrixReadOnly(style.transform).a,
							removing: card.slot.hasAttribute("data-jira-creating-removing"), inert: Boolean(card.node.closest("[inert]")) });
					}
					if (cards.some(card => card.node.isConnected)) requestAnimationFrame(sample);
				}
				requestAnimationFrame(sample);
			}, codes);
			await deleteItem.click();
			for (const code of codes) await expect(issue(page, code)).toHaveCount(0);
			await expect(toolbar).toHaveCount(0);
			await expect(page.getByRole("menu")).toHaveCount(0);
			const samples = await page.evaluate(() => (window as unknown as {
				jiraToolbarRemovalSamples: { code: string; height: number; baseline: number; opacity: number; scale: number; removing: boolean; inert: boolean }[];
			}).jiraToolbarRemovalSamples);
			for (const code of codes) {
				const closing = samples.filter(sample => sample.code === code && sample.removing && sample.height > 1 && sample.height < sample.baseline - 1);
				if (reducedMotion === "no-preference") {
					expect(closing.length).toBeGreaterThan(1);
					expect(closing.every(sample => sample.inert)).toBe(true);
					expect(closing.some(sample => sample.opacity < 1 && sample.scale < 1)).toBe(true);
				} else expect(closing).toHaveLength(0);
			}
			const allCodes = issueCodes;
			for (const code of allCodes.filter(code => !codes.includes(code))) await expect(issue(page, code)).toHaveCount(1);
			await page.screenshot({ path: `output/agent-browser/jira-removal/toolbar-${codes.join("-")}-${reducedMotion}.png` });
		});
	}
}

interface RemovalReflowSample {
	time: number;
	height: number;
	siblingTop: number;
	footerTop: number;
	scrollTop: number;
}

const removalReflowScenarios = [
	{ action: "Delete", selected: [], removed: ["TEU-1"] },
	{ action: "Archive", selected: [], removed: ["TEU-1"] },
	{ action: "toolbar Delete", selected: ["TEU-1", "TEU-2"], removed: ["TEU-1", "TEU-2"] },
	{ action: "toolbar Delete", selected: ["TEU-4"], removed: ["TEU-4"] },
	{ action: "toolbar Delete", selected: ["TEU-1", "TEU-2", "TEU-3", "TEU-4"], removed: ["TEU-1", "TEU-2", "TEU-3", "TEU-4"] },
];

for (const height of [900, 1200]) {
	for (const scenario of removalReflowScenarios) {
		test(`${scenario.action} ${scenario.removed.join(", ")} settles without a second reflow bounce at ${height}px`, async ({ page }) => {
			await page.setViewportSize({ width: 1440, height });
			await page.goto(`${origin}/jira-team-eu26-end`, { waitUntil: "networkidle" });
			for (const code of scenario.selected) await issue(page, code).locator("[draggable]").first().click({ modifiers: ["Meta"] });
			if (scenario.action === "toolbar Delete") {
				await page.locator('[data-slot="jira-toolbar"]').getByRole("button", { name: "More actions", exact: true }).click();
			} else {
				const trigger = issue(page, "TEU-1").getByRole("button", { name: "More actions for TEU-1", exact: true });
				await trigger.focus();
				await trigger.press("Enter");
			}
			const menuItem = page.getByRole("menuitem", { name: scenario.action === "Archive" ? "Archive" : "Delete", exact: true });
			await menuItem.evaluate((_, removedCodes) => {
				const column = document.querySelector('[data-jira-kanban-column="Context"]')!;
				const content = column.querySelector('[data-jira-kanban-column-content]')!;
				const list = column.querySelector<HTMLElement>('[data-jira-kanban-card-list]')!;
				const sibling = Array.from(column.querySelectorAll<HTMLElement>('[data-board-agent-session-drop-zone="issue"]'))
					.find(card => !removedCodes.includes(card.dataset.issueKey!)) ?? column.querySelector('[data-slot="board-column-header"]')!;
				const footer = column.querySelector('[data-board-column-create-action]')!;
				const start = performance.now();
				const samples: RemovalReflowSample[] = [];
				const done = new Promise(resolve => {
					function sample() {
						// Removing the final scrolled card legitimately clamps scrollTop.
						// Measure layout independently from that native scroll adjustment.
						samples.push({ time: performance.now() - start, height: content.getBoundingClientRect().height,
							siblingTop: sibling.getBoundingClientRect().top + list.scrollTop,
							footerTop: footer.getBoundingClientRect().top, scrollTop: list.scrollTop });
						if (performance.now() - start < 800) requestAnimationFrame(sample);
						else resolve(samples);
					}
					requestAnimationFrame(sample);
				});
				Object.assign(window, { jiraRemovalReflow: done });
			}, scenario.removed);
			await menuItem.click();
			const samples = await page.evaluate(() => (window as unknown as { jiraRemovalReflow: Promise<RemovalReflowSample[]> }).jiraRemovalReflow);
			await test.info().attach("removal-reflow", { body: JSON.stringify(samples), contentType: "application/json" });
			for (const metric of ["height", "siblingTop", "footerTop"] as const) {
				const rebound = Math.max(...samples.slice(1).map((sample, index) => sample[metric] - samples[index][metric]));
				expect(rebound, `${metric} rebounds after closing`).toBeLessThanOrEqual(1);
			}
			for (const code of scenario.removed) await expect(issue(page, code)).toHaveCount(0);
			await page.screenshot({ path: `output/agent-browser/jira-removal/reflow-${scenario.action.replaceAll(" ", "-")}-${scenario.removed.join("-")}-${height}.png` });
		});
	}
}
