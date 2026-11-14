import type { ShaderLabEffectLayerType, ShaderLabLayerKind, ShaderLabLayerType, ShaderLabParameterValue } from "@basementstudio/shader-lab";

export const SHADER_LAB_BLEND_MODES = [
	"normal",
	"multiply",
	"screen",
	"overlay",
	"darken",
	"lighten",
	"color-dodge",
	"color-burn",
	"hard-light",
	"soft-light",
	"difference",
	"exclusion",
	"hue",
	"saturation",
	"color",
	"luminosity",
] as const;

export const SHADER_LAB_COMPOSITE_MODES = ["filter", "mask"] as const;
export const SHADER_LAB_MASK_SOURCES = ["luminance", "alpha", "red", "green", "blue"] as const;
export const SHADER_LAB_MASK_MODES = ["multiply", "stencil"] as const;

export type ShaderLabRuntimeEffectType = Exclude<
	ShaderLabEffectLayerType,
	"ascii" | "dithering"
>;

export type ShaderLabRuntimeSourceType = "fluid" | "pixel-trail" | "magnify-lens" | "mesh-gradient" | "custom-shader";
export type ShaderLabRuntimeLayerType = ShaderLabRuntimeEffectType | ShaderLabRuntimeSourceType;

export type ShaderLabEffectParamType = "number" | "select" | "boolean" | "color" | "vec2" | "vec3" | "text";

export type ShaderLabVisibleWhen = Readonly<{
	key: string;
	equals?: ShaderLabParameterValue;
	gte?: number;
}>;

export type ShaderLabSelectOption = Readonly<{
	label: string;
	value: string;
}>;

export type ShaderLabEffectParamDefinition = Readonly<{
	key: string;
	label: string;
	type: ShaderLabEffectParamType;
	defaultValue: ShaderLabParameterValue;
	min?: number;
	max?: number;
	step?: number;
	group?: string;
	description?: string;
	options?: readonly ShaderLabSelectOption[];
	visibleWhen?: ShaderLabVisibleWhen;
}>;

export type ShaderLabPresetDefaults = Readonly<
	Record<string, Readonly<Record<string, Readonly<Record<string, ShaderLabParameterValue>>>>>
>;

export type ShaderLabEffectDefinition = Readonly<{
	type: ShaderLabRuntimeLayerType;
	runtimeType?: ShaderLabLayerType;
	kind?: ShaderLabLayerKind;
	label: string;
	description: string;
	params: readonly ShaderLabEffectParamDefinition[];
	/** Param values applied together when a select param changes, keyed by param key then option value. */
	presetDefaults?: ShaderLabPresetDefaults;
}>;

export type ShaderLabPropDoc = Readonly<{
	name: string;
	type: string;
	default?: string;
	description: string;
}>;

export const SHADER_LAB_RUNTIME_EFFECT_TYPES = [
	"bloom",
	"blob-tracking",
	"circuit-bent",
	"directional-blur",
	"chromatic-aberration",
	"crt",
	"displacement-map",
	"edge-detect",
	"fluted-glass",
	"halftone",
	"ink",
	"particle-grid",
	"pattern",
	"pixelation",
	"pixel-sorting",
	"plotter",
	"posterize",
	"slice",
	"smear",
	"threshold",
	"voxel"
] as const satisfies readonly ShaderLabRuntimeEffectType[];

export const SHADER_LAB_RUNTIME_SOURCE_TYPES = [
	"fluid",
	"pixel-trail",
	"magnify-lens",
	"mesh-gradient",
	"custom-shader",
] as const satisfies readonly ShaderLabRuntimeSourceType[];

export const SHADER_LAB_RUNTIME_LAYER_TYPES = [
	...SHADER_LAB_RUNTIME_EFFECT_TYPES,
	...SHADER_LAB_RUNTIME_SOURCE_TYPES,
] as const satisfies readonly ShaderLabRuntimeLayerType[];
