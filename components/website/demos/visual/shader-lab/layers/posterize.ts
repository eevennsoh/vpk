import type { ShaderLabEffectDefinition } from "../types";

export const POSTERIZE_LAYER = {
	"type": "posterize",
	"label": "Posterize",
	"description": "Shader Lab posterize pass with levels, gamma, and channel/luminance mode controls.",
	"params": [
		{
			"key": "levels",
			"label": "Levels",
			"type": "number",
			"defaultValue": 5,
			"min": 2,
			"max": 16,
			"step": 1
		},
		{
			"key": "gamma",
			"label": "Gamma",
			"type": "number",
			"defaultValue": 1,
			"min": 0.4,
			"max": 2.5,
			"step": 0.01
		},
		{
			"key": "mode",
			"label": "Mode",
			"type": "select",
			"defaultValue": "rgb",
			"options": [
				{
					"label": "RGB",
					"value": "rgb"
				},
				{
					"label": "Luma",
					"value": "luma"
				}
			]
		}
	]
} as const satisfies ShaderLabEffectDefinition;
