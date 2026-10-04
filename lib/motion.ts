/**
 * Motion for React mirror of the ADS motion tokens in app/tailwind-theme.css.
 * Motion cannot read CSS variables, so JS transitions import these values instead
 * of pasting cubic-bezier arrays. lib/motion.test.js keeps both sources in sync.
 */

type CubicBezier = readonly [number, number, number, number];

/** Seconds, matching the --duration-* tokens. */
export const motionDuration = {
	instant: 0,
	xxshort: 0.05,
	fast: 0.1,
	normal: 0.15,
	medium: 0.2,
	slow: 0.25,
	slower: 0.4,
	slowest: 0.6,
} as const;

/** Cubic-bezier control points, matching the --ease-* tokens. */
export const motionEase = {
	linear: [0, 0, 1, 1],
	in: [0.6, 0, 0.8, 0.6],
	out: [0, 0.4, 0, 1],
	outPractical: [0.4, 1, 0.6, 1],
	inOut: [0.4, 0, 0, 1],
} as const satisfies Record<string, CubicBezier>;

interface MotionTiming {
	readonly duration: number;
	readonly ease: CubicBezier;
}

interface MotionRecipe {
	readonly enter: MotionTiming;
	readonly exit: MotionTiming;
}

/**
 * Per-role enter/exit timing from .agents/rules/motion-decisions.md. Put `exit`
 * inside the exit variant so the faster exit is not overridden by `enter`.
 */
export const motionRecipe = {
	popup: {
		enter: { duration: motionDuration.normal, ease: motionEase.outPractical },
		exit: { duration: motionDuration.fast, ease: motionEase.in },
	},
	modal: {
		enter: { duration: motionDuration.slow, ease: motionEase.inOut },
		exit: { duration: motionDuration.medium, ease: motionEase.in },
	},
	blanket: {
		enter: { duration: motionDuration.slow, ease: motionEase.out },
		exit: { duration: motionDuration.medium, ease: motionEase.in },
	},
	flag: {
		enter: { duration: motionDuration.slow, ease: motionEase.out },
		exit: { duration: motionDuration.medium, ease: motionEase.in },
	},
	avatar: {
		enter: { duration: motionDuration.normal, ease: motionEase.outPractical },
		exit: { duration: motionDuration.fast, ease: motionEase.in },
	},
} as const satisfies Record<string, MotionRecipe>;
