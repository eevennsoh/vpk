/**
 * Keynote slide colours from the Team ’26 EU Figma templates. Slides are a
 * fixed brand surface (they never follow the product light/dark theme), so
 * these are deliberate literals rather than ADS semantic tokens.
 */
export const FINALE_COLORS = {
	/** Slide background in the "Template example" bento frames. */
	slide: "#F1F2F4",
	/** Bento tile fill — white cards on grey, like Jira cards on a column. */
	tile: "#FFFFFF",
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
