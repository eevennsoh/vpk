import { expect, test, type Locator, type Page } from "@playwright/test";

import { withDesignVariants } from "@/tests/helpers/design-variants";
import { appUrl } from "@/tests/helpers/origin";

const JIRA_GOLDEN_JOURNEYS_V4_ROUTE = "/jira-golden-journeys-v4";

const DESIGN_VARIANTS_STORAGE_KEY = "ui-design-variants";
const AGENT_SESSION_PANEL_WIDTH_PX = 360;
const AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX = 32;

function getPanel(page: Page): Locator {
	// The panel is a <section> with an accessible name, so it exposes role
	// "region".
	return page.getByRole("region", { name: "Unlink sessions panel" });
}

/** The absolutely positioned rail host that owns `width` / `top`. */
function getPanelHost(page: Page): Locator {
	return getPanel(page).locator("..");
}

/** The untracked-work column itself, wherever it currently lives. */
function getAgentSessionColumn(page: Page): Locator {
	return page.locator("[data-agent-session-column]");
}

async function openBoard(page: Page, options?: { panelVariant?: boolean }): Promise<void> {
	// A `?variants=` override is deterministic and keeps the overlay tests
	// independent of the settings dropdown; one test below opens the board
	// without it and drives the real menu to prove the toggle is wired.
	const route = options?.panelVariant === undefined
		? JIRA_GOLDEN_JOURNEYS_V4_ROUTE
		: withDesignVariants(JIRA_GOLDEN_JOURNEYS_V4_ROUTE, { panel: options.panelVariant });
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(appUrl(route), { waitUntil: "domcontentloaded" });
	await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({
		timeout: 30_000,
	});
}

/** The panel mounts minimised; open it to its full 360px. */
async function expandPanel(page: Page): Promise<void> {
	await page.getByRole("button", { name: "Expand Unlink sessions column" }).click();
	await expect.poll(async () => (await getPanelHost(page).boundingBox())?.width)
		.toBe(AGENT_SESSION_PANEL_WIDTH_PX);
}

interface HorizontalSpan {
	left: number;
	right: number;
}

async function readSpan(locator: Locator): Promise<HorizontalSpan> {
	const box = await locator.boundingBox();
	expect(box).not.toBeNull();
	if (!box) throw new Error("element is not laid out");
	return { left: box.x, right: box.x + box.width };
}

test("the panel floats over the board instead of taking a column of its own", async ({ page }) => {
	await openBoard(page, { panelVariant: true });
	const panel = getPanel(page);
	await expect(panel).toBeVisible();
	await expandPanel(page);

	const panelSpan = await readSpan(panel);
	const scrollportSpan = await readSpan(page.locator("[data-jira-kanban-scrollport]"));

	// The panel is pinned to the trailing edge, so the board's scrollport starts
	// well before it and runs to at least its trailing edge: the board owns the
	// full region width and the panel is layered on top of it.
	expect(scrollportSpan.left).toBeLessThan(panelSpan.left);
	expect(scrollportSpan.right).toBeGreaterThanOrEqual(panelSpan.right);

	// The decisive claim: real board content occupies the panel's x-range. An
	// in-flow column would have left the panel's strip empty.
	const columnUnderPanel = await page
		.locator("[data-jira-kanban-card-list]")
		.evaluateAll((nodes, panelLeft) => nodes.some((node) => {
			const rect = node.getBoundingClientRect();
			return rect.right > panelLeft;
		}), panelSpan.left);
	expect(columnUnderPanel).toBe(true);

	// And the overlap is the panel painting over the card list, not the other
	// way round — hit-testing inside the panel resolves to the panel.
	const panelOwnsItsPixels = await panel.evaluate((node) => {
		const rect = node.getBoundingClientRect();
		const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
		return hit !== null && node.contains(hit);
	});
	expect(panelOwnsItsPixels).toBe(true);
});

test("the panel docks from the tab strip down, flush to the page bottom", async ({ page }) => {
	await openBoard(page, { panelVariant: true });
	await expandPanel(page);

	const tabStrip = page.locator("header [role=tablist]").first();
	const tabsBox = await tabStrip.boundingBox();
	expect(tabsBox).not.toBeNull();
	if (!tabsBox) throw new Error("tab strip is not laid out");
	const tabsBottom = tabsBox.y + tabsBox.height;

	const host = getPanelHost(page);
	const hostBox = await host.boundingBox();
	expect(hostBox).not.toBeNull();
	if (!hostBox) throw new Error("panel host is not laid out");

	// The panel takes a real `top` offset, so its top edge must land exactly on
	// the underside of the tab strip's rule — not the control row. Pinning at
	// the search row left an `mt-6` hole under the tabs. Tolerance is zero:
	// at 83 the panel starts on the rule's own 1px row and punches a hole.
	expect(hostBox.y).toBe(tabsBottom);
	expect(hostBox.width).toBe(AGENT_SESSION_PANEL_WIDTH_PX);

	// Flush to the page bottom: no rounded-card inset, no FAB clearance.
	const viewport = page.viewportSize();
	expect(viewport).not.toBeNull();
	expect(hostBox.y + hostBox.height).toBe(viewport!.height);
	await expect(host).toHaveCSS("border-bottom-right-radius", "0px");
	await expect(host).toHaveCSS("bottom", "0px");

	const headerBox = await page.locator("[data-slot=panel-header]").boundingBox();
	expect(headerBox).not.toBeNull();
	expect(headerBox!.y).toBe(tabsBottom);
	await expect(page.locator("[data-slot=panel-header]")).toHaveClass(/py-4/);
	await expect(page.locator("[data-slot=panel-header]")).not.toHaveClass(/pt-6/);
	await expect(page.getByRole("button", { name: "Collapse panel" })).toBeVisible();
});

test("the tab strip's rule runs unbroken beneath the docked rail", async ({ page }) => {
	await openBoard(page, { panelVariant: true });

	const tabStrip = page.locator("header [role=tablist]").first();
	const tabsBox = await tabStrip.boundingBox();
	expect(tabsBox).not.toBeNull();
	if (!tabsBox) throw new Error("tab strip is not laid out");

	// Sample the rule's own row across the full width, including the band the
	// rail occupies. Nothing may paint over it: `elementFromPoint` returning a
	// node inside the panel means the rule is occluded there — the "hole".
	const ruleY = Math.round(tabsBox.y + tabsBox.height) - 1;
	const samples = await page.evaluate(
		({ y, right }) => {
			const xs = [10, Math.round(right / 2), right - 40, right - 16, right - 2];
			return xs.map((x) => {
				const el = document.elementFromPoint(x, y);
				return { x, occludedByPanel: Boolean(el?.closest("[data-slot=panel-container]")) };
			});
		},
		{ y: ruleY, right: Math.round(tabsBox.x + tabsBox.width) },
	);

	expect(samples.filter((sample) => sample.occludedByPanel)).toEqual([]);
});

test("the docked rail is persistent — nothing can dismiss it", async ({ page }) => {
	await openBoard(page, { panelVariant: true });
	const panel = getPanel(page);
	await expect(panel).toBeVisible();

	// The rail IS the entry point, so the board header must not carry a
	// show/hide control — a closed state would be unreachable.
	await expect(page.getByRole("button", { name: /unlink sessions panel/i })).toHaveCount(0);

	// Collapsed: still mounted, still hosting the column.
	await expect(panel.locator("[data-agent-session-column]")).toHaveCount(1);

	// Expanded: the header offers collapse and no close.
	await expandPanel(page);
	await expect(page.getByRole("button", { name: "Collapse panel" })).toBeVisible();
	await expect(page.getByRole("button", { name: /close/i })).toHaveCount(0);
	await expect(panel).toBeVisible();
});

test("collapse shrinks the panel to the rail and the rail expands it back", async ({ page }) => {
	await openBoard(page, { panelVariant: true });
	const panel = getPanel(page);
	const panelHost = panel.locator("..");
	const expandButton = page.getByRole("button", { name: "Expand Unlink sessions column" });
	const [hostBox, expandButtonBox] = await Promise.all([
		panelHost.boundingBox(),
		expandButton.boundingBox(),
	]);
	expect(hostBox).not.toBeNull();
	expect(expandButtonBox).not.toBeNull();
	if (!hostBox || !expandButtonBox) throw new Error("collapsed rail is not laid out");
	const topInset = expandButtonBox.y - hostBox.y;
	const leftInset = expandButtonBox.x - hostBox.x;
	const rightInset = hostBox.x + hostBox.width - expandButtonBox.x - expandButtonBox.width;
	expect(topInset).toBe(leftInset);
	expect(topInset).toBe(rightInset);
	await expect(panelHost).toHaveCSS("border-left-width", "0px");

	await expandPanel(page);
	await expect(panelHost).toHaveCSS("border-left-width", "1px");
	await expect(page.getByRole("button", { name: "Collapse panel" })).toBeVisible();

	await page.getByRole("button", { name: "Collapse panel" }).click();
	await expect.poll(async () => (await panel.boundingBox())?.width)
		.toBe(AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX);
	// At 32px the panel drops its own header — the rail carries the only
	// expand control, so a second header would be chrome on chrome.
	await expect(page.getByRole("button", { name: "Collapse panel" })).toHaveCount(0);
	await expect(panel.locator("[data-agent-session-column][data-collapsed]")).toHaveCount(1);

	await expandPanel(page);
	await expect(page.getByRole("button", { name: "Collapse panel" })).toBeVisible();
	await expect(panel.locator("[data-agent-session-column][data-collapsed]")).toHaveCount(0);
});

test("the panel survives the switch to the List view", async ({ page }) => {
	await openBoard(page, { panelVariant: true });
	const panel = getPanel(page);
	await expandPanel(page);

	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByTestId("jira-list")).toBeVisible();

	// Same overlay, same width, still hosting the column: one panel serves both
	// views because both render into the same content region.
	await expect(panel).toBeVisible();
	await expect(panel.locator("[data-agent-session-column]")).toHaveCount(1);
	const panelSpan = await readSpan(getPanelHost(page));
	expect(panelSpan.right - panelSpan.left).toBe(AGENT_SESSION_PANEL_WIDTH_PX);

	// The panel is pinned to the trailing edge and the list's leading cells are
	// `sticky left-0`, so nothing sticky sits under it and the list needs no
	// inset — it scrolls underneath exactly like the board does.
	const listSpan = await readSpan(page.getByTestId("jira-list"));
	expect(listSpan.left).toBeLessThan(panelSpan.left);
	expect(listSpan.right).toBeGreaterThan(panelSpan.left);

	// Collapsing narrows the panel without moving the list: there is no reserved
	// width to give back.
	await page.getByRole("button", { name: "Collapse panel" }).click();
	await expect.poll(async () => (await panel.boundingBox())?.width)
		.toBe(AGENT_SESSION_COLUMN_COLLAPSED_WIDTH_PX);
	expect((await readSpan(page.getByTestId("jira-list"))).left).toBe(listSpan.left);
});

test("with the variant off the column stays in flow and no panel renders", async ({ page }) => {
	await openBoard(page, { panelVariant: false });

	await expect(getPanel(page)).toHaveCount(0);

	// Exactly one untracked-work column, and it is a board sibling: the first
	// status column starts after it rather than underneath it.
	const column = getAgentSessionColumn(page);
	await expect(column).toHaveCount(1);
	const columnSpan = await readSpan(column);
	const firstColumnSpan = await readSpan(
		page.locator("[data-jira-kanban-card-list]").first(),
	);
	expect(firstColumnSpan.left).toBeGreaterThanOrEqual(columnSpan.right);

	const inFlowMetrics = await column.locator("ul[data-variant=large]").evaluate((list) => {
		const styles = getComputedStyle(list);
		const articles = [...list.querySelectorAll("article")];
		if (articles.length < 2) {
			return null;
		}
		const first = articles[0].getBoundingClientRect();
		const second = articles[1].getBoundingClientRect();
		return {
			articleGap: second.top - first.bottom,
			gap: Number.parseFloat(styles.rowGap || styles.gap),
			paddingLeft: Number.parseFloat(styles.paddingLeft),
		};
	});
	expect(inFlowMetrics).not.toBeNull();
	if (!inFlowMetrics) {
		return;
	}
	expect(inFlowMetrics.gap).toBe(0);
	expect(inFlowMetrics.articleGap).toBeLessThan(1);
	expect(inFlowMetrics.paddingLeft).toBe(0);
});

test("the collapsed in-flow count shares a baseline with To do", async ({ page }) => {
	await openBoard(page, { panelVariant: false });

	const sessionCount = getAgentSessionColumn(page).locator("span[aria-hidden='true']").first();
	const todoLabel = page.locator("[data-jira-kanban-column='To do']").getByText("To do", { exact: true });
	await expect(sessionCount).toBeVisible();
	await expect(todoLabel).toBeVisible();

	const [countBox, todoBox] = await Promise.all([
		sessionCount.boundingBox(),
		todoLabel.boundingBox(),
	]);
	expect(countBox).not.toBeNull();
	expect(todoBox).not.toBeNull();
	if (!countBox || !todoBox) {
		return;
	}

	// Same 24px header slot as CollapsedBoardColumn: vertical centers must
	// agree, or the extra top pad is back and `16` sits off `To do`.
	const countMid = countBox.y + countBox.height / 2;
	const todoMid = todoBox.y + todoBox.height / 2;
	expect(Math.abs(countMid - todoMid)).toBeLessThanOrEqual(2);
});

test("with the variant off the column stays in flow on the list", async ({ page }) => {
	await openBoard(page, { panelVariant: false });
	await page.getByRole("tab", { name: "List", exact: true }).click();
	await expect(page.getByTestId("jira-list")).toBeVisible();

	await expect(getPanel(page)).toHaveCount(0);
	const column = getAgentSessionColumn(page);
	await expect(column).toHaveCount(1);
	await expect(column).toBeVisible();

	const columnSpan = await readSpan(column);
	const listSpan = await readSpan(page.getByTestId("jira-list"));
	expect(listSpan.left).toBeGreaterThanOrEqual(columnSpan.right);
});

test("the settings menu toggles the Panel variant on the live board", async ({ page }) => {
	await openBoard(page);
	await expect(getPanel(page)).toHaveCount(0);
	const column = getAgentSessionColumn(page);
	await expect(column).toHaveCount(1);
	const inFlowColumnSpan = await readSpan(column);

	await page.getByRole("button", { name: "Settings" }).click();
	const panelVariantItem = page.getByRole("menuitemcheckbox", { name: "Panel" });
	await expect(panelVariantItem).not.toBeChecked();
	await panelVariantItem.click();

	const panel = getPanel(page);
	await expect(panel).toBeVisible();
	const panelSpan = await readSpan(panel);
	// Turning the variant on lifts the column from the board's leading edge
	// into the trailing overlay. The presentations never coexist.
	await expect(getAgentSessionColumn(page)).toHaveCount(1);
	expect(panelSpan.left).toBeGreaterThan(inFlowColumnSpan.left);

	// The choice is persisted under the shared storage key.
	expect(
		await page.evaluate(
			(key) => window.localStorage.getItem(key),
			DESIGN_VARIANTS_STORAGE_KEY,
		),
	).toBe(JSON.stringify({ panel: true }));
});

const FLOATING_ROVO_BUTTON_EDGE_GAP = 24;
const FAB_INSET_TOLERANCE_PX = 8;

function getFloatingRovoButton(page: Page): Locator {
	return page.getByRole("button", { name: "Open Rovo chat" });
}

async function readFabGeometry(page: Page) {
	return page.evaluate(() => {
		const fab = document.querySelector('[aria-label="Open Rovo chat"]');
		const panel = document.querySelector('[aria-label="Unlink sessions panel"]');
		if (!(fab instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
			return null;
		}
		const fabRect = fab.getBoundingClientRect();
		return {
			cssVar: getComputedStyle(document.documentElement).getPropertyValue("--untracked-panel-width").trim(),
			distRight: window.innerWidth - (fabRect.x + fabRect.width),
			fabRight: fabRect.x + fabRect.width,
			viewportWidth: window.innerWidth,
		};
	});
}

test("an expanded untracked panel insets the floating Rovo button off the session rows", async ({ page }) => {
	await openBoard(page, { panelVariant: true });
	await expandPanel(page);

	const fab = getFloatingRovoButton(page);
	await expect(fab).toBeVisible();

	const geometry = await readFabGeometry(page);
	expect(geometry).not.toBeNull();
	if (!geometry) {
		return;
	}

	expect(geometry.cssVar).toBe(`${AGENT_SESSION_PANEL_WIDTH_PX}px`);
	expect(geometry.fabRight).toBeLessThanOrEqual(
		geometry.viewportWidth - AGENT_SESSION_PANEL_WIDTH_PX + 1,
	);
	expect(Math.abs(geometry.distRight - (AGENT_SESSION_PANEL_WIDTH_PX + FLOATING_ROVO_BUTTON_EDGE_GAP)))
		.toBeLessThanOrEqual(FAB_INSET_TOLERANCE_PX);
});

test("panel session rows use a 4px gutter on both axes", async ({ page }) => {
	await openBoard(page, { panelVariant: true });
	await expandPanel(page);

	const metrics = await getPanel(page).locator("ul[data-variant=large]").evaluate((list) => {
		const styles = getComputedStyle(list);
		const articles = [...list.querySelectorAll("article")];
		if (articles.length < 2) {
			return null;
		}
		const first = articles[0].getBoundingClientRect();
		const second = articles[1].getBoundingClientRect();
		return {
			articleGap: second.top - first.bottom,
			gap: Number.parseFloat(styles.rowGap || styles.gap),
			paddingLeft: Number.parseFloat(styles.paddingLeft),
			paddingRight: Number.parseFloat(styles.paddingRight),
		};
	});

	expect(metrics).not.toBeNull();
	if (!metrics) {
		return;
	}

	expect(metrics.paddingLeft).toBe(4);
	expect(metrics.paddingRight).toBe(4);
	expect(metrics.gap).toBe(4);
	expect(Math.abs(metrics.articleGap - 4)).toBeLessThan(0.5);
});

test("a collapsed untracked rail keeps the FAB in the original corner", async ({ page }) => {
	await openBoard(page, { panelVariant: true });

	const fab = getFloatingRovoButton(page);
	await expect(fab).toBeVisible();

	const geometry = await readFabGeometry(page);
	expect(geometry).not.toBeNull();
	if (!geometry) {
		return;
	}

	// First paint is collapsed (`defaultAgentSessionColumnCollapsed`). Extra
	// inset is 0 — not the 32px rail and never the 360px expanded hole.
	expect(geometry.cssVar === "0px" || geometry.cssVar === "").toBe(true);
	expect(geometry.distRight).toBeLessThan(AGENT_SESSION_PANEL_WIDTH_PX);
	expect(Math.abs(geometry.distRight - FLOATING_ROVO_BUTTON_EDGE_GAP))
		.toBeLessThanOrEqual(FAB_INSET_TOLERANCE_PX);
});
