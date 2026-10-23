// Anatomy hero token map (ws4b spec section 4.2, integration K13 and R5).
//
// The vendored kit paints every part through 29 --anatomy-* custom properties. vpk maps each one onto a
// grayscale vpk token so a hero passes check-html and reads as the same figure system as the iso kit. Both
// engines resolve top, near side and far side identically in both themes, with luminance top > near > far
// (K13): light tops use --surface-raised, dark tops --ill-tone2, and the dark far sides --surface-sunken.
// No imports, no file reads: importing this module is free (R28).

// The 29 upstream names, in the order of the vendored `.iso{}` block, mapped for the light theme.
export const ANATOMY_TOKEN_MAP = Object.freeze({
	page: "var(--paper-background)",
	card: "var(--paper)",
	// text (fig and readout corners) and muted (title and hint corners, legend keys, caption) are real 10.5-13px
	// text on the plate (--paper), so both clear WCAG 1.4.3's 4.5:1 in light and dark (check-runtime B16): light
	// --subtlest-text is 2.49:1 there and --muted-text 4.44:1, so muted is --muted-text pulled 20% towards
	// --body-text (5.4:1 light, 9.8:1 dark) and text is --body-text, keeping upstream's darker-text hierarchy.
	text: "var(--body-text)",
	strong: "var(--headline)",
	muted: "color-mix(in srgb, var(--muted-text) 80%, var(--body-text))",
	paper: "var(--paper)",
	face: "var(--surface-raised)",
	top: "var(--surface-raised)",
	"shade-0": "var(--ill-tone3)",
	"shade-1": "color-mix(in srgb, var(--ill-tone2) 50%, var(--ill-tone3))",
	"shade-2": "var(--ill-tone2)",
	"shade-3": "var(--ill-tone1)",
	"lit-top": "var(--surface-raised)",
	"lit-shade": "var(--ill-tone1)",
	hi: "var(--ill-line)",
	mid: "color-mix(in srgb, var(--ill-ink50) 60%, var(--ill-guide))",
	lo: "var(--ill-guide)",
	faint: "var(--ill-guide-dashed)",
	lit: "var(--focal)",
	halo: "transparent",
	"halo-opacity": "0",
	dot: "var(--ill-line)",
	red: "var(--ill-line)",
	green: "var(--ill-line)",
	blue: "var(--ill-line)",
	weight: "var(--vpk-figure-stroke, 0.6px)",
	ease: "cubic-bezier(0.32, 0.72, 0, 1)",
	mono: "var(--font-mono)",
	lift: "none",
});

// Dark-theme overrides (K13). Every other property keeps its light mapping, whose vpk token already flips
// with [data-theme="dark"]. No vpk token is darker than --surface-sunken, so the deeper anatomy sides share it.
export const ANATOMY_DARK_TOKEN_MAP = Object.freeze({
	face: "var(--ill-tone2)",
	top: "var(--ill-tone2)",
	"lit-top": "var(--ill-tone2)",
	"shade-2": "var(--surface-sunken)",
	"shade-1": "var(--surface-sunken)",
	"shade-0": "var(--surface-sunken)",
});

// The shared face-tone contract (P-an-4, K13): what top, near-side and far-side faces resolve to in each
// theme. The iso kit (scripts/iso/palette.mjs) must resolve the same roles to the same tokens; F1b locks it.
export const FIGURE_FACE_ROLES = Object.freeze({
	light: Object.freeze({ top: "var(--surface-raised)", sideNear: "var(--ill-tone1)", sideFar: "var(--ill-tone2)", sideDeep: "var(--ill-tone3)" }),
	dark: Object.freeze({ top: "var(--ill-tone2)", sideNear: "var(--ill-tone1)", sideFar: "var(--surface-sunken)", sideDeep: "var(--surface-sunken)" }),
});

// Status hues have no place in a grayscale figure (locked decision 2).
export const FORBIDDEN_TONES = Object.freeze(["red", "green", "blue"]);

// The anatomy property each face role is painted with, per theme map above.
export const FACE_ROLE_PROPERTIES = Object.freeze({ top: "top", sideNear: "shade-3", sideFar: "shade-2", sideDeep: "shade-0" });

// Declarations for one token block: `--anatomy-name:value;` in map order.
export function tokenDeclarations(map) {
	return Object.entries(map).map(([name, value]) => `--anatomy-${name}:${value};`).join("");
}
