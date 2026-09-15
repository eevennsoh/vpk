/**
 * The card-glow surface contract: the custom properties a glow surface
 * declares, and the helpers that build them.
 *
 * Separate from `card-glow.tsx` so that file exports only its component —
 * mixing constants and helpers into a component module defeats Fast Refresh's
 * ability to preserve state (`react-doctor/only-export-components`).
 */

import type { CSSProperties } from "react";

export type CardGlowCSSProperties = CSSProperties & Record<`--card-glow-${string}`, string | number>;

/**
 * How far the bloom travels from centre at full pointer deflection.
 *
 * `percent` measures the glow layer's own box (`absolute inset-0`), so it works
 * on content-sized surfaces such as a list row. `container` keeps the original
 * bento reading, which measures the tile's *content* box — consumers that pick
 * it must also set `container-type: size` on the surface.
 */
export type CardGlowTravel = "percent" | "container";

/**
 * Tuned in the card-glow showcase (`components/website/demos/visual/card-glow-demo.tsx`).
 * That demo is the parameter lab; these are the values it settled on, and every
 * product consumer reads them from here instead of restating the numbers.
 */
export const CARD_GLOW_DEFAULTS = {
	borderCore: 36,
	borderSpread: 120,
	borderWidth: 1,
	iconBlur: 28,
	iconBrightness: 1.3,
	iconContrast: 1.4,
	iconOpacity: 0.25,
	iconSaturate: 5,
	iconScale: 3.4,
} as const;

/**
 * Put this on the ancestor that owns a set of glow surfaces. The per-surface
 * accent goes on the surface itself via {@link cardGlowSurfaceStyle}; keeping
 * the tuning vars on a shared ancestor means one declaration for a whole grid
 * or list rather than one per card.
 */
export const CARD_GLOW_EFFECT_STYLE: CardGlowCSSProperties = {
	"--card-glow-border-core": CARD_GLOW_DEFAULTS.borderCore,
	"--card-glow-border-spread": CARD_GLOW_DEFAULTS.borderSpread,
	"--card-glow-border-width": CARD_GLOW_DEFAULTS.borderWidth,
	"--card-glow-icon-blur": CARD_GLOW_DEFAULTS.iconBlur,
	"--card-glow-icon-brightness": CARD_GLOW_DEFAULTS.iconBrightness,
	"--card-glow-icon-contrast": CARD_GLOW_DEFAULTS.iconContrast,
	"--card-glow-icon-opacity": CARD_GLOW_DEFAULTS.iconOpacity,
	"--card-glow-icon-saturate": CARD_GLOW_DEFAULTS.iconSaturate,
	"--card-glow-icon-scale": CARD_GLOW_DEFAULTS.iconScale,
};

/**
 * Per-surface style: the accent the stroke and bloom are painted in, plus the
 * travel basis. Spread it onto the element that hosts {@link CardGlowLayers}.
 */
export function cardGlowSurfaceStyle(
	accent: string,
	travel: CardGlowTravel = "percent",
): CardGlowCSSProperties {
	if (travel === "container") {
		return {
			"--card-glow-tile-accent": accent,
			"--card-glow-travel-x": "50cqi",
			"--card-glow-travel-y": "50cqh",
		};
	}

	return { "--card-glow-tile-accent": accent };
}
