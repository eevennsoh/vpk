export type HumanAgentAvatarEasing = readonly [number, number, number, number];

export interface HumanAgentAvatarMotionOptions {
	variant: "orbit" | "horizontal-group";
	durationMs: number;
	initialDelayMs: number;
	betweenTurnsMs: number;
	repeatDelayMs: number;
	repeat: number | "infinite";
	ease: HumanAgentAvatarEasing;
	direction: "clockwise" | "counter-clockwise";
	curvature: number;
	scaleAmount: number;
	/** Optional destination sizes; defaults are a 24px agent and 20px human. */
	agentTargetSizePx?: number;
	humanTargetSizePx?: number;
	pauseWhenOffscreen: boolean;
}

const DEFAULT_TARGET_SIZES = { agent: 24, human: 20 } as const;

export const DEFAULT_HUMAN_AGENT_AVATAR_MOTION: Readonly<HumanAgentAvatarMotionOptions> =
	{
		variant: "orbit",
		durationMs: 300, // User preset, shared by both turns.
		initialDelayMs: 0,
		betweenTurnsMs: 50,
		repeatDelayMs: 1_200,
		repeat: "infinite",
		ease: [0.4, 0, 0, 1], // ease-in-out
		direction: "clockwise",
		curvature: 2,
		scaleAmount: 1,
		agentTargetSizePx: DEFAULT_TARGET_SIZES.agent,
		humanTargetSizePx: DEFAULT_TARGET_SIZES.human,
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
		variant: options.variant ?? defaults.variant,
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
		agentTargetSizePx: bounded(options.agentTargetSizePx, DEFAULT_TARGET_SIZES.agent, 8, 48),
		humanTargetSizePx: bounded(options.humanTargetSizePx, DEFAULT_TARGET_SIZES.human, 8, 48),
		pauseWhenOffscreen:
			options.pauseWhenOffscreen ?? defaults.pauseWhenOffscreen,
	};
}

export function resolveHumanAgentAvatarTargets(
	{ frameSize }: { frameSize: number; agentSize: number; humanSize: number },
	options: Pick<HumanAgentAvatarMotionOptions, "agentTargetSizePx" | "humanTargetSizePx"> = {},
) {
	const humanTarget = Math.min(frameSize, options.humanTargetSizePx ?? DEFAULT_TARGET_SIZES.human);
	const agentTarget = Math.min(frameSize, options.agentTargetSizePx ?? DEFAULT_TARGET_SIZES.agent);
	return { agentSize: agentTarget, humanSize: humanTarget };
}
