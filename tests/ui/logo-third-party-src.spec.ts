import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

// BrandLogoMark (components/ui/logo-mark.tsx) resolves a brand from `name ?? getThirdPartyLogoNameFromSrc(src)`.
// The "In a Tile" example (LogoThirdPartyDemoInTile) passes only `src={thirdPartyLogoSrc(name)}`,
// a "/3p/<name>/24.svg" path, so the package mark appears there only if the src lookup works;
// without it each size falls back to an <img> of the local asset.
const ROUTE = "/components/ui/logo-third-party#in-a-tile";

test("a /3p/ src with no name draws the package brand mark, not an <img>", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl(ROUTE));
	const example = page.locator("#in-a-tile");
	// Each sample row holds one BrandLogoMark per tile size, then the brand label.
	const slackRow = example.getByText("Slack", { exact: true }).locator("..");
	await slackRow.scrollIntoViewIfNeeded();
	const marks = () => slackRow.evaluate((row) => {
		const tiles = Array.from(row.children).slice(0, -1);
		return {
			tiles: tiles.length,
			imgs: row.querySelectorAll("img").length,
			drawnSvgs: tiles.filter((tile) => {
				const svg = tile.querySelector("svg");
				const box = svg?.getBoundingClientRect();
				return box !== undefined && box.width > 0 && box.height > 0;
			}).length,
		};
	});
	await expect.poll(async () => {
		const { tiles, imgs, drawnSvgs } = await marks();
		return { imgs, everyTileDrawn: tiles > 0 && drawnSvgs === tiles };
	}, { message: "Slack /3p/ src marks draw the package svg in every tile and no <img>" }).toEqual({ imgs: 0, everyTileDrawn: true });
});
