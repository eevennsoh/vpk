import type { ShaderLabLayerKind, ShaderLabLayerType, ShaderLabParameterValue } from "@basementstudio/shader-lab";

import {
	SHADER_LAB_BLEND_MODES,
	SHADER_LAB_COMPOSITE_MODES,
	SHADER_LAB_MASK_MODES,
	SHADER_LAB_MASK_SOURCES,
	type ShaderLabEffectDefinition,
	type ShaderLabEffectParamDefinition,
	type ShaderLabPropDoc,
	type ShaderLabVisibleWhen,
} from "./types";

export function getShaderLabDefaultParams(definition: ShaderLabEffectDefinition): Record<string, ShaderLabParameterValue> {
	return Object.fromEntries(definition.params.map((param) => [param.key, param.defaultValue]));
}

export function getShaderLabPresetDefaults(
	definition: ShaderLabEffectDefinition,
	key: string,
	value: ShaderLabParameterValue,
): Record<string, ShaderLabParameterValue> | null {
	const keyDefaults = definition.presetDefaults?.[key];
	if (!keyDefaults || typeof value !== "string") return null;
	return keyDefaults[value] ?? null;
}

export function getShaderLabRuntimeLayerType(definition: ShaderLabEffectDefinition): ShaderLabLayerType {
	return (definition.runtimeType ?? definition.type) as ShaderLabLayerType;
}

export function getShaderLabLayerKind(definition: ShaderLabEffectDefinition): ShaderLabLayerKind {
	return definition.kind ?? "effect";
}

export function isShaderLabParamVisible(
	param: ShaderLabEffectParamDefinition,
	params: Record<string, ShaderLabParameterValue>,
): boolean {
	const condition = param.visibleWhen;
	if (!condition) return true;

	const value = params[condition.key];
	if ("equals" in condition) return value === condition.equals;
	if (typeof condition.gte === "number") return typeof value === "number" && value >= condition.gte;
	return true;
}

function quote(value: string): string {
	return '"' + value + '"';
}

function formatStringUnion(values: readonly string[]): string {
	return values.map(quote).join(" | ");
}

function formatDefaultValue(value: ShaderLabParameterValue): string {
	if (typeof value === "string") return quote(value);
	if (Array.isArray(value)) return JSON.stringify(value);
	return String(value);
}

function formatParamType(param: ShaderLabEffectParamDefinition): string {
	if (param.type === "select" && param.options?.length) {
		return formatStringUnion(param.options.map((option) => option.value));
	}

	switch (param.type) {
		case "color":
		case "text":
			return "string";
		case "vec2":
			return "[number, number]";
		case "vec3":
			return "[number, number, number]";
		default:
			return param.type;
	}
}

function describeVisibleWhen(condition: ShaderLabVisibleWhen): string {
	if ("equals" in condition) {
		return " Visible when " + condition.key + " is " + String(condition.equals) + ".";
	}
	if (typeof condition.gte === "number") {
		return " Visible when " + condition.key + " is at least " + condition.gte + ".";
	}
	return "";
}

export function createShaderLabEffectPropDocs(definition: ShaderLabEffectDefinition): ShaderLabPropDoc[] {
	const paramDocs = definition.params.map((param) => ({
		name: param.key,
		type: formatParamType(param),
		default: formatDefaultValue(param.defaultValue),
		description: (param.description ?? "Shader Lab " + param.label + " parameter.") + (param.visibleWhen ? describeVisibleWhen(param.visibleWhen) : ""),
	}));

	return [
		{ name: "layerType", type: quote(definition.type), default: quote(definition.type), description: "Selects the Shader Lab " + definition.label + " layer." },
		{ name: "opacity", type: "number", default: "1", description: "Layer opacity." },
		{ name: "blendMode", type: formatStringUnion(SHADER_LAB_BLEND_MODES), default: quote("normal"), description: "Shader Lab layer blend mode." },
		{ name: "compositeMode", type: formatStringUnion(SHADER_LAB_COMPOSITE_MODES), default: quote("filter"), description: "Whether the effect filters the source or is composited as a mask." },
		{ name: "maskSource", type: formatStringUnion(SHADER_LAB_MASK_SOURCES), default: quote("luminance"), description: "Source channel used when compositeMode is mask." },
		{ name: "maskMode", type: formatStringUnion(SHADER_LAB_MASK_MODES), default: quote("multiply"), description: "Mask compositing behavior used when compositeMode is mask." },
		{ name: "maskInvert", type: "boolean", default: "false", description: "Inverts the layer mask when compositeMode is mask." },
		{ name: "hue", type: "number", default: "0", description: "Layer hue rotation in degrees." },
		{ name: "saturation", type: "number", default: "1", description: "Layer saturation multiplier." },
		...paramDocs,
		{ name: "className", type: "string", description: "Optional classes applied to the demo wrapper." },
	];
}

export function getShaderLabEffectUsage(definition: ShaderLabEffectDefinition): string {
	return "<ShaderLabLayer layerType=\"" + definition.type + "\" />";
}

export function getShaderLabEffectImportStatement(): string {
	return "import { ShaderLabLayer } from \"@/components/website/demos/visual/shader-lab-effect-demo\";";
}

export function optionLabel(value: string): string {
	return value
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}
