import type { ShaderLabEffectDefinition } from "../types";

export const CIRCUIT_BENT_LAYER = {
	"type": "circuit-bent",
	"label": "Circuit Bent",
	"description": "Shader Lab circuit-bent signal pass with line scan distortion, color modes, and temporal noise controls.",
	"params": [
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
					"label": "Monochrome",
					"value": "monochrome"
				}
			]
		},
		{
			"key": "monoColor",
			"label": "Tint",
			"type": "color",
			"defaultValue": "#ebf5ff",
			"visibleWhen": {
				"equals": "monochrome",
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
			"key": "signalBlackPoint",
			"label": "Black Point",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Signal"
		},
		{
			"key": "signalWhitePoint",
			"label": "White Point",
			"type": "number",
			"defaultValue": 0.22,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Signal"
		},
		{
			"key": "signalGamma",
			"label": "Gamma",
			"type": "number",
			"defaultValue": 3.07,
			"min": 0.1,
			"max": 5,
			"step": 0.01,
			"group": "Signal"
		},
		{
			"key": "presenceThreshold",
			"label": "Presence",
			"type": "number",
			"defaultValue": 0.37,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Signal"
		},
		{
			"key": "presenceSoftness",
			"label": "Presence Softness",
			"type": "number",
			"defaultValue": 0.64,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Signal"
		},
		{
			"key": "linePitch",
			"label": "Pitch",
			"type": "number",
			"defaultValue": 6.4,
			"min": 2,
			"max": 48,
			"step": 0.1,
			"group": "Lines"
		},
		{
			"key": "lineThickness",
			"label": "Thickness",
			"type": "number",
			"defaultValue": 0.5,
			"min": 0.5,
			"max": 8,
			"step": 0.1,
			"group": "Lines"
		},
		{
			"key": "lineAngle",
			"label": "Angle",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 180,
			"step": 1,
			"group": "Lines"
		},
		{
			"key": "noiseMode",
			"label": "Noise Type",
			"type": "select",
			"defaultValue": "turbulence",
			"options": [
				{
					"label": "Sine",
					"value": "sine"
				},
				{
					"label": "Perlin",
					"value": "perlin"
				},
				{
					"label": "Turbulence",
					"value": "turbulence"
				}
			],
			"group": "Noise"
		},
		{
			"key": "noiseAmount",
			"label": "Amount",
			"type": "number",
			"defaultValue": 1,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Noise"
		},
		{
			"key": "scrollSpeed",
			"label": "Scroll Speed",
			"type": "number",
			"defaultValue": 4,
			"min": 0,
			"max": 4,
			"step": 0.01,
			"group": "Animation"
		}
	]
} as const satisfies ShaderLabEffectDefinition;
