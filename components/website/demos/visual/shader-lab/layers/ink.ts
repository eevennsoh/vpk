import type { ShaderLabEffectDefinition } from "../types";

export const INK_LAYER = {
	"type": "ink",
	"label": "Ink",
	"description": "Shader Lab ink pass with blur/crisp layers, gradient ink colors, grain, smoke, and bloom controls.",
	"params": [
		{
			"key": "blurPasses",
			"label": "Trail Passes",
			"type": "number",
			"defaultValue": 13,
			"min": 1,
			"max": 20,
			"step": 1,
			"group": "Ink Bleed"
		},
		{
			"key": "crispPasses",
			"label": "Crisp Passes",
			"type": "number",
			"defaultValue": 3,
			"min": 1,
			"max": 6,
			"step": 1,
			"group": "Ink Bleed"
		},
		{
			"key": "crispBlend",
			"label": "Detail Blend",
			"type": "number",
			"defaultValue": 0.81,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Ink Bleed"
		},
		{
			"key": "blurStrength",
			"label": "Bleed Strength",
			"type": "number",
			"defaultValue": 0.044,
			"min": 0.001,
			"max": 0.08,
			"step": 0.001,
			"group": "Ink Bleed"
		},
		{
			"key": "blurDirection",
			"label": "Flow Direction",
			"type": "number",
			"defaultValue": 90,
			"min": -180,
			"max": 180,
			"step": 1,
			"group": "Ink Bleed"
		},
		{
			"key": "dripLength",
			"label": "Drip Length",
			"type": "number",
			"defaultValue": 1,
			"min": 1,
			"max": 10,
			"step": 0.1,
			"group": "Ink Bleed"
		},
		{
			"key": "dripWeight",
			"label": "Drip Weight",
			"type": "number",
			"defaultValue": 0.4,
			"min": 0.2,
			"max": 2,
			"step": 0.1,
			"group": "Ink Bleed"
		},
		{
			"key": "fluidNoise",
			"label": "Fluid Noise",
			"type": "number",
			"defaultValue": 0.02,
			"min": 0,
			"max": 2,
			"step": 0.01,
			"group": "Ink Bleed"
		},
		{
			"key": "noiseScale",
			"label": "Noise Scale",
			"type": "number",
			"defaultValue": 1.2,
			"min": 0.5,
			"max": 8,
			"step": 0.1,
			"group": "Ink Bleed"
		},
		{
			"key": "smokeSpeed",
			"label": "Smoke Speed",
			"type": "number",
			"defaultValue": 0.36,
			"min": 0,
			"max": 2,
			"step": 0.01,
			"group": "Ink Bleed"
		},
		{
			"key": "smokeTurbulence",
			"label": "Smoke Turbulence",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 1.5,
			"step": 0.01,
			"group": "Ink Bleed"
		},
		{
			"key": "blurSpread",
			"label": "Spread",
			"type": "number",
			"defaultValue": 1.6,
			"min": 0.5,
			"max": 4,
			"step": 0.1,
			"group": "Ink Bleed"
		},
		{
			"key": "colorMode",
			"label": "Color Mode",
			"type": "select",
			"defaultValue": "gradient",
			"options": [
				{
					"label": "Gradient",
					"value": "gradient"
				},
				{
					"label": "Source",
					"value": "source"
				}
			],
			"group": "Colors"
		},
		{
			"key": "coreColor",
			"label": "Core Color",
			"type": "color",
			"defaultValue": "#fffde8",
			"group": "Glow Colors",
			"visibleWhen": {
				"equals": "gradient",
				"key": "colorMode"
			}
		},
		{
			"key": "midColor",
			"label": "Mid Color",
			"type": "color",
			"defaultValue": "#FFA700",
			"group": "Glow Colors",
			"visibleWhen": {
				"equals": "gradient",
				"key": "colorMode"
			}
		},
		{
			"key": "edgeColor",
			"label": "Edge Color",
			"type": "color",
			"defaultValue": "#7192F1",
			"group": "Glow Colors",
			"visibleWhen": {
				"equals": "gradient",
				"key": "colorMode"
			}
		},
		{
			"key": "backgroundColor",
			"label": "Background",
			"type": "color",
			"defaultValue": "#000000",
			"group": "Colors"
		},
		{
			"key": "grainEnabled",
			"label": "Enable Grain",
			"type": "boolean",
			"defaultValue": false,
			"group": "Grain"
		},
		{
			"key": "grainIntensity",
			"label": "Grain Intensity",
			"type": "number",
			"defaultValue": 0.3,
			"min": 0,
			"max": 0.3,
			"step": 0.005,
			"group": "Grain"
		},
		{
			"key": "grainScale",
			"label": "Grain Scale",
			"type": "number",
			"defaultValue": 1.5,
			"min": 0.5,
			"max": 5,
			"step": 0.1,
			"group": "Grain"
		},
		{
			"key": "bloomEnabled",
			"label": "Bloom",
			"type": "boolean",
			"defaultValue": true,
			"group": "Bloom"
		},
		{
			"key": "bloomIntensity",
			"label": "Intensity",
			"type": "number",
			"defaultValue": 6.19,
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
			"defaultValue": 0.97,
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
			"defaultValue": 0,
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
			"defaultValue": 0.96,
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
