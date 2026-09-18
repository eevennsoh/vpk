import {
	resolveVoiceDefaults,
	resolveVoiceStyle,
	themePresets,
	type VoiceBeamProps,
	type VoiceGeometry,
} from "voice-glow";

export type VoiceGlowNumbers = VoiceGeometry & {
	level: number; sensitivity: number; threshold: number; attack: number; release: number;
	breatheDuration: number; processingEase: number; hueRange: number; hueDuration: number;
	brightness: number; saturation: number; strength: number; borderRadius: number;
};
export type VoiceGlowConfig = Required<Pick<VoiceBeamProps,
	"type" | "theme" | "colorVariant" | "active" | "paused" | "processing" | "bands" | "staticColors"
>> & Partial<VoiceGlowNumbers>;

export const VOICE_GLOW_DEFAULTS: VoiceGlowConfig = {
	type: "default", theme: "auto", colorVariant: "colorful",
	active: true, paused: false, processing: false, bands: true, staticColors: false, level: 0.5,
};
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

export function resolveVoiceGlowNumbers(config: VoiceGlowConfig, pageTheme: "dark" | "light"): VoiceGlowNumbers {
	const theme = config.theme === "auto" ? pageTheme : config.theme;
	const colors = themePresets[theme];
	const style = resolveVoiceStyle(config.type, theme);
	return {
		...resolveVoiceDefaults(config.type, theme),
		level: 0.5, sensitivity: 3.1, threshold: 0.015, attack: 0.325, release: 0.86,
		breatheDuration: 5.2, processingEase: 0.6, borderRadius: 16,
		hueRange: colors.hueRange ?? 24, hueDuration: colors.hueDuration ?? 12,
		brightness: style.brightness ?? colors.brightness,
		saturation: style.saturation ?? colors.saturation,
		strength: style.strength ?? colors.strength ?? 1,
	};
}

type Control = readonly [keyof VoiceGlowNumbers, string, number, number, number, string?];
export const VOICE_GLOW_CONTROLS = [
	{ title: "Audio response", controls: [
		["level", "Manual intensity", 0, 1, 0.01], ["sensitivity", "Sensitivity", 0, 10, 0.1],
		["threshold", "Noise gate", 0, 1, 0.005], ["attack", "Attack", 0.01, 2, 0.01, "s"],
		["release", "Release", 0.01, 3, 0.01, "s"], ["idle", "Idle presence", 0, 1, 0.01],
		["breatheDuration", "Breathing period", 0.1, 20, 0.1, "s"],
	] },
	{ title: "Processing", controls: [
		["processingDuration", "Pass duration", 0.05, 5, 0.05, "s"],
		["processingLevel", "Processing intensity", 0, 1, 0.01],
		["processingEase", "Morph duration", 0.05, 2, 0.05, "s"],
		["processingTravel", "Travel", 0, 4, 0.05], ["processingCurve", "Turn easing", 1, 6, 0.1],
		["cornerFollow", "Follow corners", 0, 1, 0.01],
	] },
	{ title: "Geometry", controls: [
		["scale", "Scale", 0.1, 3, 0.05], ["reach", "Reach", 0, 5, 0.05],
		["spread", "Spread", 0, 3, 0.05], ["flow", "Flow", -150, 150, 1, "px/s"],
		["bend", "Bend", 0, 150, 1, "px"], ["glowWidth", "Lobe width", 0.1, 3, 0.05],
		["glowHeight", "Lobe height", 0.1, 3, 0.05], ["lobeSpacing", "Lobe spacing", 0.1, 3, 0.05],
		["rangeWidth", "Range width", 0.1, 3, 0.05], ["rangeHeight", "Range height", 0.1, 3, 0.05],
		["softness", "Softness", 0.1, 3, 0.05],
	] },
	{ title: "Band", controls: [
		["bandStrength", "Band strength", 0, 3, 0.05], ["bandWidth", "Band width", 0.1, 6, 0.05],
		["bandPosition", "Band position", 0.1, 1.3, 0.01], ["bandCurve", "Band curve", 0.1, 5, 0.05],
		["bandSpread", "Band spread", 0.1, 2, 0.01], ["bandSkew", "Band skew", -0.6, 0.6, 0.01],
		["bandOffset", "Band offset", -100, 100, 1, "px"], ["bandTail", "Tail lift", 0, 1, 0.01],
		["bandTailPosition", "Tail start", 0, 1, 0.01], ["bandTailCurve", "Tail curve", 0.1, 6, 0.1],
		["bandTailOverflow", "Tail overflow", 0, 50, 1, "px"], ["bandAberration", "Chromatic split", 0, 1, 0.01],
	] },
	{ title: "Light and distortion", controls: [
		["brightness", "Brightness", 0, 3, 0.05], ["saturation", "Saturation", 0, 3, 0.05],
		["strength", "Strength", 0, 1, 0.01], ["hueRange", "Hue range", 0, 180, 1, "°"],
		["hueDuration", "Hue period", 0.1, 30, 0.1, "s"], ["glowSize", "Bloom blur", 0.1, 3, 0.05],
		["strokeOpacity", "Stroke opacity", 0, 3, 0.05], ["innerOpacity", "Inner opacity", 0, 3, 0.05],
		["bloomOpacity", "Bloom opacity", 0, 3, 0.05], ["distortion", "Distortion", 0, 1, 0.01],
		["distortionDetail", "Distortion detail", 0.1, 5, 0.1], ["coreSize", "Hotspot size", 0, 3, 0.05],
		["coreLight", "Core wash", 0, 3, 0.05], ["coreLightWidth", "Core width", 0.1, 3, 0.05],
		["coreLightHeight", "Core height", 0.1, 3, 0.05], ["strokeScale", "Stroke scale", 0.1, 3, 0.05],
		["innerScale", "Inner scale", 0.1, 3, 0.05], ["innerHeight", "Inner height", 0.1, 3, 0.05],
		["bloomScale", "Bloom scale", 0.1, 3, 0.05], ["bloomHeight", "Bloom height", 0.1, 3, 0.05],
	] },
] as const satisfies readonly { title: string; controls: readonly Control[] }[];
