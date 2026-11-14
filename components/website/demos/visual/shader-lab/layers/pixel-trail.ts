import type { ShaderLabEffectDefinition } from "../types";

export const PIXEL_TRAIL_LAYER = {
	type: "pixel-trail",
	kind: "source",
	label: "Pixel Trail",
	description: "Shader Lab pixel-trail source layer that samples the incoming image through a pointer-driven grid trail with cell size, radius, decay, displacement, and intensity controls.",
	params: [
		{ key: "cellSize", label: "Cell Size", type: "number", defaultValue: 24, min: 4, max: 128, step: 1, group: "Trail" },
		{ key: "radius", label: "Radius", type: "number", defaultValue: 0.04, min: 0.005, max: 0.3, step: 0.005, group: "Trail" },
		{ key: "decay", label: "Decay", type: "number", defaultValue: 0.9, min: 0.5, max: 0.999, step: 0.001, group: "Trail" },
		{ key: "displaceAmount", label: "Displace", type: "number", defaultValue: 0.02, min: 0, max: 0.2, step: 0.001, group: "Trail" },
		{ key: "intensity", label: "Intensity", type: "number", defaultValue: 1, min: 0, max: 2, step: 0.05, group: "Trail" },
	],
} as const satisfies ShaderLabEffectDefinition;
