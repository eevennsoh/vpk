import type { ShaderLabEffectDefinition } from "../types";

export const EDGE_DETECT_LAYER = {
	"type": "edge-detect",
	"label": "Edge Detect",
	"description": "Shader Lab edge-detect pass with threshold, strength, invert, and mono/source color modes.",
	"params": [
		{
			"key": "threshold",
			"label": "Threshold",
			"type": "number",
			"defaultValue": 0.1,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "strength",
			"label": "Strength",
			"type": "number",
			"defaultValue": 1,
			"min": 0.1,
			"max": 5,
			"step": 0.1
		},
		{
			"key": "invert",
			"label": "Invert",
			"type": "boolean",
			"defaultValue": false
		},
		{
			"key": "colorMode",
			"label": "Color",
			"type": "select",
			"defaultValue": "overlay",
			"options": [
				{
					"label": "Overlay",
					"value": "overlay"
				},
				{
					"label": "Mono",
					"value": "mono"
				},
				{
					"label": "Source",
					"value": "source"
				}
			]
		},
		{
			"key": "lineColor",
			"label": "Line Color",
			"type": "color",
			"defaultValue": "#ffffff",
			"visibleWhen": {
				"key": "colorMode",
				"equals": "mono"
			}
		},
		{
			"key": "bgColor",
			"label": "Background",
			"type": "color",
			"defaultValue": "#000000",
			"visibleWhen": {
				"key": "colorMode",
				"equals": "mono"
			}
		}
	]
} as const satisfies ShaderLabEffectDefinition;
