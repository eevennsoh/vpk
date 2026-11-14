import type { ShaderLabEffectDefinition } from "../types";

export const PLOTTER_LAYER = {
	"type": "plotter",
	"label": "Plotter",
	"description": "Shader Lab plotter pass with hatching gap, stroke weight, threshold, wobble, crosshatch, paper, and ink controls.",
	"params": [
		{
			"key": "colorMode",
			"label": "Color",
			"type": "select",
			"defaultValue": "ink",
			"options": [
				{
					"label": "Ink",
					"value": "ink"
				},
				{
					"label": "Source",
					"value": "source"
				}
			]
		},
		{
			"key": "gap",
			"label": "Gap",
			"type": "number",
			"defaultValue": 12,
			"min": 10,
			"max": 120,
			"step": 1
		},
		{
			"key": "weight",
			"label": "Weight",
			"type": "number",
			"defaultValue": 1.5,
			"min": 0.5,
			"max": 5,
			"step": 0.1
		},
		{
			"key": "angle",
			"label": "Angle",
			"type": "number",
			"defaultValue": 90,
			"min": 0,
			"max": 180,
			"step": 1
		},
		{
			"key": "crosshatch",
			"label": "Crosshatch",
			"type": "boolean",
			"defaultValue": true
		},
		{
			"key": "crossAngle",
			"label": "Cross Angle",
			"type": "number",
			"defaultValue": 135,
			"min": 0,
			"max": 180,
			"step": 1,
			"visibleWhen": {
				"key": "crosshatch",
				"equals": true
			}
		},
		{
			"key": "threshold",
			"label": "Threshold",
			"type": "number",
			"defaultValue": 0.5,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "wobble",
			"label": "Wobble",
			"type": "number",
			"defaultValue": 0.3,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "paperColor",
			"label": "Paper Color",
			"type": "color",
			"defaultValue": "#f5f0e8"
		},
		{
			"key": "inkColor",
			"label": "Ink Color",
			"type": "color",
			"defaultValue": "#1a1a1a",
			"visibleWhen": {
				"key": "colorMode",
				"equals": "ink"
			}
		}
	]
} as const satisfies ShaderLabEffectDefinition;
