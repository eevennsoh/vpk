import type { ShaderLabEffectDefinition } from "../types";

export const DIRECTIONAL_BLUR_LAYER = {
	"type": "directional-blur",
	"label": "Directional Blur",
	"description": "Shader Lab directional blur pass with linear and radial blur modes.",
	"params": [
		{
			"key": "mode",
			"label": "Mode",
			"type": "select",
			"defaultValue": "linear",
			"options": [
				{
					"label": "Linear",
					"value": "linear"
				},
				{
					"label": "Radial",
					"value": "radial"
				}
			]
		},
		{
			"key": "strength",
			"label": "Strength",
			"type": "number",
			"defaultValue": 18,
			"min": 0,
			"max": 96,
			"step": 0.5
		},
		{
			"key": "samples",
			"label": "Samples",
			"type": "number",
			"defaultValue": 8,
			"min": 1,
			"max": 16,
			"step": 1
		},
		{
			"key": "angle",
			"label": "Angle",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 360,
			"step": 1,
			"visibleWhen": {
				"key": "mode",
				"equals": "linear"
			}
		},
		{
			"key": "center",
			"label": "Center",
			"type": "vec2",
			"defaultValue": [
				0.5,
				0.5
			],
			"min": 0,
			"max": 1,
			"step": 0.01,
			"visibleWhen": {
				"key": "mode",
				"equals": "radial"
			}
		}
	]
} as const satisfies ShaderLabEffectDefinition;
