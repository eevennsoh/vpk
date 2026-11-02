/**
 * The finale's colours in each appearance. Light is the Team ’26 EU keynote
 * templates, and the ADS light values the bento's product UI was drawn in;
 * dark is ADS's dark set, so the finale lands on a dark board's own ground.
 * The finale follows the app's theme (`studio/use-finale-appearance.ts`).
 *
 * The DOM reads them as CSS variables (`FINALE_COLORS`), switched by the
 * theme's `data-color-mode` (`FinalePaletteStyle`); WebGL and canvas, which
 * need numbers, resolve the same names against a palette (`finaleColor`).
 */

export type FinaleAppearance = "light" | "dark";

export interface FinalePalette {
	/** The slide behind the bento and the mega bento. */
	readonly slide: string;
	/** Bento tile fill: one step off the slide. */
	readonly tile: string;
	/** The keynote's type. */
	readonly ink: string;
	/* The product UI drawn inside the tiles. */
	readonly panel: string;
	readonly panelSunken: string;
	readonly line: string;
	readonly hairline: string;
	readonly chip: string;
	readonly text: string;
	readonly textSubtle: string;
	readonly textSubtlest: string;
	readonly textStrong: string;
	readonly textDisabled: string;
	/** A bold pill (Record for agent, Work's mark) and what sits on it. */
	readonly bold: string;
	readonly onBold: string;
	readonly knobTop: string;
	readonly knobBottom: string;
	readonly well: string;
	readonly glass: string;
	readonly secondary: string;
	readonly glyphStrong: string;
	readonly row: string;
	readonly rowTarget: string;
	readonly track: string;
	readonly silver: string;
	/* Lozenges: Jira's statuses, and Work's Open Beta. */
	readonly todo: string;
	readonly todoText: string;
	readonly progress: string;
	readonly progressText: string;
	readonly done: string;
	readonly doneText: string;
	readonly discovery: string;
	readonly discoveryText: string;
	readonly beta: string;
	readonly betaEdge: string;
	readonly betaText: string;
	/* The keynote's chapters. */
	readonly chapterContext: string;
	readonly chapterCollaboration: string;
	readonly chapterConfidence: string;
	/** The ripple's dots on a tile. */
	readonly dots: string;
	/** A Jira card's stand-in when its print is missing. */
	readonly card: string;
	readonly cardEdge: string;
}

export const FINALE_PALETTES: Readonly<Record<FinaleAppearance, FinalePalette>> = {
	light: {
		slide: "#FFFFFF",
		tile: "#F8F8F8",
		ink: "#101214",
		panel: "#FFFFFF",
		panelSunken: "#F7F7F7",
		line: "#DDDEE1",
		hairline: "#F3F4F6",
		chip: "#F0F1F2",
		text: "#292A2E",
		textSubtle: "#505258",
		textSubtlest: "#6B6E76",
		textStrong: "#000000",
		textDisabled: "rgba(8, 15, 33, 0.29)",
		bold: "#292A2E",
		onBold: "#FFFFFF",
		knobTop: "#FFFFFF",
		knobBottom: "#ECECEC",
		well: "rgba(0, 0, 0, 0.08)",
		glass: "rgba(255, 255, 255, 0.6)",
		secondary: "rgba(0, 0, 0, 0.5)",
		glyphStrong: "rgba(0, 0, 0, 0.85)",
		row: "rgba(23, 23, 23, 0.03)",
		rowTarget: "rgba(5, 21, 36, 0.06)",
		track: "#E5E7EB",
		silver: "#DDDEE1",
		todo: "#DDDEE1",
		todoText: "#292A2E",
		progress: "#E9F2FE",
		progressText: "#1558BC",
		done: "#DCFFF1",
		doneText: "#216E4E",
		discovery: "#F8EEFE",
		discoveryText: "#803FA5",
		beta: "#EED7FC",
		betaEdge: "#D8A0F7",
		betaText: "#48245D",
		chapterContext: "#DAF0AF",
		chapterCollaboration: "#E9D8F8",
		chapterConfidence: "#D0E1FD",
		dots: "#091E42",
		card: "#FFFFFF",
		cardEdge: "rgba(9, 30, 66, 0.14)",
	},
	dark: {
		slide: "#1F1F21",
		tile: "#242528",
		ink: "#F1F2F4",
		panel: "#2B2C2F",
		panelSunken: "#1F1F21",
		line: "#3D3F43",
		hairline: "#303134",
		chip: "#37383C",
		text: "#CECFD2",
		textSubtle: "#A9ABAF",
		textSubtlest: "#96999E",
		textStrong: "#F1F2F4",
		textDisabled: "rgba(229, 233, 246, 0.25)",
		bold: "#CECFD2",
		onBold: "#1F1F21",
		// The knob's glyph is a dark image: it stays a white knob on the light pill.
		knobTop: "#FFFFFF",
		knobBottom: "#ECECEC",
		well: "rgba(255, 255, 255, 0.08)",
		glass: "rgba(43, 44, 47, 0.6)",
		secondary: "rgba(255, 255, 255, 0.5)",
		glyphStrong: "rgba(255, 255, 255, 0.85)",
		row: "rgba(206, 206, 217, 0.04)",
		rowTarget: "rgba(206, 206, 217, 0.07)",
		track: "#3D3F43",
		silver: "#4B4D51",
		todo: "#4B4D51",
		todoText: "#CECFD2",
		progress: "#1C2B42",
		progressText: "#8FB8F6",
		done: "#1C3329",
		doneText: "#7EE2B8",
		discovery: "#35243F",
		discoveryText: "#D8A0F7",
		beta: "#48245D",
		betaEdge: "#803FA5",
		betaText: "#EED7FC",
		chapterContext: "#37471F",
		chapterCollaboration: "#48245D",
		chapterConfidence: "#123263",
		dots: "#CECFD2",
		card: "#242528",
		cardEdge: "rgba(206, 206, 217, 0.12)",
	},
};

type FinaleColorName = keyof FinalePalette;

const cssName = (name: string) => `--finale-${name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`;
const NAMES = Object.keys(FINALE_PALETTES.light) as FinaleColorName[];

/** The finale's colours for the DOM: CSS variables that follow the app's theme. */
export const FINALE_COLORS = Object.fromEntries(NAMES.map((name) => [name, `var(${cssName(name)})`])) as Readonly<Record<FinaleColorName, string>>;

const BY_VARIABLE = new Map(NAMES.map((name) => [`var(${cssName(name)})`, name]));

/** A colour as WebGL or a canvas needs it: a finale variable resolved for `appearance`, anything else as it is. */
export function finaleColor(color: string, appearance: FinaleAppearance): string {
	const name = BY_VARIABLE.get(color);
	return name ? FINALE_PALETTES[appearance][name] : color;
}

const declarations = (palette: FinalePalette) => NAMES.map((name) => `${cssName(name)}:${palette[name]}`).join(";");

/** The variables' sheet: light by default, dark under the app's dark theme. */
export const FINALE_PALETTE_CSS = `:root{${declarations(FINALE_PALETTES.light)}}:root[data-color-mode="dark"]{${declarations(FINALE_PALETTES.dark)}}`;

/** Team ’26 primaries from the template's colour guidelines: the wall's posters and shapes, in either appearance. */
export const FINALE_BRAND = {
	blue: "#3266D4",
	lime: "#82B536",
	purple: "#B367EB",
	saffron: "#F1AB3C",
	black: "#111214",
	white: "#FFFFFF",
} as const;

export type FinaleBrandColor = keyof typeof FINALE_BRAND;
