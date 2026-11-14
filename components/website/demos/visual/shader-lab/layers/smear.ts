import type { ShaderLabEffectDefinition } from "../types";

export const SMEAR_LAYER = {
	"type": "smear",
	"label": "Progressive Blur",
	"description": "Shader Lab smear/progressive blur pass with angle, range, strength, and sample controls.",
	"params": [
		{
			"key": "angle",
			"label": "Angle",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 360,
			"step": 1
		},
		{
			"key": "start",
			"label": "Start",
			"type": "number",
			"defaultValue": 0.25,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "end",
			"label": "End",
			"type": "number",
			"defaultValue": 0.75,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "strength",
			"label": "Strength",
			"type": "number",
			"defaultValue": 24,
			"min": 0,
			"max": 64,
			"step": 1
		},
		{
			"key": "samples",
			"label": "Samples",
			"type": "number",
			"defaultValue": 12,
			"min": 4,
			"max": 32,
			"step": 1
		}
	]
} as const satisfies ShaderLabEffectDefinition;
