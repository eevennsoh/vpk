import assert from "node:assert/strict";
import test from "node:test";
import { resolveVoiceDefaults } from "voice-glow";
// @ts-expect-error Node's strip-types runner requires the explicit extension.
import { getVoiceGlowStatus, resolveVoiceGlowNumbers, VOICE_GLOW_CONTROLS, VOICE_GLOW_DEFAULTS } from "./data.ts";
// @ts-expect-error Node's strip-types runner requires the explicit extension.
import { requestVoiceGlowMicrophone } from "./microphone-request.ts";
// @ts-expect-error Node's strip-types runner requires the explicit extension.
import { createVoiceGlowSimulation, sampleSimulatedVoice } from "./simulated-voice.ts";

test("shape and page theme resolve the upstream tuning without retaining another preset", () => {
	const pill = resolveVoiceGlowNumbers({ ...VOICE_GLOW_DEFAULTS, type: "pill" }, "dark");
	const mobile = resolveVoiceGlowNumbers({ ...VOICE_GLOW_DEFAULTS, type: "mobile" }, "dark");
	assert.equal(pill.scale, 0.45);
	assert.equal(pill.flow, 0);
	assert.equal(mobile.scale, 1.25);
	assert.equal(mobile.reach, 3);
	const light = resolveVoiceGlowNumbers(VOICE_GLOW_DEFAULTS, "light");
	assert.equal(light.coreLight, 1.8);
	assert.equal(light.bandStrength, 1.7);
	assert.deepEqual(light, resolveVoiceGlowNumbers({ ...VOICE_GLOW_DEFAULTS, theme: "light" }, "dark"));
});

test("only current microphone failures override simulated or manual input status", () => {
	const error = new Error("Permission denied");
	for (const state of ["denied", "error"] as const) assert.equal(getVoiceGlowStatus({ state, error }, true), error.message);
	for (const state of ["idle", "requesting", "unsupported"] as const) {
		assert.match(getVoiceGlowStatus({ state, error }, true), /Simulated voice input/);
		assert.match(getVoiceGlowStatus({ state, error }, false), /manual intensity/);
	}
	assert.match(getVoiceGlowStatus({ state: "live", error: null }, true), /Microphone active/);
});

test("simulated voice has phrases and silence, stays bounded, and repeats without a jump", () => {
	for (let frame = 0; frame < 480; frame++) {
		const level = sampleSimulatedVoice(frame / 120);
		assert.ok(level >= 0 && level <= 1);
	}
	assert.ok(sampleSimulatedVoice(3) > sampleSimulatedVoice(1.8) * 10);
	assert.equal(sampleSimulatedVoice(0), sampleSimulatedVoice(4));
	assert.ok(Math.abs(sampleSimulatedVoice(3.999) - sampleSimulatedVoice(4)) < 0.03);
});

test("the sampled voice clock resets and holds its phase across long unsampled gaps", () => {
	let time = 0;
	const simulation = createVoiceGlowSimulation(() => time);
	const first = simulation.read();
	for (let frame = 1; frame <= 40; frame++) { time = frame * 25; simulation.read(); }
	time = 10_000;
	assert.equal(simulation.read(), sampleSimulatedVoice(1.05) * 0.5);
	simulation.reset();
	assert.equal(simulation.read(), first);
});

test("late permission results release every track instead of reactivating a stopped demo", async () => {
	let resolve!: (stream: MediaStream) => void;
	let current = true;
	let stops = 0;
	const stream = { getTracks: () => [{ stop: () => stops++ }, { stop: () => stops++ }] } as unknown as MediaStream;
	const result = requestVoiceGlowMicrophone(() => new Promise<MediaStream>((done) => { resolve = done; }), () => current);
	current = false;
	resolve(stream);
	assert.equal(await result, null);
	assert.equal(stops, 2);
	assert.equal(await requestVoiceGlowMicrophone(async () => stream, () => true), stream);
	assert.equal(stops, 2);
	assert.equal(await requestVoiceGlowMicrophone(async () => null, () => false), null);
});

test("every upstream geometry control is exposed once and its presets fit the GUI bounds", () => {
	const controls = VOICE_GLOW_CONTROLS.flatMap(({ controls }) => [...controls]);
	const keys = controls.map(([key]) => key);
	assert.equal(new Set(keys).size, keys.length);
	for (const key of Object.keys(resolveVoiceDefaults())) assert.ok(keys.includes(key as typeof keys[number]), key);
	for (const type of ["default", "pill", "mobile"] as const) {
		for (const theme of ["dark", "light"] as const) {
			const defaults = resolveVoiceGlowNumbers({ ...VOICE_GLOW_DEFAULTS, type, theme }, theme);
			for (const [key, , min, max, step] of controls) {
				assert.ok(Number.isFinite(defaults[key]), key);
				assert.ok(defaults[key] >= min && defaults[key] <= max, `${type}/${theme}/${key}`);
				assert.ok(step > 0 && min < max, key);
			}
		}
	}
});
