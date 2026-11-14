import type {
	ShaderLabEffectDefinition,
	ShaderLabRuntimeEffectType,
	ShaderLabRuntimeLayerType,
	ShaderLabRuntimeSourceType,
} from "./shader-lab/types";
import { BLOB_TRACKING_LAYER } from "./shader-lab/layers/blob-tracking";
import { BLOOM_LAYER } from "./shader-lab/layers/bloom";
import { CHROMATIC_ABERRATION_LAYER } from "./shader-lab/layers/chromatic-aberration";
import { CUSTOM_SHADER_LAYER } from "./shader-lab/layers/custom-shader";
import { DIRECTIONAL_BLUR_LAYER } from "./shader-lab/layers/directional-blur";
import { DISPLACEMENT_MAP_LAYER } from "./shader-lab/layers/displacement-map";
import { EDGE_DETECT_LAYER } from "./shader-lab/layers/edge-detect";
import { FLUID_LAYER } from "./shader-lab/layers/fluid";
import { FLUTED_GLASS_LAYER } from "./shader-lab/layers/fluted-glass";
import { MAGNIFY_LENS_LAYER } from "./shader-lab/layers/magnify-lens";
import { MESH_GRADIENT_LAYER } from "./shader-lab/layers/mesh-gradient";
import { PIXELATION_LAYER } from "./shader-lab/layers/pixelation";
import { PIXEL_SORTING_LAYER } from "./shader-lab/layers/pixel-sorting";
import { PIXEL_TRAIL_LAYER } from "./shader-lab/layers/pixel-trail";
import { POSTERIZE_LAYER } from "./shader-lab/layers/posterize";
import { SLICE_LAYER } from "./shader-lab/layers/slice";

export * from "./shader-lab/helpers";
export * from "./shader-lab/types";

export const SHADER_LAB_EFFECT_DEFINITIONS = {
	"blob-tracking": BLOB_TRACKING_LAYER,
	"bloom": BLOOM_LAYER,
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
	"directional-blur": DIRECTIONAL_BLUR_LAYER,
	"chromatic-aberration": CHROMATIC_ABERRATION_LAYER,
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
	"displacement-map": DISPLACEMENT_MAP_LAYER,
	"edge-detect": EDGE_DETECT_LAYER,
	"fluted-glass": FLUTED_GLASS_LAYER,
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
	"pixelation": PIXELATION_LAYER,
	"pixel-sorting": PIXEL_SORTING_LAYER,
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
	"posterize": POSTERIZE_LAYER,
	"slice": SLICE_LAYER,
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

export const SHADER_LAB_SOURCE_DEFINITIONS = {
	"fluid": FLUID_LAYER,
	"pixel-trail": PIXEL_TRAIL_LAYER,
	"magnify-lens": MAGNIFY_LENS_LAYER,
	"mesh-gradient": MESH_GRADIENT_LAYER,
	"custom-shader": CUSTOM_SHADER_LAYER,
} as const satisfies Record<ShaderLabRuntimeSourceType, ShaderLabEffectDefinition>;

export const SHADER_LAB_LAYER_DEFINITIONS = {
	...SHADER_LAB_EFFECT_DEFINITIONS,
	...SHADER_LAB_SOURCE_DEFINITIONS,
} as const satisfies Record<ShaderLabRuntimeLayerType, ShaderLabEffectDefinition>;
