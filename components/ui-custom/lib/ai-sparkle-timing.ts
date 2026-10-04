// The last plus finishes at 750ms; the star takes 400ms to return to rest.
const ENTER_SECONDS = 0.75;
const RETURN_SECONDS = 0.4;

export function resolveAiSparkleTiming(duration?: number) {
	const scale = duration === undefined ? 1 : Math.max(0, duration) / (ENTER_SECONDS + RETURN_SECONDS);
	return { scale, playSeconds: ENTER_SECONDS * scale, returnSeconds: RETURN_SECONDS * scale };
}
