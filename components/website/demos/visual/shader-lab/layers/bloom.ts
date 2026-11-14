import type { ShaderLabEffectDefinition } from "../types";

export const BLOOM_LAYER = {
	"type": "bloom",
	"label": "Bloom",
	"description": "Shader Lab bloom pass with highlight drive, radius, softness, and threshold controls.",
	"params": [
		{
			"key": "bloomIntensity",
			"label": "Intensity",
			"type": "number",
			"defaultValue": 1.25,
			"min": 0,
			"max": 2,
			"step": 0.01,
			"group": "Bloom"
		},
		{
			"key": "bloomThreshold",
			"label": "Threshold",
			"type": "number",
			"defaultValue": 0.6,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Bloom"
		},
		{
			"key": "bloomRadius",
			"label": "Radius",
			"type": "number",
			"defaultValue": 6,
			"min": 0,
			"max": 24,
			"step": 0.25,
			"group": "Bloom"
		},
		{
			"key": "bloomSoftness",
			"label": "Softness",
			"type": "number",
			"defaultValue": 0.35,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Bloom"
		},
		{
			"key": "bloomKnee",
			"label": "Knee",
			"type": "number",
			"defaultValue": 0.2,
			"min": 0,
			"max": 0.5,
			"step": 0.01,
			"group": "Highlight"
		},
		{
			"key": "highlightDrive",
			"label": "Highlight Drive",
			"type": "number",
			"defaultValue": 1.5,
			"min": 1,
			"max": 4,
			"step": 0.01,
			"group": "Highlight"
		}
	]
} as const satisfies ShaderLabEffectDefinition;
