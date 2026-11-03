"use client";

import { useLayoutEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";

import { SETTLE } from "./constants";

/**
 * A pixel length that eases to each new target (instantly under reduced motion, and on its first value).
 * Returns "auto" until a target is known, so the element keeps its natural size meanwhile.
 */
export function useEasedLength(target: number | null): MotionValue<number | "auto"> {
	const value = useMotionValue<number | "auto">(target ?? "auto");
	const reduced = useReducedMotion() ?? false;
	const known = useRef(target != null);
	useLayoutEffect(() => {
		if (target == null) return undefined;
		if (!known.current || reduced || typeof value.get() !== "number") {
			known.current = true;
			value.set(target);
			return undefined;
		}
		const controls = animate(value as MotionValue<number>, target, SETTLE);
		return () => controls.stop();
	}, [reduced, target, value]);
	return value;
}
