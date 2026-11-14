import type { ShaderLabEffectDefinition } from "../types";

export const FLUTED_GLASS_LAYER = {
	"type": "fluted-glass",
	"label": "Fluted Glass",
	"description": "Shader Lab fluted-glass refraction pass with preset, frequency, amplitude, warp, irregularity, and angle controls.",
	"params": [
		{
			"key": "preset",
			"label": "Preset",
			"type": "select",
			"defaultValue": "architectural",
			"options": [
				{
					"label": "Architectural",
					"value": "architectural"
				},
				{
					"label": "Painterly",
					"value": "painterly"
				}
			]
		},
		{
			"key": "frequency",
			"label": "Frequency",
			"type": "number",
			"defaultValue": 20,
			"min": 2,
			"max": 100,
			"step": 1
		},
		{
			"key": "amplitude",
			"label": "Amplitude",
			"type": "number",
			"defaultValue": 0.02,
			"min": 0,
			"max": 0.1,
			"step": 0.001
		},
		{
			"key": "warp",
			"label": "Warp",
			"type": "number",
			"defaultValue": 0.28,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "irregularity",
			"label": "Irregularity",
			"type": "number",
			"defaultValue": 0.35,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "angle",
			"label": "Angle",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 360,
			"step": 1
		}
	]
} as const satisfies ShaderLabEffectDefinition;
