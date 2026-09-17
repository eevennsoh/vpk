"use client";

import { useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { MotionValue, SpringOptions } from "motion/react";
import { useEffect, useMemo } from "react";
import type { RefObject } from "react";

import {
	resolveMagneticAxisOffset,
	resolveMagneticPointerRelation,
	type MagneticPointerRelation,
} from "./magnetic-proximity-model";

/** Reverse-engineered from the "Magnetic Hover" component shipped on
 * magnet.learnframer.site (chunk-ND35KM2X.mjs). */
export const MAGNETIC_PROXIMITY_DISTANCE = 10;
export const MAGNETIC_PROXIMITY_LABEL_RATIO = 6 / 10;
export const MAGNETIC_PROXIMITY_HOVER_AREA = 24;
export const MAGNETIC_PROXIMITY_SPRING = {
	damping: 50,
	stiffness: 900,
	mass: 0.5,
	restDelta: 0.001,
} as const;

export interface MagneticProximityOptions {
	/** Peak offset in px applied at the edge of the target. */
	distance?: number;
	/** Fraction of `distance` applied to the nested label values. */
	labelRatio?: number;
	/** Padding in px around the target rect that still counts as hovered. */
	hoverArea?: number;
	spring?: SpringOptions;
}

export interface MagneticProximityValues {
	x: MotionValue<number>;
	y: MotionValue<number>;
	labelX: MotionValue<number>;
	labelY: MotionValue<number>;
	/** Pointer relation remains available when reduced motion pins translation. */
	proximity: MotionValue<MagneticPointerRelation>;
}

/**
 * Spring-backed magnetic lean toward the pointer.
 *
 * While the pointer sits inside the target rect (grown by `hoverArea`), `x`/`y`
 * lean up to `distance` px toward it, normalized against the rect's half-size,
 * and `labelX`/`labelY` follow at `labelRatio` for a nested parallax layer.
 * Leaving the activation box or unmounting returns every value to rest.
 * `prefers-reduced-motion` pins translation at 0 while retaining proximity
 * relation state for non-motion feedback such as selected colors.
 *
 * Touch pointers are ignored: they would otherwise freeze the lean at its last
 * offset once the finger lifts, since there is no hover state to leave.
 *
 * Note on self-damping: when the returned `x`/`y` are applied to an ancestor of
 * `targetRef`, the measured rect moves with the lean, so the offset converges
 * instead of chasing. That feedback loop is intentional in `useGlassTabsMotion`
 * — putting the transform on the measured element itself gives a different,
 * unbounded chase.
 */
export function useMagneticProximity(
	targetRef: RefObject<HTMLElement | null>,
	options?: Readonly<MagneticProximityOptions>,
): MagneticProximityValues {
	const shouldReduceMotion = useReducedMotion();

	const distance = options?.distance ?? MAGNETIC_PROXIMITY_DISTANCE;
	const labelRatio = options?.labelRatio ?? MAGNETIC_PROXIMITY_LABEL_RATIO;
	const hoverArea = options?.hoverArea ?? MAGNETIC_PROXIMITY_HOVER_AREA;

	const {
		damping = MAGNETIC_PROXIMITY_SPRING.damping,
		stiffness = MAGNETIC_PROXIMITY_SPRING.stiffness,
		mass = MAGNETIC_PROXIMITY_SPRING.mass,
		restDelta = MAGNETIC_PROXIMITY_SPRING.restDelta,
	} = options?.spring ?? {};
	const springConfig = useMemo(
		() => ({ damping, stiffness, mass, restDelta }),
		[damping, stiffness, mass, restDelta],
	);

	const magnetX = useMotionValue(0);
	const magnetY = useMotionValue(0);
	const proximity = useMotionValue<MagneticPointerRelation>("outside");
	const x = useSpring(magnetX, springConfig);
	const y = useSpring(magnetY, springConfig);
	const labelX = useTransform(x, (nextValue) => nextValue * labelRatio);
	const labelY = useTransform(y, (nextValue) => nextValue * labelRatio);

	useEffect(() => {
		if (typeof document === "undefined") return;

		const reset = () => {
			if (proximity.get() !== "outside") {
				proximity.set("outside");
			}
			magnetX.set(0);
			magnetY.set(0);
		};
		if (shouldReduceMotion) reset();

		const handleMove = (event: PointerEvent) => {
			if (event.pointerType === "touch") {
				reset();
				return;
			}
			const element = targetRef.current;
			if (!element) return;
			const rect = element.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) {
				reset();
				return;
			}

			const nextProximity = resolveMagneticPointerRelation(
				{ x: event.clientX, y: event.clientY },
				rect,
				hoverArea,
			);
			if (proximity.get() !== nextProximity) {
				proximity.set(nextProximity);
			}

			if (nextProximity !== "outside" && !shouldReduceMotion) {
				const dx = event.clientX - (rect.left + rect.width / 2);
				const dy = event.clientY - (rect.top + rect.height / 2);
				magnetX.set(resolveMagneticAxisOffset(dx, rect.width / 2, distance));
				magnetY.set(resolveMagneticAxisOffset(dy, rect.height / 2, distance));
				return;
			}

			magnetX.set(0);
			magnetY.set(0);
		};

		document.addEventListener("pointermove", handleMove, { passive: true });
		return () => {
			document.removeEventListener("pointermove", handleMove);
			reset();
		};
	}, [distance, hoverArea, magnetX, magnetY, proximity, shouldReduceMotion, targetRef]);

	return { x, y, labelX, labelY, proximity };
}
