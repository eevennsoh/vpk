"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { useMotionValue, useReducedMotion, useSpring, type MotionValue } from "motion/react";

/** Tight, critically damped follow: settles in ~200ms without overshooting the pile's tilt. */
const PILE_POINTER_SPRING = { stiffness: 420, damping: 36, mass: 0.6 } as const;

function usePileSpring(target: MotionValue<number>, reducedMotion: boolean | null) {
	const spring = useSpring(target, PILE_POINTER_SPRING);
	return reducedMotion ? target : spring;
}

/**
 * Hover state lives in motion values, not React state: entering or leaving a pile
 * must not re-render its `layout` cards, which would make the whole LayoutGroup re-measure.
 */
export function useAttachmentPilePointer() {
	const reducedMotion = useReducedMotion();
	const targetX = useMotionValue(0);
	const targetY = useMotionValue(0);
	const targetRotate = useMotionValue(0);
	const targetSpread = useMotionValue(0);
	const x = usePileSpring(targetX, reducedMotion);
	const y = usePileSpring(targetY, reducedMotion);
	const rotate = usePileSpring(targetRotate, reducedMotion);
	const spread = usePileSpring(targetSpread, reducedMotion);
	const frame = useRef<number | null>(null);
	const pointer = useRef<{ node: Element; x: number; y: number } | null>(null);
	useEffect(() => () => {
		if (frame.current !== null) cancelAnimationFrame(frame.current);
	}, []);
	function enter() {
		if (!reducedMotion) targetSpread.set(1);
	}
	function move(event: PointerEvent<HTMLElement>) {
		if (reducedMotion || event.pointerType === "touch") return;
		const node = event.currentTarget.closest("[data-attachment-stack]");
		if (!node) return;
		pointer.current = { node, x: event.clientX, y: event.clientY };
		if (frame.current !== null) return;
		frame.current = requestAnimationFrame(() => {
			frame.current = null;
			const sample = pointer.current;
			if (!sample) return;
			const box = sample.node.getBoundingClientRect();
			const nx = Math.max(-1, Math.min(1, (sample.x - box.left - box.width / 2) / (box.width / 2 || 1)));
			const ny = Math.max(-1, Math.min(1, (sample.y - box.top - box.height / 2) / (box.height / 2 || 1)));
			targetX.set(nx * 4); targetY.set(ny * 2); targetRotate.set(nx * 3);
		});
	}
	function reset() {
		pointer.current = null;
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		frame.current = null;
		for (const value of [targetX, targetY, targetRotate, targetSpread]) value.set(0);
	}
	return { x, y, rotate, spread, enter, move, reset };
}

export type AttachmentPilePointer = ReturnType<typeof useAttachmentPilePointer>;
