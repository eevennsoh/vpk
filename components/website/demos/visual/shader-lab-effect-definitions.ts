import type {
	ShaderLabEffectDefinition,
	ShaderLabRuntimeEffectType,
	ShaderLabRuntimeLayerType,
	ShaderLabRuntimeSourceType,
} from "./shader-lab/types";

export * from "./shader-lab/helpers";
export * from "./shader-lab/types";

export const SHADER_LAB_EFFECT_DEFINITIONS = {
	"blob-tracking": {
		"type": "blob-tracking",
		"label": "Blob Tracking",
		"description": "Detects moving or bright regions and frames them with tracked shapes, labels, connectors, and trails.",
		"params": [
			{ "key": "blobAmount", "label": "Blob Amount", "type": "number", "defaultValue": 6, "min": 1, "max": 32, "step": 1, "group": "Detection" },
			{ "key": "detectionMode", "label": "Detection Mode", "type": "select", "defaultValue": "auto", "options": [
				{ "label": "Auto", "value": "auto" },
				{ "label": "Motion", "value": "motion" },
				{ "label": "Luminance", "value": "luminance" }
			], "group": "Detection" },
			{ "key": "minBlobSize", "label": "Minimum Blob Size", "type": "number", "defaultValue": 3, "min": 1, "max": 64, "step": 1, "group": "Detection" },
			{ "key": "motionThreshold", "label": "Motion Threshold", "type": "number", "defaultValue": 0.12, "min": 0, "max": 1, "step": 0.01, "group": "Detection" },
			{ "key": "motionMaskThreshold", "label": "Motion Mask Threshold", "type": "number", "defaultValue": 0.08, "min": 0, "max": 0.5, "step": 0.01, "group": "Detection" },
			{ "key": "motionPersistence", "label": "Motion Persistence", "type": "number", "defaultValue": 0.82, "min": 0, "max": 0.99, "step": 0.01, "group": "Detection" },
			{ "key": "sensitivity", "label": "Sensitivity", "type": "number", "defaultValue": 0.8, "min": 0, "max": 1, "step": 0.01, "group": "Tracking" },
			{ "key": "smoothing", "label": "Smoothing", "type": "number", "defaultValue": 0.6, "min": 0, "max": 1, "step": 0.01, "group": "Tracking" },
			{ "key": "persistentTracking", "label": "Persistent Tracking", "type": "boolean", "defaultValue": true, "group": "Tracking" },
			{ "key": "shapeType", "label": "Shape", "type": "select", "defaultValue": "square", "options": [
				{ "label": "Square", "value": "square" },
				{ "label": "Circle", "value": "circle" },
				{ "label": "Diamond", "value": "diamond" }
			], "group": "Shape" },
			{ "key": "shapeScale", "label": "Shape Scale", "type": "number", "defaultValue": 1, "min": 0.25, "max": 3, "step": 0.05, "group": "Shape" },
			{ "key": "centerShape", "label": "Center Marker", "type": "select", "defaultValue": "dot", "options": [
				{ "label": "Dot", "value": "dot" },
				{ "label": "Cross", "value": "cross" },
				{ "label": "None", "value": "none" }
			], "group": "Shape" },
			{ "key": "showOutline", "label": "Show Outline", "type": "boolean", "defaultValue": true, "group": "Decoration" },
			{ "key": "showLabels", "label": "Show Labels", "type": "boolean", "defaultValue": true, "group": "Decoration" },
			{ "key": "connectLines", "label": "Connect Lines", "type": "boolean", "defaultValue": true, "group": "Decoration" },
			{ "key": "connectorArrows", "label": "Connector Arrows", "type": "boolean", "defaultValue": false, "group": "Decoration" },
			{ "key": "connectorDashed", "label": "Dashed Connectors", "type": "boolean", "defaultValue": false, "group": "Decoration" },
			{ "key": "curvedLines", "label": "Curved Lines", "type": "boolean", "defaultValue": false, "group": "Decoration" },
			{ "key": "strokeColor", "label": "Stroke Color", "type": "color", "defaultValue": "#ffffff", "group": "Decoration" },
			{ "key": "strokeWidth", "label": "Stroke Width", "type": "number", "defaultValue": 2, "min": 1, "max": 8, "step": 0.25, "group": "Decoration" },
			{ "key": "trailDecay", "label": "Trail Decay", "type": "number", "defaultValue": 0.35, "min": 0, "max": 1, "step": 0.01, "group": "Decoration" },
			{ "key": "invert", "label": "Invert", "type": "boolean", "defaultValue": false, "group": "Output" },
			{ "key": "outputMode", "label": "Output Mode", "type": "select", "defaultValue": "decorated", "options": [
				{ "label": "Decorated", "value": "decorated" },
				{ "label": "Motion mask", "value": "motion" }
			], "group": "Output" },
			{ "key": "innerEffectType", "label": "Inner Effect", "type": "select", "defaultValue": "none", "options": [
				{ "label": "None", "value": "none" },
				{ "label": "Bloom", "value": "bloom" },
				{ "label": "CRT", "value": "crt" },
				{ "label": "Halftone", "value": "halftone" },
				{ "label": "Pixelation", "value": "pixelation" },
				{ "label": "Threshold", "value": "threshold" }
			], "group": "Inner Effect" },
			{ "key": "innerEffectParams", "label": "Inner Effect Parameters", "type": "text", "defaultValue": "{}", "group": "Inner Effect" }
		]
	},
	"bloom": {
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
	},
	"circuit-bent": {
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
	},
	"directional-blur": {
		"type": "directional-blur",
		"label": "Directional Blur",
		"description": "Shader Lab directional blur pass with linear and radial blur modes.",
		"params": [
			{
				"key": "mode",
				"label": "Mode",
				"type": "select",
				"defaultValue": "linear",
				"options": [
					{
						"label": "Linear",
						"value": "linear"
					},
					{
						"label": "Radial",
						"value": "radial"
					}
				]
			},
			{
				"key": "strength",
				"label": "Strength",
				"type": "number",
				"defaultValue": 18,
				"min": 0,
				"max": 96,
				"step": 0.5
			},
			{
				"key": "samples",
				"label": "Samples",
				"type": "number",
				"defaultValue": 8,
				"min": 1,
				"max": 16,
				"step": 1
			},
			{
				"key": "angle",
				"label": "Angle",
				"type": "number",
				"defaultValue": 0,
				"min": 0,
				"max": 360,
				"step": 1,
				"visibleWhen": {
					"key": "mode",
					"equals": "linear"
				}
			},
			{
				"key": "center",
				"label": "Center",
				"type": "vec2",
				"defaultValue": [
					0.5,
					0.5
				],
				"min": 0,
				"max": 1,
				"step": 0.01,
				"visibleWhen": {
					"key": "mode",
					"equals": "radial"
				}
			}
		]
	},
	"chromatic-aberration": {
		"type": "chromatic-aberration",
		"label": "Chromatic Aberration",
		"description": "Shader Lab chromatic aberration pass with radial, horizontal, and vertical channel split modes.",
		"params": [
			{
				"key": "intensity",
				"label": "Intensity",
				"type": "number",
				"defaultValue": 5,
				"min": 0,
				"max": 50,
				"step": 0.5
			},
			{
				"key": "direction",
				"label": "Direction",
				"type": "select",
				"defaultValue": "radial",
				"options": [
					{
						"label": "Radial",
						"value": "radial"
					},
					{
						"label": "Horizontal",
						"value": "horizontal"
					},
					{
						"label": "Vertical",
						"value": "vertical"
					}
				]
			},
			{
				"key": "center",
				"label": "Center",
				"type": "vec2",
				"defaultValue": [
					0.5,
					0.5
				],
				"min": 0,
				"max": 1,
				"step": 0.01,
				"visibleWhen": {
					"key": "direction",
					"equals": "radial"
				}
			},
			{
				"key": "angle",
				"label": "Angle",
				"type": "number",
				"defaultValue": 0,
				"min": 0,
				"max": 360,
				"step": 1,
				"visibleWhen": {
					"key": "direction",
					"equals": "horizontal"
				}
			}
		]
	},
	"crt": {
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
	},
	"displacement-map": {
		"type": "displacement-map",
		"label": "Displacement Map",
		"description": "Shader Lab displacement-map pass that offsets the source from luminance or color channels.",
		"params": [
			{
				"key": "strength",
				"label": "Strength",
				"type": "number",
				"defaultValue": 20,
				"min": 0,
				"max": 200,
				"step": 1
			},
			{
				"key": "direction",
				"label": "Direction",
				"type": "select",
				"defaultValue": "both",
				"options": [
					{
						"label": "Both",
						"value": "both"
					},
					{
						"label": "Horizontal",
						"value": "horizontal"
					},
					{
						"label": "Vertical",
						"value": "vertical"
					}
				]
			},
			{
				"key": "channel",
				"label": "Channel",
				"type": "select",
				"defaultValue": "luminance",
				"options": [
					{
						"label": "Luminance",
						"value": "luminance"
					},
					{
						"label": "Red",
						"value": "red"
					},
					{
						"label": "Green",
						"value": "green"
					},
					{
						"label": "Blue",
						"value": "blue"
					}
				]
			},
			{
				"key": "midpoint",
				"label": "Midpoint",
				"type": "number",
				"defaultValue": 0.5,
				"min": 0,
				"max": 1,
				"step": 0.01
			}
		]
	},
	"edge-detect": {
		"type": "edge-detect",
		"label": "Edge Detect",
		"description": "Shader Lab edge-detect pass with threshold, strength, invert, and mono/source color modes.",
		"params": [
			{
				"key": "threshold",
				"label": "Threshold",
				"type": "number",
				"defaultValue": 0.1,
				"min": 0,
				"max": 1,
				"step": 0.01
			},
			{
				"key": "strength",
				"label": "Strength",
				"type": "number",
				"defaultValue": 1,
				"min": 0.1,
				"max": 5,
				"step": 0.1
			},
			{
				"key": "invert",
				"label": "Invert",
				"type": "boolean",
				"defaultValue": false
			},
			{
				"key": "colorMode",
				"label": "Color",
				"type": "select",
				"defaultValue": "overlay",
				"options": [
					{
						"label": "Overlay",
						"value": "overlay"
					},
					{
						"label": "Mono",
						"value": "mono"
					},
					{
						"label": "Source",
						"value": "source"
					}
				]
			},
			{
				"key": "lineColor",
				"label": "Line Color",
				"type": "color",
				"defaultValue": "#ffffff",
				"visibleWhen": {
					"key": "colorMode",
					"equals": "mono"
				}
			},
			{
				"key": "bgColor",
				"label": "Background",
				"type": "color",
				"defaultValue": "#000000",
				"visibleWhen": {
					"key": "colorMode",
					"equals": "mono"
				}
			}
		]
	},
	"fluted-glass": {
		"type": "fluted-glass",
		"label": "Fluted Glass",
		"description": "Shader Lab fluted-glass refraction pass with preset, frequency, amplitude, warp, irregularity, and angle controls.",
		"params": [
			{
				"key": "preset",
				"label": "Preset",
				"type": "select",
				"defaultValue": "architectural",
				"options": [
					{
						"label": "Architectural",
						"value": "architectural"
					},
					{
						"label": "Painterly",
						"value": "painterly"
					}
				]
			},
			{
				"key": "frequency",
				"label": "Frequency",
				"type": "number",
				"defaultValue": 20,
				"min": 2,
				"max": 100,
				"step": 1
			},
			{
				"key": "amplitude",
				"label": "Amplitude",
				"type": "number",
				"defaultValue": 0.02,
				"min": 0,
				"max": 0.1,
				"step": 0.001
			},
			{
				"key": "warp",
				"label": "Warp",
				"type": "number",
				"defaultValue": 0.28,
				"min": 0,
				"max": 1,
				"step": 0.01
			},
			{
				"key": "irregularity",
				"label": "Irregularity",
				"type": "number",
				"defaultValue": 0.35,
				"min": 0,
				"max": 1,
				"step": 0.01
			},
			{
				"key": "angle",
				"label": "Angle",
				"type": "number",
				"defaultValue": 0,
				"min": 0,
				"max": 360,
				"step": 1
			}
		]
	},
	"halftone": {
		"type": "halftone",
		"label": "Halftone",
		"description": "Shader Lab halftone pass with monochrome, duotone, custom, and CMYK print controls.",
		"params": [
			{
				"key": "colorMode",
				"label": "Color Mode",
				"type": "select",
				"defaultValue": "cmyk",
				"options": [
					{
						"label": "Source",
						"value": "source"
					},
					{
						"label": "Monochrome",
						"value": "monochrome"
					},
					{
						"label": "Duotone",
						"value": "duotone"
					},
					{
						"label": "Custom",
						"value": "custom"
					},
					{
						"label": "CMYK",
						"value": "cmyk"
					}
				]
			},
			{
				"key": "shape",
				"label": "Shape",
				"type": "select",
				"defaultValue": "circle",
				"options": [
					{
						"label": "Circle",
						"value": "circle"
					},
					{
						"label": "Square",
						"value": "square"
					},
					{
						"label": "Diamond",
						"value": "diamond"
					},
					{
						"label": "Line",
						"value": "line"
					}
				]
			},
			{
				"key": "spacing",
				"label": "Spacing",
				"type": "number",
				"defaultValue": 5,
				"min": 2,
				"max": 48,
				"step": 1
			},
			{
				"key": "dotSize",
				"label": "Dot Size",
				"type": "number",
				"defaultValue": 1,
				"min": 0.1,
				"max": 3,
				"step": 0.01
			},
			{
				"key": "dotMin",
				"label": "Dot Min",
				"type": "number",
				"defaultValue": 0,
				"min": 0,
				"max": 0.5,
				"step": 0.01
			},
			{
				"key": "angle",
				"label": "Angle",
				"type": "number",
				"defaultValue": 28,
				"min": 0,
				"max": 360,
				"step": 1
			},
			{
				"key": "contrast",
				"label": "Contrast",
				"type": "number",
				"defaultValue": 1,
				"min": 0,
				"max": 2,
				"step": 0.01
			},
			{
				"key": "softness",
				"label": "Softness",
				"type": "number",
				"defaultValue": 0.25,
				"min": 0,
				"max": 1,
				"step": 0.01
			},
			{
				"key": "dotGain",
				"label": "Dot Gain",
				"type": "number",
				"defaultValue": 0,
				"min": 0,
				"max": 1,
				"step": 0.01,
				"description": "Simulates ink bleeding into paper fibers"
			},
			{
				"key": "dotMorph",
				"label": "Dot Morph",
				"type": "number",
				"defaultValue": 0,
				"min": 0,
				"max": 1,
				"step": 0.01,
				"description": "Blends dot shape based on tonal value (circles → squares in midtones)"
			},
			{
				"key": "invertLuma",
				"label": "Invert",
				"type": "boolean",
				"defaultValue": false
			},
			{
				"key": "customColorCount",
				"label": "Color Count",
				"type": "number",
				"defaultValue": 4,
				"min": 2,
				"max": 4,
				"step": 1,
				"description": "Palette is distributed evenly across luminance bands.",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "customLuminanceBias",
				"label": "Luminance Bias",
				"type": "number",
				"defaultValue": 0,
				"min": -1,
				"max": 1,
				"step": 0.01,
				"description": "Shifts palette mapping toward shadows or highlights.",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "bloomEnabled",
				"label": "Bloom",
				"type": "boolean",
				"defaultValue": false,
				"group": "Bloom",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
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
			},
			{
				"key": "customBgColor",
				"label": "Background",
				"type": "color",
				"defaultValue": "#F5F5F0",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "customColor1",
				"label": "Shadows",
				"type": "color",
				"defaultValue": "#0d1014",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "customColor2",
				"label": "Midtones / Highlights",
				"type": "color",
				"defaultValue": "#4d5057",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "customColor3",
				"label": "High Mids",
				"type": "color",
				"defaultValue": "#969aa2",
				"visibleWhen": {
					"gte": 3,
					"key": "customColorCount"
				}
			},
			{
				"key": "customColor4",
				"label": "Highlights",
				"type": "color",
				"defaultValue": "#e1e2de",
				"visibleWhen": {
					"gte": 4,
					"key": "customColorCount"
				}
			},
			{
				"key": "ink",
				"label": "Ink",
				"type": "color",
				"defaultValue": "#0d1014",
				"visibleWhen": {
					"equals": "monochrome",
					"key": "colorMode"
				}
			},
			{
				"key": "duotoneLight",
				"label": "Light Color",
				"type": "color",
				"defaultValue": "#F5F5F0",
				"visibleWhen": {
					"equals": "duotone",
					"key": "colorMode"
				}
			},
			{
				"key": "duotoneDark",
				"label": "Dark Color",
				"type": "color",
				"defaultValue": "#1d1d1c",
				"visibleWhen": {
					"equals": "duotone",
					"key": "colorMode"
				}
			},
			{
				"key": "preset",
				"label": "Ink Preset",
				"type": "select",
				"defaultValue": "process",
				"options": [
					{
						"label": "Process CMYK",
						"value": "process"
					},
					{
						"label": "Risograph",
						"value": "risograph"
					},
					{
						"label": "Newspaper",
						"value": "newspaper"
					},
					{
						"label": "Vintage",
						"value": "vintage"
					},
					{
						"label": "Custom",
						"value": "custom"
					}
				],
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "gcr",
				"label": "Black Generation",
				"type": "number",
				"defaultValue": 0.5,
				"min": 0,
				"max": 1,
				"step": 0.01,
				"description": "Controls how much goes to the K plate vs C+M+Y",
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "cmykBlend",
				"label": "CMYK Blend",
				"type": "select",
				"defaultValue": "subtractive",
				"options": [
					{
						"label": "Subtractive",
						"value": "subtractive"
					},
					{
						"label": "Overprint",
						"value": "overprint"
					}
				],
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "cyanAngle",
				"label": "Cyan Angle",
				"type": "number",
				"defaultValue": 15,
				"min": 0,
				"max": 90,
				"step": 1,
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "magentaAngle",
				"label": "Magenta Angle",
				"type": "number",
				"defaultValue": 75,
				"min": 0,
				"max": 90,
				"step": 1,
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "yellowAngle",
				"label": "Yellow Angle",
				"type": "number",
				"defaultValue": 0,
				"min": 0,
				"max": 90,
				"step": 1,
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "keyAngle",
				"label": "Key Angle",
				"type": "number",
				"defaultValue": 45,
				"min": 0,
				"max": 90,
				"step": 1,
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "paperColor",
				"label": "Paper Color",
				"type": "color",
				"defaultValue": "#F5F5F0",
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "paperGrain",
				"label": "Paper Grain",
				"type": "number",
				"defaultValue": 0.15,
				"min": 0,
				"max": 0.5,
				"step": 0.01,
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "registration",
				"label": "Registration",
				"type": "number",
				"defaultValue": 0,
				"min": 0,
				"max": 5,
				"step": 0.1,
				"description": "Simulates plate misalignment in CMYK printing",
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "inkCyan",
				"label": "Cyan Ink",
				"type": "color",
				"defaultValue": "#00AEEF",
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "inkMagenta",
				"label": "Magenta Ink",
				"type": "color",
				"defaultValue": "#EC008C",
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "inkYellow",
				"label": "Yellow Ink",
				"type": "color",
				"defaultValue": "#FFF200",
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			},
			{
				"key": "inkKey",
				"label": "Key Ink",
				"type": "color",
				"defaultValue": "#1a1a1a",
				"visibleWhen": {
					"equals": "cmyk",
					"key": "colorMode"
				}
			}
		],
		"presetDefaults": {
			"preset": {
				"process": {
					"inkCyan": "#00AEEF",
					"inkMagenta": "#EC008C",
					"inkYellow": "#FFF200",
					"inkKey": "#1a1a1a",
					"paperColor": "#F5F5F0"
				},
				"risograph": {
					"inkCyan": "#0078BF",
					"inkMagenta": "#FF48B0",
					"inkYellow": "#FFE800",
					"inkKey": "#000000",
					"paperColor": "#F2F0E6"
				},
				"newspaper": {
					"inkCyan": "#1A6B8A",
					"inkMagenta": "#8C3A5E",
					"inkYellow": "#C4A832",
					"inkKey": "#2B2B2B",
					"paperColor": "#F0E6D0"
				},
				"vintage": {
					"inkCyan": "#3A7CA5",
					"inkMagenta": "#A0506A",
					"inkYellow": "#D4A843",
					"inkKey": "#3C3228",
					"paperColor": "#EDE4D4"
				}
			}
		}
	},
	"ink": {
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
	},
	"particle-grid": {
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
	},
	"pattern": {
		"type": "pattern",
		"label": "Pattern",
		"description": "Shader Lab pattern pass with atlas presets, color modes, inversion, custom palettes, and bloom controls.",
		"params": [
			{
				"key": "cellSize",
				"label": "Cell Size",
				"type": "number",
				"defaultValue": 12,
				"min": 4,
				"max": 48,
				"step": 1
			},
			{
				"key": "preset",
				"label": "Preset",
				"type": "select",
				"defaultValue": "bars",
				"options": [
					{
						"label": "Bars",
						"value": "bars"
					},
					{
						"label": "Candles",
						"value": "candles"
					},
					{
						"label": "Shapes",
						"value": "shapes"
					}
				]
			},
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
						"label": "Quantized",
						"value": "quantized"
					},
					{
						"label": "Monochrome",
						"value": "monochrome"
					},
					{
						"label": "Custom",
						"value": "custom"
					}
				]
			},
			{
				"key": "monoColor",
				"label": "Tint",
				"type": "color",
				"defaultValue": "#f5f5f0",
				"visibleWhen": {
					"equals": "monochrome",
					"key": "colorMode"
				}
			},
			{
				"key": "bgOpacity",
				"label": "Background",
				"type": "number",
				"defaultValue": 0,
				"min": 0,
				"max": 1,
				"step": 0.01,
				"visibleWhen": {
					"equals": "source",
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
				"key": "customColorCount",
				"label": "Color Count",
				"type": "number",
				"defaultValue": 4,
				"min": 2,
				"max": 4,
				"step": 1,
				"description": "Palette is distributed evenly across luminance bands.",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "customLuminanceBias",
				"label": "Luminance Bias",
				"type": "number",
				"defaultValue": 0,
				"min": -1,
				"max": 1,
				"step": 0.01,
				"description": "Shifts palette mapping toward shadows or highlights.",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "customBgColor",
				"label": "Background",
				"type": "color",
				"defaultValue": "#F5F5F0",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "customColor1",
				"label": "Shadows",
				"type": "color",
				"defaultValue": "#0d1014",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "customColor2",
				"label": "Midtones / Highlights",
				"type": "color",
				"defaultValue": "#4d5057",
				"visibleWhen": {
					"equals": "custom",
					"key": "colorMode"
				}
			},
			{
				"key": "customColor3",
				"label": "High Mids",
				"type": "color",
				"defaultValue": "#969aa2",
				"visibleWhen": {
					"gte": 3,
					"key": "customColorCount"
				}
			},
			{
				"key": "customColor4",
				"label": "Highlights",
				"type": "color",
				"defaultValue": "#e1e2de",
				"visibleWhen": {
					"gte": 4,
					"key": "customColorCount"
				}
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
	},
	"pixelation": {
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
	},
	"pixel-sorting": {
		"type": "pixel-sorting",
		"label": "Pixel Sorting",
		"description": "Shader Lab pixel-sorting pass with threshold band, range, mode, direction, and reverse controls.",
		"params": [
			{
				"key": "threshold",
				"label": "Threshold",
				"type": "number",
				"defaultValue": 0.25,
				"min": 0,
				"max": 1,
				"step": 0.01
			},
			{
				"key": "upperThreshold",
				"label": "Upper Threshold",
				"type": "number",
				"defaultValue": 1,
				"min": 0,
				"max": 1,
				"step": 0.01
			},
			{
				"key": "direction",
				"label": "Direction",
				"type": "select",
				"defaultValue": "horizontal",
				"options": [
					{
						"label": "Horizontal",
						"value": "horizontal"
					},
					{
						"label": "Vertical",
						"value": "vertical"
					}
				]
			},
			{
				"key": "mode",
				"label": "Mode",
				"type": "select",
				"defaultValue": "luma",
				"options": [
					{
						"label": "Luma",
						"value": "luma"
					},
					{
						"label": "Hue",
						"value": "hue"
					},
					{
						"label": "Saturation",
						"value": "saturation"
					}
				]
			},
			{
				"key": "reverse",
				"label": "Reverse",
				"type": "boolean",
				"defaultValue": false
			},
			{
				"key": "range",
				"label": "Range",
				"type": "number",
				"defaultValue": 0.3,
				"min": 0,
				"max": 1,
				"step": 0.01
			}
		]
	},
	"plotter": {
		"type": "plotter",
		"label": "Plotter",
		"description": "Shader Lab plotter pass with hatching gap, stroke weight, threshold, wobble, crosshatch, paper, and ink controls.",
		"params": [
			{
				"key": "colorMode",
				"label": "Color",
				"type": "select",
				"defaultValue": "ink",
				"options": [
					{
						"label": "Ink",
						"value": "ink"
					},
					{
						"label": "Source",
						"value": "source"
					}
				]
			},
			{
				"key": "gap",
				"label": "Gap",
				"type": "number",
				"defaultValue": 12,
				"min": 10,
				"max": 120,
				"step": 1
			},
			{
				"key": "weight",
				"label": "Weight",
				"type": "number",
				"defaultValue": 1.5,
				"min": 0.5,
				"max": 5,
				"step": 0.1
			},
			{
				"key": "angle",
				"label": "Angle",
				"type": "number",
				"defaultValue": 90,
				"min": 0,
				"max": 180,
				"step": 1
			},
			{
				"key": "crosshatch",
				"label": "Crosshatch",
				"type": "boolean",
				"defaultValue": true
			},
			{
				"key": "crossAngle",
				"label": "Cross Angle",
				"type": "number",
				"defaultValue": 135,
				"min": 0,
				"max": 180,
				"step": 1,
				"visibleWhen": {
					"key": "crosshatch",
					"equals": true
				}
			},
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
				"key": "wobble",
				"label": "Wobble",
				"type": "number",
				"defaultValue": 0.3,
				"min": 0,
				"max": 1,
				"step": 0.01
			},
			{
				"key": "paperColor",
				"label": "Paper Color",
				"type": "color",
				"defaultValue": "#f5f0e8"
			},
			{
				"key": "inkColor",
				"label": "Ink Color",
				"type": "color",
				"defaultValue": "#1a1a1a",
				"visibleWhen": {
					"key": "colorMode",
					"equals": "ink"
				}
			}
		]
	},
	"posterize": {
		"type": "posterize",
		"label": "Posterize",
		"description": "Shader Lab posterize pass with levels, gamma, and channel/luminance mode controls.",
		"params": [
			{
				"key": "levels",
				"label": "Levels",
				"type": "number",
				"defaultValue": 5,
				"min": 2,
				"max": 16,
				"step": 1
			},
			{
				"key": "gamma",
				"label": "Gamma",
				"type": "number",
				"defaultValue": 1,
				"min": 0.4,
				"max": 2.5,
				"step": 0.01
			},
			{
				"key": "mode",
				"label": "Mode",
				"type": "select",
				"defaultValue": "rgb",
				"options": [
					{
						"label": "RGB",
						"value": "rgb"
					},
					{
						"label": "Luma",
						"value": "luma"
					}
				]
			}
		]
	},
	"slice": {
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
	},
	"smear": {
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
	},
		"threshold": {
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
		},
	"voxel": {
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
	}
} as const satisfies Record<ShaderLabRuntimeEffectType, ShaderLabEffectDefinition>;

const SHADER_LAB_CUSTOM_SHADER_STARTER = `export const sketch = Fn(() => {
  const uv0 = screenAspectUV(screenSize)
  const color = vec3(
    uv0.x.add(0.5),
    uv0.y.add(0.5),
    sin(time).mul(0.5).add(0.5)
  ).toVar()

  color.assign(technicolorTonemap(color))

  return color
})
`;

export const SHADER_LAB_SOURCE_DEFINITIONS = {
	"fluid": {
		type: "fluid",
		kind: "source",
		label: "Fluid",
		description: "Shader Lab fluid source layer with WebGPU dye simulation, auto splats, curl, dissipation, pressure, radius, force, brightness, and color mode controls.",
		params: [
			{ key: "simRes", label: "Sim Resolution", type: "number", defaultValue: 192, min: 32, max: 512, step: 32, group: "Simulation" },
			{ key: "dyeRes", label: "Dye Resolution", type: "number", defaultValue: 1024, min: 128, max: 2048, step: 64, group: "Simulation" },
			{ key: "iterations", label: "Iterations", type: "number", defaultValue: 20, min: 1, max: 32, step: 1, group: "Simulation" },
			{ key: "densityDissipation", label: "Density Dissipation", type: "number", defaultValue: 4, min: 0, max: 8, step: 0.01, group: "Simulation" },
			{ key: "velocityDissipation", label: "Velocity Dissipation", type: "number", defaultValue: 0.2, min: 0, max: 4, step: 0.01, group: "Simulation" },
			{ key: "pressureDissipation", label: "Pressure Dissipation", type: "number", defaultValue: 0, min: 0, max: 1, step: 0.01, group: "Simulation" },
			{ key: "curlStrength", label: "Curl", type: "number", defaultValue: 30, min: 0, max: 80, step: 1, group: "Simulation" },
			{ key: "radius", label: "Radius", type: "number", defaultValue: 1, min: 0.05, max: 2, step: 0.01, group: "Interaction" },
			{ key: "splatForce", label: "Splat Force", type: "number", defaultValue: 6000, min: 500, max: 15000, step: 100, group: "Interaction" },
			{ key: "autoSplats", label: "Auto Splats", type: "boolean", defaultValue: true, group: "Interaction" },
			{ key: "brightness", label: "Brightness", type: "number", defaultValue: 1.6, min: 0.1, max: 4, step: 0.01, group: "Color" },
			{
				key: "colorMode",
				label: "Color Mode",
				type: "select",
				defaultValue: "monochrome",
				group: "Color",
				options: [
					{ label: "Monochrome", value: "monochrome" },
					{ label: "Duotone", value: "duotone" },
					{ label: "Source", value: "source" },
				],
			},
			{ key: "monoDark", label: "Mono Dark", type: "color", defaultValue: "#000000", group: "Color", visibleWhen: { equals: "monochrome", key: "colorMode" } },
			{ key: "monoLight", label: "Mono Light", type: "color", defaultValue: "#ffffff", group: "Color", visibleWhen: { equals: "monochrome", key: "colorMode" } },
			{ key: "duotoneDark", label: "Duotone Dark", type: "color", defaultValue: "#101010", group: "Color", visibleWhen: { equals: "duotone", key: "colorMode" } },
			{ key: "duotoneLight", label: "Duotone Light", type: "color", defaultValue: "#f3f3ef", group: "Color", visibleWhen: { equals: "duotone", key: "colorMode" } },
		],
	},
	"pixel-trail": {
		type: "pixel-trail",
		kind: "source",
		label: "Pixel Trail",
		description: "Shader Lab pixel-trail source layer that samples the incoming image through a pointer-driven grid trail with cell size, radius, decay, displacement, and intensity controls.",
		params: [
			{ key: "cellSize", label: "Cell Size", type: "number", defaultValue: 24, min: 4, max: 128, step: 1, group: "Trail" },
			{ key: "radius", label: "Radius", type: "number", defaultValue: 0.04, min: 0.005, max: 0.3, step: 0.005, group: "Trail" },
			{ key: "decay", label: "Decay", type: "number", defaultValue: 0.9, min: 0.5, max: 0.999, step: 0.001, group: "Trail" },
			{ key: "displaceAmount", label: "Displace", type: "number", defaultValue: 0.02, min: 0, max: 0.2, step: 0.001, group: "Trail" },
			{ key: "intensity", label: "Intensity", type: "number", defaultValue: 1, min: 0, max: 2, step: 0.05, group: "Trail" },
		],
	},
	"magnify-lens": {
		type: "magnify-lens",
		kind: "source",
		label: "Magnify Lens",
		description: "Shader Lab magnify-lens source layer that tracks pointer position over the incoming image with radius, softness, zoom, chromatic edge, and follow-lag controls.",
		params: [
			{ key: "radius", label: "Radius", type: "number", defaultValue: 0.18, min: 0.02, max: 0.5, step: 0.005, group: "Lens" },
			{ key: "softness", label: "Softness", type: "number", defaultValue: 0.4, min: 0, max: 1, step: 0.01, group: "Lens" },
			{ key: "zoom", label: "Zoom", type: "number", defaultValue: 1.8, min: 1, max: 4, step: 0.05, group: "Lens" },
			{ key: "chromaStrength", label: "Chromatic Edge", type: "number", defaultValue: 0.012, min: 0, max: 0.05, step: 0.001, group: "Lens" },
			{ key: "followLag", label: "Follow Lag", type: "number", defaultValue: 0.2, min: 0, max: 0.95, step: 0.01, group: "Lens" },
		],
	},
	"mesh-gradient": {
		type: "mesh-gradient",
		runtimeType: "gradient",
		kind: "source",
		label: "Mesh Gradient",
		description: "Shader Lab mesh-gradient source layer, backed by the runtime gradient pass, with five weighted color points, noise warp, vortex motion, tonemapping, glow, grain, and vignette controls.",
		params: [
			{ key: "preset", label: "Preset", type: "select", defaultValue: "custom", group: "Points", options: [
				{ label: "Custom", value: "custom" },
				{ label: "Forest", value: "aurora" },
				{ label: "Ember", value: "sunset" },
				{ label: "Abyss", value: "deep-ocean" },
				{ label: "Violet", value: "neon-glow" },
			] },
			{ key: "activePoints", label: "Active Points", type: "number", defaultValue: 5, min: 2, max: 5, step: 1, group: "Points" },
			{ key: "point1Color", label: "Point 1 Color", type: "color", defaultValue: "#0b0f17", group: "Points" },
			{ key: "point1Position", label: "Point 1 Position", type: "vec2", defaultValue: [-0.82, -0.62], min: -1.5, max: 1.5, step: 0.01, group: "Points" },
			{ key: "point1Weight", label: "Point 1 Weight", type: "number", defaultValue: 0.62, min: 0, max: 3, step: 0.01, group: "Points" },
			{ key: "point2Color", label: "Point 2 Color", type: "color", defaultValue: "#1868DB", group: "Points" },
			{ key: "point2Position", label: "Point 2 Position", type: "vec2", defaultValue: [0.22, 0.72], min: -1.5, max: 1.5, step: 0.01, group: "Points" },
			{ key: "point2Weight", label: "Point 2 Weight", type: "number", defaultValue: 1.55, min: 0, max: 3, step: 0.01, group: "Points" },
			{ key: "point3Color", label: "Point 3 Color", type: "color", defaultValue: "#FCA700", group: "Points", visibleWhen: { key: "activePoints", gte: 3 } },
			{ key: "point3Position", label: "Point 3 Position", type: "vec2", defaultValue: [0.88, -0.26], min: -1.5, max: 1.5, step: 0.01, group: "Points", visibleWhen: { key: "activePoints", gte: 3 } },
			{ key: "point3Weight", label: "Point 3 Weight", type: "number", defaultValue: 0.86, min: 0, max: 3, step: 0.01, group: "Points", visibleWhen: { key: "activePoints", gte: 3 } },
			{ key: "point4Color", label: "Point 4 Color", type: "color", defaultValue: "#AF59E1", group: "Points", visibleWhen: { key: "activePoints", gte: 4 } },
			{ key: "point4Position", label: "Point 4 Position", type: "vec2", defaultValue: [-0.34, 0.52], min: -1.5, max: 1.5, step: 0.01, group: "Points", visibleWhen: { key: "activePoints", gte: 4 } },
			{ key: "point4Weight", label: "Point 4 Weight", type: "number", defaultValue: 0.82, min: 0, max: 3, step: 0.01, group: "Points", visibleWhen: { key: "activePoints", gte: 4 } },
			{ key: "point5Color", label: "Point 5 Color", type: "color", defaultValue: "#66D9E8", group: "Points", visibleWhen: { key: "activePoints", gte: 5 } },
			{ key: "point5Position", label: "Point 5 Position", type: "vec2", defaultValue: [0.58, -0.76], min: -1.5, max: 1.5, step: 0.01, group: "Points", visibleWhen: { key: "activePoints", gte: 5 } },
			{ key: "point5Weight", label: "Point 5 Weight", type: "number", defaultValue: 0.48, min: 0, max: 3, step: 0.01, group: "Points", visibleWhen: { key: "activePoints", gte: 5 } },
			{ key: "noiseType", label: "Noise", type: "select", defaultValue: "ridge", group: "Distortion", options: [
				{ label: "Simplex", value: "simplex" },
				{ label: "Perlin", value: "perlin" },
				{ label: "Value", value: "value" },
				{ label: "Voronoi", value: "voronoi" },
				{ label: "Ridge", value: "ridge" },
				{ label: "Turbulence", value: "turbulence" },
			] },
			{ key: "noiseSeed", label: "Seed", type: "number", defaultValue: 70.3, min: 0, max: 100, step: 0.1, group: "Distortion" },
			{ key: "warpAmount", label: "Warp Amount", type: "number", defaultValue: 0.22, min: 0, max: 1, step: 0.01, group: "Distortion" },
			{ key: "warpScale", label: "Warp Scale", type: "number", defaultValue: 2.35, min: 0.1, max: 6, step: 0.01, group: "Distortion" },
			{ key: "warpIterations", label: "Iterations", type: "number", defaultValue: 2, min: 1, max: 5, step: 1, group: "Distortion" },
			{ key: "warpDecay", label: "Warp Decay", type: "number", defaultValue: 1, min: 0.1, max: 3, step: 0.01, group: "Distortion" },
			{ key: "warpBias", label: "Warp Bias", type: "number", defaultValue: 0.5, min: 0, max: 1, step: 0.01, group: "Distortion" },
			{ key: "vortexAmount", label: "Vortex", type: "number", defaultValue: 0.18, min: -1, max: 1, step: 0.01, group: "Distortion" },
			{ key: "animate", label: "Animate", type: "boolean", defaultValue: true, group: "Animation" },
			{ key: "motionAmount", label: "Motion Amount", type: "number", defaultValue: 0.5, min: 0, max: 1, step: 0.01, group: "Animation" },
			{ key: "motionSpeed", label: "Motion Speed", type: "number", defaultValue: 0.4, min: 0, max: 2, step: 0.01, group: "Animation", visibleWhen: { equals: true, key: "animate" } },
			{ key: "falloff", label: "Falloff", type: "number", defaultValue: 2.05, min: 0.5, max: 4, step: 0.01, group: "Distortion" },
			{ key: "tonemapMode", label: "Tonemap", type: "select", defaultValue: "cinematic", group: "Finish", options: [
				{ label: "None", value: "none" },
				{ label: "ACES", value: "aces" },
				{ label: "Reinhard", value: "reinhard" },
				{ label: "Toto's", value: "totos" },
				{ label: "Cinematic", value: "cinematic" },
			] },
			{ key: "glowStrength", label: "Glow Strength", type: "number", defaultValue: 0.18, min: 0, max: 1, step: 0.01, group: "Finish" },
			{ key: "glowThreshold", label: "Glow Threshold", type: "number", defaultValue: 0.46, min: 0, max: 1, step: 0.01, group: "Finish" },
			{ key: "grainAmount", label: "Grain", type: "number", defaultValue: 0.08, min: 0, max: 1, step: 0.01, group: "Finish" },
			{ key: "vignetteStrength", label: "Vignette Strength", type: "number", defaultValue: 0.12, min: 0, max: 1, step: 0.01, group: "Finish" },
			{ key: "vignetteRadius", label: "Vignette Radius", type: "number", defaultValue: 1.5, min: 0, max: 1.5, step: 0.01, group: "Finish" },
			{ key: "vignetteSoftness", label: "Vignette Softness", type: "number", defaultValue: 1, min: 0.01, max: 1, step: 0.01, group: "Finish" },
		],
	},
	"custom-shader": {
		type: "custom-shader",
		kind: "source",
		label: "Custom Shader",
		description: "Shader Lab custom shader source layer that compiles pasted TSL code with source/effect mode, entry export, source file name, and revision controls.",
		params: [
			{ key: "effectMode", label: "Effect Mode", type: "boolean", defaultValue: false, group: "Code" },
			{ key: "sourceMode", label: "Source Mode", type: "select", defaultValue: "paste", group: "Code", options: [
				{ label: "Paste", value: "paste" },
				{ label: "File", value: "file" },
			] },
			{ key: "sourceCode", label: "Source Code", type: "text", defaultValue: SHADER_LAB_CUSTOM_SHADER_STARTER, group: "Code" },
			{ key: "sourceFileName", label: "Source File", type: "text", defaultValue: "", group: "Code" },
			{ key: "entryExport", label: "Entry Export", type: "text", defaultValue: "sketch", group: "Code" },
			{ key: "sourceRevision", label: "Source Revision", type: "number", defaultValue: 0, min: 0, max: Number.MAX_SAFE_INTEGER, step: 1, group: "Code" },
		],
	},
} as const satisfies Record<ShaderLabRuntimeSourceType, ShaderLabEffectDefinition>;

export const SHADER_LAB_LAYER_DEFINITIONS = {
	...SHADER_LAB_EFFECT_DEFINITIONS,
	...SHADER_LAB_SOURCE_DEFINITIONS,
} as const satisfies Record<ShaderLabRuntimeLayerType, ShaderLabEffectDefinition>;
