// iso/motion — build-time SMIL for the one-shot assembly (illustrations.md R11; svg-style.md
// § SMIL motion; integration K3 iso-kit form).
//
// Every element is begin="indefinite" with data-vpk-begin="0s" and one shared dur; the layer
// stagger is baked into keyTimes as a hold segment, so an armed (paused) figure shows every layer
// at its start offset from the first frame. The last keyframe is the rest pose (identity), which
// is also the base attribute, so static, print and reduced-motion renders show the assembled art.
// The canonical starter (runtime/smil-starter.mjs) is the only code that begins these elements.

import { ENTRY } from "./accent.mjs";

export const MAX_LAYERS = 6;
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
// i × MANUAL_STEP_MS, an even gap shorter than the drop, so consecutive drops overlap slightly (six layers: 1.6 s in total, under
// MAX_TOTAL_MS). No arrow and no ghost (the user's redline).
export const MANUAL_PART_MS = ENTRY.PART_MS;
export const MANUAL_STEP_MS = ENTRY.STAGGER_MS;
// The hand-off state is a class list on <g data-vpk-iso-scene>, stepped by one discrete class animation: vpk-iso-h<j> hides
// layer j (it has not started dropping), vpk-iso-a<i> paints layer i in the accent (it started less than ENTRY.ACCENT_HOLD_MS
// ago: the current step), and the rest value vpk-iso-set paints nothing (the neutral tone map). runtime-css (entryCss) paints
// the classes. MANUAL_HOLD_MS is the same for every layer, the last included, so each hands back at the same point of its drop.
export const ENTRY_REST_CLASS = "vpk-iso-set";
export const MANUAL_HOLD_MS = ENTRY.ACCENT_HOLD_MS;
export function entryClass(t, timing) {
	const accented = timing.starts.flatMap((start, i) => (start <= t && t < start + MANUAL_HOLD_MS ? [`vpk-iso-a${i}`] : []));
	const hidden = timing.starts.flatMap((start, j) => (start > t ? [`vpk-iso-h${j}`] : []));
	return [...accented, ...hidden].join(" ") || ENTRY_REST_CLASS;
}

export function manualTiming({ layers }) {
	const n = Array.isArray(layers) ? layers.length : Number(layers);
	if (!Number.isInteger(n) || n < 1) throw new RangeError("manualTiming: at least one layer is required");
	if (n > MAX_LAYERS) throw new RangeError(`manualTiming: ${n} layers exceeds ${MAX_LAYERS}`);
	const starts = Array.from({ length: n }, (_, i) => i * MANUAL_STEP_MS);
	const total = starts.at(-1) + MANUAL_PART_MS;
	return Object.freeze({ layers: n, manual: true, part: MANUAL_PART_MS, starts: Object.freeze(starts), lastStart: starts.at(-1), total });
}

// The hand-off: one discrete class animation for the whole scene. Before the first layer starts every layer is hidden; from
// starts[i] layer i drops in the accent (the current step) with later layers hidden; MANUAL_HOLD_MS after its start it loses the
// accent class and the CSS fades it to neutral over ENTRY.HANDOFF_MS. Once the last layer has handed back the scene rests on
// vpk-iso-set, which paints nothing, so a landed or printed figure is the neutral art. A figure that never plays (reduced
// motion, static) never gains a class. One element per figure, so a 35-part figure pays for it once.
export function handoffTimes(timing) {
	const events = [-1, ...timing.starts, ...timing.starts.map(start => start + MANUAL_HOLD_MS)].filter(t => t < timing.total);
	return [...new Set(events)].sort((a, b) => a - b);
}

export function handoffAnimation(timing) {
	const events = handoffTimes(timing);
	const values = events.map(t => entryClass(t, timing));
	const times = events.map(t => Math.max(0, t) / timing.total);
	return `<animate data-vpk-begin="0s" attributeName="class" begin="indefinite" dur="${timing.total}ms" values="${values.join(";")}" keyTimes="${times.map(fraction).join(";")}" calcMode="discrete" fill="freeze"/>`;
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
