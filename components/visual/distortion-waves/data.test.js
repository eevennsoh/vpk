import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { PALETTES, defaultStyle } from "distortion-waves";

import {
	DEFAULT_DISTORTION_WAVE_CONFIG,
	DISTORTION_WAVE_PALETTE_OPTIONS,
	DISTORTION_WAVE_SOURCE_METADATA,
	DISTORTION_WAVE_STYLE_GROUPS,
	DISTORTION_WAVE_TYPE_OPTIONS,
	getDistortionWaveStyleDefaults,
} from "./data.ts";

const WAVE_TYPES = ["vertical", "horizontal", "center"];
const PACKAGE_JSON = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
const CONTROLS = DISTORTION_WAVE_STYLE_GROUPS.flatMap((group) => group.controls);

test("Distortion Waves tracks the exact pinned upstream package", () => {
	assert.equal(PACKAGE_JSON.dependencies["distortion-waves"], DISTORTION_WAVE_SOURCE_METADATA.packageVersion);
});

test("every GUI knob is a distinct upstream WaveStyle number", () => {
	assert.ok(CONTROLS.length >= 30, `expected the full knob set, found ${CONTROLS.length}`);
	assert.equal(new Set(CONTROLS.map((control) => control.key)).size, CONTROLS.length, "duplicate knob");
	const style = defaultStyle("vertical");
	for (const { key } of CONTROLS) {
		assert.equal(typeof style[key], "number", `${key} is not an upstream WaveStyle number`);
	}
});

test("every range brackets the defaults of all three wave types", () => {
	for (const type of WAVE_TYPES) {
		const defaults = getDistortionWaveStyleDefaults(type);
		for (const { key, min, max, step } of CONTROLS) {
			assert.ok(step > 0 && min < max, `${key} has an empty range`);
			assert.ok(min <= defaults[key] && defaults[key] <= max, `${type}.${key}=${defaults[key]} outside ${min}–${max}`);
		}
	}
});

test("type defaults come from upstream, and the initial config uses vertical", () => {
	const center = getDistortionWaveStyleDefaults("center");
	assert.equal(center.travel, defaultStyle("center").travel);
	assert.notEqual(center.travel, defaultStyle("vertical").travel);
	assert.deepEqual(DEFAULT_DISTORTION_WAVE_CONFIG.style, getDistortionWaveStyleDefaults("vertical"));
});

test("type and palette options cover upstream", () => {
	assert.deepEqual(DISTORTION_WAVE_TYPE_OPTIONS.map((option) => option.value), WAVE_TYPES);
	const paletteValues = new Set(DISTORTION_WAVE_PALETTE_OPTIONS.map((option) => option.value));
	for (const name of Object.keys(PALETTES)) {
		assert.ok(paletteValues.has(name), `palette ${name} not offered`);
	}
});
