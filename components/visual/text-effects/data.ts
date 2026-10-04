import { motionEase } from "@/lib/motion";
/**
 * Text-animation presets ported from Pixel Point's `animate-text` skill
 * (https://pixelpoint.io/skills/animate-text/). Each effect's keyframes,
 * easing, duration, and per-unit stagger are transcribed 1:1 from the skill's
 * portable motion contracts (`assets/specs/<id>.json`); only the entrance
 * ("enter") phase is used, since the showcase replays the reveal on a loop.
 */

/** Animation granularity. `whole` animates the entire passage as one unit. */
export type Granularity = "char" | "word" | "line" | "whole";

/** Order in which staggered units start animating. */
export type StaggerMode = "normal" | "center-out";

/** Keyframe endpoint. Only the keys an effect uses are present. */
export type Frame = Readonly<
	Partial<{
		opacity: number;
		/** Horizontal offset in px (Motion `x`). */
		x: number;
		/** Vertical offset in px (Motion `y`). */
		y: number;
		scale: number;
		/** Gaussian blur radius in px (Motion `filter: blur()`). */
		blur: number;
	}>
>;

export type EffectId =
	| "soft-blur-in"
	| "per-character-rise"
	| "bottom-up-letters"
	| "top-down-letters"
	| "stagger-from-center"
	| "typewriter"
	| "per-word-crossfade"
	| "spring-scale-in"
	| "mask-reveal-up"
	| "line-by-line-slide"
	| "shimmer-sweep"
	| "focus-blur-resolve";

export type TextEffectSpec = Readonly<{
	label: string;
	description: string;
	/** The effect's native granularity (the demo can override non-`whole` ones). */
	target: Granularity;
	/** Per-unit entrance duration, in ms. */
	durationMs: number;
	/** Per-unit delay step, in ms. */
	staggerMs: number;
	/** Cubic-bezier control points for Motion's `ease`. */
	easing: readonly [number, number, number, number];
	staggerMode?: StaggerMode;
	/** Faithful `steps(1, end)` reveal — opacity holds, then snaps at the end. */
	stepped?: boolean;
	from: Frame;
	to: Frame;
}>;

/**
 * The 12 showcased effects. `from`/`to`/`easing`/`durationMs`/`staggerMs` mirror
 * the skill's `enter` phase exactly; `label`/`description` are condensed from the
 * skill catalog. The ordering groups per-character → per-word → per-line → whole.
 */
export const TEXT_EFFECTS: Readonly<Record<EffectId, TextEffectSpec>> = {
	"soft-blur-in": {
		label: "Soft Blur",
		description: "Per-character fade-in with a gentle blur and upward motion — Apple's signature hero-title reveal.",
		target: "char",
		durationMs: 900,
		staggerMs: 25,
		easing: [0.22, 1, 0.36, 1],
		from: { opacity: 0, y: 16, blur: 12 },
		to: { opacity: 1, y: 0, blur: 0 },
	},
	"per-character-rise": {
		label: "Character Rise",
		description: "Letters slide up from below with no blur — crisp, deliberate, and kinetic.",
		target: "char",
		durationMs: 700,
		staggerMs: 24,
		easing: [0.2, 0.8, 0.2, 1],
		from: { opacity: 0, y: 32 },
		to: { opacity: 1, y: 0 },
	},
	"bottom-up-letters": {
		label: "Bottom-Up Letters",
		description: "Letters rise from below in a pronounced staircase, one symbol at a time, with zero blur.",
		target: "char",
		durationMs: 400,
		staggerMs: 88,
		easing: [0.18, 1, 0.32, 1],
		from: { opacity: 0, y: 46 },
		to: { opacity: 1, y: 0 },
	},
	"top-down-letters": {
		label: "Top-Down Letters",
		description: "Letters descend from above in a pronounced staircase, one symbol at a time, with zero blur.",
		target: "char",
		durationMs: 400,
		staggerMs: 88,
		easing: [0.18, 1, 0.32, 1],
		from: { opacity: 0, y: -46 },
		to: { opacity: 1, y: 0 },
	},
	"stagger-from-center": {
		label: "Stagger from Center",
		description: "Characters reveal from the center outward to emphasize the keyword core.",
		target: "char",
		durationMs: 620,
		staggerMs: 22,
		easing: [0.22, 1, 0.36, 1],
		staggerMode: "center-out",
		from: { opacity: 0, y: 12, blur: 3 },
		to: { opacity: 1, y: 0, blur: 0 },
	},
	typewriter: {
		label: "Typewriter",
		description: "Per-character stepped reveal with a minimal editorial typing rhythm.",
		target: "char",
		durationMs: 240,
		staggerMs: 46,
		easing: motionEase.linear,
		stepped: true,
		from: { opacity: 0 },
		to: { opacity: 1 },
	},
	"per-word-crossfade": {
		label: "Word Crossfade",
		description: "Words gently fade into place one after another, with a short vertical drift for a calm keynote rhythm.",
		target: "word",
		durationMs: 700,
		staggerMs: 70,
		easing: [0.16, 1, 0.3, 1],
		from: { opacity: 0, y: 8 },
		to: { opacity: 1, y: 0 },
	},
	"spring-scale-in": {
		label: "Spring Scale",
		description: "Words pop in with a soft overshoot scale, like a physical spring settling into place.",
		target: "word",
		durationMs: 360,
		staggerMs: 95,
		easing: [0.34, 1.56, 0.64, 1],
		from: { opacity: 0, scale: 0.7 },
		to: { opacity: 1, scale: 1 },
	},
	"mask-reveal-up": {
		label: "Mask Reveal Up",
		description: "Lines reveal upward with a soft masked feel and a compact stagger.",
		target: "line",
		durationMs: 760,
		staggerMs: 90,
		easing: [0.22, 1, 0.36, 1],
		from: { opacity: 0, y: 30, blur: 6 },
		to: { opacity: 1, y: 0, blur: 0 },
	},
	"line-by-line-slide": {
		label: "Line Slide",
		description: "Each line enters from the left with a staggered slide for a flowing paragraph reveal.",
		target: "line",
		durationMs: 900,
		staggerMs: 120,
		easing: [0.22, 1, 0.36, 1],
		from: { opacity: 0, x: -48 },
		to: { opacity: 1, x: 0 },
	},
	"shimmer-sweep": {
		label: "Shimmer Sweep",
		description: "A subtle sweep across a clean headline, blending in while gliding from left to center.",
		target: "whole",
		durationMs: 850,
		staggerMs: 0,
		easing: [0.22, 1, 0.36, 1],
		from: { opacity: 0, x: -22, blur: 8 },
		to: { opacity: 1, x: 0, blur: 0 },
	},
	"focus-blur-resolve": {
		label: "Focus Blur Resolve",
		description: "A premium focus pull from heavy blur to crisp text.",
		target: "whole",
		durationMs: 760,
		staggerMs: 0,
		easing: [0.22, 1, 0.36, 1],
		from: { opacity: 0, y: 14, blur: 14, scale: 1.01 },
		to: { opacity: 1, y: 0, blur: 0, scale: 1 },
	},
};

/** Live, demo-tunable settings. Keyframes/easing come from the chosen effect. */
export type TextEffectConfig = Readonly<{
	effect: EffectId;
	/** Granularity override for non-`whole` effects. */
	splitBy: Granularity;
	/** Per-unit duration, in ms (seeded from the effect, then tunable). */
	durationMs: number;
	/** Per-unit delay step, in ms (seeded from the effect, then tunable). */
	staggerMs: number;
	autoLoop: boolean;
	/** Pause between auto-loop cycles, in seconds. */
	loopDelay: number;
}>;

export const EFFECT_OPTIONS: readonly { value: EffectId; label: string }[] = (
	Object.keys(TEXT_EFFECTS) as EffectId[]
).map((id) => ({ value: id, label: TEXT_EFFECTS[id].label }));

/** Build the live config for an effect, seeding duration/stagger from its spec. */
export function configForEffect(
	effect: EffectId,
	overrides?: Partial<Pick<TextEffectConfig, "autoLoop" | "loopDelay">>,
): TextEffectConfig {
	const spec = TEXT_EFFECTS[effect];
	return {
		effect,
		splitBy: spec.target,
		durationMs: spec.durationMs,
		staggerMs: spec.staggerMs,
		autoLoop: overrides?.autoLoop ?? true,
		loopDelay: overrides?.loopDelay ?? 1.2,
	};
}

export const DEFAULT_CONFIG: TextEffectConfig = configForEffect("soft-blur-in");

/** Multi-line headline that exercises char, word, line, and whole granularities. */
export const SAMPLE_TEXT = "Designed to move.\nBuilt to focus.\nReady for anything.";

/**
 * Optional colour palette painted on top of the neutral text. When omitted the
 * text stays its ambient colour (`text-text`); when supplied, a fully opaque
 * gradient drawn from the palette is painted over the glyphs, completely
 * covering the neutral base so they read as vivid, full-saturation colour. Two
 * or more stops blend across the passage; one stop is a flat colour.
 */
export type ColorStops = readonly string[];

/**
 * Blue → purple → orange — the Team Work Graph dot palette. Sampling this per
 * character is what gives the TWG source-picker button its rainbow soft-blur
 * reveal; exported here so any `TextEffects` consumer can reuse the same look.
 */
export const RAINBOW_COLOR_STOPS: ColorStops = ["#1868db", "#bf63f3", "#fca700"];
