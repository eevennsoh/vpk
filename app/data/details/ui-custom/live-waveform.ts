import type { ComponentDetail } from "@/app/data/component-detail-types";

export const LIVE_WAVEFORM_DETAIL: ComponentDetail = {
	description: "Canvas-based microphone waveform that can animate from a live stream or show a processing state without requesting permissions.",
	usage: `import { LiveWaveform } from "@/components/ui-custom/live-waveform";

<LiveWaveform active height={80} mode="static" />
<LiveWaveform processing height={80} mode="scrolling" />`,
	props: [
		{ name: "active", type: "boolean", default: "false", description: "Starts microphone capture when true." },
		{ name: "processing", type: "boolean", default: "false", description: "Renders a synthetic waveform animation without opening the microphone." },
		{ name: "height", type: "string | number", default: "64", description: "Rendered waveform height." },
		{ name: "barCount", type: "number", description: "Optional fixed number of bars; otherwise the waveform derives the count from its rendered width." },
		{ name: "mode", type: '"scrolling" | "static"', default: '"static"', description: "Selects between centered or left-to-right animated rendering." },
		{ name: "className", type: "string", description: "Additional CSS classes." },
	],
	examples: [
		{ title: "Scrolling mode", demoSlug: "live-waveform-demo-scrolling", description: "Switches the interactive preview card into scrolling mode." },
	],
};
