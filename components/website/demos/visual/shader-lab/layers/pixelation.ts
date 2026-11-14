import type { ShaderLabEffectDefinition } from "../types";

export const PIXELATION_LAYER = {
	"type": "pixelation",
	"label": "Pixelation",
	"description": "Shader Lab pixelation pass with cell-size and aspect-ratio controls.",
	"params": [
		{
			"key": "cellSize",
			"label": "Cell Size",
			"type": "number",
			"defaultValue": 8,
			"min": 2,
			"max": 64,
			"step": 1
		},
		{
			"key": "aspectRatio",
			"label": "Aspect Ratio",
			"type": "number",
			"defaultValue": 1,
			"min": 0.25,
			"max": 4,
			"step": 0.05
		}
	]
} as const satisfies ShaderLabEffectDefinition;
