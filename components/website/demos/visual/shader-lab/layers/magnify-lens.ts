import type { ShaderLabEffectDefinition } from "../types";

export const MAGNIFY_LENS_LAYER = {
	type: "magnify-lens",
	kind: "source",
	label: "Magnify Lens",
	description: "Shader Lab magnify-lens source layer that tracks pointer position over the incoming image with radius, softness, zoom, chromatic edge, and follow-lag controls.",
	params: [
		{ key: "radius", label: "Radius", type: "number", defaultValue: 0.18, min: 0.02, max: 0.5, step: 0.005, group: "Lens" },
		{ key: "softness", label: "Softness", type: "number", defaultValue: 0.4, min: 0, max: 1, step: 0.01, group: "Lens" },
		{ key: "zoom", label: "Zoom", type: "number", defaultValue: 1.8, min: 1, max: 4, step: 0.05, group: "Lens" },
		{ key: "chromaStrength", label: "Chromatic Edge", type: "number", defaultValue: 0.012, min: 0, max: 0.05, step: 0.001, group: "Lens" },
		{ key: "followLag", label: "Follow Lag", type: "number", defaultValue: 0.2, min: 0, max: 0.95, step: 0.01, group: "Lens" },
	],
} as const satisfies ShaderLabEffectDefinition;
