import type { ComponentDetail } from "@/app/data/component-detail-types";
import { resolveVoiceGlowNumbers, VOICE_GLOW_CONTROLS, VOICE_GLOW_DEFAULTS, VOICE_GLOW_LOOKS } from "@/components/visual/voice-glow/data";

const defaults = resolveVoiceGlowNumbers(VOICE_GLOW_DEFAULTS, "dark");

export const VOICE_GLOW_DETAIL: ComponentDetail = {
	apiName: "VoiceGlow",
	description: "A sound-reactive effect along the bottom edge of a chat input, recording pill, or mobile screen. Choose Glow, Dither, Mosaic, Dots, or Lines and tune the selected look. The demo simulates speech by default and can also use manual intensity or your microphone.",
	importStatement: `import VoiceGlow, { useMicrophone, type VoiceGlowProps } from "@/components/visual/voice-glow";`,
	usage: `const mic = useMicrophone();

<VoiceGlow look="dither" stream={mic.stream} level={0.5}>
	<div className="h-28 w-80 rounded-2xl bg-surface-raised" />
</VoiceGlow>
<Button onClick={mic.state === "live" ? mic.stop : () => void mic.start()}>
	{mic.state === "live" ? "Stop microphone" : "Use microphone"}
</Button>`,
	demoLayout: { previewContentWidth: "full", previewHeight: "fit", examplesContentWidth: "full" },
	adsLinks: [
		{ label: "Voice Glow documentation", url: "https://libraries.dev/voice" },
		{ label: "voice-glow on npm", url: "https://www.npmjs.com/package/voice-glow" },
		{ label: "Upstream source (0.4.0)", url: "https://github.com/Jakubantalik/Libraries.dev/tree/f14340a2ad05ad6e81d8d8f319a68ca8a907d480/packages/voice-glow" },
	],
	examples: [
		{ title: "Recording pill", description: "Compact 150 × 44 pill with the upstream pill geometry.", demoSlug: "voice-glow-pill" },
		{ title: "Mobile screen", description: "A taller host with the mobile preset’s wider, rising glow.", demoSlug: "voice-glow-mobile" },
	],
	props: [
		{ name: "children", type: "React.ReactNode", required: true, description: "Wrapped host element; the first child’s radius is detected automatically." },
		{ name: "type", type: '"default" | "pill" | "mobile"', default: '"default"', description: "Geometry preset. Explicit numeric props override the preset." },
		{ name: "look", type: VOICE_GLOW_LOOKS.map(({ value }) => JSON.stringify(value)).join(" | "), default: '"glow"', description: "Rendering style. Combine any look with any host geometry." },
		{ name: "stream", type: "MediaStream | null", description: "Audio source; takes priority over manual level. Audio is analyzed locally and never played back by the effect." },
		{ name: "level", type: "number | (() => number)", default: "0", description: "Manual intensity from 0 to 1. A getter is sampled without rendering React every frame." },
		{ name: "theme", type: '"dark" | "light" | "auto"', default: '"dark"', description: "Upstream auto follows the OS. The catalog’s Follow page mode resolves to the active VPK theme." },
		{ name: "colorVariant", type: '"colorful" | "mono" | "ocean" | "sunset" | "forest" | "candy" | "ice" | "gold"', default: '"colorful"', description: "Bundled palette for Glow, Dither, and Mosaic. Use tint for Dots and Lines." },
		{ name: "colors", type: "string[]", description: "Up to seven hex/rgb lobe colors, center first, then pairs outward. Missing slots retain the palette." },
		{ name: "bandColors", type: "{ core?: string; above?: string; mid?: string; below?: string }", description: "Hex/rgb overrides for the band’s ridge and fringes." },
		...(["active", "paused", "bands", "staticColors"] as const).map((name) => ({
			name, type: "boolean", default: String(VOICE_GLOW_DEFAULTS[name]),
			description: {
				active: "Enable the effect; false fades it out and stops analysis.",
				paused: "Freeze the last frame and audio analysis; resume preserves the clocks.",
				bands: "Drive lobes separately from low, mid, and high frequencies.",
				staticColors: "Stop hue drift while keeping audio response.",
			}[name],
		})),
		...VOICE_GLOW_CONTROLS.flatMap(({ controls, looks }) => {
			const lookDefaults = looks ? resolveVoiceGlowNumbers({ ...VOICE_GLOW_DEFAULTS, look: looks[0] }, "dark") : defaults;
			return controls.filter(([key]) => key !== "level").map(([key, label, , , , ...units]) => ({
				name: key, type: "number", default: String(lookDefaults[key]),
				description: `${label}${units[0] ? ` (${units[0]})` : ""}.${looks ? ` Applies to ${looks.join(", ")}.` : ""} The default may vary by look, shape, or theme.`,
			}));
		}),
		{ name: "dotShape", type: '"round" | "square"', default: '"round"', description: "Shape of each mark in Dots." },
		{ name: "linePattern", type: '"rows" | "columns" | "grid"', default: '"rows"', description: "Which direction Lines draw across the surface." },
		{ name: "seeThrough", type: "boolean", default: "false", description: "Draw Lines behind a raised ridge to create a wireframe." },
		{ name: "tint", type: "string", description: "Hex or RGB ink color for Dots and Lines." },
		{ name: "pixelDust", type: "number", default: "1.1", description: "How long the trail of particles lingers in Dither and Mosaic when a beam is driven with motion. Defaults to 1.5 seconds on mobile." },
		{ name: "pixelExitTarget", type: "HTMLElement | null", description: "Element that Dither and Mosaic pixels can fly to or from as active changes. Respects reduced motion." },
		{ name: "borderRadius", type: "number", description: "Explicit corner radius in pixels, overriding child auto-detection." },
		{ name: "motion", type: "VoiceBeamMotion | (() => VoiceBeamMotion | null | undefined)", description: "Control the glow’s gather, offset, stretch, held level, and corner following. A getter is sampled without rendering React every frame." },
		{ name: "onLevel", type: "(level: number) => void", description: "Smoothed intensity every frame. Keep transient meter values outside React state." },
		{ name: "onActivate / onDeactivate", type: "() => void", description: "Callbacks when the respective fade completes." },
		{ name: "css", type: "string", description: "Upstream advanced CSS hook; {id} is replaced per instance. Available through the adapter, outside the demo controls." },
		{ name: "className / style / ref", type: "string / React.CSSProperties / React.Ref<HTMLDivElement>", description: "Standard wrapper customization and element reference." },
	],
};
