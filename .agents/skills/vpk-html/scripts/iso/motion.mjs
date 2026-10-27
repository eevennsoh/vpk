// iso/motion — build-time SMIL for the one-shot assembly (illustrations.md R11; svg-style.md
// § SMIL motion; integration K3 iso-kit form).
//
// Every element is begin="indefinite" with data-vpk-begin="0s" and one shared dur; the layer
// stagger is baked into keyTimes as a hold segment, so an armed (paused) figure shows every layer
// at its start offset from the first frame. The last keyframe is the rest pose (identity), which
// is also the base attribute, so static, print and reduced-motion renders show the assembled art.
// The canonical starter (runtime/smil-starter.mjs) is the only code that begins these elements.

import { ENTRY } from "./accent.mjs";

// Any number of layers: each layer group carries its own hand-off class animation and the runtime CSS is layer-agnostic
// (runtime-css entryCss), so there is no layer cap.
export const MAX_TOTAL_MS = 1800;
export const MOVE_SPLINE = "0.16 1 0.3 1";
export const HOLD_SPLINE = "0 0 1 1";

const fraction = value => {
	const text = (Math.round(value * 1000) / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
	return text === "-0" ? "0" : text;
};
const tenth = value => {
	const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
	return text === "-0" ? "0" : text;
};

// The assembly (illustrations.md § Style, rule 10; the reference videos' entry, iso/accent.mjs ENTRY, shared with the 3D
// prototype). Each layer drops from ENTRY.DROP_Z above in MANUAL_PART_MS on the ease-out spline and lands; layer i starts at
// i × staggerFor(layers), an even gap shorter than the drop, so consecutive drops overlap slightly. No arrow and no ghost (the
// user's redline). The gap is ENTRY.STAGGER_MS (MANUAL_STEP_MS, 180 ms) up to 7 layers; beyond that it shrinks, with no floor,
// so the whole assembly still ends by MAX_TOTAL_MS (12 layers: 100 ms; 24 layers: 47 ms).
export const MANUAL_PART_MS = ENTRY.PART_MS;
export const MANUAL_STEP_MS = ENTRY.STAGGER_MS;
export function staggerFor(layers) {
	const n = Math.max(1, Math.floor(Number(layers) || 1));
	if (n < 2) return MANUAL_STEP_MS;
	// No floor and no layer cap: the gap shrinks (fractional below 1 ms) so any number of layers ends by MAX_TOTAL_MS.
	const gap = (MAX_TOTAL_MS - MANUAL_PART_MS) / (n - 1);
	return gap >= 1 ? Math.min(MANUAL_STEP_MS, Math.floor(gap)) : gap;
}

// The hand-off is layer-agnostic: every layer group (g[data-vpk-iso-enter], and each g[data-vpk-iso-shadow-enter]) carries one
// discrete SMIL class animation of its own. ENTRY_WAIT_CLASS hides the group until its layer starts dropping, ENTRY_DROP_CLASS
// paints a dropping part group in the accent (it started less than ENTRY.ACCENT_HOLD_MS ago: the current step), and the rest
// value ENTRY_REST_CLASS paints nothing (the neutral tone map). runtime-css paints the three classes with one rule set for any
// layer count. MANUAL_HOLD_MS is the same for every layer, the last included, so each hands back at the same point of its drop.
export const ENTRY_WAIT_CLASS = "vpk-iso-wait";
export const ENTRY_DROP_CLASS = "vpk-iso-drop";
export const ENTRY_REST_CLASS = "vpk-iso-set";
export const MANUAL_HOLD_MS = ENTRY.ACCENT_HOLD_MS;

export function manualTiming({ layers }) {
	const n = Array.isArray(layers) ? layers.length : Number(layers);
	if (!Number.isInteger(n) || n < 1) throw new RangeError("manualTiming: at least one layer is required");
	const step = staggerFor(n);
	const starts = Array.from({ length: n }, (_, i) => i * step);
	const total = starts.at(-1) + MANUAL_PART_MS;
	return Object.freeze({ layers: n, manual: true, part: MANUAL_PART_MS, step, starts: Object.freeze(starts), lastStart: starts.at(-1), total });
}

// The class frames of layer i, [[ms, class], ...]: a group waits (hidden) until its start, a part group then drops in the accent
// for MANUAL_HOLD_MS, and rests. `accent: false` (emphasis "ink" or "none") and shadow groups (`shadow: true`) skip the accent
// step. null when the class would never change (a first layer without the accent).
export function layerClassFrames(i, timing, { accent = true, shadow = false } = {}) {
	const start = timing.starts[i];
	const frames = start > 0 ? [[0, ENTRY_WAIT_CLASS]] : [];
	if (accent && !shadow) {
		frames.push([start, ENTRY_DROP_CLASS]);
		if (start + MANUAL_HOLD_MS < timing.total) frames.push([start + MANUAL_HOLD_MS, ENTRY_REST_CLASS]);
	} else frames.push([start, ENTRY_REST_CLASS]);
	return frames.length < 2 && frames[0]?.[1] === ENTRY_REST_CLASS ? null : frames;
}

// The class of layer i's group at time t ("" when it has no animation: the base art carries no class).
export function layerClassAt(i, t, timing, options) {
	const frames = layerClassFrames(i, timing, options);
	if (!frames) return "";
	return frames.filter(([at]) => at <= t).at(-1)?.[1] ?? frames[0][1];
}

// One discrete class animation for layer i's group ("" when the class never changes). The base art carries no class, so a
// static, reduced-motion or print render is the neutral rest pose.
export function layerClassAnimation(i, timing, options) {
	const frames = layerClassFrames(i, timing, options);
	if (!frames) return "";
	if (frames[0][0] > 0) frames.unshift([0, frames[0][1]]);
	return `<animate data-vpk-begin="0s" attributeName="class" begin="indefinite" dur="${timing.total}ms" values="${frames.map(([, name]) => name).join(";")}" keyTimes="${frames.map(([at]) => fraction(at / timing.total)).join(";")}" calcMode="discrete" fill="freeze"/>`;
}

// keyTimes / values / keySplines for layer i (non-decreasing, no duplicate times).
export function enterKeyframes(i, timing, [dx, dy]) {
	const begin = timing.starts[i];
	const t0 = begin / timing.total;
	const t1 = (begin + timing.part) / timing.total;
	const start = `${tenth(dx)} ${tenth(dy)}`;
	const values = [start];
	const times = [0];
	const splines = [];
	if (t0 > 0) {
		values.push(start);
		times.push(t0);
		splines.push(HOLD_SPLINE);
	}
	values.push("0 0");
	times.push(t1);
	splines.push(MOVE_SPLINE);
	if (t1 < 1) {
		values.push("0 0");
		times.push(1);
		splines.push(HOLD_SPLINE);
	}
	return { values: values.join(";"), keyTimes: times.map(fraction).join(";"), keySplines: splines.join(";"), t0, t1 };
}

export function enterAnimation(i, timing, offset) {
	const { values, keyTimes, keySplines } = enterKeyframes(i, timing, offset);
	return `<animateTransform data-vpk-begin="0s" attributeName="transform" type="translate" begin="indefinite" dur="${timing.total}ms" values="${values}" keyTimes="${keyTimes}" calcMode="spline" keySplines="${keySplines}" fill="freeze"/>`;
}

// Fade start for labels and guides: the last 15% of the assembly (at most 240 ms), never before the
// last layer starts moving.
export function fadeStart(timing) {
	const lastStart = timing.lastStart / timing.total;
	return Math.min(0.95, Math.max(lastStart, 1 - Math.min(240, timing.total * 0.15) / timing.total));
}

export function fadeAnimation(t, timing) {
	return `<animate data-vpk-begin="0s" attributeName="opacity" begin="indefinite" dur="${timing.total}ms" values="0;0;1" keyTimes="0;${fraction(t)};1" fill="freeze"/>`;
}
