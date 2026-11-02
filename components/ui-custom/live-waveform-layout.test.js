const test = require("node:test");
const assert = require("node:assert/strict");

const {
	STATIC_ACTIVE_HANDOFF_DURATION_MS,
	STATIC_PROCESSING_TRAVEL_DURATION_MS,
	getScrollingBarVisualIndex,
	getStaticBarDataIndex,
	getStaticProcessingBarValue,
	getStaticProcessingTravelHead,
	getCompressedVoiceEnergy,
	getNoiseGatedVoiceEnergy,
	getVoiceResponsiveBarValue,
	getWaveformBarHeight,
	getWaveformEaseOutProgress,
	getWaveformPaletteIndex,
	getWaveformSeriesValue,
	getScrollingBarX,
} = require("./live-waveform-layout.ts");

test("positions the newest scrolling waveform bar flush against the right edge", () => {
	const width = 124;
	const barWidth = 2;
	const barGap = 2;
	const x = getScrollingBarX({
		barGap,
		barWidth,
		index: 0,
		width,
	});

	assert.equal(x + barWidth, width);
});

test("keeps the configured gap between scrolling waveform bars", () => {
	const width = 124;
	const barWidth = 2;
	const barGap = 2;
	const newestBarX = getScrollingBarX({
		barGap,
		barWidth,
		index: 0,
		width,
	});
	const nextBarX = getScrollingBarX({
		barGap,
		barWidth,
		index: 1,
		width,
	});

	assert.equal(newestBarX - (nextBarX + barWidth), barGap);
});

test("covers the full requested bar count for odd static waveform layouts", () => {
	const barCount = 5;
	const dataLength = 10;
	const indexes = Array.from({ length: barCount }, (_, index) =>
		getStaticBarDataIndex({
			barCount,
			dataLength,
			index,
		}),
	);

	assert.deepEqual(indexes, [6, 3, 0, 3, 6]);
});

test("mirrors even static waveform layouts around the center seam", () => {
	const barCount = 4;
	const dataLength = 10;
	const indexes = Array.from({ length: barCount }, (_, index) =>
		getStaticBarDataIndex({
			barCount,
			dataLength,
			index,
		}),
	);

	assert.deepEqual(indexes, [5, 0, 0, 5]);
});

test("maps voice data into independent responsive frequency bars", () => {
	const data = new Uint8Array(64);
	data.fill(8);
	data.fill(240, 20, 28);

	const bars = Array.from({ length: 4 }, (_, index) =>
		getVoiceResponsiveBarValue({
			barCount: 4,
			data,
			index,
			sensitivity: 1,
		}),
	);

	assert.ok(bars[2] > bars[0] * 2);
	assert.ok(bars[2] > bars[3] * 2);
	assert.notEqual(new Set(bars).size, 1);
});

test("keeps quiet room noise at the resting waveform floor", () => {
	const data = new Uint8Array(64);
	data.fill(12);

	const bars = Array.from({ length: 4 }, (_, index) =>
		getVoiceResponsiveBarValue({
			barCount: 4,
			data,
			index,
			sensitivity: 2.4,
		}),
	);

	assert.deepEqual(bars, [0.05, 0.05, 0.05, 0.05]);
	assert.equal(getNoiseGatedVoiceEnergy({ value: 0.04 }), 0);
	assert.equal(getCompressedVoiceEnergy({ value: 0.04, sensitivity: 2.4 }), 0);
});

test("keeps voice bars responsive to sensitivity without exceeding the visual range", () => {
	const data = new Uint8Array(32);
	data.fill(96);

	const normal = getVoiceResponsiveBarValue({
		barCount: 8,
		data,
		index: 3,
		sensitivity: 1,
	});
	const boosted = getVoiceResponsiveBarValue({
		barCount: 8,
		data,
		index: 3,
		sensitivity: 2.4,
	});

	assert.ok(boosted > normal);
	assert.ok(boosted <= 1);
});

test("caps loud voice bars below a full-height plateau", () => {
	const data = new Uint8Array(64);
	data.fill(255);

	const bars = Array.from({ length: 4 }, (_, index) =>
		getVoiceResponsiveBarValue({
			barCount: 4,
			data,
			index,
			sensitivity: 2.4,
		}),
	);

	const tallestBar = Math.max(...bars);
	const nearPeakBars = bars.filter((value) => value >= tallestBar - 0.03);

	assert.ok(tallestBar < 0.7);
	assert.ok(nearPeakBars.length < bars.length);
	assert.ok(tallestBar - Math.min(...bars) >= 0.04);
	assert.ok(new Set(bars).size > 1);
});

test("preserves band contrast when voice input is boosted", () => {
	const data = new Uint8Array(64);
	data.fill(18);
	data.fill(96, 10, 18);
	data.fill(210, 20, 28);
	data.fill(132, 34, 44);

	const bars = Array.from({ length: 4 }, (_, index) =>
		getVoiceResponsiveBarValue({
			barCount: 4,
			data,
			index,
			sensitivity: 2.4,
		}),
	);

	assert.ok(bars[2] > bars[1]);
	assert.ok(bars[2] > bars[3]);
	assert.ok(bars[2] - bars[0] > 0.25);
	assert.ok(bars.filter((value) => value > 0.62).length <= 1);
});

test("caps rendered waveform bars below the full button height", () => {
	assert.equal(
		getWaveformBarHeight({
			baseBarHeight: 4,
			barHeightScale: 1.15,
			height: 28,
			value: 1,
		}),
		20.16,
	);
});

test("animates the static processing waveform over time", () => {
	const valueAtStart = getStaticProcessingBarValue({
		barCount: 15,
		elapsedMs: 0,
		index: 7,
	});
	const valueLater = getStaticProcessingBarValue({
		barCount: 15,
		elapsedMs: 250,
		index: 7,
	});

	assert.notEqual(valueAtStart, valueLater);
});

test("moves the static processing crest from right to left across the fixed bar grid", () => {
	const barCount = 15;
	const valuesAtStart = Array.from({ length: barCount }, (_, index) =>
		getStaticProcessingBarValue({
			barCount,
			elapsedMs: 0,
			index,
		}),
	);
	const valuesLater = Array.from({ length: barCount }, (_, index) =>
		getStaticProcessingBarValue({
			barCount,
			elapsedMs: STATIC_PROCESSING_TRAVEL_DURATION_MS / 2,
			index,
		}),
	);

	const crestIndexAtStart = valuesAtStart.indexOf(Math.max(...valuesAtStart));
	const crestIndexLater = valuesLater.indexOf(Math.max(...valuesLater));

	assert.ok(crestIndexLater < crestIndexAtStart);
});

test("completes a full static processing sweep within 500ms", () => {
	const barCount = 15;
	const headAtStart = getStaticProcessingTravelHead({
		barCount,
		elapsedMs: 0,
	});
	const headNearEnd = getStaticProcessingTravelHead({
		barCount,
		elapsedMs: STATIC_PROCESSING_TRAVEL_DURATION_MS - 1,
	});

	assert.ok(headAtStart > barCount);
	assert.ok(headNearEnd < 0);
});

test("caps the static processing waveform below the previous tall peak range", () => {
	const barCount = 15;
	let maxValue = 0;

	for (let elapsedMs = 0; elapsedMs <= STATIC_PROCESSING_TRAVEL_DURATION_MS; elapsedMs += 25) {
		for (let index = 0; index < barCount; index += 1) {
			maxValue = Math.max(
				maxValue,
				getStaticProcessingBarValue({
					barCount,
					elapsedMs,
					index,
				}),
			);
		}
	}

	assert.ok(maxValue <= 0.8);
});

test("uses an ease-out curve for the active handoff progress", () => {
	const midpoint = getWaveformEaseOutProgress({
		durationMs: STATIC_ACTIVE_HANDOFF_DURATION_MS,
		elapsedMs: STATIC_ACTIVE_HANDOFF_DURATION_MS / 2,
	});

	assert.ok(midpoint > 0.5);
	assert.equal(
		getWaveformEaseOutProgress({
			durationMs: STATIC_ACTIVE_HANDOFF_DURATION_MS,
			elapsedMs: STATIC_ACTIVE_HANDOFF_DURATION_MS,
		}),
		1,
	);
});

test("samples transition source bars across the full destination width", () => {
	const bars = [0.2, 0.5, 0.8];

	assert.equal(
		getWaveformSeriesValue({
			bars,
			index: 0,
			totalCount: 5,
		}),
		0.2,
	);
	assert.equal(
		getWaveformSeriesValue({
			bars,
			index: 4,
			totalCount: 5,
		}),
		0.8,
	);
});

test("uses one visual palette sequence for processing and live waveform bars", () => {
	const paletteLength = 4;
	const barCount = 4;
	const staticColorsByPosition = Array.from({ length: barCount }, (_, index) =>
		getWaveformPaletteIndex({
			index,
			paletteLength,
		}),
	);
	const scrollingColorsByPosition = Array.from({ length: barCount }, (_, visualIndex) => {
		const drawIndex = barCount - 1 - visualIndex;
		return getWaveformPaletteIndex({
			index: getScrollingBarVisualIndex({
				barCount,
				index: drawIndex,
			}),
			paletteLength,
		});
	});

	assert.deepEqual(scrollingColorsByPosition, staticColorsByPosition);
	assert.deepEqual(staticColorsByPosition, [1, 2, 3, 0]);
});
