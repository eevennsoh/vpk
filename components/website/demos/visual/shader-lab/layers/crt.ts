import type { ShaderLabEffectDefinition } from "../types";

export const CRT_LAYER = {
	"type": "crt",
	"label": "CRT",
	"description": "Shader Lab CRT pass with scanlines, mask, barrel distortion, persistence, flicker, glitch, and bloom controls.",
	"params": [
		{
			"key": "crtMode",
			"label": "Mode",
			"type": "select",
			"defaultValue": "slot-mask",
			"options": [
				{
					"label": "Slot-Mask Monitor",
					"value": "slot-mask"
				},
				{
					"label": "Aperture-Grille Monitor",
					"value": "aperture-grille"
				},
				{
					"label": "Composite TV",
					"value": "composite-tv"
				}
			]
		},
		{
			"key": "cellSize",
			"label": "Mask Scale",
			"type": "number",
			"defaultValue": 3,
			"min": 3,
			"max": 32,
			"step": 1
		},
		{
			"key": "scanlineIntensity",
			"label": "Scanline Intensity",
			"type": "number",
			"defaultValue": 0.17,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "maskIntensity",
			"label": "Mask Intensity",
			"type": "number",
			"defaultValue": 1,
			"min": 0,
			"max": 1,
			"step": 0.01
		},
		{
			"key": "barrelDistortion",
			"label": "Barrel Distortion",
			"type": "number",
			"defaultValue": 0.15,
			"min": 0,
			"max": 0.3,
			"step": 0.001,
			"group": "Distortion"
		},
		{
			"key": "chromaticAberration",
			"label": "Convergence",
			"type": "number",
			"defaultValue": 2,
			"min": 0,
			"max": 2,
			"step": 0.01,
			"group": "Distortion"
		},
		{
			"key": "beamFocus",
			"label": "Beam Focus",
			"type": "number",
			"defaultValue": 0.58,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Phosphor"
		},
		{
			"key": "brightness",
			"label": "Brightness",
			"type": "number",
			"defaultValue": 1.2,
			"min": 0.5,
			"max": 100,
			"step": 0.01,
			"group": "Phosphor"
		},
		{
			"key": "highlightDrive",
			"label": "Highlight Drive",
			"type": "number",
			"defaultValue": 1,
			"min": 1,
			"max": 100,
			"step": 0.01,
			"group": "Phosphor"
		},
		{
			"key": "highlightThreshold",
			"label": "Highlight Threshold",
			"type": "number",
			"defaultValue": 0.62,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Phosphor"
		},
		{
			"key": "shoulder",
			"label": "Shoulder",
			"type": "number",
			"defaultValue": 0.25,
			"min": 0,
			"max": 4,
			"step": 0.01,
			"group": "Phosphor"
		},
		{
			"key": "chromaRetention",
			"label": "Chroma Retention",
			"type": "number",
			"defaultValue": 1.15,
			"min": 0,
			"max": 2,
			"step": 0.01,
			"group": "Phosphor"
		},
		{
			"key": "shadowLift",
			"label": "Shadow Lift",
			"type": "number",
			"defaultValue": 0.16,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Phosphor"
		},
		{
			"key": "persistence",
			"label": "Persistence",
			"type": "number",
			"defaultValue": 0.18,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Phosphor"
		},
		{
			"key": "vignetteIntensity",
			"label": "Vignette",
			"type": "number",
			"defaultValue": 0.45,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Distortion"
		},
		{
			"key": "flickerIntensity",
			"label": "Flicker",
			"type": "number",
			"defaultValue": 0.2,
			"min": 0,
			"max": 0.2,
			"step": 0.01,
			"group": "Noise"
		},
		{
			"key": "glitchIntensity",
			"label": "Glitch",
			"type": "number",
			"defaultValue": 0.13,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Noise"
		},
		{
			"key": "glitchSpeed",
			"label": "Glitch Speed",
			"type": "number",
			"defaultValue": 5,
			"min": 0.1,
			"max": 5,
			"step": 0.1,
			"group": "Noise",
			"visibleWhen": {
				"gte": 0.01,
				"key": "glitchIntensity"
			}
		},
		{
			"key": "signalArtifacts",
			"label": "Signal Artifacts",
			"type": "number",
			"defaultValue": 0.45,
			"min": 0,
			"max": 1,
			"step": 0.01,
			"group": "Signal",
			"visibleWhen": {
				"equals": "composite-tv",
				"key": "crtMode"
			}
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
			"defaultValue": 1.93,
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
			"defaultValue": 0,
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
			"defaultValue": 8,
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
			"defaultValue": 0.31,
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
