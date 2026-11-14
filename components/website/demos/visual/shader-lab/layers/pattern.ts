import type { ShaderLabEffectDefinition } from "../types";

export const PATTERN_LAYER = {
	"type": "pattern",
	"label": "Pattern",
	"description": "Shader Lab pattern pass with atlas presets, color modes, inversion, custom palettes, and bloom controls.",
	"params": [
		{
			"key": "cellSize",
			"label": "Cell Size",
			"type": "number",
			"defaultValue": 12,
			"min": 4,
			"max": 48,
			"step": 1
		},
		{
			"key": "preset",
			"label": "Preset",
			"type": "select",
			"defaultValue": "bars",
			"options": [
				{
					"label": "Bars",
					"value": "bars"
				},
				{
					"label": "Candles",
					"value": "candles"
				},
				{
					"label": "Shapes",
					"value": "shapes"
				}
			]
		},
		{
			"key": "colorMode",
			"label": "Color Mode",
			"type": "select",
			"defaultValue": "source",
			"options": [
				{
					"label": "Source",
					"value": "source"
				},
				{
					"label": "Quantized",
					"value": "quantized"
				},
				{
					"label": "Monochrome",
					"value": "monochrome"
				},
				{
					"label": "Custom",
					"value": "custom"
				}
			]
		},
		{
			"key": "monoColor",
			"label": "Tint",
			"type": "color",
			"defaultValue": "#f5f5f0",
			"visibleWhen": {
				"equals": "monochrome",
				"key": "colorMode"
			}
		},
		{
			"key": "bgOpacity",
			"label": "Background",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"visibleWhen": {
				"equals": "source",
				"key": "colorMode"
			}
		},
		{
			"key": "invert",
			"label": "Invert",
			"type": "boolean",
			"defaultValue": false
		},
		{
			"key": "customColorCount",
			"label": "Color Count",
			"type": "number",
			"defaultValue": 4,
			"min": 2,
			"max": 4,
			"step": 1,
			"description": "Palette is distributed evenly across luminance bands.",
			"visibleWhen": {
				"equals": "custom",
				"key": "colorMode"
			}
		},
		{
			"key": "customLuminanceBias",
			"label": "Luminance Bias",
			"type": "number",
			"defaultValue": 0,
			"min": -1,
			"max": 1,
			"step": 0.01,
			"description": "Shifts palette mapping toward shadows or highlights.",
			"visibleWhen": {
				"equals": "custom",
				"key": "colorMode"
			}
		},
		{
			"key": "customBgColor",
			"label": "Background",
			"type": "color",
			"defaultValue": "#F5F5F0",
			"visibleWhen": {
				"equals": "custom",
				"key": "colorMode"
			}
		},
		{
			"key": "customColor1",
			"label": "Shadows",
			"type": "color",
			"defaultValue": "#0d1014",
			"visibleWhen": {
				"equals": "custom",
				"key": "colorMode"
			}
		},
		{
			"key": "customColor2",
			"label": "Midtones / Highlights",
			"type": "color",
			"defaultValue": "#4d5057",
			"visibleWhen": {
				"equals": "custom",
				"key": "colorMode"
			}
		},
		{
			"key": "customColor3",
			"label": "High Mids",
			"type": "color",
			"defaultValue": "#969aa2",
			"visibleWhen": {
				"gte": 3,
				"key": "customColorCount"
			}
		},
		{
			"key": "customColor4",
			"label": "Highlights",
			"type": "color",
			"defaultValue": "#e1e2de",
			"visibleWhen": {
				"gte": 4,
				"key": "customColorCount"
			}
		},
		{
			"key": "bloomEnabled",
			"label": "Bloom",
			"type": "boolean",
			"defaultValue": false,
			"group": "Bloom"
		},
		{
			"key": "bloomIntensity",
			"label": "Intensity",
			"type": "number",
			"defaultValue": 1.25,
			"min": 0,
			"max": 8,
			"step": 0.01,
			"group": "Bloom",
			"visibleWhen": {
				"equals": true,
				"key": "bloomEnabled"
			}
		},
		{
			"key": "bloomThreshold",
			"label": "Threshold",
			"type": "number",
			"defaultValue": 0.6,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Bloom",
			"visibleWhen": {
				"equals": true,
				"key": "bloomEnabled"
			}
		},
		{
			"key": "bloomRadius",
			"label": "Radius",
			"type": "number",
			"defaultValue": 6,
			"min": 0,
			"max": 24,
			"step": 0.25,
			"group": "Bloom",
			"visibleWhen": {
				"equals": true,
				"key": "bloomEnabled"
			}
		},
		{
			"key": "bloomSoftness",
			"label": "Softness",
			"type": "number",
			"defaultValue": 0.35,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Bloom",
			"visibleWhen": {
				"equals": true,
				"key": "bloomEnabled"
			}
		}
	]
} as const satisfies ShaderLabEffectDefinition;
