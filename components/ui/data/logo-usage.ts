/**
 * Typed loader + resolver for logo usage metadata. The canonical source of truth
 * is `logo-usage.json` — this module just reads it and exposes typed helpers.
 *
 * The usage decisions are facts about each asset's visual:
 *
 * - 1P product logos (Jira, Confluence, …) ship a solid superellipse background,
 *   so they render bare. The Atlassian master logo has no solid background and
 *   gets a bordered tile (see `oneP.borderById`).
 * - 2P partner logos are bare `/public/2p/<vendor>.png` marks with no background,
 *   so they always need a bordered containing tile.
 * - 3P logos that ship a `/public/3p/<id>/16-borderless.svg` sibling are
 *   "white-tile" marks — the standard `<size>.svg` paints a white background and
 *   a baked 1px hairline. We render these inside a VPK-drawn bordered tile using
 *   the *borderless* variant so the two borders don't double up. Also used for
 *   tight estate (tags) or oversized logos where we build our own border.
 * - 3P logos with no borderless sibling are full-bleed, solid-fill marks (their
 *   own colored superellipse fills the tile). They need no border — same as the
 *   solid-background 1P product logos.
 * - 3P logos listed in `threeP.borderedIds` are the exception to that last rule:
 *   transparent-glyph marks (GitHub Copilot, VS Code) that paint no background
 *   of their own and ship no `16-borderless.svg` to swap to. Without an entry
 *   they fall through to the solid-fill branch and render bare — visibly
 *   inconsistent beside every bordered package mark in the same grid. They get a
 *   border with their base `src` unchanged.
 *
 * `THIRD_PARTY_BORDERLESS_LOGO_IDS` MUST stay in sync with `/public/3p` — the
 * folders that contain a `16-borderless.svg`. `logo-usage.source.test.js` reads the
 * directory and fails if the JSON drifts, so new 3P assets can't silently bypass
 * the border treatment. The same test asserts `borderedIds` stays disjoint from
 * `borderlessIds`, since `borderlessIds` is checked first.
 */
import type { AtlassianLogoName } from "./logo-data";
import logoUsage from "./logo-usage.json" with { type: "json" };

const ONE_P = logoUsage.tiers.oneP;
const TWO_P = logoUsage.tiers.twoP;
const THREE_P = logoUsage.tiers.threeP;

const ONE_P_BORDER_BY_ID: Readonly<Record<string, boolean>> = ONE_P.borderById;

/** The 3P logo ids that ship a borderless variant (mirror of `/public/3p`). */
export const THIRD_PARTY_BORDERLESS_LOGO_IDS: ReadonlySet<string> = new Set(
	THREE_P.borderlessIds,
);

/**
 * The 3P logo ids whose base asset is a bare transparent glyph: they need a
 * bordered tile but have no borderless variant to swap to.
 */
export const THIRD_PARTY_BORDERED_LOGO_IDS: ReadonlySet<string> = new Set(
	(THREE_P as { borderedIds?: readonly string[] }).borderedIds ?? [],
);

/**
 * The 3P logo ids whose glyph is monochrome near-black. They disappear against a
 * dark themed surface, so consumers that render the bare glyph (agent avatars,
 * `LogoThirdParty` with `tileBackground="surface"`) invert them in dark mode.
 *
 * Colored dark marks are deliberately excluded — inverting them would corrupt
 * the brand hue. See the `$darkGlyphIdsComment` in `logo-usage.json`.
 */
export const THIRD_PARTY_DARK_GLYPH_LOGO_IDS: ReadonlySet<string> = new Set(
	(THREE_P as { darkGlyphIds?: readonly string[] }).darkGlyphIds ?? [],
);

/**
 * The dark-mode inversion applied to a near-black glyph. Both selectors are
 * emitted because `theme-wrapper.tsx` sets the `dark` class and the
 * `data-color-mode` attribute on the same root, and surfaces rendered outside
 * the wrapper (exported HTML) may only carry the attribute. They target the same
 * element, so a single `filter: invert(1)` resolves — they do not compound.
 */
const DARK_GLYPH_INVERT = "dark:invert [[data-color-mode=dark]_&]:invert";

/**
 * Tailwind classes that keep a monochrome near-black 3P glyph legible on a dark
 * themed surface, or `undefined` when the mark already has enough contrast.
 *
 * `invert` must land on the glyph itself, never on the surface behind it —
 * inverting the wrapper would flip the backdrop too and reinstate the very
 * contrast failure this fixes.
 *
 * This is the ONLY place the treatment is decided. CSS filters on *nested*
 * elements compose, so a caller that adds its own `dark:invert` around a logo
 * component double-inverts the glyph straight back to near-black. Callers must
 * not pass their own inversion class.
 */
export function darkModeGlyphContrastClassName(id: string | undefined): string | undefined {
	return id && THIRD_PARTY_DARK_GLYPH_LOGO_IDS.has(id) ? DARK_GLYPH_INVERT : undefined;
}

/**
 * Same treatment as {@link darkModeGlyphContrastClassName}, keyed off a
 * `/3p/<id>/…` asset path for consumers that only hold a src (`CustomLogo`,
 * `BrandLogoMark`). Non-3P paths never qualify: 1P/2P art is not in the
 * near-black list and `/2p/` marks are opaque PNGs we cannot measure.
 */
export function darkModeGlyphContrastClassNameForSrc(src: string | undefined): string | undefined {
	if (!src?.startsWith("/3p/")) {
		return undefined;
	}
	return darkModeGlyphContrastClassName(src.split("/")[2]);
}

export interface BrandLogoPresentation {
	/** The src to render — swapped to the borderless variant for white-tile 3P logos. */
	src: string;
	/** Whether the logo needs a 1px bordered containing tile. */
	hasBorder: boolean;
}

/**
 * Resolves the rendered src and whether a bordered tile is needed for a 2P/3P
 * logo path. Falls back to "no border, src unchanged" for any path that is not a
 * recognized `/2p/` or `/3p/` asset.
 */
export function resolveBrandLogoPresentation(src: string): BrandLogoPresentation {
	// 2P partner marks are bare PNGs with no background — always need a border.
	if (src.startsWith("/2p/")) {
		return { src, hasBorder: TWO_P.defaultHasBorder };
	}

	if (src.startsWith("/3p/")) {
		const id = src.split("/")[2] ?? "";
		// White-tile 3P logos: use the borderless glyph inside our bordered tile.
		if (THIRD_PARTY_BORDERLESS_LOGO_IDS.has(id)) {
			return { src: `/3p/${id}/${THREE_P.borderlessVariantFile}`, hasBorder: true };
		}
		// Transparent-glyph 3P logos: bordered tile, but no variant to swap to.
		if (THIRD_PARTY_BORDERED_LOGO_IDS.has(id)) {
			return { src, hasBorder: true };
		}
		// Solid-fill 3P logos paint their own background — no border needed.
		return { src, hasBorder: THREE_P.defaultHasBorder };
	}

	return { src, hasBorder: false };
}

/** Per-id inset scale for 3P marks (glyph size = box size * scale). */
const THREE_P_INSET_SCALE_BY_ID: Readonly<Record<string, number>> =
	(THREE_P as { insetScaleById?: Record<string, number> }).insetScaleById ?? {};

/**
 * Resolves the inset scale for a 2P/3P brand asset path — the fraction of the
 * logo box the glyph should occupy. A full-bleed 3P mark can be tagged in
 * `logo-usage.json` (`threeP.insetScaleById`) to render smaller and centered
 * inside its box (e.g. VS Code at 20px inside a 24px box). Returns 1 (no inset)
 * for any path without an explicit override.
 */
export function resolveBrandLogoInsetScale(src: string): number {
	if (src.startsWith("/3p/")) {
		const id = src.split("/")[2] ?? "";
		return THREE_P_INSET_SCALE_BY_ID[id] ?? 1;
	}
	return 1;
}

/**
 * Whether a 1P Atlassian product/master logo should render inside a bordered
 * tile. Solid-background product marks render bare; the Atlassian master logo
 * (no solid background) gets a border. Driven by `logo-usage.json`.
 */
export function resolveAtlassianLogoBorder(name: AtlassianLogoName): boolean {
	return ONE_P_BORDER_BY_ID[name] ?? ONE_P.defaultHasBorder;
}

/**
 * 1P marks that ship NO solid background fill beyond those already flagged
 * bordered in `logo-usage.json`. The Rovo family marks are transparent like the
 * Atlassian master logo, so inline chips inset + center them in the 16px box
 * rather than stretching a bare glyph edge-to-edge.
 */
const BACKGROUNDLESS_ATLASSIAN_LOGO_NAMES: ReadonlySet<AtlassianLogoName> = new Set([
	"rovo",
	"rovo-dev",
	"rovo-dev-agent",
]);

/**
 * Whether a 1P logo lacks a solid background fill — true for the bordered marks
 * (per `logo-usage.json`) and the Rovo family. Such marks get the inset chip
 * treatment (a 12px glyph centered in the 16px box); solid-background product
 * marks fill the box bare. Single source of truth for the inline-chip 1P logo
 * sizing decision, shared by `AtlassianLogoMark frame="chip"` and the rich-text
 * mention/reference chips.
 */
export function isBackgroundlessAtlassianLogo(name: AtlassianLogoName): boolean {
	return resolveAtlassianLogoBorder(name) || BACKGROUNDLESS_ATLASSIAN_LOGO_NAMES.has(name);
}
