/**
 * TWG Loader — pure helpers, constants, and animation engine.
 *
 * Ported from the Atlassian Teamwork Graph microsite `LoadingSpinner`
 * (platform/packages/teamwork-graph/twg-microsite-experience). Everything
 * here is framework-agnostic and side-effect free apart from the imperative
 * DOM updaters, which mutate SVG nodes passed in by the caller.
 *
 * The only adaptation from upstream is color resolution: instead of calling
 * `@atlaskit/tokens` `token()` at runtime, we render equivalent ADS CSS custom
 * properties (`--ds-*`) with hard-coded fallbacks. Keeping the literal SVG
 * attribute stable avoids SSR/client hydration drift while the browser still
 * resolves the active theme from `setGlobalTheme()`.
 */

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Public size scale. Mirrors `@atlaskit/spinner` so existing call sites
 * can swap implementations without changing props.
 */
export type TWGLoaderSize = "small" | "medium" | "large" | "xlarge";

/* -------------------------------------------------------------------------- */
/* Geometry, timing and patterns                                              */
/* -------------------------------------------------------------------------- */

export const VIEWBOX_SIZE = 24;
export const VIEWBOX_CENTER: number = VIEWBOX_SIZE / 2;

export const SIZE_PX: Record<TWGLoaderSize, number> = {
	small: 16,
	medium: 24,
	large: 32,
	xlarge: 64,
};

export const DOT_RADIUS = 2.5;
export const NODE_STROKE_WIDTH = 1.5;
export const SPREAD_RADIUS = 8;
export const LINE_WIDTH = 1.5;

export const BURST_DURATION_S = 0.4;
export const ROTATE_DURATION_S = 0.4;
export const DRAW_DURATION_S = 0.8;
/** Fraction of the snake duration after which the tail begins to retract. */
export const TAIL_DELAY = 0.35;
export const ROTATION_AMOUNT_DEG = 45;

/** Dot starting angles (radians). Order matters — patterns reference these indices. */
export const DOT_ANGLES: readonly number[] = [
	-Math.PI / 2, // top
	0, // right
	Math.PI / 2, // bottom
	Math.PI, // left
];

export type Segment = readonly [fromIdx: number, toIdx: number];

/** Snake patterns — one set of dot-to-dot segments per cycle. */
export const DRAW_PATTERNS: readonly (readonly Segment[])[] = [
	[
		[3, 0],
		[0, 2],
		[2, 1],
	],
	[
		[0, 2],
		[2, 3],
		[3, 1],
	],
	[
		[3, 1],
		[1, 0],
		[0, 2],
	],
	[
		[0, 1],
		[1, 3],
		[3, 2],
	],
];

export const MAX_LINE_COUNT: number = Math.max(
	...DRAW_PATTERNS.map((p) => p.length),
);

export const TOTAL_SNAKE_DURATION_S: number = DRAW_DURATION_S / (1 - TAIL_DELAY);
export const CYCLE_DURATION_S: number =
	TOTAL_SNAKE_DURATION_S + ROTATE_DURATION_S;
export const ROTATION_AMOUNT_RAD: number =
	(ROTATION_AMOUNT_DEG * Math.PI) / 180;

/** Visiting order for masks/dots — preserves the original stacking. */
export const DOT_ORDER = [0, 1, 3, 2] as const;

/* -------------------------------------------------------------------------- */
/* Easing                                                                     */
/* -------------------------------------------------------------------------- */

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

export function easeOutBack(t: number, overshoot = 1.0): number {
	const c = clamp01(t);
	const c3 = overshoot + 1;
	return 1 + c3 * Math.pow(c - 1, 3) + overshoot * Math.pow(c - 1, 2);
}

export function easeInOutQuad(t: number): number {
	const c = clamp01(t);
	return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
}

/* -------------------------------------------------------------------------- */
/* Colors                                                                     */
/* -------------------------------------------------------------------------- */

/** Brand colors for the four dot rings. Aligned with `DOT_ANGLES`. */
const DOT_COLORS = [
	"var(--ds-icon-accent-orange, #FCA700)",
	"var(--ds-icon-accent-lime, #6A9A23)",
	"var(--ds-icon-accent-blue, #1868DB)",
	"var(--ds-icon-accent-purple, #AF59E0)",
] as const;

export function getDotColors(): readonly string[] {
	return DOT_COLORS;
}

/** Single neutral color for the snake / connector lines. No exact ADS token. */
export function getLineColor(): string {
	return "#6C6F77";
}

/* -------------------------------------------------------------------------- */
/* Pure animation engine                                                      */
/* -------------------------------------------------------------------------- */

export type DotPosition = { x: number; y: number };

export type FrameState = {
	positions: readonly DotPosition[];
	/** Snake head fraction in `[0, 1]`. Negative = no snake this frame. */
	drawFrac: number;
	/** Snake tail fraction in `[0, 1]`. */
	retractFrac: number;
	/** Index into `DRAW_PATTERNS`. */
	patternIndex: number;
};

export function getDotPositions(
	spread: number,
	rotation: number,
): DotPosition[] {
	return DOT_ANGLES.map((angle) => ({
		x: VIEWBOX_CENTER + Math.cos(angle + rotation) * spread,
		y: VIEWBOX_CENTER + Math.sin(angle + rotation) * spread,
	}));
}

/**
 * Compute the frame at `elapsedSeconds` since animation start.
 *
 * Phase 1 (`< BURST_DURATION_S`): dots fly out from center with overshoot.
 * Phase 2 (repeating): snake draws + retracts, then logo rotates and
 * advances to the next pattern.
 */
export function computeFrame(elapsedSeconds: number): FrameState {
	let spread = SPREAD_RADIUS;
	let rotation = 0;
	let drawFrac = -1;
	let retractFrac = 0;
	let patternIndex = 0;

	if (elapsedSeconds < BURST_DURATION_S) {
		const progress = elapsedSeconds / BURST_DURATION_S;
		spread = easeOutBack(progress, 0.8) * SPREAD_RADIUS;
	} else {
		const cycleElapsed = elapsedSeconds - BURST_DURATION_S;
		const cycleCount = Math.floor(cycleElapsed / CYCLE_DURATION_S);
		const cycleTime = cycleElapsed % CYCLE_DURATION_S;

		patternIndex = cycleCount % DRAW_PATTERNS.length;
		const baseRotation = cycleCount * ROTATION_AMOUNT_RAD;

		if (cycleTime < TOTAL_SNAKE_DURATION_S) {
			const snakeProgress = cycleTime / TOTAL_SNAKE_DURATION_S;
			drawFrac = easeInOutQuad(
				Math.min(1, snakeProgress / (1 - TAIL_DELAY)),
			);
			const tailRaw = Math.max(
				0,
				(snakeProgress - TAIL_DELAY) / (1 - TAIL_DELAY),
			);
			retractFrac = easeInOutQuad(Math.min(1, tailRaw));
			rotation = baseRotation;
		} else {
			const rotateProgress =
				(cycleTime - TOTAL_SNAKE_DURATION_S) / ROTATE_DURATION_S;
			rotation =
				baseRotation +
				easeOutBack(rotateProgress, 0.6) * ROTATION_AMOUNT_RAD;
		}
	}

	return {
		positions: getDotPositions(spread, rotation),
		drawFrac,
		retractFrac,
		patternIndex,
	};
}

/**
 * Resting mark. Same four rings, parked in a square, with one diagonal from
 * the top-left ring (index 0) to the bottom-right ring (index 2).
 */
export const REST_SPREAD = 6.5;

export function getRestPositions(): DotPosition[] {
	return [
		{ x: VIEWBOX_CENTER - REST_SPREAD, y: VIEWBOX_CENTER - REST_SPREAD },
		{ x: VIEWBOX_CENTER + REST_SPREAD, y: VIEWBOX_CENTER - REST_SPREAD },
		{ x: VIEWBOX_CENTER + REST_SPREAD, y: VIEWBOX_CENTER + REST_SPREAD },
		{ x: VIEWBOX_CENTER - REST_SPREAD, y: VIEWBOX_CENTER + REST_SPREAD },
	];
}

/** The single connector drawn while the logo is resting. */
export const REST_PATTERN: readonly Segment[] = [[0, 2]];

/** Static frame used for `prefers-reduced-motion: reduce`. */
export function computeStaticFrame(): FrameState {
	return {
		positions: getDotPositions(SPREAD_RADIUS, 0),
		drawFrac: -1,
		retractFrac: 0,
		patternIndex: 0,
	};
}

/* -------------------------------------------------------------------------- */
/* Imperative DOM updaters                                                    */
/* -------------------------------------------------------------------------- */

export const HIDDEN_DASH = "0 9999";
const EPSILON = 0.001;

export function hideLine(el: SVGPathElement): void {
	el.setAttribute("stroke-dasharray", HIDDEN_DASH);
	el.setAttribute("stroke-dashoffset", "0");
}

export function updateDots(
	svg: SVGSVGElement,
	positions: readonly DotPosition[],
): void {
	const circles = svg.querySelectorAll<SVGCircleElement>(
		'[data-type="dot"], [data-type="mask"]',
	);
	circles.forEach((circle) => {
		const idx = Number(circle.getAttribute("data-idx"));
		const pos = positions[idx];
		if (!pos) return;
		circle.setAttribute("cx", String(pos.x));
		circle.setAttribute("cy", String(pos.y));
	});
}

export function updateLines(
	svg: SVGSVGElement,
	positions: readonly DotPosition[],
	pattern: readonly Segment[],
	drawFrac: number,
	retractFrac: number,
): void {
	const segLengths: number[] = [];
	const cumDist: number[] = [0];
	for (let i = 0; i < pattern.length; i++) {
		const from = positions[pattern[i][0]];
		const to = positions[pattern[i][1]];
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		segLengths.push(len);
		cumDist.push(cumDist[i] + len);
	}
	const totalLen = cumDist[pattern.length];
	const headDist = drawFrac * totalLen;
	const tailDist = retractFrac * totalLen;

	for (let i = 0; i < MAX_LINE_COUNT; i++) {
		const el = svg.getElementById(`line-${i}`) as SVGPathElement | null;
		if (!el) continue;

		const isInactive = i >= pattern.length || drawFrac < 0;
		if (isInactive) {
			hideLine(el);
			continue;
		}

		const [fromIdx, toIdx] = pattern[i];
		const from = positions[fromIdx];
		const to = positions[toIdx];
		const segLen = segLengths[i];
		const segCumStart = cumDist[i];

		const headPos = Math.min(segLen, Math.max(0, headDist - segCumStart));
		const tailPos = Math.min(segLen, Math.max(0, tailDist - segCumStart));
		const visibleLen = headPos - tailPos;

		if (visibleLen <= EPSILON || segLen < EPSILON) {
			hideLine(el);
			continue;
		}

		const gapLen = segLen - visibleLen;
		el.setAttribute("d", `M${from.x},${from.y} L${to.x},${to.y}`);
		el.setAttribute(
			"stroke-dasharray",
			`${visibleLen.toFixed(4)} ${gapLen.toFixed(4)}`,
		);
		el.setAttribute("stroke-dashoffset", (-tailPos).toFixed(4));
	}
}
