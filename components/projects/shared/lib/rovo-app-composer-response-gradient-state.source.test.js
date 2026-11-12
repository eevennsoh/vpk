const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
	resolveRovoAppComposerResponseGradientState,
} = require("./rovo-app-composer-response-gradient-state.ts");

const COMPOSER_RESPONSE_GRADIENT_SOURCE = fs.readFileSync(
	path.join(__dirname, "../components/rovo-app-composer-response-gradient.tsx"),
	"utf8",
);

test("keeps the response gradient hidden when realtime voice is off", () => {
	assert.deepEqual(
		resolveRovoAppComposerResponseGradientState({
			realtimeGenerationState: "idle",
			realtimeVoiceState: "idle",
		}),
		{
			phase: null,
			visible: false,
		},
	);
});

test("keeps the response gradient hidden while voice is listening without a response", () => {
	assert.deepEqual(
		resolveRovoAppComposerResponseGradientState({
			realtimeGenerationState: "idle",
			realtimeVoiceState: "listening",
		}),
		{
			phase: null,
			visible: false,
		},
	);
});

test("shows the warmup response gradient while the assistant is generating before audio is speaking", () => {
	assert.deepEqual(
		resolveRovoAppComposerResponseGradientState({
			realtimeGenerationState: "generating",
			realtimeVoiceState: "connecting",
		}),
		{
			phase: "warmup",
			visible: true,
		},
	);
});

test("keeps the response gradient visible during the completion tail", () => {
	assert.deepEqual(
		resolveRovoAppComposerResponseGradientState({
			realtimeGenerationState: "complete",
			realtimeVoiceState: "listening",
		}),
		{
			phase: "warmup",
			visible: true,
		},
	);
});

test("switches to the speaking phase once live voice playback starts", () => {
	assert.deepEqual(
		resolveRovoAppComposerResponseGradientState({
			realtimeGenerationState: "generating",
			realtimeVoiceState: "speaking",
		}),
		{
			phase: "speaking",
			visible: true,
		},
	);
});

test("keeps the response gradient visible while audio is still speaking even after text generation has gone idle", () => {
	assert.deepEqual(
		resolveRovoAppComposerResponseGradientState({
			realtimeGenerationState: "idle",
			realtimeVoiceState: "speaking",
		}),
		{
			phase: "speaking",
			visible: true,
		},
	);
});

test("samples the live waveform signal without cloning it inside the frame loop", () => {
	assert.match(
		COMPOSER_RESPONSE_GRADIENT_SOURCE,
		/const liveSignal = signalRef\.current;/,
	);
	assert.doesNotMatch(
		COMPOSER_RESPONSE_GRADIENT_SOURCE,
		/bars: \[\.\.\.signalRef\.current\],/,
	);
});

test("caches live waveform samples once per speaking frame", () => {
	const smoothingLoopStart = COMPOSER_RESPONSE_GRADIENT_SOURCE.indexOf(
		"for (\n\t\t\t\t\t\tlet offset = -LIVE_SIGNAL_SMOOTHING_WINDOW_SIZE;",
	);
	const smoothingLoopEnd = COMPOSER_RESPONSE_GRADIENT_SOURCE.indexOf(
		"smoothedSeriesValue /= LIVE_SIGNAL_SMOOTHING_WEIGHT_TOTAL;",
		smoothingLoopStart,
	);
	const smoothingLoopSource = COMPOSER_RESPONSE_GRADIENT_SOURCE.slice(
		smoothingLoopStart,
		smoothingLoopEnd,
	);

	assert.notEqual(smoothingLoopStart, -1);
	assert.notEqual(smoothingLoopEnd, -1);
	assert.match(
		COMPOSER_RESPONSE_GRADIENT_SOURCE,
		/const liveSignalSamples = new Array<number>\(liveSignalSampleCount\);/,
	);
	assert.match(smoothingLoopSource, /liveSignalSamples\[index \+ offset - liveSignalSampleStartIndex\]/);
	assert.doesNotMatch(smoothingLoopSource, /getWaveformSeriesValue\(/);
});
