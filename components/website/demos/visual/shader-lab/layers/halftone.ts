import type { ShaderLabEffectDefinition } from "../types";

export const HALFTONE_LAYER = {
	"type": "halftone",
	"label": "Halftone",
	"description": "Shader Lab halftone pass with monochrome, duotone, custom, and CMYK print controls.",
	"params": [
		{
			"key": "colorMode",
			"label": "Color Mode",
			"type": "select",
			"defaultValue": "cmyk",
			"options": [
				{
					"label": "Source",
					"value": "source"
				},
				{
					"label": "Monochrome",
					"value": "monochrome"
				},
				{
					"label": "Duotone",
					"value": "duotone"
				},
				{
					"label": "Custom",
					"value": "custom"
				},
				{
					"label": "CMYK",
					"value": "cmyk"
				}
			]
		},
		{
			"key": "shape",
			"label": "Shape",
			"type": "select",
			"defaultValue": "circle",
			"options": [
				{
					"label": "Circle",
					"value": "circle"
				},
				{
					"label": "Square",
					"value": "square"
				},
				{
					"label": "Diamond",
					"value": "diamond"
				},
				{
					"label": "Line",
					"value": "line"
				}
			]
		},
		{
			"key": "spacing",
			"label": "Spacing",
			"type": "number",
			"defaultValue": 5,
			"min": 2,
			"max": 48,
			"step": 1
		},
		{
			"key": "dotSize",
			"label": "Dot Size",
			"type": "number",
			"defaultValue": 1,
			"min": 0.1,
			"max": 3,
			"step": 0.01
		},
		{
			"key": "dotMin",
			"label": "Dot Min",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 0.5,
			"step": 0.01
		},
		{
			"key": "angle",
			"label": "Angle",
			"type": "number",
			"defaultValue": 28,
			"min": 0,
			"max": 360,
			"step": 1
		},
		{
			"key": "contrast",
			"label": "Contrast",
			"type": "number",
			"defaultValue": 1,
			"min": 0,
			"max": 2,
			"step": 0.01
		},
		{
			"key": "softness",
			"label": "Softness",
			"type": "number",
			"defaultValue": 0.25,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "dotGain",
			"label": "Dot Gain",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"description": "Simulates ink bleeding into paper fibers"
		},
		{
			"key": "dotMorph",
			"label": "Dot Morph",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"description": "Blends dot shape based on tonal value (circles → squares in midtones)"
		},
		{
			"key": "invertLuma",
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
			"key": "bloomEnabled",
			"label": "Bloom",
			"type": "boolean",
			"defaultValue": false,
			"group": "Bloom",
			"visibleWhen": {
				"equals": "custom",
				"key": "colorMode"
			}
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
			"key": "ink",
			"label": "Ink",
			"type": "color",
			"defaultValue": "#0d1014",
			"visibleWhen": {
				"equals": "monochrome",
				"key": "colorMode"
			}
		},
		{
			"key": "duotoneLight",
			"label": "Light Color",
			"type": "color",
			"defaultValue": "#F5F5F0",
			"visibleWhen": {
				"equals": "duotone",
				"key": "colorMode"
			}
		},
		{
			"key": "duotoneDark",
			"label": "Dark Color",
			"type": "color",
			"defaultValue": "#1d1d1c",
			"visibleWhen": {
				"equals": "duotone",
				"key": "colorMode"
			}
		},
		{
			"key": "preset",
			"label": "Ink Preset",
			"type": "select",
			"defaultValue": "process",
			"options": [
				{
					"label": "Process CMYK",
					"value": "process"
				},
				{
					"label": "Risograph",
					"value": "risograph"
				},
				{
					"label": "Newspaper",
					"value": "newspaper"
				},
				{
					"label": "Vintage",
					"value": "vintage"
				},
				{
					"label": "Custom",
					"value": "custom"
				}
			],
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "gcr",
			"label": "Black Generation",
			"type": "number",
			"defaultValue": 0.5,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"description": "Controls how much goes to the K plate vs C+M+Y",
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "cmykBlend",
			"label": "CMYK Blend",
			"type": "select",
			"defaultValue": "subtractive",
			"options": [
				{
					"label": "Subtractive",
					"value": "subtractive"
				},
				{
					"label": "Overprint",
					"value": "overprint"
				}
			],
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "cyanAngle",
			"label": "Cyan Angle",
			"type": "number",
			"defaultValue": 15,
			"min": 0,
			"max": 90,
			"step": 1,
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "magentaAngle",
			"label": "Magenta Angle",
			"type": "number",
			"defaultValue": 75,
			"min": 0,
			"max": 90,
			"step": 1,
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "yellowAngle",
			"label": "Yellow Angle",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 90,
			"step": 1,
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "keyAngle",
			"label": "Key Angle",
			"type": "number",
			"defaultValue": 45,
			"min": 0,
			"max": 90,
			"step": 1,
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "paperColor",
			"label": "Paper Color",
			"type": "color",
			"defaultValue": "#F5F5F0",
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "paperGrain",
			"label": "Paper Grain",
			"type": "number",
			"defaultValue": 0.15,
			"min": 0,
			"max": 0.5,
			"step": 0.01,
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "registration",
			"label": "Registration",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 5,
			"step": 0.1,
			"description": "Simulates plate misalignment in CMYK printing",
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "inkCyan",
			"label": "Cyan Ink",
			"type": "color",
			"defaultValue": "#00AEEF",
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "inkMagenta",
			"label": "Magenta Ink",
			"type": "color",
			"defaultValue": "#EC008C",
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "inkYellow",
			"label": "Yellow Ink",
			"type": "color",
			"defaultValue": "#FFF200",
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		},
		{
			"key": "inkKey",
			"label": "Key Ink",
			"type": "color",
			"defaultValue": "#1a1a1a",
			"visibleWhen": {
				"equals": "cmyk",
				"key": "colorMode"
			}
		}
	],
	"presetDefaults": {
		"preset": {
			"process": {
				"inkCyan": "#00AEEF",
				"inkMagenta": "#EC008C",
				"inkYellow": "#FFF200",
				"inkKey": "#1a1a1a",
				"paperColor": "#F5F5F0"
			},
			"risograph": {
				"inkCyan": "#0078BF",
				"inkMagenta": "#FF48B0",
				"inkYellow": "#FFE800",
				"inkKey": "#000000",
				"paperColor": "#F2F0E6"
			},
			"newspaper": {
				"inkCyan": "#1A6B8A",
				"inkMagenta": "#8C3A5E",
				"inkYellow": "#C4A832",
				"inkKey": "#2B2B2B",
				"paperColor": "#F0E6D0"
			},
			"vintage": {
				"inkCyan": "#3A7CA5",
				"inkMagenta": "#A0506A",
				"inkYellow": "#D4A843",
				"inkKey": "#3C3228",
				"paperColor": "#EDE4D4"
			}
		}
	}
} as const satisfies ShaderLabEffectDefinition;
