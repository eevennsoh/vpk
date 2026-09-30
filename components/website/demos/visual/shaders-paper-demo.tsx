"use client";

import { createElement, useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "motion/react";
import {
	ColorPanels,
	Dithering,
	DotGrid,
	DotOrbit,
	FlutedGlass,
	GemSmoke,
	GodRays,
	GrainGradient,
	HalftoneCmyk,
	HalftoneDots,
	Heatmap,
	ImageDithering,
	LensDistortion,
	LiquidMetal,
	MeshGradient,
	Metaballs,
	NeuroNoise,
	PaperTexture,
	PerlinNoise,
	PulsingBorder,
	SimplexNoise,
	SmokeRing,
	Spiral,
	StaticMeshGradient,
	StaticRadialGradient,
	Swirl,
	Voronoi,
	Warp,
	Water,
	Waves,
	colorPanelsPresets,
	ditheringPresets,
	dotGridPresets,
	dotOrbitPresets,
	flutedGlassPresets,
	gemSmokePresets,
	godRaysPresets,
	grainGradientPresets,
	halftoneCmykPresets,
	halftoneDotsPresets,
	heatmapPresets,
	imageDitheringPresets,
	lensDistortionPresets,
	liquidMetalPresets,
	meshGradientPresets,
	metaballsPresets,
	neuroNoisePresets,
	paperTexturePresets,
	perlinNoisePresets,
	pulsingBorderPresets,
	simplexNoisePresets,
	smokeRingPresets,
	spiralPresets,
	staticMeshGradientPresets,
	staticRadialGradientPresets,
	swirlPresets,
	voronoiPresets,
	warpPresets,
	waterPresets,
	wavesPresets,
} from "@paper-design/shaders-react";

import { GUI } from "@/components/utils/gui";
import { token } from "@/lib/tokens";
import { LENS_DISTORTION_NUMBER_CONTROLS, PAPER_TEXTURE_NUMBER_CONTROLS, type NumberControlMeta } from "@/components/website/demos/visual/shaders-paper-control-meta";

const DEFAULT_SLUG = "paper-mesh-gradient";
const DEMO_IMAGE = "/ambient/ado/combo/primary/blue.svg";

type PaperShaderSlug =
	| "paper-color-panels"
	| "paper-dithering"
	| "paper-dot-grid"
	| "paper-dot-orbit"
	| "paper-fluted-glass"
	| "paper-gem-smoke"
	| "paper-god-rays"
	| "paper-grain-gradient"
	| "paper-halftone-cmyk"
	| "paper-halftone-dots"
	| "paper-heatmap"
	| "paper-image-dithering"
	| "paper-lens-distortion"
	| "paper-liquid-metal"
	| "paper-mesh-gradient"
	| "paper-metaballs"
	| "paper-neuro-noise"
	| "paper-paper-texture"
	| "paper-perlin-noise"
	| "paper-pulsing-border"
	| "paper-simplex-noise"
	| "paper-smoke-ring"
	| "paper-spiral"
	| "paper-static-mesh-gradient"
	| "paper-static-radial-gradient"
	| "paper-swirl"
	| "paper-voronoi"
	| "paper-warp"
	| "paper-water"
	| "paper-waves";

type PaperShaderPreset = {
	name: string;
	params: object;
};

type PaperShaderDefinition = {
	name: string;
	component: ElementType;
	presets: readonly PaperShaderPreset[];
	image?: string;
};

type PaperShadersDemoProps = {
	slug?: string;
};

type PaperShaderParamValue = boolean | number | string | string[] | undefined;
type PaperShaderParams = Record<string, PaperShaderParamValue>;

type SelectOption = Readonly<{
	value: string;
	label: string;
}>;

const COMMON_NUMBER_CONTROL_META = {
	speed: { min: -3, max: 3, step: 0.05 },
	frame: { min: 0, max: 10000, step: 1 },
	scale: { min: 0.01, max: 4, step: 0.01 },
	rotation: { min: 0, max: 360, step: 1, unit: "deg" },
	offsetX: { min: -1, max: 1, step: 0.01 },
	offsetY: { min: -1, max: 1, step: 0.01 },
	originX: { min: 0, max: 1, step: 0.01 },
	originY: { min: 0, max: 1, step: 0.01 },
	worldWidth: { min: 0, max: 1000, step: 1 },
	worldHeight: { min: 0, max: 1000, step: 1 },
} as const satisfies Record<string, NumberControlMeta>;

const DEFAULT_NUMBER_CONTROL_META = {
	min: 0,
	max: 1,
	step: 0.01,
} as const satisfies NumberControlMeta;

const NUMBER_CONTROL_META: Record<string, NumberControlMeta> = {
	...COMMON_NUMBER_CONTROL_META,
	amplitude: { min: 0, max: 1, step: 0.01 },
	angle: { min: 0, max: 360, step: 1, unit: "deg" },
	bandCount: { min: 0, max: 15, step: 1 },
	bloom: DEFAULT_NUMBER_CONTROL_META,
	blur: DEFAULT_NUMBER_CONTROL_META,
	brightness: DEFAULT_NUMBER_CONTROL_META,
	caustic: DEFAULT_NUMBER_CONTROL_META,
	center: DEFAULT_NUMBER_CONTROL_META,
	colorSteps: { min: 1, max: 7, step: 1 },
	contrast: DEFAULT_NUMBER_CONTROL_META,
	contour: DEFAULT_NUMBER_CONTROL_META,
	count: { min: 1, max: 20, step: 1 },
	crumples: DEFAULT_NUMBER_CONTROL_META,
	density: DEFAULT_NUMBER_CONTROL_META,
	distortion: DEFAULT_NUMBER_CONTROL_META,
	distortionFreq: { min: 0, max: 20, step: 1 },
	distortionShift: { min: -1, max: 1, step: 0.01 },
	drops: DEFAULT_NUMBER_CONTROL_META,
	edges: DEFAULT_NUMBER_CONTROL_META,
	fade: DEFAULT_NUMBER_CONTROL_META,
	fadeIn: DEFAULT_NUMBER_CONTROL_META,
	fadeOut: DEFAULT_NUMBER_CONTROL_META,
	falloff: { min: -1, max: 1, step: 0.01 },
	fiber: DEFAULT_NUMBER_CONTROL_META,
	fiberSize: DEFAULT_NUMBER_CONTROL_META,
	focalAngle: { min: 0, max: 360, step: 1, unit: "deg" },
	focalDistance: { min: 0, max: 3, step: 0.01 },
	folds: DEFAULT_NUMBER_CONTROL_META,
	frequency: { min: 0, max: 2, step: 0.01 },
	gainC: { min: -1, max: 1, step: 0.01 },
	gainK: { min: -1, max: 1, step: 0.01 },
	gainM: { min: -1, max: 1, step: 0.01 },
	gainY: { min: -1, max: 1, step: 0.01 },
	gap: { min: 0, max: 0.1, step: 0.001 },
	gapX: { min: 2, max: 500, step: 1 },
	gapY: { min: 2, max: 500, step: 1 },
	glow: DEFAULT_NUMBER_CONTROL_META,
	grainMixer: DEFAULT_NUMBER_CONTROL_META,
	grainOverlay: DEFAULT_NUMBER_CONTROL_META,
	grainSize: DEFAULT_NUMBER_CONTROL_META,
	gridNoise: DEFAULT_NUMBER_CONTROL_META,
	highlights: DEFAULT_NUMBER_CONTROL_META,
	innerDistortion: DEFAULT_NUMBER_CONTROL_META,
	innerGlow: DEFAULT_NUMBER_CONTROL_META,
	innerShape: { min: 0, max: 4, step: 0.01 },
	intensity: DEFAULT_NUMBER_CONTROL_META,
	lacunarity: { min: 1.5, max: 10, step: 0.1 },
	layering: DEFAULT_NUMBER_CONTROL_META,
	length: { min: 0, max: 3, step: 0.01 },
	margin: DEFAULT_NUMBER_CONTROL_META,
	marginBottom: DEFAULT_NUMBER_CONTROL_META,
	marginLeft: DEFAULT_NUMBER_CONTROL_META,
	marginRight: DEFAULT_NUMBER_CONTROL_META,
	marginTop: DEFAULT_NUMBER_CONTROL_META,
	midIntensity: DEFAULT_NUMBER_CONTROL_META,
	midSize: DEFAULT_NUMBER_CONTROL_META,
	mixing: DEFAULT_NUMBER_CONTROL_META,
	noise: DEFAULT_NUMBER_CONTROL_META,
	noiseFrequency: DEFAULT_NUMBER_CONTROL_META,
	noiseIterations: { min: 1, max: 8, step: 1 },
	noiseScale: { min: 0.01, max: 5, step: 0.01 },
	octaveCount: { min: 1, max: 8, step: 1 },
	offset: { min: -1, max: 1, step: 0.01 },
	opacityRange: DEFAULT_NUMBER_CONTROL_META,
	outerDistortion: DEFAULT_NUMBER_CONTROL_META,
	outerGlow: DEFAULT_NUMBER_CONTROL_META,
	persistence: { min: 0.3, max: 1, step: 0.01 },
	positions: { min: 0, max: 100, step: 1 },
	proportion: DEFAULT_NUMBER_CONTROL_META,
	pulse: DEFAULT_NUMBER_CONTROL_META,
	radius: DEFAULT_NUMBER_CONTROL_META,
	repetition: { min: 1, max: 10, step: 1 },
	roughness: DEFAULT_NUMBER_CONTROL_META,
	roundness: DEFAULT_NUMBER_CONTROL_META,
	seed: { min: 0, max: 1000, step: 0.1 },
	shape: { min: 0, max: 3, step: 1 },
	shapeScale: DEFAULT_NUMBER_CONTROL_META,
	shift: { min: -1, max: 1, step: 0.01 },
	shiftBlue: { min: -1, max: 1, step: 0.01 },
	shiftRed: { min: -1, max: 1, step: 0.01 },
	shadows: DEFAULT_NUMBER_CONTROL_META,
	size: DEFAULT_NUMBER_CONTROL_META,
	sizeRange: DEFAULT_NUMBER_CONTROL_META,
	smoke: DEFAULT_NUMBER_CONTROL_META,
	smokeSize: DEFAULT_NUMBER_CONTROL_META,
	softness: DEFAULT_NUMBER_CONTROL_META,
	spacing: { min: 0, max: 2, step: 0.01 },
	spotSize: DEFAULT_NUMBER_CONTROL_META,
	spots: { min: 1, max: 20, step: 1 },
	spotty: DEFAULT_NUMBER_CONTROL_META,
	stepsPerColor: { min: 1, max: 10, step: 1 },
	stretch: DEFAULT_NUMBER_CONTROL_META,
	strokeCap: DEFAULT_NUMBER_CONTROL_META,
	strokeTaper: DEFAULT_NUMBER_CONTROL_META,
	strokeWidth: DEFAULT_NUMBER_CONTROL_META,
	swirl: DEFAULT_NUMBER_CONTROL_META,
	swirlIterations: { min: 0, max: 20, step: 1 },
	thickness: DEFAULT_NUMBER_CONTROL_META,
	twist: DEFAULT_NUMBER_CONTROL_META,
	waveX: DEFAULT_NUMBER_CONTROL_META,
	waveXShift: DEFAULT_NUMBER_CONTROL_META,
	waveY: DEFAULT_NUMBER_CONTROL_META,
	waveYShift: DEFAULT_NUMBER_CONTROL_META,
	waves: DEFAULT_NUMBER_CONTROL_META,
};

const PAPER_SHADER_NUMBER_CONTROL_META: Partial<Record<PaperShaderSlug, Record<string, NumberControlMeta>>> = {
	"paper-color-panels": {
		angle1: { min: -1, max: 1, step: 0.01 },
		angle2: { min: -1, max: 1, step: 0.01 },
		blur: { min: 0, max: 0.5, step: 0.01 },
		density: { min: 0.25, max: 7, step: 0.01 },
	},
	"paper-dithering": {
		size: { min: 1, max: 20, step: 1 },
	},
	"paper-dot-grid": {
		size: { min: 1, max: 100, step: 1 },
		strokeWidth: { min: 0, max: 50, step: 1 },
	},
	"paper-dot-orbit": {
		stepsPerColor: { min: 1, max: 4, step: 1 },
	},
	"paper-fluted-glass": {
		angle: { min: 0, max: 180, step: 1, unit: "deg" },
	},
	"paper-god-rays": {
		density: DEFAULT_NUMBER_CONTROL_META,
	},
	"paper-halftone-cmyk": {
		contrast: { min: 0, max: 2, step: 0.01 },
		size: DEFAULT_NUMBER_CONTROL_META,
	},
	"paper-halftone-dots": {
		radius: { min: 0, max: 2, step: 0.01 },
	},
	"paper-image-dithering": {
		size: { min: 0.5, max: 20, step: 0.5 },
	},
	"paper-lens-distortion": LENS_DISTORTION_NUMBER_CONTROLS,
	"paper-paper-texture": PAPER_TEXTURE_NUMBER_CONTROLS,
	"paper-simplex-noise": {
		stepsPerColor: { min: 1, max: 10, step: 1 },
	},
	"paper-smoke-ring": {
		radius: DEFAULT_NUMBER_CONTROL_META,
		thickness: { min: 0.01, max: 1, step: 0.01 },
	},
	"paper-static-radial-gradient": {
		radius: { min: 0, max: 3, step: 0.01 },
	},
	"paper-swirl": {
		bandCount: { min: 0, max: 15, step: 1 },
	},
	"paper-voronoi": {
		distortion: { min: 0, max: 0.5, step: 0.01 },
		stepsPerColor: { min: 1, max: 3, step: 1 },
	},
	"paper-water": {
		size: { min: 0.01, max: 7, step: 0.01 },
	},
};

const PAPER_SHADER_SELECT_OPTIONS: Partial<Record<PaperShaderSlug | "*", Record<string, readonly string[]>>> = {
	"*": {
		fit: ["contain", "cover"],
	},
	"paper-dithering": {
		shape: ["simplex", "warp", "dots", "wave", "ripple", "swirl", "sphere"],
		type: ["random", "2x2", "4x4", "8x8"],
	},
	"paper-dot-grid": {
		shape: ["circle", "diamond", "square", "triangle"],
	},
	"paper-fluted-glass": {
		distortionShape: ["prism", "lens", "contour", "cascade", "flat"],
		shape: ["pattern", "wave", "lines", "linesIrregular", "zigzag"],
	},
	"paper-gem-smoke": {
		shape: ["none", "circle", "daisy", "diamond", "metaballs"],
	},
	"paper-grain-gradient": {
		shape: ["wave", "dots", "truchet", "corners", "ripple", "blob", "sphere"],
	},
	"paper-halftone-cmyk": {
		type: ["dots", "ink", "sharp"],
	},
	"paper-halftone-dots": {
		grid: ["square", "hex"],
		type: ["classic", "gooey", "holes", "soft"],
	},
	"paper-image-dithering": {
		type: ["random", "2x2", "4x4", "8x8"],
	},
	"paper-liquid-metal": {
		shape: ["none", "circle", "daisy", "diamond", "metaballs"],
	},
	"paper-pulsing-border": {
		aspectRatio: ["auto", "square"],
	},
	"paper-warp": {
		shape: ["checks", "stripes", "edge"],
	},
};

const PAPER_SHADER_COLOR_LIMITS: Partial<Record<PaperShaderSlug, number>> = {
	"paper-color-panels": 7,
	"paper-dot-orbit": 10,
	"paper-gem-smoke": 6,
	"paper-god-rays": 5,
	"paper-grain-gradient": 7,
	"paper-heatmap": 10,
	"paper-mesh-gradient": 10,
	"paper-metaballs": 8,
	"paper-pulsing-border": 5,
	"paper-simplex-noise": 10,
	"paper-smoke-ring": 10,
	"paper-static-mesh-gradient": 10,
	"paper-static-radial-gradient": 10,
	"paper-swirl": 10,
	"paper-voronoi": 5,
	"paper-warp": 10,
};

const TIMING_CONTROL_KEYS = new Set(["speed", "frame"]);
const TRANSFORM_CONTROL_KEYS = new Set([
	"fit",
	"scale",
	"rotation",
	"offsetX",
	"offsetY",
	"originX",
	"originY",
	"worldWidth",
	"worldHeight",
]);
const INTERNAL_CONTROL_KEYS = new Set(["frame", "originX", "originY", "worldWidth", "worldHeight"]);

const PAPER_SHADER_VISIBLE_COMMON_CONTROL_KEYS: Record<PaperShaderSlug, readonly string[]> = {
	"paper-color-panels": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-dithering": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-dot-grid": ["rotation"],
	"paper-dot-orbit": ["speed", "scale"],
	"paper-fluted-glass": ["scale", "fit"],
	"paper-gem-smoke": ["speed", "scale"],
	"paper-god-rays": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-grain-gradient": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-halftone-cmyk": ["scale", "fit"],
	"paper-halftone-dots": ["scale", "fit"],
	"paper-heatmap": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-image-dithering": ["scale", "fit"],
	"paper-lens-distortion": ["scale", "fit"],
	"paper-liquid-metal": ["speed", "scale", "rotation", "offsetX", "offsetY", "fit"],
	"paper-mesh-gradient": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-metaballs": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-neuro-noise": ["speed", "scale", "rotation"],
	"paper-paper-texture": ["scale", "fit"],
	"paper-perlin-noise": ["speed", "scale", "rotation"],
	"paper-pulsing-border": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-simplex-noise": ["speed", "scale", "rotation"],
	"paper-smoke-ring": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-spiral": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-static-mesh-gradient": ["scale", "rotation", "offsetX", "offsetY"],
	"paper-static-radial-gradient": ["offsetX", "offsetY"],
	"paper-swirl": ["speed", "scale", "rotation", "offsetX", "offsetY"],
	"paper-voronoi": ["speed", "scale", "rotation"],
	"paper-warp": ["speed", "scale", "rotation"],
	"paper-water": ["speed", "scale", "fit"],
	"paper-waves": ["scale", "rotation"],
};

const PAPER_SHADER_HIDDEN_CONTROL_KEYS: Partial<Record<PaperShaderSlug, readonly string[]>> = {
	"paper-fluted-glass": ["marginLeft", "marginRight", "marginTop", "marginBottom"],
	"paper-pulsing-border": ["margin"],
};

const PAPER_SHADER_DEMOS: Record<PaperShaderSlug, PaperShaderDefinition> = {
	"paper-color-panels": {
		name: "Color Panels",
		component: ColorPanels,
		presets: colorPanelsPresets,
	},
	"paper-dithering": {
		name: "Dithering",
		component: Dithering,
		presets: ditheringPresets,
	},
	"paper-dot-grid": {
		name: "Dot Grid",
		component: DotGrid,
		presets: dotGridPresets,
	},
	"paper-dot-orbit": {
		name: "Dot Orbit",
		component: DotOrbit,
		presets: dotOrbitPresets,
	},
	"paper-fluted-glass": {
		name: "Fluted Glass",
		component: FlutedGlass,
		presets: flutedGlassPresets,
		image: DEMO_IMAGE,
	},
	"paper-gem-smoke": {
		name: "Gem Smoke",
		component: GemSmoke,
		presets: gemSmokePresets,
		image: DEMO_IMAGE,
	},
	"paper-god-rays": {
		name: "God Rays",
		component: GodRays,
		presets: godRaysPresets,
	},
	"paper-grain-gradient": {
		name: "Grain Gradient",
		component: GrainGradient,
		presets: grainGradientPresets,
	},
	"paper-halftone-cmyk": {
		name: "Halftone CMYK",
		component: HalftoneCmyk,
		presets: halftoneCmykPresets,
		image: DEMO_IMAGE,
	},
	"paper-halftone-dots": {
		name: "Halftone Dots",
		component: HalftoneDots,
		presets: halftoneDotsPresets,
		image: DEMO_IMAGE,
	},
	"paper-heatmap": {
		name: "Heatmap",
		component: Heatmap,
		presets: heatmapPresets,
		image: DEMO_IMAGE,
	},
	"paper-image-dithering": {
		name: "Image Dithering",
		component: ImageDithering,
		presets: imageDitheringPresets,
		image: DEMO_IMAGE,
	},
	"paper-liquid-metal": {
		name: "Liquid Metal",
		component: LiquidMetal,
		presets: liquidMetalPresets,
		image: DEMO_IMAGE,
	},
	"paper-lens-distortion": {
		name: "Lens Distortion",
		component: LensDistortion,
		presets: lensDistortionPresets,
		image: DEMO_IMAGE,
	},
	"paper-mesh-gradient": {
		name: "Mesh Gradient",
		component: MeshGradient,
		presets: meshGradientPresets,
	},
	"paper-metaballs": {
		name: "Metaballs",
		component: Metaballs,
		presets: metaballsPresets,
	},
	"paper-neuro-noise": {
		name: "Neuro Noise",
		component: NeuroNoise,
		presets: neuroNoisePresets,
	},
	"paper-paper-texture": {
		name: "Paper Texture",
		component: PaperTexture,
		presets: paperTexturePresets,
		image: DEMO_IMAGE,
	},
	"paper-perlin-noise": {
		name: "Perlin Noise",
		component: PerlinNoise,
		presets: perlinNoisePresets,
	},
	"paper-pulsing-border": {
		name: "Pulsing Border",
		component: PulsingBorder,
		presets: pulsingBorderPresets,
	},
	"paper-simplex-noise": {
		name: "Simplex Noise",
		component: SimplexNoise,
		presets: simplexNoisePresets,
	},
	"paper-smoke-ring": {
		name: "Smoke Ring",
		component: SmokeRing,
		presets: smokeRingPresets,
	},
	"paper-spiral": {
		name: "Spiral",
		component: Spiral,
		presets: spiralPresets,
	},
	"paper-static-mesh-gradient": {
		name: "Static Mesh Gradient",
		component: StaticMeshGradient,
		presets: staticMeshGradientPresets,
	},
	"paper-static-radial-gradient": {
		name: "Static Radial Gradient",
		component: StaticRadialGradient,
		presets: staticRadialGradientPresets,
	},
	"paper-swirl": {
		name: "Swirl",
		component: Swirl,
		presets: swirlPresets,
	},
	"paper-voronoi": {
		name: "Voronoi",
		component: Voronoi,
		presets: voronoiPresets,
	},
	"paper-warp": {
		name: "Warp",
		component: Warp,
		presets: warpPresets,
	},
	"paper-water": {
		name: "Water",
		component: Water,
		presets: waterPresets,
		image: DEMO_IMAGE,
	},
	"paper-waves": {
		name: "Waves",
		component: Waves,
		presets: wavesPresets,
	},
};

function getSlugFromPathname(pathname: string | null): PaperShaderSlug {
	const slug = pathname?.split("/").filter(Boolean).at(-1);

	if (slug && slug in PAPER_SHADER_DEMOS) {
		return slug as PaperShaderSlug;
	}

	return DEFAULT_SLUG;
}

function getPaperShaderSlug(previewSlug: string | undefined, pathname: string | null): PaperShaderSlug {
	if (previewSlug && previewSlug in PAPER_SHADER_DEMOS) {
		return previewSlug as PaperShaderSlug;
	}

	return getSlugFromPathname(pathname);
}

function clonePaperShaderValue(value: unknown): PaperShaderParamValue {
	if (Array.isArray(value)) {
		return value.filter((entry): entry is string => typeof entry === "string");
	}

	if (
		value === undefined
		|| typeof value === "boolean"
		|| typeof value === "number"
		|| typeof value === "string"
	) {
		return value;
	}

	return undefined;
}

function createPaperShaderParams(
	definition: PaperShaderDefinition,
	preset = definition.presets[0],
): PaperShaderParams {
	const params = Object.fromEntries(
		Object.entries(preset.params).map(([key, value]) => [key, clonePaperShaderValue(value)])
	) as PaperShaderParams;

	return definition.image ? { ...params, image: definition.image } : params;
}

function getReducedMotionShaderProps(
	params: PaperShaderParams,
	shouldReduceMotion: boolean,
): PaperShaderParams {
	const nextParams = { ...params };

	if (shouldReduceMotion && typeof params.speed === "number") {
		nextParams.speed = 0;
	}

	return nextParams;
}

function formatPaperControlLabel(value: string): string {
	const spaced = value
		.replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
		.replace(/\b([CMYK])\b/gu, (match) => match.toUpperCase());

	return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

function getSelectOptions(slug: PaperShaderSlug, key: string): SelectOption[] | undefined {
	const values = PAPER_SHADER_SELECT_OPTIONS[slug]?.[key] ?? PAPER_SHADER_SELECT_OPTIONS["*"]?.[key];

	return values?.map((value) => ({
		value,
		label: formatPaperControlLabel(value),
	}));
}

function getNumberControlMeta(slug: PaperShaderSlug, key: string, value: number): NumberControlMeta {
	return PAPER_SHADER_NUMBER_CONTROL_META[slug]?.[key]
		?? NUMBER_CONTROL_META[key]
		?? {
			min: Math.min(0, Math.floor(value - 1)),
			max: Math.max(1, Math.ceil(value + 1)),
			step: Number.isInteger(value) ? 1 : 0.01,
		};
}

function isColorControlKey(key: string) {
	return key.startsWith("color");
}

function getPaperShaderVisibleControlKeys(slug: PaperShaderSlug, params: PaperShaderParams) {
	const visibleCommonControlKeys = new Set(PAPER_SHADER_VISIBLE_COMMON_CONTROL_KEYS[slug]);
	const hiddenControlKeys = new Set(PAPER_SHADER_HIDDEN_CONTROL_KEYS[slug]);

	return Object.keys(params).filter((key) => {
		if (INTERNAL_CONTROL_KEYS.has(key) || hiddenControlKeys.has(key)) {
			return false;
		}

		if (TIMING_CONTROL_KEYS.has(key) || TRANSFORM_CONTROL_KEYS.has(key)) {
			return visibleCommonControlKeys.has(key);
		}

		return true;
	});
}

function getPaperShaderControlGroups(slug: PaperShaderSlug, params: PaperShaderParams) {
	const keys = getPaperShaderVisibleControlKeys(slug, params);

	return {
		images: keys.filter((key) => key === "image"),
		colors: keys.filter((key) => (
			key === "colors"
			|| (isColorControlKey(key) && typeof params[key] === "string")
		)),
		shader: keys.filter((key) => (
			key !== "image"
			&& key !== "colors"
			&& !(isColorControlKey(key) && typeof params[key] === "string")
			&& !TIMING_CONTROL_KEYS.has(key)
			&& !TRANSFORM_CONTROL_KEYS.has(key)
		)),
		timing: keys.filter((key) => TIMING_CONTROL_KEYS.has(key)),
		transform: keys.filter((key) => TRANSFORM_CONTROL_KEYS.has(key)),
	};
}

function getDefaultParamValue(defaultParams: PaperShaderParams, key: string) {
	return defaultParams[key];
}

function renderPaperShaderControl({
	slug,
	controlKey,
	value,
	defaultValue,
	onChange,
}: Readonly<{
	slug: PaperShaderSlug;
	controlKey: string;
	value: PaperShaderParamValue;
	defaultValue: PaperShaderParamValue;
	onChange: (key: string, value: PaperShaderParamValue) => void;
}>) {
	const id = `${slug}-${controlKey}`;
	const label = formatPaperControlLabel(controlKey);

	if (controlKey === "image") {
		return (
			<GUI.ImageInput
				key={controlKey}
				id={id}
				label={label}
				value={typeof value === "string" ? value : undefined}
				objectFit="contain"
				showClear={slug === "paper-paper-texture"}
				valueKeys={controlKey}
				onChange={(nextValue) => onChange(controlKey, nextValue)}
			/>
		);
	}

	if (Array.isArray(value)) {
		const defaultList = Array.isArray(defaultValue) ? defaultValue : undefined;
		return (
			<GUI.ColorList
				key={controlKey}
				id={id}
				label={label}
				value={value}
				defaultValue={defaultList}
				allowAddRemove
				addColor={value.at(-1) ?? "#ffffff"}
				maxColors={PAPER_SHADER_COLOR_LIMITS[slug] ?? 10}
				valueKeys={controlKey}
				onChange={(nextValue) => onChange(controlKey, nextValue)}
			/>
		);
	}

	if (typeof value === "boolean") {
		return (
			<GUI.Toggle
				key={controlKey}
				id={id}
				label={label}
				checked={value}
				valueKeys={controlKey}
				onChange={(nextValue) => onChange(controlKey, nextValue)}
			/>
		);
	}

	if (typeof value === "string" && isColorControlKey(controlKey)) {
		return (
			<GUI.ColorInput
				key={controlKey}
				id={id}
				label={label}
				value={value}
				defaultValue={typeof defaultValue === "string" ? defaultValue : undefined}
				format="css"
				valueKeys={controlKey}
				onChange={(nextValue) => onChange(controlKey, nextValue)}
			/>
		);
	}

	if (typeof value === "string") {
		const options = getSelectOptions(slug, controlKey);

		if (options) {
			return (
				<GUI.Select
					key={controlKey}
					id={id}
					label={label}
					value={value}
					defaultValue={typeof defaultValue === "string" ? defaultValue : undefined}
					options={options}
					valueKeys={controlKey}
					onChange={(nextValue) => onChange(controlKey, nextValue)}
				/>
			);
		}

		return (
			<GUI.TextInput
				key={controlKey}
				id={id}
				label={label}
				value={value}
				valueKeys={controlKey}
				onChange={(nextValue) => onChange(controlKey, nextValue)}
			/>
		);
	}

	if (typeof value === "number") {
		const meta = getNumberControlMeta(slug, controlKey, value);
		return (
			<GUI.Control
				key={controlKey}
				id={id}
				label={label}
				value={value}
				defaultValue={typeof defaultValue === "number" ? defaultValue : undefined}
				min={meta.min}
				max={meta.max}
				step={meta.step}
				unit={meta.unit}
				valueKeys={controlKey}
				onChange={(nextValue) => onChange(controlKey, nextValue)}
			/>
		);
	}

	return null;
}

export default function PaperShadersDemo({ slug: previewSlug }: Readonly<PaperShadersDemoProps>) {
	const pathname = usePathname();
	const shouldReduceMotion = useReducedMotion() ?? false;
	const slug = getPaperShaderSlug(previewSlug, pathname);
	const definition = PAPER_SHADER_DEMOS[slug];
	const [selectedPresetName, setSelectedPresetName] = useState(definition.presets[0].name);
	const [params, setParams] = useState<PaperShaderParams>(() => createPaperShaderParams(definition));
	const selectedPreset = useMemo(
		() => definition.presets.find((preset) => preset.name === selectedPresetName) ?? definition.presets[0],
		[definition, selectedPresetName],
	);
	const defaultParams = useMemo(
		() => createPaperShaderParams(definition, selectedPreset),
		[definition, selectedPreset],
	);
	const shaderProps = useMemo(
		() => getReducedMotionShaderProps(params, shouldReduceMotion),
		[params, shouldReduceMotion],
	);
	const controlGroups = useMemo(() => getPaperShaderControlGroups(slug, params), [params, slug]);
	const values = useMemo(
		() => ({ preset: selectedPresetName, ...params }),
		[params, selectedPresetName],
	);

	useEffect(() => {
		setSelectedPresetName(definition.presets[0].name);
		setParams(createPaperShaderParams(definition));
	}, [definition]);

	const updateParam = useCallback((key: string, value: PaperShaderParamValue) => {
		setParams((currentParams) => ({
			...currentParams,
			[key]: clonePaperShaderValue(value),
		}));
	}, []);

	const updatePreset = useCallback((presetName: string) => {
		const nextPreset = definition.presets.find((preset) => preset.name === presetName) ?? definition.presets[0];
		setSelectedPresetName(nextPreset.name);
		setParams((currentParams) => {
			const nextParams = createPaperShaderParams(definition, nextPreset);
			return definition.image
				? { ...nextParams, image: currentParams.image }
				: nextParams;
		});
	}, [definition]);

	const renderControls = useCallback(
		(controlKeys: readonly string[]) => controlKeys.map((controlKey) => renderPaperShaderControl({
			slug,
			controlKey,
			value: params[controlKey],
			defaultValue: getDefaultParamValue(defaultParams, controlKey),
			onChange: updateParam,
		})),
		[defaultParams, params, slug, updateParam],
	);

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col" style={{ gap: token("space.400") }}>
			<div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface">
				{createElement(definition.component, {
					...shaderProps,
					className: "size-full",
					width: "100%",
					height: "100%",
				})}
			</div>
			<GUI.Panel title="Shader controls" values={values}>
				<GUI.Select
					id={`${slug}-preset`}
					label="Preset"
					value={selectedPresetName}
					defaultValue={definition.presets[0].name}
					options={definition.presets.map((preset) => ({
						value: preset.name,
						label: preset.name,
					}))}
					valueKeys="preset"
					onChange={updatePreset}
				/>

				{controlGroups.images.length > 0 ? (
					<GUI.Section title="Image">
						{renderControls(controlGroups.images)}
					</GUI.Section>
				) : null}

				{controlGroups.colors.length > 0 ? (
					<GUI.Section title="Colors">
						{renderControls(controlGroups.colors)}
					</GUI.Section>
				) : null}

				{controlGroups.shader.length > 0 ? (
					<GUI.Section title={definition.name}>
						{renderControls(controlGroups.shader)}
					</GUI.Section>
				) : null}

				{controlGroups.timing.length > 0 ? (
					<GUI.Section title="Timing">
						{renderControls(controlGroups.timing)}
					</GUI.Section>
				) : null}

				{controlGroups.transform.length > 0 ? (
					<GUI.Section title="Transform">
						{renderControls(controlGroups.transform)}
					</GUI.Section>
				) : null}
			</GUI.Panel>
		</div>
	);
}
