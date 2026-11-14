import type { ShaderLabEffectDefinition } from "../types";

export const PARTICLE_GRID_LAYER = {
	"type": "particle-grid",
	"label": "Particle Grid",
	"description": "Shader Lab particle-grid pass with grid resolution, displacement, noise, color, and bloom controls.",
	"params": [
		{
			"key": "gridResolution",
			"label": "Resolution",
			"type": "select",
			"defaultValue": "256",
			"options": [
				{
					"label": "32",
					"value": "32"
				},
				{
					"label": "64",
					"value": "64"
				},
				{
					"label": "128",
					"value": "128"
				},
				{
					"label": "256",
					"value": "256"
				},
				{
					"label": "512",
					"value": "512"
				},
				{
					"label": "1024",
					"value": "1024"
				},
				{
					"label": "2048",
					"value": "2048"
				},
				{
					"label": "4096",
					"value": "4096"
				}
			]
		},
		{
			"key": "pointSize",
			"label": "Point Size",
			"type": "number",
			"defaultValue": 4,
			"min": 1,
			"max": 32,
			"step": 1
		},
		{
			"key": "displacement",
			"label": "Displacement",
			"type": "number",
			"defaultValue": 0.1,
			"min": -2,
			"max": 2,
			"step": 0.01
		},
		{
			"key": "backgroundColor",
			"label": "Background",
			"type": "color",
			"defaultValue": "#000000"
		},
		{
			"key": "noiseAmount",
			"label": "Amount",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 2,
			"step": 0.01,
			"group": "Motion"
		},
		{
			"key": "noiseScale",
			"label": "Scale",
			"type": "number",
			"defaultValue": 3,
			"min": 0.5,
			"max": 10,
			"step": 0.1,
			"group": "Motion"
		},
		{
			"key": "noiseSpeed",
			"label": "Speed",
			"type": "number",
			"defaultValue": 0.5,
			"min": 0,
			"max": 3,
			"step": 0.01,
			"group": "Motion"
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
