import { defaultStyle } from "distortion-waves";
import type { PaletteName, WaveStyle, WaveType } from "distortion-waves";

type DistortionWavePaletteChoice = PaletteName | "type" | "custom";
type DistortionWaveLiveMode = "on" | "animations" | "off";
type DistortionWaveReducedMotion = "system" | "always" | "never";

type DistortionWaveOption<TValue extends string> = Readonly<{
	value: TValue;
	label: string;
	description: string;
}>;

/** Every numeric WaveStyle knob the GUI exposes. */
export type DistortionWaveStyleKey = Exclude<
	{ [K in keyof WaveStyle]-?: WaveStyle[K] extends number ? K : never }[keyof WaveStyle],
	"cornerRadius" | "launchGap" | "easeX1" | "easeY1" | "easeX2" | "easeY2"
>;

type DistortionWaveStyleValues = Readonly<Record<DistortionWaveStyleKey, number>>;

type DistortionWaveStyleControl = Readonly<{
	key: DistortionWaveStyleKey;
	label: string;
	min: number;
	max: number;
	step: number;
	unit?: string;
}>;

type DistortionWaveStyleGroup = Readonly<{
	title: string;
	controls: readonly DistortionWaveStyleControl[];
}>;

export type DistortionWaveControlConfig = Readonly<{
	type: WaveType;
	palette: DistortionWavePaletteChoice;
	customColor: string;
	scrubEnabled: boolean;
	scrub: number;
	live: DistortionWaveLiveMode;
	reducedMotion: DistortionWaveReducedMotion;
	style: DistortionWaveStyleValues;
}>;

/**
 * Which upstream release this component tracks. Integrity is the lockfile's job.
 */
export const DISTORTION_WAVE_SOURCE_METADATA = {
	repository: "https://github.com/Jakubantalik/Libraries.dev",
	packageName: "distortion-waves",
	packageVersion: "0.1.0",
	license: "MIT",
} as const;

export const DISTORTION_WAVE_TYPE_OPTIONS: readonly DistortionWaveOption<WaveType>[] = [
	{ value: "vertical", label: "Vertical", description: "Rises from a button at the bottom edge." },
	{ value: "horizontal", label: "Horizontal", description: "Sweeps right from a tall source on the left edge." },
	{ value: "center", label: "Center", description: "A ring that opens from an avatar or point." },
];

export const DISTORTION_WAVE_PALETTE_OPTIONS: readonly DistortionWaveOption<DistortionWavePaletteChoice>[] = [
	{ value: "type", label: "Type default", description: "Use the colours tuned for the current wave type." },
	{ value: "colorful", label: "Colorful", description: "The full-spectrum upstream palette." },
	{ value: "green", label: "Green", description: "Greens with lime and teal fringes." },
	{ value: "ocean", label: "Ocean", description: "Blues and cyans." },
	{ value: "sunset", label: "Sunset", description: "Oranges, pinks and purples." },
	{ value: "mono", label: "Mono", description: "Greyscale." },
	{ value: "custom", label: "Custom", description: "One colour, lighter ahead of the front and deeper behind it." },
];

export const DISTORTION_WAVE_LIVE_OPTIONS: readonly DistortionWaveOption<DistortionWaveLiveMode>[] = [
	{ value: "on", label: "On change", description: "Re-picture the views after they change while the wave is out." },
	{ value: "animations", label: "Animations", description: "Also re-picture while CSS animations run. Costly." },
	{ value: "off", label: "Off", description: "Keep the first picture for the whole wave." },
];

export const DISTORTION_WAVE_REDUCED_MOTION_OPTIONS: readonly DistortionWaveOption<DistortionWaveReducedMotion>[] = [
	{ value: "system", label: "System", description: "Crossfade when the visitor prefers reduced motion." },
	{ value: "always", label: "Always fade", description: "Always crossfade instead of running the wave." },
	{ value: "never", label: "Never fade", description: "Always run the wave." },
];

/**
 * Ranges bracket the upstream per-type defaults (`defaultStyle(type)`).
 * Lengths are points of a 393 × 852 screen and scale with the element.
 */
export const DISTORTION_WAVE_STYLE_GROUPS: readonly DistortionWaveStyleGroup[] = [
	{
		title: "Timing",
		controls: [
			{ key: "anticipation", label: "Anticipation", min: 0, max: 2, step: 0.01, unit: "s" },
			{ key: "travel", label: "Travel", min: 0.5, max: 6, step: 0.01, unit: "s" },
			{ key: "returnSpeed", label: "Return speed", min: 0.25, max: 4, step: 0.05, unit: "×" },
			{ key: "pull", label: "Pull", min: 0, max: 80, step: 0.5, unit: "pt" },
			{ key: "inhale", label: "Inhale", min: 0, max: 150, step: 0.5, unit: "pt" },
			{ key: "gatherGlow", label: "Gather glow", min: 0, max: 1, step: 0.01 },
			{ key: "gatherDots", label: "Gather dots", min: 0, max: 1, step: 0.01 },
		],
	},
	{
		title: "Wave",
		controls: [
			{ key: "amplitude", label: "Amplitude", min: 0, max: 100, step: 0.5, unit: "pt" },
			{ key: "lensWidth", label: "Lens width", min: 20, max: 400, step: 1, unit: "pt" },
			{ key: "aberration", label: "Aberration", min: 0, max: 2, step: 0.01 },
			{ key: "swell", label: "Swell", min: 0, max: 60, step: 0.5, unit: "pt" },
			{ key: "blur", label: "Blur", min: 0, max: 60, step: 0.5, unit: "pt" },
			{ key: "blurAhead", label: "Blur ahead", min: 0, max: 300, step: 1, unit: "pt" },
			{ key: "blurBehind", label: "Blur behind", min: 0, max: 600, step: 1, unit: "pt" },
			{ key: "lead", label: "Lead", min: 0, max: 400, step: 1, unit: "pt" },
			{ key: "tail", label: "Tail", min: 0, max: 800, step: 1, unit: "pt" },
			{ key: "strength", label: "Strength", min: 0, max: 1, step: 0.01 },
			{ key: "orientation", label: "Lean to touch", min: 0, max: 1, step: 0.01 },
		],
	},
	{
		title: "Edges",
		controls: [
			{ key: "rimWidth", label: "Rim width", min: 0, max: 40, step: 0.5, unit: "pt" },
			{ key: "rimUnevenness", label: "Rim unevenness", min: 0, max: 2, step: 0.01 },
			{ key: "rimStrength", label: "Rim strength", min: 0, max: 1, step: 0.01 },
			{ key: "rimSoftness", label: "Rim softness", min: 0, max: 800, step: 1, unit: "pt" },
			{ key: "rimPulse", label: "Rim pulse", min: 0, max: 2, step: 0.01 },
			{ key: "rimFade", label: "Rim fade", min: 0, max: 6, step: 0.01, unit: "s" },
			{ key: "linger", label: "Linger", min: -1, max: 2, step: 0.01, unit: "s" },
			{ key: "hairlineWidth", label: "Hairline width", min: 0, max: 6, step: 0.1, unit: "pt" },
			{ key: "hairlineOpacity", label: "Hairline opacity", min: 0, max: 1, step: 0.01 },
			{ key: "hairlineWhite", label: "Hairline white", min: 0, max: 1, step: 0.01 },
			{ key: "hairlineLinger", label: "Hairline linger", min: 0, max: 3, step: 0.01, unit: "s" },
			{ key: "hairlineFade", label: "Hairline fade", min: 0, max: 8, step: 0.1, unit: "s" },
		],
	},
	{
		title: "Dots",
		controls: [
			{ key: "particleCount", label: "Count", min: 0, max: 200, step: 1 },
			{ key: "particleSize", label: "Size", min: 0.5, max: 6, step: 0.1, unit: "pt" },
			{ key: "particleReach", label: "Reach", min: 0, max: 400, step: 1, unit: "pt" },
			{ key: "particleFlight", label: "Flight", min: 0, max: 100, step: 0.5, unit: "pt" },
			{ key: "particleGap", label: "Gap", min: 0, max: 60, step: 0.5, unit: "pt" },
			{ key: "particleLife", label: "Life", min: 0.2, max: 6, step: 0.01, unit: "s" },
			{ key: "particleSpread", label: "Spread", min: 0, max: 2, step: 0.01 },
		],
	},
];

const STYLE_KEYS: readonly DistortionWaveStyleKey[] = DISTORTION_WAVE_STYLE_GROUPS.flatMap(
	(group) => group.controls.map((control) => control.key),
);

/** The upstream tuned numbers for a type, narrowed to the GUI's knobs. */
export function getDistortionWaveStyleDefaults(type: WaveType): DistortionWaveStyleValues {
	const style = defaultStyle(type);
	return Object.fromEntries(
		STYLE_KEYS.map((key) => [key, style[key]]),
	) as Record<DistortionWaveStyleKey, number>;
}

export const DEFAULT_DISTORTION_WAVE_CONFIG: DistortionWaveControlConfig = {
	type: "vertical",
	palette: "type",
	customColor: "#1868DB",
	scrubEnabled: false,
	scrub: 0.4,
	live: "on",
	reducedMotion: "system",
	style: getDistortionWaveStyleDefaults("vertical"),
};
