import type { ShaderLabEffectDefinition } from "../types";

export const SLICE_LAYER = {
	"type": "slice",
	"label": "Slice",
	"description": "Shader Lab slice pass with horizontal/vertical glitch slices, block width, density, dispersion, and speed controls.",
	"params": [
		{
			"key": "amount",
			"label": "Amount",
			"type": "number",
			"defaultValue": 180,
			"min": 0,
			"max": 480,
			"step": 1
		},
		{
			"key": "sliceHeight",
			"label": "Slice Height",
			"type": "number",
			"defaultValue": 28,
			"min": 2,
			"max": 240,
			"step": 1
		},
		{
			"key": "blockWidth",
			"label": "Block Width",
			"type": "number",
			"defaultValue": 120,
			"min": 8,
			"max": 640,
			"step": 1
		},
		{
			"key": "density",
			"label": "Density",
			"type": "number",
			"defaultValue": 0.58,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "dispersion",
			"label": "Dispersion",
			"type": "number",
			"defaultValue": 0.18,
			"min": 0,
			"max": 0.5,
			"step": 0.01
		},
		{
			"key": "speed",
			"label": "Speed",
			"type": "number",
			"defaultValue": 0.2,
			"min": 0,
			"max": 2,
			"step": 0.01
		},
		{
			"key": "direction",
			"label": "Direction",
			"type": "select",
			"defaultValue": "right",
			"options": [
				{
					"label": "Right",
					"value": "right"
				},
				{
					"label": "Left",
					"value": "left"
				},
				{
					"label": "Both",
					"value": "both"
				}
			]
		}
	]
} as const satisfies ShaderLabEffectDefinition;
