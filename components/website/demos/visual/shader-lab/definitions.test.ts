import assert from "node:assert/strict";
import { test } from "node:test";

import {
	getShaderLabEffectImportStatement,
	getShaderLabEffectUsage,
	getShaderLabLayerExportName,
	getShaderLabRuntimeLayerType,
} from "./helpers.ts";
import { SHADER_LAB_LAYER_DEFINITIONS } from "./index.ts";
import {
	SHADER_LAB_RUNTIME_EFFECT_TYPES,
	SHADER_LAB_RUNTIME_LAYER_TYPES,
	SHADER_LAB_RUNTIME_SOURCE_TYPES,
	type ShaderLabEffectParamDefinition,
} from "./types.ts";

const SHADER_LAB_EFFECT_PARAM_COUNTS = {
	bloom: 6,
	"blob-tracking": 25,
	"circuit-bent": 14,
	"directional-blur": 5,
	"chromatic-aberration": 4,
	crt: 24,
	"displacement-map": 4,
	"edge-detect": 6,
	"fluted-glass": 6,
	halftone: 40,
	ink: 25,
	"particle-grid": 12,
	pattern: 18,
	pixelation: 2,
	"pixel-sorting": 6,
	plotter: 10,
	posterize: 3,
	slice: 7,
	smear: 5,
	threshold: 4,
	voxel: 10,
};

const SHADER_LAB_SOURCE_PARAM_COUNTS = {
	"custom-shader": 6,
	fluid: 16,
	"magnify-lens": 5,
	"mesh-gradient": 36,
	"pixel-trail": 5,
};

function paramsByKey(params: readonly ShaderLabEffectParamDefinition[]) {
	return Object.fromEntries(params.map((param) => [param.key, param]));
}

test("Shader Lab param counts track every runtime layer type", () => {
	assert.deepEqual(Object.keys(SHADER_LAB_EFFECT_PARAM_COUNTS).sort(), [...SHADER_LAB_RUNTIME_EFFECT_TYPES].sort());
	assert.deepEqual(Object.keys(SHADER_LAB_SOURCE_PARAM_COUNTS).sort(), [...SHADER_LAB_RUNTIME_SOURCE_TYPES].sort());
});

test("Shader Lab definitions expose all upstream params", () => {
	for (const [layerType, count] of Object.entries({ ...SHADER_LAB_EFFECT_PARAM_COUNTS, ...SHADER_LAB_SOURCE_PARAM_COUNTS })) {
		const definition = SHADER_LAB_LAYER_DEFINITIONS[layerType as keyof typeof SHADER_LAB_LAYER_DEFINITIONS];
		assert.equal(definition.type, layerType);
		assert.equal(definition.params.length, count, layerType);
	}
});

test("blob tracking controls follow the Shader Lab 3 output contract", () => {
	const params = paramsByKey(SHADER_LAB_LAYER_DEFINITIONS["blob-tracking"].params);

	assert.equal(params.sensitivity.defaultValue, 0.8);
	assert.equal(params.motionMaskThreshold.defaultValue, 0.08);
	assert.equal(params.motionPersistence.defaultValue, 0.82);
	assert.equal(params.outputMode.defaultValue, "decorated");
	assert.deepEqual(
		params.outputMode.options?.map((option) => option.value),
		["decorated", "motion"],
	);
	assert.equal(SHADER_LAB_LAYER_DEFINITIONS.bloom.params[0].max, 2);
});

test("Shader Lab sources are source layers and mesh gradient runs on the gradient pass", () => {
	for (const sourceType of SHADER_LAB_RUNTIME_SOURCE_TYPES) {
		assert.equal(SHADER_LAB_LAYER_DEFINITIONS[sourceType].kind, "source", sourceType);
	}
	assert.equal(getShaderLabRuntimeLayerType(SHADER_LAB_LAYER_DEFINITIONS["mesh-gradient"]), "gradient");
	assert.equal(getShaderLabRuntimeLayerType(SHADER_LAB_LAYER_DEFINITIONS.bloom), "bloom");
});

test("each layer module exports its definition under the documented name", async () => {
	for (const layerType of SHADER_LAB_RUNTIME_LAYER_TYPES) {
		const definition = SHADER_LAB_LAYER_DEFINITIONS[layerType];
		const layerModule: Record<string, unknown> = await import(`./layers/${layerType}.ts`);
		assert.deepEqual(Object.keys(layerModule), [getShaderLabLayerExportName(definition)], layerType);
		assert.equal(layerModule[getShaderLabLayerExportName(definition)], definition, layerType);
	}
});

test("Shader Lab docs show the component, definition and both imports a demo uses", () => {
	assert.equal(getShaderLabEffectUsage(SHADER_LAB_LAYER_DEFINITIONS.bloom), "<ShaderLabEffect definition={BLOOM_LAYER} />");
	assert.equal(
		getShaderLabEffectImportStatement(SHADER_LAB_LAYER_DEFINITIONS.bloom),
		'import { ShaderLabEffect } from "@/components/website/demos/visual/shader-lab-effect-demo";\n'
			+ 'import { BLOOM_LAYER } from "@/components/website/demos/visual/shader-lab/layers/bloom";',
	);
	assert.equal(getShaderLabEffectUsage(SHADER_LAB_LAYER_DEFINITIONS["pixel-trail"]), "<ShaderLabLayer definition={PIXEL_TRAIL_LAYER} />");
	assert.equal(
		getShaderLabEffectImportStatement(SHADER_LAB_LAYER_DEFINITIONS["pixel-trail"]),
		'import { ShaderLabLayer } from "@/components/website/demos/visual/shader-lab-effect-demo";\n'
			+ 'import { PIXEL_TRAIL_LAYER } from "@/components/website/demos/visual/shader-lab/layers/pixel-trail";',
	);
});
