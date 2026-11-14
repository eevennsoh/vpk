import type { ShaderLabEffectDefinition } from "../types";

export const THRESHOLD_LAYER = {
	"type": "threshold",
	"label": "Threshold",
	"description": "Shader Lab threshold pass with threshold, softness, noise, and invert controls.",
	"params": [
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
			"key": "softness",
			"label": "Softness",
			"type": "number",
			"defaultValue": 0.02,
			"min": 0,
			"max": 0.2,
			"step": 0.001
		},
		{
			"key": "noise",
			"label": "Noise",
			"type": "number",
			"defaultValue": 0.08,
			"min": 0,
			"max": 0.3,
			"step": 0.001
		},
		{
			"key": "invert",
			"label": "Invert",
			"type": "boolean",
			"defaultValue": false
		}
	]
} as const satisfies ShaderLabEffectDefinition;
