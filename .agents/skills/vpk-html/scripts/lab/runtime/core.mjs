// vpk-lab runtime · core: pure maths for labs, films and the Gantt (references/lab-kit.md). Ported from the EU26
// finale (components/projects/jira-team-eu26-end/finale/lib/finale-math.ts) and its case-study labs. Side-effect-free;
// lab/kit.mjs inlines it into the lab block, so even comments avoid colour literals, tags and replacement patterns.

/** Clamp `v` into [lo, hi] (default [0, 1]). */
export function clamp(v, lo = 0, hi = 1) {
	return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
	return a + (b - a) * t;
}

/** Linear 0..1 progress of `t` through [a, b]; a step at `b` when the window is empty. */
export function progress(t, a, b) {
	if (b <= a) return t >= b ? 1 : 0;
	return clamp((t - a) / (b - a));
}

/** Smoothstep of `v` from `e0` to `e1`. */
export function smooth(e0, e1, v) {
	if (e1 <= e0) return v >= e1 ? 1 : 0;
	const x = clamp((v - e0) / (e1 - e0));
	return x * x * (3 - 2 * x);
}

/** CSS cubic-bezier timing as `(x) => y`, solved with Newton steps and a bisection fallback. */
export function cubicBezier(x1, y1, x2, y2) {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;
	const sampleX = s => ((ax * s + bx) * s + cx) * s;
	const sampleY = s => ((ay * s + by) * s + cy) * s;
	const slopeX = s => (3 * ax * s + 2 * bx) * s + cx;
	return input => {
		const x = clamp(input);
		if (x === 0 || x === 1) return x;
		let s = x;
		for (let index = 0; index < 8; index += 1) {
			const error = sampleX(s) - x;
			if (Math.abs(error) < 1e-5) return sampleY(s);
			const slope = slopeX(s);
			if (Math.abs(slope) < 1e-6) break;
			s -= error / slope;
		}
		let low = 0;
		let high = 1;
		s = x;
		for (let index = 0; index < 24; index += 1) {
			const value = sampleX(s);
			if (Math.abs(value - x) < 1e-5) break;
			if (value < x) low = s;
			else high = s;
			s = (low + high) / 2;
		}
		return sampleY(s);
	};
}

/** Curves for canvas code (JS cannot read CSS custom properties): vpkOut / vpkInOut are the skill's --ease-out and
 * --ease-in-out tokens; the rest are the ADS curves the EU26 finale used (the exit curve is keyed `in`). */
export const EASE = Object.freeze({
	vpkOut: cubicBezier(0.16, 1, 0.3, 1),
	vpkInOut: cubicBezier(0.65, 0, 0.35, 1),
	outBold: cubicBezier(0, 0.4, 0, 1),
	inOut: cubicBezier(0.4, 0, 0, 1),
	in: cubicBezier(0.6, 0, 0.8, 0.6),
	outPractical: cubicBezier(0.4, 1, 0.6, 1),
	unfold: cubicBezier(0.22, 1, 0.36, 1),
	linear: value => clamp(value),
});

/** Closed-form unit-mass spring response, 0 towards 1, after `elapsed` seconds. As in finale-math.ts, damping
 * ratios of 1 or more use the critically damped response. */
export function spring(elapsed, k = 170, c = 18) {
	if (!(elapsed > 0)) return 0;
	const omega = Math.sqrt(k);
	const zeta = c / (2 * omega);
	if (zeta >= 1) return 1 - Math.exp(-omega * elapsed) * (1 + omega * elapsed);
	const omegaD = omega * Math.sqrt(1 - zeta * zeta);
	const decay = Math.exp(-zeta * omega * elapsed);
	return 1 - decay * (Math.cos(omegaD * elapsed) + ((zeta * omega) / omegaD) * Math.sin(omegaD * elapsed));
}

/** `edge`: first time the spring reaches 0.5 (null within the horizon); `overshoot`: peak above 1. */
export function springStats(k, c, { horizon = 1.2, dt = 0.0005 } = {}) {
	let edge = null;
	let peak = 0;
	const steps = Math.floor(horizon / dt + 1e-9);
	for (let index = 0; index <= steps; index += 1) {
		const s = index * dt;
		const value = spring(s, k, c);
		if (edge === null && value >= 0.5) edge = s;
		if (value > peak) peak = value;
	}
	return { edge, overshoot: Math.max(0, peak - 1) };
}

/** Seeded PRNG in [0, 1). */
export function mulberry32(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Deterministic per-index pseudo random in [0, 1). */
export function hash01(seed) {
	const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
	return value - Math.floor(value);
}

/** Cubic Hermite spline through `keys` ({ time, settle?, ...channels }) with Catmull-Rom tangents; settle keys and
 * both end keys get a zero tangent, so motion lands and holds. `channels`: property names or `(key) => number`.
 * Returns `(t) => number[]`, holding the end values outside the key range. */
export function keyframes(keys, channels) {
	const sorted = [...keys].sort((a, b) => a.time - b.time);
	const readers = channels.map(channel => (typeof channel === "function" ? channel : key => key[channel]));
	const values = sorted.map(key => readers.map(read => Number(read(key))));
	const last = sorted.length - 1;
	const tangents = values.map((row, index) => row.map((_, channel) => {
		if (sorted[index].settle || index === 0 || index === last) return 0;
		return (values[index + 1][channel] - values[index - 1][channel]) / (sorted[index + 1].time - sorted[index - 1].time);
	}));
	return t => {
		if (last < 0) return [];
		if (t <= sorted[0].time) return [...values[0]];
		if (t >= sorted[last].time) return [...values[last]];
		let index = 0;
		while (index < last - 1 && t >= sorted[index + 1].time) index += 1;
		const span = sorted[index + 1].time - sorted[index].time;
		const s = span > 0 ? (t - sorted[index].time) / span : 1;
		const s2 = s * s;
		const s3 = s2 * s;
		const h00 = 2 * s3 - 3 * s2 + 1;
		const h10 = s3 - 2 * s2 + s;
		const h01 = 3 * s2 - 2 * s3;
		const h11 = s3 - s2;
		return values[index].map((p0, channel) => h00 * p0 + h10 * tangents[index][channel] * span
			+ h01 * values[index + 1][channel] + h11 * tangents[index + 1][channel] * span);
	};
}

export function fixed(n, d = 2) {
	return Number(n).toFixed(d);
}

/** Always-signed fixed number with a true minus sign (U+2212); zero stays unsigned. */
export function signed(n, d = 2) {
	const text = fixed(Math.abs(Number(n)), d);
	if (Number(text) === 0) return text;
	return (n < 0 ? "−" : "+") + text;
}

// ---------- Segment clocks (film data, lab-kit.md C4) ----------

function coreSegments(data) {
	return Array.isArray(data?.segments) ? data.segments : [];
}

/** The segment that holds film time `film`: the last one starting at or before it (else the first). */
export function segmentAt(data, film) {
	const segments = coreSegments(data);
	let found = segments[0] ?? null;
	for (const segment of segments) {
		if (segment.film[0] <= film + 1e-9) found = segment;
	}
	return found;
}

/** Piecewise-linear lookup in nondecreasing [filmLocal, value] samples: column `from` is searched (binary,
 * first crossing on flat runs) and column `to` is returned, so (0, 1) reads the clock and (1, 0) inverts it. */
function coreInterpolate(samples, input, from, to) {
	const lastIndex = samples.length - 1;
	if (lastIndex < 0) return input;
	if (input <= samples[0][from]) return samples[0][to];
	if (input >= samples[lastIndex][from]) return samples[lastIndex][to];
	let low = 0;
	let high = lastIndex;
	while (high - low > 1) {
		const mid = (low + high) >> 1;
		if (samples[mid][from] < input) low = mid;
		else high = mid;
	}
	const a = samples[low];
	const b = samples[high];
	return b[from] > a[from] ? a[to] + ((input - a[from]) / (b[from] - a[from])) * (b[to] - a[to]) : b[to];
}

/** Clock reading at film time `film`: `{ segment, value, kind, label }`. */
export function clockAt(data, film) {
	const segment = segmentAt(data, film);
	if (!segment) return { segment: null, value: film, kind: "real", label: "film" };
	const clock = segment.clock ?? { kind: "real" };
	const local = clamp(film - segment.film[0], 0, Math.max(0, segment.film[1] - segment.film[0]));
	let value;
	if (clock.kind === "real") value = local;
	else if (clock.kind === "linear") value = (clock.start ?? 0) + (clock.rate ?? 1) * local;
	else if (clock.kind === "samples") value = coreInterpolate(clock.samples ?? [], local, 0, 1);
	else if (clock.kind === "custom") value = typeof clock.fn === "function" ? clock.fn(local) : NaN;
	else throw new Error(`vpk-lab: unknown clock kind "${clock.kind}" in segment "${segment.id}"`);
	return { segment, value, kind: clock.kind, label: segment.label ?? segment.id };
}

/** Film time at which segment `segmentId` reads `value`: exact for linear, monotone search for samples. */
export function filmFromClock(data, segmentId, value) {
	const segment = coreSegments(data).find(item => item.id === segmentId);
	if (!segment) throw new Error(`vpk-lab: no film segment "${segmentId}"`);
	const clock = segment.clock ?? { kind: "real" };
	let local;
	if (clock.kind === "real") local = value;
	else if (clock.kind === "linear") {
		const rate = clock.rate ?? 1;
		if (!rate) throw new Error(`vpk-lab: segment "${segmentId}" has a zero clock rate`);
		local = (value - (clock.start ?? 0)) / rate;
	} else if (clock.kind === "samples") local = coreInterpolate(clock.samples ?? [], value, 1, 0);
	else if (clock.kind === "custom") throw new Error(`vpk-lab: segment "${segmentId}" has a custom clock, which has no inverse`);
	else throw new Error(`vpk-lab: unknown clock kind "${clock.kind}" in segment "${segmentId}"`);
	return clamp(segment.film[0] + local, segment.film[0], segment.film[1]);
}

/** The current cue: the latest cue whose `film` is at or before `film + 1e-3` (null before the first). */
export function cueAt(cues, film) {
	let current = null;
	for (const cue of cues ?? []) {
		if (cue.film <= film + 1e-3 && (!current || cue.film >= current.film)) current = cue;
	}
	return current;
}

/** Film time of a cue given as `{ film }` or `{ clock, t }`; null when neither resolves. */
export function cueFilmTime(data, cue) {
	if (Number.isFinite(cue?.film)) return cue.film;
	if (cue?.clock != null && Number.isFinite(cue.t)) return filmFromClock(data, cue.clock, cue.t);
	return null;
}

// ---------- Gantt mapping (clock time to viewBox x and back) ----------

/** Clock time to viewBox x, clamped to [t0, t1] and rounded to 1e-6 so ganttX(ganttT(x)) === x. */
export function ganttX(t, { t0, t1, x0, x1 }) {
	if (!(t1 > t0)) return x0;
	const x = x0 + ((clamp(t, t0, t1) - t0) / (t1 - t0)) * (x1 - x0);
	return Math.round(x * 1e6) / 1e6;
}

/** ViewBox x to clock time, clamped to the mapped span. */
export function ganttT(x, { t0, t1, x0, x1 }) {
	if (x1 === x0) return t0;
	const inside = clamp(x, Math.min(x0, x1), Math.max(x0, x1));
	return t0 + ((inside - x0) / (x1 - x0)) * (t1 - t0);
}
