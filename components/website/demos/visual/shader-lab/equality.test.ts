import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import * as shaderLab from "../shader-lab-effect-definitions.ts";

/**
 * Equality guard for splitting the Shader Lab definitions into one module per layer.
 * `equality.fixture.json` was recorded from the single-file definitions on main at
 * f9c730479, before any of them moved. Every later move must keep each layer's
 * fingerprint identical. Usage, import statement and the API prop row are recorded
 * separately because the component API change is expected to change only those.
 */

type Fingerprints = Readonly<{
	layerOrder: string;
	tuples: string;
	halftonePresets: string;
	layers: Record<string, Record<string, string>>;
}>;

const FIXTURE: Fingerprints = JSON.parse(
	readFileSync(path.join(import.meta.dirname, "equality.fixture.json"), "utf8"),
);

const API_PROP_NAME = "layerType";
const HALFTONE_PRESET_VALUES = ["process", "risograph", "newspaper", "vintage"] as const;

function canonical(value: unknown): unknown {
	if (value === undefined) return "__undefined__";
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
		);
	}
	return value;
}

function hash(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function withoutPresetDefaults(definition: object): object {
	const { presetDefaults: _presetDefaults, ...rest } = definition as Record<string, unknown>;
	return rest;
}

function computeFingerprints(): Fingerprints {
	const definitions = shaderLab.SHADER_LAB_LAYER_DEFINITIONS;
	const layers: Record<string, Record<string, string>> = {};

	for (const layerType of shaderLab.SHADER_LAB_RUNTIME_LAYER_TYPES) {
		const propDocs = shaderLab.createShaderLabEffectPropDocs(layerType);
		layers[layerType] = {
			definition: hash(withoutPresetDefaults(definitions[layerType])),
			defaultParams: hash(shaderLab.getShaderLabDefaultParams(layerType)),
			runtimeType: hash(shaderLab.getShaderLabRuntimeLayerType(layerType)),
			kind: hash(shaderLab.getShaderLabLayerKind(layerType)),
			propDocs: hash(propDocs.filter((doc) => doc.name !== API_PROP_NAME)),
			apiPropDoc: hash(propDocs.filter((doc) => doc.name === API_PROP_NAME)),
			description: hash(shaderLab.getShaderLabEffectDescription(layerType)),
			usage: hash(shaderLab.getShaderLabEffectUsage(layerType)),
			importStatement: hash(shaderLab.getShaderLabEffectImportStatement()),
		};
	}

	return {
		layerOrder: hash(Object.keys(definitions)),
		tuples: hash({
			blendModes: shaderLab.SHADER_LAB_BLEND_MODES,
			compositeModes: shaderLab.SHADER_LAB_COMPOSITE_MODES,
			maskModes: shaderLab.SHADER_LAB_MASK_MODES,
			maskSources: shaderLab.SHADER_LAB_MASK_SOURCES,
			runtimeEffectTypes: shaderLab.SHADER_LAB_RUNTIME_EFFECT_TYPES,
			runtimeLayerTypes: shaderLab.SHADER_LAB_RUNTIME_LAYER_TYPES,
			runtimeSourceTypes: shaderLab.SHADER_LAB_RUNTIME_SOURCE_TYPES,
		}),
		halftonePresets: hash(
			HALFTONE_PRESET_VALUES.map((value) => shaderLab.getShaderLabPresetDefaults("halftone", "preset", value)),
		),
		layers,
	};
}

const actual = computeFingerprints();

test("Shader Lab layer order, mode tuples and runtime tuples are unchanged", () => {
	assert.equal(actual.layerOrder, FIXTURE.layerOrder);
	assert.equal(actual.tuples, FIXTURE.tuples);
});

test("Shader Lab halftone preset defaults are unchanged", () => {
	assert.equal(actual.halftonePresets, FIXTURE.halftonePresets);
	assert.equal(shaderLab.getShaderLabPresetDefaults("halftone", "preset", "unknown"), null);
	assert.equal(shaderLab.getShaderLabPresetDefaults("bloom", "preset", "process"), null);
});

test("Shader Lab fingerprints cover exactly the recorded layers", () => {
	assert.deepEqual(Object.keys(actual.layers), Object.keys(FIXTURE.layers));
});

for (const layerType of Object.keys(FIXTURE.layers)) {
	test(`Shader Lab ${layerType} definition, defaults and docs are unchanged`, () => {
		assert.deepEqual(actual.layers[layerType], FIXTURE.layers[layerType]);
	});
}
