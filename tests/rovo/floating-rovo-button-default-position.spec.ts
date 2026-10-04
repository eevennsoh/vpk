import { expect, test, type Locator, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const STUDIO_URL = appUrl("/studio");

// The floating button parks itself `FLOATING_ROVO_BUTTON_EDGE_GAP` (24px) from
// each edge when it lives in the bottom-right corner. Allow a small tolerance
// for sub-pixel layout and the snap spring settling.
const EDGE_GAP = 24;
const TOLERANCE = 6;

// Opens a built-in agent so the studio config panel (which renders the
// no-placement <FloatingRovoButton product="home" />) mounts.
async function openAgentConfig(page: Page) {
	await page.goto(STUDIO_URL, { waitUntil: "networkidle" });

	const sidebarNav = page.getByRole("navigation", { name: /studio/i });
	await sidebarNav.getByRole("button", { name: "RFP Drafter" }).first().click();
}

function floatingRovoButtonSurface(page: Page): Locator {
	// The draggable surface is the wrapper carrying the grab cursor; the inner
	// trigger exposes the "Open Rovo chat" label.
	return page.locator('[class*="cursor-grab"]').filter({
		has: page.getByRole("button", { name: "Open Rovo chat" }),
	});
}

async function expectAnchoredBottomRight(page: Page, surface: Locator) {
	const box = await surface.boundingBox();
	const viewport = page.viewportSize();

	expect(box, "floating Rovo button should be rendered").not.toBeNull();
	expect(viewport, "viewport size should be available").not.toBeNull();

	if (!box || !viewport) {
		return;
	}

	const distRight = viewport.width - (box.x + box.width);
	const distBottom = viewport.height - (box.y + box.height);

	expect(Math.abs(distRight - EDGE_GAP)).toBeLessThanOrEqual(TOLERANCE);
	expect(Math.abs(distBottom - EDGE_GAP)).toBeLessThanOrEqual(TOLERANCE);
}

test.describe("Floating Rovo button default position", () => {
	test("anchors to the bottom-right corner on load", async ({ page }) => {
		await openAgentConfig(page);

		const surface = floatingRovoButtonSurface(page);
		await expect(surface).toBeVisible();

		await expectAnchoredBottomRight(page, surface);
	});

	test("stays bottom-right across viewport resizes when never dragged", async ({ page }) => {
		await openAgentConfig(page);

		const surface = floatingRovoButtonSurface(page);
		await expect(surface).toBeVisible();
		await expectAnchoredBottomRight(page, surface);

		// Regression: resizing used to re-snap the undragged button to the nearest
		// of 16 grid cells, leaving it parked in a non-corner cell "for no reason".
		// It must always re-home to the bottom-right corner until the user drags it.
		for (const size of [
			{ width: 900, height: 640 },
			{ width: 1440, height: 900 },
			{ width: 1200, height: 800 },
		]) {
			await page.setViewportSize(size);
			await page.waitForTimeout(400);
			await expectAnchoredBottomRight(page, surface);
		}
	});
});
