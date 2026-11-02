"use client";

import type { Transition } from "motion/react";
import { m, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { clipRevealTransition } from "./animation";

export type ChartRevealClipMode = "reveal" | "conceal";

export interface ChartRevealClipProps {
	clipPathId: string;
	height: number;
	targetWidth: number;
	enterTransition?: Transition;
	/** Bumps when motion settings change to replay the reveal. */
	revealEpoch: number;
	/** Extra inset around the clip rect so edge glyphs are not cut off. */
	padding?: number;
	/** Vertical bleed for markers at the plot edge. Defaults to padding. */
	paddingY?: number;
	/** When false, clip stays at full width (no grow animation). */
	animating?: boolean;
	/** Reveal grows 0 → full; conceal shrinks full → 0 (ready → loading). */
	mode?: ChartRevealClipMode;
	/** Called when a conceal animation finishes. */
	onComplete?: () => void;
}

/**
 * Left-to-right clip reveal for cartesian series.
 * Anchors the transform at the corresponding edge to preserve the VPK reveal.
 */
export function ChartRevealClip({
	clipPathId,
	height,
	targetWidth,
	enterTransition,
	revealEpoch,
	padding = 0,
	paddingY = padding,
	animating = true,
	mode = "reveal",
	onComplete,
}: ChartRevealClipProps) {
	const reducedMotion = useReducedMotion();
	const transition = clipRevealTransition(enterTransition);
	const paddedWidth = Math.max(0, targetWidth + padding * 2);
	const paddedHeight = height + paddingY * 2;

	useEffect(() => {
		if (reducedMotion && animating && mode === "conceal") {
			onComplete?.();
		}
	}, [animating, mode, onComplete, reducedMotion]);

	if (!animating || reducedMotion) {
		return (
			<clipPath id={clipPathId}>
				<rect
					height={paddedHeight}
					width={paddedWidth}
					x={-padding}
					y={-paddingY}
				/>
			</clipPath>
		);
	}

	if (mode === "conceal") {
		// Mirror the LTR reveal: advance the clip's left edge rightward while width
		// shrinks (same geometry as `LineLoadingPulseStroke` exit half-cycle).
		return (
			<clipPath id={clipPathId}>
				<m.rect
					animate={{ scaleX: 0 }}
					height={paddedHeight}
					initial={{ scaleX: 1 }}
					key={`conceal-${revealEpoch}`}
					onAnimationComplete={() => onComplete?.()}
					style={{ transformBox: "fill-box", transformOrigin: "right", willChange: "transform" }}
					transition={transition}
					width={paddedWidth}
					x={-padding}
					y={-paddingY}
				/>
			</clipPath>
		);
	}

	return (
		<clipPath id={clipPathId}>
			<m.rect
				animate={{ scaleX: 1 }}
				height={paddedHeight}
				initial={{ scaleX: 0 }}
				key={`reveal-${revealEpoch}`}
				style={{ transformBox: "fill-box", transformOrigin: "left", willChange: "transform" }}
				transition={transition}
				width={paddedWidth}
				x={-padding}
				y={-paddingY}
			/>
		</clipPath>
	);
}
