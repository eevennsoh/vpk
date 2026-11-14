import type { ShaderLabEffectDefinition } from "../types";

export const FLUID_LAYER = {
	type: "fluid",
	kind: "source",
	label: "Fluid",
	description: "Shader Lab fluid source layer with WebGPU dye simulation, auto splats, curl, dissipation, pressure, radius, force, brightness, and color mode controls.",
	params: [
		{ key: "simRes", label: "Sim Resolution", type: "number", defaultValue: 192, min: 32, max: 512, step: 32, group: "Simulation" },
		{ key: "dyeRes", label: "Dye Resolution", type: "number", defaultValue: 1024, min: 128, max: 2048, step: 64, group: "Simulation" },
		{ key: "iterations", label: "Iterations", type: "number", defaultValue: 20, min: 1, max: 32, step: 1, group: "Simulation" },
		{ key: "densityDissipation", label: "Density Dissipation", type: "number", defaultValue: 4, min: 0, max: 8, step: 0.01, group: "Simulation" },
		{ key: "velocityDissipation", label: "Velocity Dissipation", type: "number", defaultValue: 0.2, min: 0, max: 4, step: 0.01, group: "Simulation" },
		{ key: "pressureDissipation", label: "Pressure Dissipation", type: "number", defaultValue: 0, min: 0, max: 1, step: 0.01, group: "Simulation" },
		{ key: "curlStrength", label: "Curl", type: "number", defaultValue: 30, min: 0, max: 80, step: 1, group: "Simulation" },
		{ key: "radius", label: "Radius", type: "number", defaultValue: 1, min: 0.05, max: 2, step: 0.01, group: "Interaction" },
		{ key: "splatForce", label: "Splat Force", type: "number", defaultValue: 6000, min: 500, max: 15000, step: 100, group: "Interaction" },
		{ key: "autoSplats", label: "Auto Splats", type: "boolean", defaultValue: true, group: "Interaction" },
		{ key: "brightness", label: "Brightness", type: "number", defaultValue: 1.6, min: 0.1, max: 4, step: 0.01, group: "Color" },
		{
			key: "colorMode",
			label: "Color Mode",
			type: "select",
			defaultValue: "monochrome",
			group: "Color",
			options: [
				{ label: "Monochrome", value: "monochrome" },
				{ label: "Duotone", value: "duotone" },
				{ label: "Source", value: "source" },
			],
		},
		{ key: "monoDark", label: "Mono Dark", type: "color", defaultValue: "#000000", group: "Color", visibleWhen: { equals: "monochrome", key: "colorMode" } },
		{ key: "monoLight", label: "Mono Light", type: "color", defaultValue: "#ffffff", group: "Color", visibleWhen: { equals: "monochrome", key: "colorMode" } },
		{ key: "duotoneDark", label: "Duotone Dark", type: "color", defaultValue: "#101010", group: "Color", visibleWhen: { equals: "duotone", key: "colorMode" } },
		{ key: "duotoneLight", label: "Duotone Light", type: "color", defaultValue: "#f3f3ef", group: "Color", visibleWhen: { equals: "duotone", key: "colorMode" } },
	],
} as const satisfies ShaderLabEffectDefinition;
