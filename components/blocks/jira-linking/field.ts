import { lerp } from "@/lib/utils";

/**
 * Pure model behind the session-to-work-item fusion effect.
 *
 * The renderer draws a metaball field: the travelling drag chip, the cohort's
 * avatars, and the target card's attach chin are each a signed-distance blob
 * that smooth-unions with its neighbours, so a neck forms between the chip and
 * the card as they close. Everything geometric lives here — no DOM, no WebGL,
 * no React — so both the canvas and the overlay compile against one contract.
 *
 * All coordinates are client px, matching `getBoundingClientRect()` and the
 * pointer values the board drag model already works in.
 */

/** WebGL loops are const-bounded, so the shader and this model share one cap. */
export const JIRA_LINKING_MAX_BALLS = 8;

/**
 * How many subjects tint the field, however many are being linked.
 *
 * Two colours make a legible gradient across the neck. Three or more average
 * out in OKLab into a muddy neutral — the more agents you drag, the less the
 * field says about any of them — so a large cohort mixes its first two and the
 * rest ride along in the source pill's own surface colour.
 */
export const JIRA_LINKING_MAX_TINT_SUBJECTS = 2;

/** Slack around the field so the smooth-union neck is never clipped. */
export const JIRA_LINKING_REGION_PADDING_PX = 120;

const AVATAR_RADIUS_PX = 11;
/** Less than a diameter, so avatars overlap the way an avatar group does. */
const AVATAR_STEP_PX = 14;
const CHIP_CORNER_RADIUS_PX = 12;
const DOCK_HALF_HEIGHT_PX = 12;
const DOCK_CORNER_RADIUS_PX = 6;
const SMOOTHNESS_MIN_PX = 6;
const SMOOTHNESS_MAX_PX = 34;
/** Widest chip-to-chin surface gap a neck still reaches across. */
const NECK_MAX_GAP_PX = 96;
/** `k` needed to bridge a gap, as a fraction of that gap. */
const NECK_GAP_RATIO = 0.75;
/**
 * How far past the target's border the subject tint survives, in px.
 *
 * Colour earns its place at the seam, where it shows two things becoming one.
 * Once the source is well inside the target there is no seam left to describe,
 * and the tint reads as a stain floating on the target's face rather than as a
 * merge — so it dissolves into the target's own surface over this distance.
 */
const TINT_FADE_DEPTH_PX = 64;
/** Chip speed, in px/frame, at which chromatic dispersion saturates. */
const DISPERSION_VELOCITY_PX = 28;
/** Approach never disperses as hard as the fuse itself. */
const DISPERSION_APPROACH_SCALE = 0.35;
/** The field collapses away over the last 30% of the fuse. */
const ALPHA_COLLAPSE_START = 0.7;
const ALPHA_COLLAPSE_SPAN = 0.3;
/** Avatars dissolve into the dock over the last 40% of the fuse. */
const AVATAR_DISSOLVE_START = 0.6;
const AVATAR_DISSOLVE_SPAN = 0.4;

export type JiraLinkingBallShape = "circle" | "pill";

export interface JiraLinkingBall {
	cx: number;
	cy: number;
	/** Circle radius, or the corner radius when `shape` is `"pill"`. */
	radius: number;
	halfWidth: number;
	halfHeight: number;
	shape: JiraLinkingBallShape;
	/** Avatar atlas cell, or -1 when this ball has no texture and uses `tint`. */
	atlasIndex: number;
	/** 0..1 sRGB fallback colour. */
	tint: readonly [number, number, number];
}

export interface JiraLinkingRegion {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface JiraLinkingFrame {
	balls: readonly JiraLinkingBall[];
	region: JiraLinkingRegion;
	/** The `k` handed to `opSmoothUnion`, in px. */
	smoothness: number;
	/** 0..1 chromatic split strength. */
	dispersion: number;
	/** 0..1 overall field opacity. */
	alpha: number;
	/** 0..1, echoed back so the renderer does not re-derive it. */
	fuseProgress: number;
	/**
	 * Index of the landing shape in `balls`, or -1 when there is no target.
	 *
	 * The renderer fades the field out across the target's interior so a blob the
	 * size of a whole card cannot blanket the content it is merging into. It
	 * needs to know which ball to measure that falloff from.
	 */
	targetIndex: number;
	/**
	 * 0-1 weight of the subjects' own colour against the target's surface.
	 *
	 * Colour belongs at the seam. Once the source is well inside the target
	 * there is no seam to describe and a tinted blob reads as a stain on the
	 * target's face, so the renderer mixes the field back toward plain surface.
	 */
	tintStrength: number;
}

export interface JiraLinkingMember {
	id: string;
	atlasIndex: number;
	tint: readonly [number, number, number];
}

export interface JiraLinkingFrameInput {
	pointer: { x: number; y: number };
	sourceRect: { left: number; top: number; width: number; height: number } | null;
	/**
	 * 0..1 sRGB surface colour of the travelling chip, resolved from the theme by
	 * the caller. The chip pill is the largest thing the field paints, so baking
	 * a literal here would smear light-theme white across dark chrome.
	 */
	sourceTint: readonly [number, number, number];
	targetAnchor: { x: number; y: number } | null;
	/** 0..1 sRGB surface colour of the landing shape, same rule as `sourceTint`. */
	targetTint: readonly [number, number, number];
	targetWidth: number;
	/** Height of the landing shape. Falls back to a chin-sized pill when omitted. */
	targetHeight?: number;
	/** Corner radius of the landing shape. Defaults to a pill. */
	targetRadius?: number;
	/** 0..1 attach proximity from the board drag model. */
	nearness: number;
	/** 0..1; stays 0 for the whole approach and only ramps after release. */
	fuseProgress: number;
	/** px/frame of the travelling chip. */
	velocity: { x: number; y: number };
	members: readonly JiraLinkingMember[];
}

function clamp01(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.min(Math.max(value, 0), 1);
}

/** Standard cubic ease-in-out, so the fuse leaves and lands softly. */
function easeInOut(t: number): number {
	return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

/** Hermite smoothstep over an already-normalised 0-1 input. */
function smoothstep01(t: number): number {
	const x = clamp01(t);
	return x * x * (3 - 2 * x);
}

function toRegion(balls: readonly JiraLinkingBall[]): JiraLinkingRegion {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const ball of balls) {
		minX = Math.min(minX, ball.cx - ball.halfWidth);
		minY = Math.min(minY, ball.cy - ball.halfHeight);
		maxX = Math.max(maxX, ball.cx + ball.halfWidth);
		maxY = Math.max(maxY, ball.cy + ball.halfHeight);
	}

	return {
		height: Math.max(0, maxY - minY + JIRA_LINKING_REGION_PADDING_PX * 2),
		left: minX - JIRA_LINKING_REGION_PADDING_PX,
		top: minY - JIRA_LINKING_REGION_PADDING_PX,
		width: Math.max(0, maxX - minX + JIRA_LINKING_REGION_PADDING_PX * 2),
	};
}

/**
 * Build one frame of the fusion field.
 *
 * Returns `null` when there is nothing to draw: no measured chip, or the chip
 * is neither near a card nor mid-fuse.
 */
export function resolveJiraLinkingFrame(
	input: Readonly<JiraLinkingFrameInput>,
): JiraLinkingFrame | null {
	const { sourceRect, targetAnchor } = input;
	const nearness = clamp01(input.nearness);
	const fuseProgress = clamp01(input.fuseProgress);

	if (!sourceRect || (nearness <= 0 && fuseProgress <= 0)) {
		return null;
	}

	const fuseAmount = targetAnchor ? easeInOut(fuseProgress) : 0;
	// Over the last 40% the avatars shrink into the dock instead of popping out.
	const avatarScale = 1 - clamp01(
		(fuseProgress - AVATAR_DISSOLVE_START) / AVATAR_DISSOLVE_SPAN,
	);

	const towardDockX = (x: number) => (targetAnchor ? lerp(x, targetAnchor.x, fuseAmount) : x);
	const towardDockY = (y: number) => (targetAnchor ? lerp(y, targetAnchor.y, fuseAmount) : y);

	const chipHalfWidth = sourceRect.width / 2;
	const chipHalfHeight = sourceRect.height / 2;
	const chipCy = sourceRect.top + chipHalfHeight;

	const balls: JiraLinkingBall[] = [{
		atlasIndex: -1,
		cx: towardDockX(sourceRect.left + chipHalfWidth),
		cy: towardDockY(chipCy),
		halfHeight: chipHalfHeight,
		halfWidth: chipHalfWidth,
		radius: Math.min(chipHalfHeight, CHIP_CORNER_RADIUS_PX),
		shape: "pill",
		tint: input.sourceTint,
	}];

	// Only the first two subjects tint the field; the chip and the target always
	// own a slot, so a large cohort can never crowd them out either.
	const avatarCapacity = Math.max(
		0,
		Math.min(
			JIRA_LINKING_MAX_TINT_SUBJECTS,
			JIRA_LINKING_MAX_BALLS - 1 - (targetAnchor ? 1 : 0),
		),
	);
	const avatars = input.members.slice(0, avatarCapacity);
	for (const [index, member] of avatars.entries()) {
		const radius = AVATAR_RADIUS_PX * avatarScale;
		balls.push({
			atlasIndex: member.atlasIndex,
			cx: towardDockX(sourceRect.left + AVATAR_RADIUS_PX + index * AVATAR_STEP_PX),
			cy: towardDockY(chipCy),
			halfHeight: radius,
			halfWidth: radius,
			radius,
			shape: "circle",
			tint: member.tint,
		});
	}

	if (targetAnchor) {
		const targetHalfHeight = input.targetHeight === undefined
			? DOCK_HALF_HEIGHT_PX
			: Math.max(0, input.targetHeight) / 2;
		balls.push({
			atlasIndex: -1,
			cx: targetAnchor.x,
			cy: targetAnchor.y,
			halfHeight: targetHalfHeight,
			halfWidth: Math.max(0, input.targetWidth) / 2,
			radius: input.targetRadius ?? DOCK_CORNER_RADIUS_PX,
			shape: "pill",
			tint: input.targetTint,
		});
	}

	const closeness = Math.max(nearness, fuseProgress);
	const speed = Math.hypot(input.velocity.x, input.velocity.y);
	const dispersion = clamp01(speed / DISPERSION_VELOCITY_PX)
		* Math.max(fuseProgress, nearness * DISPERSION_APPROACH_SCALE);
	const alpha = fuseProgress > 0
		? clamp01(Math.max(
			nearness,
			1 - Math.max(0, (fuseProgress - ALPHA_COLLAPSE_START) / ALPHA_COLLAPSE_SPAN),
		))
		: nearness;

	const targetIndex = targetAnchor ? balls.length - 1 : -1;

	return {
		alpha,
		balls,
		dispersion,
		fuseProgress,
		region: toRegion(balls),
		smoothness: lerp(
			SMOOTHNESS_MIN_PX,
			resolveNeckSmoothness(balls[0], targetIndex >= 0 ? balls[targetIndex] : null),
			closeness,
		),
		targetIndex,
		tintStrength: resolveTintStrength(
			balls[0],
			targetIndex >= 0 ? balls[targetIndex] : null,
		),
	};
}

/**
 * How much of the subjects' own colour the field still carries, 0-1.
 *
 * Measured from the source's depth past the target's border rather than from
 * its distance to the centre: a wide card and a tall one should both stop
 * showing colour the same distance in, and only the border is where a seam can
 * exist. Full colour outside and on the edge, none once the source is
 * `TINT_FADE_DEPTH_PX` inside on both axes.
 */
function resolveTintStrength(
	source: JiraLinkingBall | undefined,
	target: JiraLinkingBall | null,
): number {
	if (!source || !target) {
		return 1;
	}

	const insetX = target.halfWidth - Math.abs(target.cx - source.cx);
	const insetY = target.halfHeight - Math.abs(target.cy - source.cy);
	if (insetX <= 0 || insetY <= 0) {
		return 1;
	}

	// The shallower axis wins: a source hugging one edge is still at a seam even
	// when it is deep along the other.
	const depth = Math.min(insetX, insetY);
	return 1 - smoothstep01(depth / TINT_FADE_DEPTH_PX);
}

/**
 * A smooth union only necks when `k` is on the order of the gap it has to cross,
 * so a fixed 34px seam leaves the source and the target as two separate blobs at
 * the 40-90px separation a real hover actually produces — the whole point of the
 * effect, silently missing. Widen `k` toward the measured surface gap while the
 * two shapes are close enough for a bridge to be meaningful, and leave it at the
 * resting maximum beyond that: past `NECK_MAX_GAP_PX` no reachable `k` would
 * bridge them, and inflating it would only smear the field without connecting
 * anything.
 *
 * The gap is measured to the target's *surface* on both axes rather than
 * centre-to-centre. A target the size of a whole card is wide and tall, so a
 * centre-to-centre estimate would read a source hovering near its left edge as
 * far away when it is nearly touching.
 */
function resolveNeckSmoothness(
	source: JiraLinkingBall | undefined,
	target: JiraLinkingBall | null,
): number {
	if (!source || !target) {
		return SMOOTHNESS_MAX_PX;
	}

	const dx = Math.max(Math.abs(target.cx - source.cx) - target.halfWidth, 0);
	const dy = Math.max(Math.abs(target.cy - source.cy) - target.halfHeight, 0);
	const gapToSurface = Math.hypot(dx, dy);
	const surfaceGap = Math.max(
		0,
		gapToSurface - Math.min(source.halfWidth, source.halfHeight),
	);
	if (surfaceGap > NECK_MAX_GAP_PX) {
		return SMOOTHNESS_MAX_PX;
	}

	return Math.max(SMOOTHNESS_MAX_PX, surfaceGap * NECK_GAP_RATIO);
}
