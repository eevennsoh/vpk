import {
	pixelDomeDefault,
	pixelGlowDefault,
	resolveVoiceDefaults,
	resolveVoiceStyle,
	themePresets,
	type VoiceBeamLook,
	type VoiceBeamProps,
	type VoiceGeometry,
	type UseMicrophoneResult,
} from "voice-glow";

const SURFACE_DEFAULTS = {
	dotSize: 1, dotGap: 1, lineWidth: 1, lineGap: 1, texture: 0.6, gravity: 1,
	surfaceHeight: 1, surfaceCurve: 1, surfaceTail: 0, surfaceTailPosition: 0.6,
	surfaceTailCurve: 2.4, surfaceFade: 0.2, tintAmount: 1,
} satisfies Partial<VoiceBeamProps>;

export type VoiceGlowNumbers = VoiceGeometry & {
	level: number; sensitivity: number; threshold: number; attack: number; release: number;
	breatheDuration: number; hueRange: number; hueDuration: number;
	brightness: number; saturation: number; strength: number; borderRadius: number;
	pixelGlow: number; pixelDome: number; pixelMagnet: number;
} & typeof SURFACE_DEFAULTS;
export type VoiceGlowConfig = Required<Pick<VoiceBeamProps,
	"type" | "look" | "theme" | "colorVariant" | "active" | "paused" | "bands" | "staticColors" | "dotShape" | "linePattern" | "seeThrough"
>> & Pick<VoiceBeamProps, "tint"> & Partial<VoiceGlowNumbers>;

export const VOICE_GLOW_DEFAULTS: VoiceGlowConfig = {
	type: "default", look: "glow", theme: "auto", colorVariant: "colorful",
	active: true, paused: false, bands: true, staticColors: false, level: 0.5,
	dotShape: "round", linePattern: "rows", seeThrough: false,
};
export const VOICE_GLOW_LOOKS = [
	{ value: "glow", label: "Glow", description: "Soft gradients and a luminous edge" },
	{ value: "dither", label: "Dither", description: "Color sampled onto small square pixels" },
	{ value: "mosaic", label: "Mosaic", description: "A grid of colorful glyphs" },
	{ value: "dots", label: "Dots", description: "A surface of dots that rises with speech" },
	{ value: "lines", label: "Lines", description: "A surface drawn with lines" },
] as const satisfies readonly { value: VoiceBeamLook; label: string; description: string }[];
export const VOICE_GLOW_TYPES = [
	{ value: "default", label: "Chat input" }, { value: "pill", label: "Recording pill" },
	{ value: "mobile", label: "Mobile screen" },
] as const;
export const VOICE_GLOW_PALETTES = [
	"colorful", "mono", "ocean", "sunset", "forest", "candy", "ice", "gold",
] as const;
export const VOICE_GLOW_THEMES = [
	{ value: "auto", label: "Follow page" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" },
] as const;

export function getVoiceGlowStatus(mic: Pick<UseMicrophoneResult, "state" | "error">, simulated: boolean): string {
	if ((mic.state === "denied" || mic.state === "error") && mic.error) return mic.error.message;
	if (mic.state === "live") return "Microphone active. Speak to drive the glow; manual intensity is ignored.";
	return simulated
		? "Simulated voice input. The glow rises and settles with speech-like bursts."
		: "Adjust manual intensity to preview the glow, or enable simulated voice.";
}

export function resolveVoiceGlowNumbers(config: VoiceGlowConfig, pageTheme: "dark" | "light"): VoiceGlowNumbers {
	const theme = config.theme === "auto" ? pageTheme : config.theme;
	const colors = themePresets[theme];
	const style = resolveVoiceStyle(config.type, theme);
	return {
		...resolveVoiceDefaults(config.type, theme, config.look),
		...SURFACE_DEFAULTS,
		pixelGlow: pixelGlowDefault(config.type, config.look),
		pixelDome: pixelDomeDefault(config.type),
		pixelMagnet: config.look === "mosaic" ? 0.4 : 0.7,
		level: 0.5, sensitivity: 3.1, threshold: 0.015, attack: 0.325, release: 0.86,
		breatheDuration: 5.2, borderRadius: 16,
		hueRange: colors.hueRange ?? 24, hueDuration: colors.hueDuration ?? 12,
		brightness: style.brightness ?? colors.brightness,
		saturation: style.saturation ?? colors.saturation,
		strength: style.strength ?? colors.strength ?? 1,
	};
}

type Control = readonly [keyof VoiceGlowNumbers, string, number, number, number, string?];
type ControlGroup = Readonly<{ title: string; looks?: readonly VoiceBeamLook[]; controls: readonly Control[] }>;
const COLOR_LOOKS = ["glow", "dither", "mosaic"] as const;
export const VOICE_GLOW_CONTROLS: readonly ControlGroup[] = [
	{ title: "Pixels", looks: ["dither", "mosaic"], controls: [
		["pixelSize", "Cell size", 0.3, 3, 0.05], ["pixelGlow", "Pixel halo", 0, 1, 0.01],
		["pixelDome", "Dome height", 0, 1, 0.01], ["pixelMagnet", "Pointer attraction", 0, 1, 0.01],
	] },
	{ title: "Dots", looks: ["dots"], controls: [
		["dotSize", "Dot size", 0.1, 3, 0.05], ["dotGap", "Dot spacing", 0.3, 3, 0.05],
	] },
	{ title: "Lines", looks: ["lines"], controls: [
		["lineWidth", "Line width", 0.05, 3, 0.05], ["lineGap", "Line spacing", 0.3, 3, 0.05],
	] },
	{ title: "Surface", looks: ["dots", "lines"], controls: [
		["texture", "Ripple", 0, 1, 0.01], ["gravity", "Gravity", 0.1, 3, 0.05],
		["surfaceHeight", "Surface height", 0.1, 3, 0.05], ["surfaceCurve", "Surface curve", -2, 3, 0.05],
		["surfaceTail", "Tail lift", -2, 2, 0.05], ["surfaceTailPosition", "Tail start", 0, 1, 0.01],
		["surfaceTailCurve", "Tail curve", 0.5, 6, 0.1], ["surfaceFade", "Edge fade", 0, 1, 0.01],
		["tintAmount", "Tint amount", 0, 1, 0.01],
	] },
	{ title: "Audio response", controls: [
		["level", "Manual intensity", 0, 1, 0.01], ["sensitivity", "Sensitivity", 0, 10, 0.1],
		["threshold", "Noise gate", 0, 1, 0.005], ["attack", "Attack", 0.01, 2, 0.01, "s"],
		["release", "Release", 0.01, 3, 0.01, "s"], ["idle", "Idle presence", 0, 1, 0.01],
		["breatheDuration", "Breathing period", 0.1, 20, 0.1, "s"],
	] },
	{ title: "Geometry", controls: [
		["scale", "Scale", 0.1, 3, 0.05], ["strength", "Strength", 0, 1, 0.01],
		["reach", "Reach", 0, 5, 0.05],
		["spread", "Spread", 0, 3, 0.05], ["flow", "Flow", -150, 150, 1, "px/s"],
		["glowWidth", "Lobe width", 0.1, 3, 0.05], ["lobeSpacing", "Lobe spacing", 0.1, 3, 0.05],
		["rangeWidth", "Range width", 0.1, 3, 0.05], ["rangeHeight", "Range height", 0.1, 3, 0.05],
	] },
	{ title: "Bloom", looks: COLOR_LOOKS, controls: [
		["glowHeight", "Lobe height", 0.1, 3, 0.05],
		["softness", "Softness", 0.1, 3, 0.05],
		["bloomScale", "Bloom scale", 0.1, 3, 0.05], ["bloomHeight", "Bloom height", 0.1, 3, 0.05],
	] },
	{ title: "Band", looks: COLOR_LOOKS, controls: [
		["bend", "Bend", 0, 150, 1, "px"], ["bandStrength", "Band strength", 0, 4, 0.05], ["bandWidth", "Band width", 0.1, 6, 0.05],
		["bandPosition", "Band position", 0.1, 1.3, 0.01], ["bandCurve", "Band curve", 0.1, 5, 0.05],
		["bandSpread", "Band spread", 0.1, 2, 0.01], ["bandSkew", "Band skew", -0.6, 0.6, 0.01],
		["bandOffset", "Band offset", -100, 100, 1, "px"], ["bandTail", "Tail lift", 0, 1, 0.01],
		["bandTailPosition", "Tail start", 0, 1, 0.01], ["bandTailCurve", "Tail curve", 0.1, 6, 0.1],
		["bandTailOverflow", "Tail overflow", 0, 50, 1, "px"], ["bandAberration", "Chromatic split", 0, 1, 0.01],
	] },
	{ title: "Color", looks: COLOR_LOOKS, controls: [
		["brightness", "Brightness", 0, 3, 0.05],
		["saturation", "Saturation", 0, 3, 0.05], ["hueRange", "Hue range", 0, 180, 1, "°"],
		["hueDuration", "Hue period", 0.1, 30, 0.1, "s"],
	] },
	{ title: "Light and distortion", looks: ["glow"], controls: [
		["glowSize", "Bloom blur", 0.1, 3, 0.05],
		["strokeOpacity", "Stroke opacity", 0, 3, 0.05], ["innerOpacity", "Inner opacity", 0, 3, 0.05],
		["bloomOpacity", "Bloom opacity", 0, 3, 0.05], ["distortion", "Distortion", 0, 1, 0.01],
		["distortionDetail", "Distortion detail", 0.1, 5, 0.1], ["coreSize", "Hotspot size", 0, 3, 0.05],
		["coreLight", "Core wash", 0, 3, 0.05], ["coreLightWidth", "Core width", 0.1, 3, 0.05],
		["coreLightHeight", "Core height", 0.1, 3, 0.05], ["strokeScale", "Stroke scale", 0.1, 3, 0.05],
		["innerScale", "Inner scale", 0.1, 3, 0.05], ["innerHeight", "Inner height", 0.1, 3, 0.05],
	] },
];
