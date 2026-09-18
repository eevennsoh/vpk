import type { ComponentDetail } from "@/app/data/component-detail-types";
import { resolveVoiceGlowNumbers, VOICE_GLOW_CONTROLS, VOICE_GLOW_DEFAULTS } from "@/components/visual/voice-glow/data";

const defaults = resolveVoiceGlowNumbers(VOICE_GLOW_DEFAULTS, "dark");

export const VOICE_GLOW_DETAIL: ComponentDetail = {
	apiName: "VoiceGlow",
	description: "Sound-reactive glow from Jakub Antalik’s MIT-licensed voice-glow package. A centered beam rises and blooms with voice intensity along a wrapped element’s bottom edge. The demo simulates speech by default; switch to manual intensity or your microphone, or a traveling beam while processing. Supports chat inputs, recording pills, mobile screens, eight palettes, and custom lobe and band colors.",
	importStatement: `import VoiceGlow, { useMicrophone, type VoiceGlowProps } from "@/components/visual/voice-glow";`,
	usage: `const mic = useMicrophone();

<VoiceGlow stream={mic.stream} level={0.5} processing={false}>
	<div className="h-28 w-80 rounded-2xl bg-surface-raised" />
</VoiceGlow>
<Button onClick={mic.state === "live" ? mic.stop : () => void mic.start()}>
	{mic.state === "live" ? "Stop microphone" : "Use microphone"}
</Button>`,
	demoLayout: { previewContentWidth: "full", previewHeight: "fit", examplesContentWidth: "full" },
	adsLinks: [
		{ label: "Voice Glow documentation", url: "https://libraries.dev/voice" },
		{ label: "voice-glow on npm", url: "https://www.npmjs.com/package/voice-glow" },
		{ label: "Upstream source", url: "https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/voice-glow" },
	],
	examples: [
		{ title: "Recording pill", description: "Compact 150 × 44 pill with the upstream pill geometry.", demoSlug: "voice-glow-pill" },
		{ title: "Mobile screen", description: "A taller host with the mobile preset’s wider, rising glow.", demoSlug: "voice-glow-mobile" },
		{ title: "Processing", description: "Gather the glow into a compact beam that travels while work is in progress.", demoSlug: "voice-glow-processing" },
	],
	props: [
		{ name: "children", type: "React.ReactNode", required: true, description: "Wrapped host element; the first child’s radius is detected automatically." },
		{ name: "type", type: '"default" | "pill" | "mobile"', default: '"default"', description: "Geometry preset. Explicit numeric props override the preset." },
		{ name: "stream", type: "MediaStream | null", description: "Audio source; takes priority over manual level. Audio is analyzed locally and never played back by the effect." },
		{ name: "level", type: "number | (() => number)", default: "0", description: "Manual intensity from 0 to 1. A getter is sampled without rendering React every frame." },
		{ name: "theme", type: '"dark" | "light" | "auto"', default: '"dark"', description: "Upstream auto follows the OS. The catalog’s Follow page mode resolves to the active VPK theme." },
		{ name: "colorVariant", type: '"colorful" | "mono" | "ocean" | "sunset" | "forest" | "candy" | "ice" | "gold"', default: '"colorful"', description: "Bundled palette." },
		{ name: "colors", type: "string[]", description: "Up to seven hex/rgb lobe colors, center first, then pairs outward. Missing slots retain the palette." },
		{ name: "bandColors", type: "{ core?: string; above?: string; mid?: string; below?: string }", description: "Hex/rgb overrides for the band’s ridge and fringes." },
		...(["active", "paused", "processing", "bands", "staticColors"] as const).map((name) => ({
			name, type: "boolean", default: String(VOICE_GLOW_DEFAULTS[name]),
			description: {
				active: "Enable the effect; false fades it out and stops analysis.",
				paused: "Freeze the last frame and audio analysis; resume preserves the clocks.",
				processing: "Gather the glow into a traveling processing beam.",
				bands: "Drive lobes separately from low, mid, and high frequencies.",
				staticColors: "Stop hue drift while keeping audio response.",
			}[name],
		})),
		...VOICE_GLOW_CONTROLS.flatMap(({ controls }) => controls.filter(([key]) => key !== "level").map(([key, label, , , , ...units]) => ({
			name: key, type: "number", default: String(defaults[key]),
			description: `${label}${units[0] ? ` (${units[0]})` : ""}. Default shown for the dark chat-input preset; shape and theme may retune it.`,
		}))),
		{ name: "borderRadius", type: "number", description: "Explicit corner radius in pixels, overriding child auto-detection." },
		{ name: "onLevel", type: "(level: number) => void", description: "Smoothed intensity every frame. Keep transient meter values outside React state." },
		{ name: "onActivate / onDeactivate", type: "() => void", description: "Callbacks when the respective fade completes." },
		{ name: "css", type: "string", description: "Upstream advanced CSS hook; {id} is replaced per instance. Available through the adapter, outside the demo controls." },
		{ name: "className / style / ref", type: "string / React.CSSProperties / React.Ref<HTMLDivElement>", description: "Standard wrapper customization and element reference." },
	],
};
