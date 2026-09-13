"use client";

// oxlint-disable react-doctor/only-export-components -- This module intentionally exports colocated component API, variant contracts, context contracts, or metadata used by consumers.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import { cva, type VariantProps } from "class-variance-authority";
import { useEffect, useId, useState } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

const VIEWBOX_SIZE = 24;
const CENTER = VIEWBOX_SIZE / 2;
const STROKE_WIDTH = 2.5;
const RADIUS = CENTER - STROKE_WIDTH / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Filled variant: outer ring + gap + inner sector fill. */
const FILLED_RING_WIDTH = 3;
const FILLED_RING_RADIUS = CENTER - FILLED_RING_WIDTH / 2; // 10.5
const FILLED_CIRCUMFERENCE = 2 * Math.PI * FILLED_RING_RADIUS;
// 15° gaps throughout; longer 45° dashes at zero, then 15° dashes once started.
const FILLED_DASH_GAP = FILLED_CIRCUMFERENCE / 24;
const FILL_TRANSITION = { duration: 0.4, ease: [0, 0.4, 0, 1] } as const; // duration-slower / ease-out
const FILLED_GAP = 1.5;
const FILLED_ARC_OUTER = FILLED_RING_RADIUS - FILLED_RING_WIDTH / 2 - FILLED_GAP; // 7.5

/** SVG path for a filled sector (pie slice) sweeping clockwise from 12 o'clock. */
function sectorPath(cx: number, cy: number, r: number, angleDeg: number): string {
	if (angleDeg <= 0) return "";
	if (angleDeg >= 360) {
		// Full circle — two semicircular arcs (single arc can't draw 360°)
		return `M${cx},${cy - r}A${r},${r} 0 1,1 ${cx},${cy + r}A${r},${r} 0 1,1 ${cx},${cy - r}Z`;
	}
	const rad = (angleDeg * Math.PI) / 180;
	const endX = cx + r * Math.sin(rad);
	const endY = cy - r * Math.cos(rad);
	const large = angleDeg > 180 ? 1 : 0;
	return `M${cx},${cy}L${cx},${cy - r}A${r},${r} 0 ${large},1 ${endX},${endY}Z`;
}

/** Fraction of the ring shown during the indeterminate spin. */
const INDETERMINATE_ARC = 0.25;

/**
 * Gap between status-group arcs, as a fraction of the full circumference (each gap).
 * Only applied when there are 2+ groups — a single status fills the ring with no gap.
 */
const SEGMENT_GAP_RATIO = 0.06;

const progressCircleVariants = cva(
	"relative inline-flex shrink-0 items-center justify-center",
	{
		variants: {
			size: {
				xs: "size-3",
				sm: "size-4",
				default: "size-6",
				lg: "size-8",
			},
			variant: {
				outline: "",
				filled: "",
			},
		},
		defaultVariants: {
			size: "default",
			variant: "outline",
		},
	},
);

export type ProgressCircleSegmentStatus = "passed" | "failed" | "pending";

export interface ProgressCircleSegment {
	status: ProgressCircleSegmentStatus;
	/** Relative share of the ring. Defaults to 1. Aggregate same-status checks into one weighted arc. */
	weight?: number;
}

export interface ProgressCircleProps
	extends Omit<React.ComponentProps<"div">, "children">,
		VariantProps<typeof progressCircleVariants> {
	/** Progress value from 0 to 100. Pass `null` or omit for indeterminate (spinning) state. */
	value?: number | null;
	/**
	 * Toggle segmented ring mode (lime/failed/pending arcs with gaps).
	 * When `true` and `segments` is non-empty, renders status-group arcs instead of a continuous
	 * progress ring. Defaults to `false` so continuous progress remains the default.
	 * (`variant` still controls outline vs filled chrome; this is an independent mode toggle.)
	 */
	segmented?: boolean;
	/**
	 * Status-group data for `segmented` mode. Prefer one weighted entry per status (not one per check).
	 * Ignored unless `segmented` is `true`. Continuous `value` / complete-check behavior is skipped
	 * while segmented rendering is active.
	 */
	segments?: readonly ProgressCircleSegment[];
	/** Status overlay — replaces the progress ring with an icon. */
	status?: "error" | "info";
	/** Accessible label for the progress indicator. */
	label?: string;
	/** Whether to animate the completion check. Set to `false` to render the check statically (e.g. on remount after expand/collapse). Defaults to `true`. */
	animated?: boolean;
	/** When `false`, renders the full ring at value>=100 instead of the checkmark icon. Useful for animated fill→check transitions. Defaults to `true`. */
	showCompleteIcon?: boolean;
	/** Class for the outline track ring behind the progress arc. Defaults to `text-border`. */
	trackClassName?: string;
	/** Show a dashed remainder and solid completed arc for determinate filled progress. Defaults to `false`. */
	dashed?: boolean;
	/** March the dashed remainder clockwise. Requires `dashed`; reduced motion keeps it static. Defaults to `true`. */
	animateDashes?: boolean;
	/** Color determinate filled progress: grey at 0, blue below 75, purple from 75, green at 100. Defaults to `false`. */
	colorByProgress?: boolean;
}

function segmentStrokeClassName(status: ProgressCircleSegmentStatus): string {
	switch (status) {
		case "passed":
			return "text-icon-accent-lime";
		case "failed":
			return "text-icon-danger";
		case "pending":
			return "text-border";
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

/** Proportional status-group arcs; gaps only when 2+ groups (single status fills the ring). */
function SegmentArcs({
	segments,
	weights,
	totalWeight,
}: Readonly<{
	segments: readonly ProgressCircleSegment[];
	weights: readonly number[];
	totalWeight: number;
}>) {
	const gapCount = segments.length > 1 ? segments.length : 0;
	const gapLength = gapCount > 0 ? CIRCUMFERENCE * SEGMENT_GAP_RATIO : 0;
	const drawableLength = Math.max(0, CIRCUMFERENCE - gapCount * gapLength);
	let offset = 0;

	return segments.map((segment, index) => {
		const weight = weights[index] ?? 0;
		const arcLength = totalWeight > 0 ? drawableLength * (weight / totalWeight) : 0;
		const circle = (
			<circle
				key={`${segment.status}-${index}`}
				cx={CENTER}
				cy={CENTER}
				r={RADIUS}
				fill="none"
				strokeWidth={STROKE_WIDTH}
				stroke="currentColor"
				strokeLinecap="butt"
				strokeDasharray={`${arcLength} ${CIRCUMFERENCE - arcLength}`}
				strokeDashoffset={-offset}
				transform={`rotate(-90 ${CENTER} ${CENTER})`}
				className={segmentStrokeClassName(segment.status)}
			/>
		);
		offset += arcLength + (gapCount > 0 ? gapLength : 0);
		return circle;
	});
}

function ProgressCircle({
	value,
	segmented = false,
	segments,
	size = "default",
	variant = "outline",
	status,
	label = "Progress",
	animated = true,
	showCompleteIcon = true,
	trackClassName,
	dashed = false,
	animateDashes = true,
	colorByProgress = false,
	className,
	...props
}: Readonly<ProgressCircleProps>) {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const statusExit = shouldReduceMotion
		? undefined
		: { opacity: 0, scale: 0.5 };
	const statusExitTransition = shouldReduceMotion
		? { duration: 0 }
		: { duration: 0.15 };
	const segmentList = segments ?? [];
	const hasSegments = segmented && segmentList.length > 0;
	const isIndeterminate = !hasSegments && value == null && !status;
	const clampedValue = isIndeterminate ? 0 : Math.min(100, Math.max(0, value ?? 0));
	const isFilled = variant === "filled";
	const filledColor = !colorByProgress || isIndeterminate || clampedValue === 0
		? "text-text-subtle"
		: clampedValue >= 100
			? "text-icon-success"
			: clampedValue >= 75
				? "text-icon-discovery"
				: "text-icon-information";
	const hasDashedRing = dashed && isFilled && !hasSegments && !status && value != null;
	const remainderMaskId = useId();
	const filledProgress = useMotionValue(clampedValue);
	const [settledFilledValue, setSettledFilledValue] = useState(clampedValue);
	const filledSector = useTransform(() => sectorPath(CENTER, CENTER, FILLED_ARC_OUTER, filledProgress.get() * 3.6));
	const completedMask = useTransform(() => sectorPath(CENTER, CENTER, VIEWBOX_SIZE, filledProgress.get() * 3.6));
	const completedOffset = useTransform(filledProgress, [0, 100], [FILLED_CIRCUMFERENCE, 0]);

	useEffect(() => {
		if (!hasDashedRing) return;
		const playback = animate(filledProgress, clampedValue, {
			...FILL_TRANSITION,
			duration: shouldReduceMotion ? 0 : FILL_TRANSITION.duration,
			onComplete: () => setSettledFilledValue(clampedValue),
		});
		return () => playback.stop();
	}, [clampedValue, filledProgress, hasDashedRing, shouldReduceMotion]);

	const isComplete =
		!hasSegments
		&& !status
		&& !isIndeterminate
		&& value != null
		&& value >= 100
		&& (!hasDashedRing || shouldReduceMotion || settledFilledValue >= 100)
		&& showCompleteIcon;
	const animateComplete = animated && !shouldReduceMotion;
	const segmentWeights = segmentList.map((segment) => Math.max(0, segment.weight ?? 1));
	const totalSegmentWeight = segmentWeights.reduce((sum, weight) => sum + weight, 0);
	const passedSegmentWeight = segmentList.reduce((sum, segment, index) => {
		if (segment.status !== "passed") return sum;
		return sum + (segmentWeights[index] ?? 0);
	}, 0);

	const dashOffset = isIndeterminate
		? CIRCUMFERENCE * (1 - INDETERMINATE_ARC)
		: CIRCUMFERENCE * (1 - clampedValue / 100);
	const filledAngle = isIndeterminate
		? INDETERMINATE_ARC * 360
		: (clampedValue / 100) * 360;

	const ariaValueNow = hasSegments
		? passedSegmentWeight
		: isIndeterminate
			? undefined
			: clampedValue;
	const ariaValueMax = hasSegments ? totalSegmentWeight : 100;

	return (
		<div
			data-slot="progress-circle"
			role="progressbar"
			aria-valuenow={ariaValueNow}
			aria-valuemin={0}
			aria-valuemax={ariaValueMax}
			aria-label={label}
			className={cn(progressCircleVariants({ size, variant }), className)}
			{...props}
		>
			<AnimatePresence mode="wait" initial={false}>
				{status === "error" ? (
					<motion.svg
						key="error"
						viewBox="0 0 16 16"
						fill="none"
						className="size-full"
						initial={{ opacity: 0, scale: 0.5 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
					>
						<path
							fillRule="evenodd"
							clipRule="evenodd"
							d="M6.58285 0.587048C7.36565 -0.19565 8.63453 -0.195715 9.4173 0.587048L15.4131 6.58285C16.1956 7.36563 16.1957 8.63459 15.4131 9.4173L9.4173 15.4131C8.63459 16.1957 7.36563 16.1956 6.58285 15.4131L0.587049 9.4173C-0.195714 8.63453 -0.195652 7.36565 0.587049 6.58285L6.58285 0.587048ZM8.00007 10.2551C7.44655 10.2551 6.99783 10.7038 6.99783 11.2573C6.99797 11.8107 7.44663 12.2596 8.00007 12.2596C8.55342 12.2595 9.00217 11.8107 9.00231 11.2573C9.00231 10.7039 8.5535 10.2552 8.00007 10.2551ZM7.24839 3.74057V9.00231H8.75175V3.74057H7.24839Z"
							fill="currentColor"
							className="text-icon-danger"
						/>
					</motion.svg>
				) : status === "info" ? (
					<motion.svg
						key="info"
						viewBox="0 0 16 16"
						fill="none"
						className="size-full"
						initial={{ opacity: 0, scale: 0.5 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
					>
						<path
							fillRule="evenodd"
							clipRule="evenodd"
							d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0ZM6.5 6.75V8.25H7.25V12.5H8.75V7.5C8.75 7.08579 8.41421 6.75 8 6.75H6.5ZM8 3.5C7.44772 3.5 7 3.94772 7 4.5C7 5.05228 7.44772 5.5 8 5.5C8.55228 5.5 9 5.05228 9 4.5C9 3.94772 8.55228 3.5 8 3.5Z"
							fill="currentColor"
							className="text-icon-information"
						/>
					</motion.svg>
				) : isComplete ? (
					<motion.svg
						key="check"
						viewBox="0 0 16 16"
						fill="none"
						className="size-full"
						initial={animateComplete ? { opacity: 0, scale: 0.5 } : false}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
					>
						{/* Circle background */}
						{animateComplete ? (
							<motion.path
								d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16Z"
								fill="currentColor"
								className="text-icon-success"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.2 }}
							/>
						) : (
							<path
								d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16Z"
								fill="currentColor"
								className="text-icon-success"
							/>
						)}
						{/* Checkmark */}
						{animateComplete ? (
							<motion.path
								d="M4.82617 7.51953L6.75 9.82812L11.1738 4.51953L12.3262 5.48047L7.32617 11.4805C7.18368 11.6513 6.9725 11.75 6.75 11.75C6.5275 11.75 6.31632 11.6513 6.17383 11.4805L3.67383 8.48047L4.82617 7.51953Z"
								fill="white"
								initial={{ pathLength: 0, opacity: 0 }}
								animate={{ pathLength: 1, opacity: 1 }}
								transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
								style={{ strokeDashoffset: 0 }}
							/>
						) : (
							<path
								d="M4.82617 7.51953L6.75 9.82812L11.1738 4.51953L12.3262 5.48047L7.32617 11.4805C7.18368 11.6513 6.9725 11.75 6.75 11.75C6.5275 11.75 6.31632 11.6513 6.17383 11.4805L3.67383 8.48047L4.82617 7.51953Z"
								fill="white"
							/>
						)}
					</motion.svg>
				) : hasSegments ? (
					<motion.svg
						key="segments"
						viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
						fill="none"
						className="size-full"
						exit={statusExit}
						transition={statusExitTransition}
					>
						<SegmentArcs
							segments={segmentList}
							totalWeight={totalSegmentWeight}
							weights={segmentWeights}
						/>
					</motion.svg>
				) : isFilled ? (
					<motion.svg
						key="filled"
						viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
						fill="none"
						className={cn("size-full", isIndeterminate && "animate-spin")}
						exit={statusExit}
						transition={statusExitTransition}
					>
						{hasDashedRing ? (
							<>
								<defs>
									<mask id={remainderMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={VIEWBOX_SIZE} height={VIEWBOX_SIZE}>
										<rect width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} fill="white" />
										<motion.path d={completedMask} fill="black" />
									</mask>
								</defs>
								{/* The mask stays fixed while only the unfinished dashes rotate. */}
								<g mask={`url(#${remainderMaskId})`}>
									<circle
										data-slot="progress-circle-dashes"
										cx={CENTER}
										cy={CENTER}
										r={FILLED_RING_RADIUS}
										strokeWidth={FILLED_RING_WIDTH}
										stroke="currentColor"
										strokeDasharray={`${clampedValue === 0 ? FILLED_DASH_GAP * 3 : FILLED_DASH_GAP} ${FILLED_DASH_GAP}`}
										className={cn("origin-center motion-safe:animate-spin", filledColor)}
										style={{
											animationDuration: "calc(var(--duration-slowest) * 10)",
											animationPlayState: animateDashes && clampedValue < 100 ? "running" : "paused",
										}}
									/>
								</g>
								<motion.circle
									data-slot="progress-circle-solid"
									cx={CENTER}
									cy={CENTER}
									r={FILLED_RING_RADIUS}
									strokeWidth={FILLED_RING_WIDTH}
									stroke="currentColor"
									strokeDasharray={FILLED_CIRCUMFERENCE}
									style={{ strokeDashoffset: completedOffset }}
									transform={`rotate(-90 ${CENTER} ${CENTER})`}
									className={filledColor}
								/>
							</>
						) : (
							<circle
								cx={CENTER}
								cy={CENTER}
								r={FILLED_RING_RADIUS}
								strokeWidth={FILLED_RING_WIDTH}
								stroke="currentColor"
								className={filledColor}
							/>
						)}
						{/* Inner sector fill — true pie sweep from center */}
						<motion.path
							d={hasDashedRing ? filledSector : sectorPath(CENTER, CENTER, FILLED_ARC_OUTER, filledAngle)}
							fill="currentColor"
							className={filledColor}
						/>
					</motion.svg>
				) : (
					<motion.svg
						key="ring"
						viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
						fill="none"
						className={cn("size-full", isIndeterminate && "animate-spin")}
						exit={statusExit}
						transition={statusExitTransition}
					>
						{/* Track */}
						<circle
							cx={CENTER}
							cy={CENTER}
							r={RADIUS}
							strokeWidth={STROKE_WIDTH}
							stroke="currentColor"
							className={cn("text-border", trackClassName)}
						/>
						{/* Indicator */}
						<motion.circle
							cx={CENTER}
							cy={CENTER}
							r={RADIUS}
							strokeWidth={STROKE_WIDTH}
							stroke="currentColor"
							strokeLinecap="butt"
							strokeDasharray={CIRCUMFERENCE}
							initial={false}
							animate={{ strokeDashoffset: dashOffset }}
							transition={isIndeterminate ? { duration: 0 } : { duration: 0.4, ease: [0, 0.4, 0, 1] }}
							transform={`rotate(-90 ${CENTER} ${CENTER})`}
							className="text-text-subtle"
						/>
					</motion.svg>
				)}
			</AnimatePresence>
		</div>
	);
}

export { ProgressCircle, progressCircleVariants, type VariantProps };
