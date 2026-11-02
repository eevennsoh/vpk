export function getScrollingBarX({
	barGap,
	barWidth,
	index,
	width,
}: {
	barGap: number;
	barWidth: number;
	index: number;
	width: number;
}) {
	return width - barWidth - index * (barWidth + barGap);
}

export function getScrollingBarVisualIndex({
	barCount,
	index,
}: {
	barCount: number;
	index: number;
}) {
	return Math.max(0, barCount - 1 - index);
}

export const STATIC_PROCESSING_TRAVEL_DURATION_MS = 500;
export const STATIC_ACTIVE_HANDOFF_DURATION_MS = 220;
export const WAVEFORM_MAX_BAR_HEIGHT_RATIO = 0.72;
export const WAVEFORM_VOICE_NOISE_FLOOR = 0.08;
export const WAVEFORM_VOICE_SOFT_KNEE = 1.8;

export function getWaveformBarHeight({
	baseBarHeight,
	barHeightScale,
	height,
	maxHeightRatio = WAVEFORM_MAX_BAR_HEIGHT_RATIO,
	value,
}: {
	baseBarHeight: number;
	barHeightScale: number;
	height: number;
	maxHeightRatio?: number;
	value: number;
}) {
	const minimumHeight = Math.max(0, baseBarHeight);
	const maxHeight = Math.max(minimumHeight, height * maxHeightRatio);
	const scaledHeight = Math.max(minimumHeight, value * height * barHeightScale);

	return Math.min(maxHeight, scaledHeight);
}

export function getStaticProcessingTravelHead({
	barCount,
	elapsedMs,
	travelDurationMs = STATIC_PROCESSING_TRAVEL_DURATION_MS,
}: {
	barCount: number;
	elapsedMs: number;
	travelDurationMs?: number;
}) {
	const duration = Math.max(1, travelDurationMs);
	const phase = (elapsedMs % duration) / duration;

	return barCount + 2 - (barCount + 5) * phase;
}

export function getStaticBarDataIndex({
	barCount,
	dataLength,
	index,
}: {
	barCount: number;
	dataLength: number;
	index: number;
}) {
	if (dataLength <= 1 || barCount <= 1) {
		return 0;
	}

	const centerIndex = (barCount - 1) / 2;
	const mirrorIndex = Math.floor(Math.abs(index - centerIndex));
	const sideCount = Math.max(1, Math.ceil(barCount / 2));
	const dataIndex = Math.floor((mirrorIndex / sideCount) * dataLength);

	return Math.max(0, Math.min(dataLength - 1, dataIndex));
}

export function getNoiseGatedVoiceEnergy({
	noiseFloor = WAVEFORM_VOICE_NOISE_FLOOR,
	value,
}: {
	noiseFloor?: number;
	value: number;
}) {
	const clampedValue = Math.max(0, Math.min(1, value));
	const clampedNoiseFloor = Math.max(0, Math.min(0.95, noiseFloor));
	if (clampedValue <= clampedNoiseFloor) {
		return 0;
	}

	return (clampedValue - clampedNoiseFloor) / (1 - clampedNoiseFloor);
}

export function getCompressedVoiceEnergy({
	sensitivity = 1,
	softKnee = WAVEFORM_VOICE_SOFT_KNEE,
	value,
}: {
	sensitivity?: number;
	softKnee?: number;
	value: number;
}) {
	const boostedEnergy =
		getNoiseGatedVoiceEnergy({
			value,
		}) * Math.max(0, sensitivity);
	const knee = Math.max(0.1, softKnee);
	const compressedEnergy = boostedEnergy / (boostedEnergy + knee);

	return Math.pow(Math.max(0, Math.min(1, compressedEnergy)), 0.85);
}

export function getVoiceResponsiveBarValue({
	barCount,
	data,
	index,
	sensitivity = 1,
}: {
	barCount: number;
	data: ArrayLike<number>;
	index: number;
	sensitivity?: number;
}) {
	if (data.length === 0 || barCount <= 0) {
		return 0.05;
	}

	const clampedIndex = Math.max(0, Math.min(barCount - 1, index));
	const startIndex = Math.floor(data.length * 0.03);
	const endIndex = Math.max(startIndex + barCount, Math.floor(data.length * 0.58));
	const bandWidth = (endIndex - startIndex) / Math.max(1, barCount);
	const bandStart = Math.max(0, Math.floor(startIndex + clampedIndex * bandWidth));
	const bandEnd = Math.min(
		data.length,
		Math.max(bandStart + 1, Math.ceil(startIndex + (clampedIndex + 1) * bandWidth)),
	);

	let peak = 0;
	let sumSquares = 0;
	let count = 0;

	for (let dataIndex = bandStart; dataIndex < bandEnd; dataIndex += 1) {
		const normalized = Math.max(0, Math.min(1, data[dataIndex] / 255));
		peak = Math.max(peak, normalized);
		sumSquares += normalized * normalized;
		count += 1;
	}

	const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
	const voiceEnergy = getCompressedVoiceEnergy({
		value: Math.max(rms, peak * 0.72),
		sensitivity,
	});
	const normalizedPosition = barCount <= 1 ? 0.5 : clampedIndex / Math.max(1, barCount - 1);
	const centerDistance = Math.abs(normalizedPosition - 0.5) * 2;
	const voiceProfile = Math.max(
		0.78,
		Math.min(
			1,
			0.82 + (1 - centerDistance) * 0.18 + Math.sin((clampedIndex + 1) * 1.9) * 0.03,
		),
	);
	const shapedEnergy = voiceEnergy * voiceProfile;
	const bandCeiling = Math.max(
		0.52,
		Math.min(
			0.74,
			0.56 + (1 - centerDistance) * 0.14 + Math.sin((clampedIndex + 1) * 2.17) * 0.035,
		),
	);

	return Math.max(0.05, Math.min(bandCeiling, shapedEnergy));
}

export function getStaticProcessingBarValue({
	barCount,
	elapsedMs,
	index,
	travelDurationMs = STATIC_PROCESSING_TRAVEL_DURATION_MS,
}: {
	barCount: number;
	elapsedMs: number;
	index: number;
	travelDurationMs?: number;
}) {
	if (barCount <= 1) {
		return 0.35;
	}

	const normalized = index / Math.max(1, barCount - 1);
	const centerDistance = Math.abs(normalized - 0.5) * 2;
	const centerWeight = 0.76 + (1 - centerDistance) * 0.2;
	const travelHead = getStaticProcessingTravelHead({
		barCount,
		elapsedMs,
		travelDurationMs,
	});
	const travelWidth = Math.max(2.5, barCount * 0.14);
	const travelDistance = Math.abs(index - travelHead);
	const sweep = Math.max(0, 1 - travelDistance / travelWidth);
	const timeSeconds = elapsedMs / 1000;
	const ripple = (Math.sin(timeSeconds * 6 - index * 0.55) + 1) * 0.09;
	const pulse = (Math.cos(timeSeconds * 2.4 + index * 0.28) + 1) * 0.06;
	const value = (0.1 + sweep * 0.48 + ripple + pulse) * centerWeight;

	return Math.max(0.05, Math.min(1, value));
}

export function getWaveformEaseOutProgress({
	durationMs,
	elapsedMs,
}: {
	durationMs: number;
	elapsedMs: number;
}) {
	const duration = Math.max(1, durationMs);
	const rawProgress = Math.max(0, Math.min(1, elapsedMs / duration));

	return 1 - (1 - rawProgress) ** 3;
}

export function getWaveformSeriesValue({
	bars,
	index,
	totalCount,
}: {
	bars: readonly number[];
	index: number;
	totalCount: number;
}) {
	if (bars.length === 0) {
		return 0.05;
	}

	if (bars.length === 1 || totalCount <= 1) {
		return bars[0] || 0.05;
	}

	const mappedIndex = Math.round(
		(index / (totalCount - 1)) * (bars.length - 1)
	);
	const clampedIndex = Math.max(0, Math.min(bars.length - 1, mappedIndex));

	return bars[clampedIndex] || 0.05;
}

export function getWaveformPaletteIndex({
	index,
	paletteLength,
}: {
	index: number;
	paletteLength: number;
}) {
	if (paletteLength <= 0) {
		return -1;
	}

	return (Math.imul(index + 1, 2654435761) >>> 0) % paletteLength;
}
