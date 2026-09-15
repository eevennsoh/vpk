import { CARD_GLOW_DEFAULTS } from "@/components/visual/card-glow";

export type CardGlowTheme = "system" | "light" | "dark";

export interface CardGlowConfig {
	theme: CardGlowTheme;
	iconBlur: number;
	iconSaturate: number;
	iconBrightness: number;
	iconContrast: number;
	iconScale: number;
	iconOpacity: number;
	borderSpread: number;
	borderWidth: number;
	borderBlur: number;
	borderSaturate: number;
	borderBrightness: number;
	borderContrast: number;
	exclude: boolean;
	css: boolean;
}

/**
 * This demo is the parameter lab for the shipped effect: the icon/border values
 * it starts from are the ones `components/visual/card-glow` ships, so moving a
 * slider here is always a comparison against production. The backdrop-filter
 * knobs below it have no production counterpart — the shared owner deliberately
 * omits them, because an always-on filter recolors the ring even where the
 * gradient is transparent.
 */
export const CARD_GLOW_DEFAULT_CONFIG: CardGlowConfig = {
	theme: "light",
	iconBlur: CARD_GLOW_DEFAULTS.iconBlur,
	iconSaturate: CARD_GLOW_DEFAULTS.iconSaturate,
	iconBrightness: CARD_GLOW_DEFAULTS.iconBrightness,
	iconContrast: CARD_GLOW_DEFAULTS.iconContrast,
	iconScale: CARD_GLOW_DEFAULTS.iconScale,
	iconOpacity: CARD_GLOW_DEFAULTS.iconOpacity,
	borderSpread: CARD_GLOW_DEFAULTS.borderSpread,
	borderWidth: CARD_GLOW_DEFAULTS.borderWidth,
	borderBlur: 0,
	borderSaturate: 4.2,
	borderBrightness: 2.5,
	borderContrast: 2.5,
	exclude: false,
	css: true,
};
