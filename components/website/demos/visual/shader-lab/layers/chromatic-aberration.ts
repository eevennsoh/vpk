import type { ShaderLabEffectDefinition } from "../types";

export const CHROMATIC_ABERRATION_LAYER = {
	"type": "chromatic-aberration",
	"label": "Chromatic Aberration",
	"description": "Shader Lab chromatic aberration pass with radial, horizontal, and vertical channel split modes.",
	"params": [
		{
			"key": "intensity",
			"label": "Intensity",
			"type": "number",
			"defaultValue": 5,
			"min": 0,
			"max": 50,
			"step": 0.5
		},
		{
			"key": "direction",
			"label": "Direction",
			"type": "select",
			"defaultValue": "radial",
			"options": [
				{
					"label": "Radial",
					"value": "radial"
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
				"key": "direction",
				"equals": "radial"
			}
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
				"key": "direction",
				"equals": "horizontal"
			}
		}
	]
} as const satisfies ShaderLabEffectDefinition;
