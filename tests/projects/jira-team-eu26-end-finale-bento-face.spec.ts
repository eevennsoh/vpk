import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

/*
 * The finale bento fits the real screen rather than letterboxing, so a tile's
 * stage box is the Figma's 587 × 480 only at 16:9. Agent Sessions' board
 * slice must still read as the Figma whatever the shape: the dragged session
 * on the start of its card's summary, the card pinned under the label and
 * centred on the tile.
 */
const SHAPES = [
	{ width: 1675, height: 1060 },
	{ width: 1440, height: 1080 },
	{ width: 2560, height: 1080 },
];
const TARGET = "Confirm the sandbox key retention window before replay";

test.use({ ignoreHTTPSErrors: true });

/** The tile's pieces in stage px, from the bento's rest frame. */
async function measureAgentSessions(page: Page, viewport: { width: number; height: number }) {
	await page.setViewportSize(viewport);
	// Reduced motion pins the finale to the bento's rest frame, before the mega bento mounts.
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/jira-team-eu26-end?finale=9.57&hold"), { waitUntil: "networkidle" });
	await page.getByRole("heading", { name: /EU keynote/ }).first().click();
	// The recap dialog's tile, not its off-screen twin printed under `body` while the faces print.
	const label = page.locator("dialog").getByText("Agent sessions", { exact: true });
	await expect(label).toBeVisible({ timeout: 20_000 });
	return label.evaluate((element, target) => {
		const face = element.parentElement!;
		const origin = face.getBoundingClientRect();
		const scale = origin.width / face.offsetWidth;
		const box = (text: string) => {
			const rect = [...face.querySelectorAll("p")].find((p) => p.textContent === text)!.getBoundingClientRect();
			return { x: (rect.x - origin.x) / scale, y: (rect.y - origin.y) / scale };
		};
		const label = box("Agent sessions");
		const card = box(target);
		const chip = box("Jordan Okafor");
		return {
			stage: { width: face.offsetWidth, height: face.offsetHeight },
			card,
			chipOnCard: { x: chip.x - card.x, y: chip.y - card.y },
			cardUnderLabel: card.y - label.y,
			cardFromCentre: card.x - face.offsetWidth / 2,
		};
	}, TARGET);
}

test("the Agent Sessions bento tile keeps the Figma composition at every screen shape", async ({ page }) => {
	test.setTimeout(180_000);
	const figma = await measureAgentSessions(page, { width: 1920, height: 1080 });
	expect(figma.stage).toEqual({ width: 587, height: 480 });
	// Figma: the target card's summary sits at (106.675, 153.675) in the 587 × 480 frame.
	expect(figma.card.x).toBeCloseTo(106.675, 0);
	expect(figma.card.y).toBeCloseTo(153.675, 0);

	for (const shape of SHAPES) {
		const tile = await measureAgentSessions(page, shape);
		const where = `${shape.width}x${shape.height} (stage ${tile.stage.width}x${tile.stage.height})`;
		expect(tile.stage, where).not.toEqual(figma.stage);
		expect(Math.abs(tile.chipOnCard.x - figma.chipOnCard.x), `${where}: session stays on its card`).toBeLessThan(0.5);
		expect(Math.abs(tile.chipOnCard.y - figma.chipOnCard.y), `${where}: session stays on its card`).toBeLessThan(0.5);
		expect(Math.abs(tile.cardUnderLabel - figma.cardUnderLabel), `${where}: card stays under the label`).toBeLessThan(0.5);
		expect(Math.abs(tile.cardFromCentre - figma.cardFromCentre), `${where}: card stays centred`).toBeLessThan(0.5);
	}
});
