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

// Polls until the button has settled (the snap spring runs after a resize) and sits in the corner.
async function expectAnchoredBottomRight(page: Page, surface: Locator) {
	await expect.poll(async () => {
		const box = await surface.boundingBox();
		const viewport = page.viewportSize();
		if (!box || !viewport) return Infinity;
		const distRight = viewport.width - (box.x + box.width);
		const distBottom = viewport.height - (box.y + box.height);
		return Math.max(Math.abs(distRight - EDGE_GAP), Math.abs(distBottom - EDGE_GAP));
	}, { message: "floating Rovo button anchored to the bottom-right corner" }).toBeLessThanOrEqual(TOLERANCE);
}

test.describe("Floating Rovo button default position", { tag: "@smoke" }, () => {
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
			await expectAnchoredBottomRight(page, surface);
		}
	});
});
