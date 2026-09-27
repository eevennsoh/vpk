export function getShimmerWaveCharacterDelay(index: number, count: number, duration: number, spread: number) {
	return (index * duration) / (Math.max(spread, 1) * Math.max(count, 1));
}

export function getShimmerWaveEndTime(text: string, duration: number, spread: number) {
	const lastAnimatedIndex = text.replace(/ +$/u, "").length - 1;
	return lastAnimatedIndex < 0 ? 0 : duration + getShimmerWaveCharacterDelay(lastAnimatedIndex, text.length, duration, spread);
}
