import type { ShaderLabEffectDefinition } from "../types";

export const VOXEL_LAYER = {
	"type": "voxel",
	"label": "Voxel",
	"description": "Shader Lab voxel pass that turns the source image into stacked isometric cells with depth, lighting, outlines, and brick cap controls.",
	"params": [
		{
			"key": "cellSize",
			"label": "Cell Size",
			"type": "number",
			"defaultValue": 24,
			"min": 4,
			"max": 96,
			"step": 1,
			"group": "Grid"
		},
		{
			"key": "depth",
			"label": "Depth",
			"type": "number",
			"defaultValue": 0,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Stack"
		},
		{
			"key": "maxHeight",
			"label": "Max Height",
			"type": "number",
			"defaultValue": 6,
			"min": 1,
			"max": 8,
			"step": 1,
			"group": "Stack"
		},
		{
			"key": "topShade",
			"label": "Top Shade",
			"type": "number",
			"defaultValue": 1,
			"min": 0,
			"max": 2,
			"step": 0.01,
			"group": "Lighting"
		},
		{
			"key": "lightShade",
			"label": "Light Side",
			"type": "number",
			"defaultValue": 0.78,
			"min": 0,
			"max": 2,
			"step": 0.01,
			"group": "Lighting"
		},
		{
			"key": "darkShade",
			"label": "Dark Side",
			"type": "number",
			"defaultValue": 0.55,
			"min": 0,
			"max": 2,
			"step": 0.01,
			"group": "Lighting"
		},
		{
			"key": "flipLight",
			"label": "Flip Light",
			"type": "boolean",
			"defaultValue": false,
			"group": "Lighting"
		},
		{
			"key": "outlineWidth",
			"label": "Outline",
			"type": "number",
			"defaultValue": 1,
			"min": 0,
			"max": 8,
			"step": 0.1,
			"group": "Outline"
		},
		{
			"key": "outlineColor",
			"label": "Outline Color",
			"type": "color",
			"defaultValue": "#0a0a0a",
			"group": "Outline"
		},
		{
			"key": "lego",
			"label": "Brick Caps",
			"type": "boolean",
			"defaultValue": false,
			"group": "Style"
		}
	]
} as const satisfies ShaderLabEffectDefinition;
