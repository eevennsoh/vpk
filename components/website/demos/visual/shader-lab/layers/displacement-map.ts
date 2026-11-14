import type { ShaderLabEffectDefinition } from "../types";

export const DISPLACEMENT_MAP_LAYER = {
	"type": "displacement-map",
	"label": "Displacement Map",
	"description": "Shader Lab displacement-map pass that offsets the source from luminance or color channels.",
	"params": [
		{
			"key": "strength",
			"label": "Strength",
			"type": "number",
			"defaultValue": 20,
			"min": 0,
			"max": 200,
			"step": 1
		},
		{
			"key": "direction",
			"label": "Direction",
			"type": "select",
			"defaultValue": "both",
			"options": [
				{
					"label": "Both",
					"value": "both"
				},
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
			"key": "channel",
			"label": "Channel",
			"type": "select",
			"defaultValue": "luminance",
			"options": [
				{
					"label": "Luminance",
					"value": "luminance"
				},
				{
					"label": "Red",
					"value": "red"
				},
				{
					"label": "Green",
					"value": "green"
				},
				{
					"label": "Blue",
					"value": "blue"
				}
			]
		},
		{
			"key": "midpoint",
			"label": "Midpoint",
			"type": "number",
			"defaultValue": 0.5,
			"min": 0,
			"max": 1,
			"step": 0.01
		}
	]
} as const satisfies ShaderLabEffectDefinition;
