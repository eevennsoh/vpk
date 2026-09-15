export type HumanAgentAvatarEasing = readonly [number, number, number, number];

export interface HumanAgentAvatarMotionOptions {
	durationMs: number;
	initialDelayMs: number;
	betweenTurnsMs: number;
	repeatDelayMs: number;
	repeat: number | "infinite";
	ease: HumanAgentAvatarEasing;
	direction: "clockwise" | "counter-clockwise";
	curvature: number;
	scaleAmount: number;
	foregroundSwapAt: number;
	pauseWhenOffscreen: boolean;
}

export const DEFAULT_HUMAN_AGENT_AVATAR_MOTION: Readonly<HumanAgentAvatarMotionOptions> =
	{
		durationMs: 300, // User preset, shared by both turns.
		initialDelayMs: 0,
		betweenTurnsMs: 50,
		repeatDelayMs: 1_200,
		repeat: "infinite",
		ease: [0.4, 0, 0, 1], // ease-in-out
		direction: "clockwise",
		curvature: 2,
		scaleAmount: 1,
		foregroundSwapAt: 0.5,
		pauseWhenOffscreen: true,
	};

function bounded(
	value: number | undefined,
	fallback: number,
	min: number,
	max: number,
): number {
	return value !== undefined && Number.isFinite(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}

/** Normalize editable values at the public motion-options boundary. */
export function resolveHumanAgentAvatarMotion(
	options: Partial<HumanAgentAvatarMotionOptions> = {},
): HumanAgentAvatarMotionOptions {
	const defaults = DEFAULT_HUMAN_AGENT_AVATAR_MOTION;
	const curve = options.ease ?? defaults.ease;
	return {
		durationMs: bounded(options.durationMs, defaults.durationMs, 50, 2_000),
		initialDelayMs: bounded(
			options.initialDelayMs,
			defaults.initialDelayMs,
			0,
			5_000,
		),
		betweenTurnsMs: bounded(
			options.betweenTurnsMs,
			defaults.betweenTurnsMs,
			0,
			5_000,
		),
		repeatDelayMs: bounded(
			options.repeatDelayMs,
			defaults.repeatDelayMs,
			0,
			5_000,
		),
		repeat:
			typeof options.repeat === "number"
				? Math.floor(bounded(options.repeat, 0, 0, 12))
				: "infinite",
		ease: [
			bounded(curve[0], defaults.ease[0], 0, 1),
			bounded(curve[1], defaults.ease[1], 0, 1),
			bounded(curve[2], defaults.ease[2], 0, 1),
			bounded(curve[3], defaults.ease[3], 0, 1),
		],
		direction: options.direction ?? defaults.direction,
		curvature: bounded(options.curvature, defaults.curvature, 2, 8),
		scaleAmount: bounded(options.scaleAmount, defaults.scaleAmount, 0, 1),
		foregroundSwapAt: bounded(
			options.foregroundSwapAt,
			defaults.foregroundSwapAt,
			0,
			1,
		),
		pauseWhenOffscreen:
			options.pauseWhenOffscreen ?? defaults.pauseWhenOffscreen,
	};
}
