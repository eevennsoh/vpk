import type { ShaderLabEffectDefinition } from "../types";

export const PIXEL_SORTING_LAYER = {
	"type": "pixel-sorting",
	"label": "Pixel Sorting",
	"description": "Shader Lab pixel-sorting pass with threshold band, range, mode, direction, and reverse controls.",
	"params": [
		{
			"key": "threshold",
			"label": "Threshold",
			"type": "number",
			"defaultValue": 0.25,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "upperThreshold",
			"label": "Upper Threshold",
			"type": "number",
			"defaultValue": 1,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "direction",
			"label": "Direction",
			"type": "select",
			"defaultValue": "horizontal",
			"options": [
				{
					"label": "Horizontal",
					"value": "horizontal"
				},
				{
					"label": "Vertical",
					"value": "vertical"
				}
			]
		},
		{
			"key": "mode",
			"label": "Mode",
			"type": "select",
			"defaultValue": "luma",
			"options": [
				{
					"label": "Luma",
					"value": "luma"
				},
				{
					"label": "Hue",
					"value": "hue"
				},
				{
					"label": "Saturation",
					"value": "saturation"
				}
			]
		},
		{
			"key": "reverse",
			"label": "Reverse",
			"type": "boolean",
			"defaultValue": false
		},
		{
			"key": "range",
			"label": "Range",
			"type": "number",
			"defaultValue": 0.3,
			"min": 0,
			"max": 1,
			"step": 0.01
		}
	]
} as const satisfies ShaderLabEffectDefinition;
