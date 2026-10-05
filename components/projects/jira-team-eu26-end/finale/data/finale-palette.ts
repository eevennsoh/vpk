/**
 * Keynote slide colours from the Team ’26 EU Figma templates. Slides are a
 * fixed brand surface (they never follow the product light/dark theme), so
 * these are deliberate literals rather than ADS semantic tokens.
 */
export const FINALE_COLORS = {
	/** Slide background behind the Founder Keynote "Bento" frame. */
	slide: "#FFFFFF",
	/** Bento tile fill (Figma "Neutral/Light/100"): soft grey cards on the white slide. */
	tile: "#F8F8F8",
} as const;

/** Team ’26 primaries from the template's colour guidelines: the wall's posters and shapes. */
export const FINALE_BRAND = {
	blue: "#3266D4",
	lime: "#82B536",
	purple: "#B367EB",
	saffron: "#F1AB3C",
	black: "#111214",
	white: "#FFFFFF",
} as const;

export type FinaleBrandColor = keyof typeof FINALE_BRAND;
