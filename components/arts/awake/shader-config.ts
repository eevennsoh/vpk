import { ROVO_SHADER_COLOR_HEX } from "@/lib/rovo-colors";
import { clamp } from "@/lib/math";

// Subsets of each shader's prop surface — only the knobs we randomize.
// Kept local so this module doesn't depend on shader internals.

export interface TimeShaderParams {
	seed: number;
	speed: number;
	// Always 0 → shader animates indefinitely. Non-zero values make the
	// LiquidGradient loop back to its start time and would freeze the clock
	// backdrop on a cycle, so we pin this and never randomize it.
	loop: 0;
	scale: number;
	turbAmp: number;
	turbFreq: number;
	turbIter: number;
	waveFreq: number;
	exposure: number;
	contrast: number;
	saturation: number;
}

interface HumidityShaderParams {
	seed: number;
	speed: number;
	ephemeralAmp: number;
	lensScale: number;
	lensSpacingX: number;
	lensSpacingY: number;
	lensRadius: number;
	dispersionStrength: number;
	edgeDisp: number;
}

interface TemperatureShaderParams {
	seed: number;
	speed: number;
	freqX: number;
	freqY: number;
	angle: number;
	amplitude: number;
	softness: number;
	blend: number;
}

export interface ParticlesParams {
	bgColor: string;
	// Pinned on per user request — the time card's star layer only ever
	// runs in warp mode. The literal `true` type prevents accidental flips.
	warp: true;
	// Pinned to Reverse (`1`). The shader maps `> 0.5 → -1.0` so value 1
	// pulls stars toward the viewer; value 0 would push them away.
	warpDirection: 1;
	speed: number;
	scale: number;
	layers: number;
	brightness: number;
	glow: number;
	tunnelRadius: number;
	fadeRadius: number;
	blur: number;
	customColor: true;
	colorR: number;
	colorG: number;
	colorB: number;
}

export interface ShaderConfig {
	colors: string[];
	colorsTuple: [string, string, string, string];
	// Three-color subset used only by the Time shader (LiquidGradient). A
	// fresh triplet is chosen from the brand 4 on every reroll; the
	// humidity and temperature shaders keep the full 4-color palette.
	timeColors: string[];
	time: TimeShaderParams;
	humidity: HumidityShaderParams;
	temperature: TemperatureShaderParams;
	// Overlaid on top of the Time shader with soft-light blending.
	particles: ParticlesParams;
}

// Stable singleton references. Passed by reference to shaders so their
// useEffect dep arrays (which include `colors`) don't see a new array on
// every render — otherwise the WebGL program reinitializes each frame and
// the `performance.now()` start time resets, causing a visible snapback in
// the animation.
const BRAND_COLORS: string[] = [...ROVO_SHADER_COLOR_HEX];
const BRAND_COLORS_TUPLE: [string, string, string, string] = [
	ROVO_SHADER_COLOR_HEX[0],
	ROVO_SHADER_COLOR_HEX[1],
	ROVO_SHADER_COLOR_HEX[2],
	ROVO_SHADER_COLOR_HEX[3],
];

// Base values around which each roll jitters. These match the look that
// was previously hardcoded at the shader call sites; they're the centers
// of the random distribution, not a "default" that's ever shown as-is.
const BASE = {
	time: {
		speed: 0.3,
		scale: 0.42,
		turbAmp: 0.6,
		turbFreq: 0.1,
		turbIter: 7,
		waveFreq: 3.8,
		exposure: 1.1,
		contrast: 1.1,
		saturation: 1,
	},
	humidity: {
		speed: 0.3,
		ephemeralAmp: 0.04,
		lensScale: 3.7,
		lensSpacingX: 1,
		lensSpacingY: 0.01,
		lensRadius: 0.58,
		dispersionStrength: 0.4,
		edgeDisp: 2,
	},
	temperature: {
		speed: 2.85,
		freqX: 0.9,
		freqY: 6,
		angle: 105,
		amplitude: 1.6,
		softness: 1.4,
		blend: 0.5,
	},
};

// Symmetric jitter around `base`: returns base * (1 ± amount).
function jitterPct(base: number, amount: number): number {
	return base * (1 + (Math.random() * 2 - 1) * amount);
}

// Absolute jitter: base ± delta.
function jitterAbs(base: number, delta: number): number {
	return base + (Math.random() * 2 - 1) * delta;
}

// Partial Fisher–Yates: pick `count` distinct indices in [0, length),
// uniformly at random. Used to choose which brand hexes feed the Time
// shader on a given roll.
function pickDistinctIndices(length: number, count: number): number[] {
	const pool = Array.from({ length }, (_, i) => i);
	const out: number[] = [];
	for (let i = 0; i < count; i++) {
		const j = i + Math.floor(Math.random() * (length - i));
		[pool[i], pool[j]] = [pool[j], pool[i]];
		out.push(pool[i]);
	}
	return out;
}

// Produce a fresh random config. Non-deterministic by design — each call
// yields a new look. The palette stays fixed to the Rovo brand 4.
export function getRandomShaderConfig(): ShaderConfig {
	const timeIdx = pickDistinctIndices(BRAND_COLORS.length, 3);
	return {
		colors: BRAND_COLORS,
		colorsTuple: BRAND_COLORS_TUPLE,
		timeColors: timeIdx.map((i) => BRAND_COLORS[i]),
		time: {
			seed: Math.floor(Math.random() * 10000),
			speed: clamp(jitterPct(BASE.time.speed, 0.5), 0.12, 0.6),
			loop: 0,
			scale: clamp(jitterPct(BASE.time.scale, 0.35), 0.25, 0.65),
			turbAmp: clamp(jitterPct(BASE.time.turbAmp, 0.4), 0.3, 1),
			turbFreq: clamp(jitterPct(BASE.time.turbFreq, 0.5), 0.05, 0.2),
			// Integer in [5, 10]. Shader's internal `for (j = 2; j < 13; j++)`
			// makes 2–12 the meaningful band; 5–10 keeps enough turbulence
			// detail without spiking the per-frame cost at the high end or
			// flattening the gradient at the low end.
			turbIter: 5 + Math.floor(Math.random() * 6),
			waveFreq: clamp(jitterPct(BASE.time.waveFreq, 0.35), 2, 6),
			exposure: BASE.time.exposure,
			contrast: BASE.time.contrast,
			saturation: BASE.time.saturation,
		},
		humidity: {
			seed: Math.floor(Math.random() * 10000),
			speed: clamp(jitterPct(BASE.humidity.speed, 0.6), 0.1, 0.7),
			ephemeralAmp: clamp(jitterPct(BASE.humidity.ephemeralAmp, 0.5), 0, 0.08),
			lensScale: clamp(jitterPct(BASE.humidity.lensScale, 0.25), 2.6, 4.8),
			lensSpacingX: clamp(jitterPct(BASE.humidity.lensSpacingX, 0.3), 0.7, 1.4),
			// Uniform sample in [0.005, 0.04]. Controls the vertical period
			// of the lens pattern; center was 0.01 (very dense bands), and
			// this range spans ~half that to ~4× — enough to flex between
			// tight and loose bands without flipping the look entirely.
			lensSpacingY: 0.005 + Math.random() * 0.035,
			lensRadius: clamp(jitterPct(BASE.humidity.lensRadius, 0.2), 0.45, 0.72),
			dispersionStrength: clamp(jitterPct(BASE.humidity.dispersionStrength, 0.4), 0.2, 0.65),
			edgeDisp: clamp(jitterPct(BASE.humidity.edgeDisp, 0.35), 1.2, 2.8),
		},
		temperature: {
			seed: Math.floor(Math.random() * 10000),
			speed: clamp(jitterPct(BASE.temperature.speed, 0.45), 1.4, 4),
			freqX: clamp(jitterPct(BASE.temperature.freqX, 0.4), 0.4, 1.6),
			freqY: clamp(jitterPct(BASE.temperature.freqY, 0.35), 3.5, 8.5),
			angle: jitterAbs(BASE.temperature.angle, 60),
			amplitude: clamp(jitterPct(BASE.temperature.amplitude, 0.3), 1, 2.4),
			softness: clamp(jitterPct(BASE.temperature.softness, 0.25), 0.9, 2),
			blend: clamp(jitterPct(BASE.temperature.blend, 0.3), 0.3, 0.75),
		},
		// Centers come from the UI preset the user shared. Only `warp` and
		// `customColor` are pinned; everything else rolls.
		particles: {
			// 50% gray — the soft-light neutral. Every pixel on the
			// particles canvas is at least `rgb = 0.5`; star contributions
			// add on top. When the parent div applies
			// `mix-blend-mode: soft-light` to the whole canvas, empty
			// pixels (exactly gray) render the gradient identically and
			// star pixels (above gray) brighten it. No dim-rgb edges, so
			// no per-star halos.
			bgColor: "#808080",
			warp: true,
			warpDirection: 1,
			// Fixed at the ramp's rest value. The actual per-frame speed is
			// driven by a ref from the Weather component, which ramps from
			// a fast random value down to this over ~2s on every mount /
			// city cycle. This field only sets the initial WebGL uniform
			// for the first frame before the ref takes over.
			speed: 0.05,
			scale: clamp(jitterPct(0.5, 0.4), 0.3, 0.8),
			layers: 10 + Math.floor(Math.random() * 16),
			// Tuned down — the particles are a subtle highlight over the
			// gradient, not the subject. Soft-light already dampens output
			// (|top − 0.5| × gradient response), so a brightness near 0.5
			// reads as a gentle shimmer rather than a dominant starfield.
			brightness: clamp(jitterPct(0.5, 0.3), 0.3, 0.7),
			glow: clamp(jitterPct(0.7, 0.25), 0.4, 0.95),
			tunnelRadius: clamp(jitterPct(2, 0.35), 1.2, 3),
			fadeRadius: clamp(jitterPct(1.2, 0.3), 0.8, 1.8),
			blur: clamp(jitterPct(0.05, 0.8), 0.02, 0.15),
			customColor: true,
			// Per-channel phase offsets inside the shader's `cos(i + offset)`.
			// Equal values → stars read white; diverging values decorrelate
			// the channels and produce a per-city tint. At ±50% the max
			// inter-channel phase difference is ~3 rad (~170°), enough for a
			// clearly visible hue shift between cities while keeping stars
			// mostly pale (saturation rides on how far apart R/G/B fall, not
			// how far from 3 they are).
			colorR: clamp(jitterPct(3, 0.5), 1.5, 4.5),
			colorG: clamp(jitterPct(3, 0.5), 1.5, 4.5),
			colorB: clamp(jitterPct(3, 0.5), 1.5, 4.5),
		},
	};
}
