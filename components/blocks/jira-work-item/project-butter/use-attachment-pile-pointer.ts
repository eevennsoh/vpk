"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { animate, useMotionValue, useReducedMotion, useSpring, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { motionDuration, motionEase } from "@/lib/motion";

/** Tight, critically damped follow: settles in ~200ms without overshooting the pile's tilt. */
const PILE_POINTER_SPRING = { stiffness: 420, damping: 36, mass: 0.6 } as const;

function usePileSpring(target: MotionValue<number>, reducedMotion: boolean | null) {
	const spring = useSpring(target, PILE_POINTER_SPRING);
	return reducedMotion ? target : spring;
}

/**
 * Hover state lives in motion values, not React state: entering or leaving a pile
 * must not re-render its `layout` cards, which would make the whole LayoutGroup re-measure.
 * Entering or focusing plays a one-shot bounce (rest, spread at 42%, rest; reference nudgePile)
 * staggered by min(index, 2) * duration / 12. Only the pointer lean is held while hovered.
 */
export function useAttachmentPilePointer() {
	const reducedMotion = useReducedMotion();
	const targetLeanX = useMotionValue(0);
	const targetLeanY = useMotionValue(0);
	/** Pointer position across the pile, -1 (left edge) to 1 (right edge). */
	const lean = usePileSpring(targetLeanX, reducedMotion);
	/** Pointer position down the pile, -1 (top) to 1 (bottom). */
	const leanY = usePileSpring(targetLeanY, reducedMotion);
	const spreadFront = useMotionValue(0);
	const spreadSecond = useMotionValue(0);
	const spreadBack = useMotionValue(0);
	/** Per depth layer (front, second, the rest): 0 at rest, 1 at the bounce peak. */
	const spreads = [spreadFront, spreadSecond, spreadBack] as const;
	const bounces = useRef<AnimationPlaybackControls[]>([]);
	const frame = useRef<number | null>(null);
	const pointer = useRef<{ node: Element; x: number; y: number } | null>(null);
	useEffect(() => () => {
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		for (const bounce of bounces.current) bounce.stop();
	}, []);
	function enter() {
		if (reducedMotion) return;
		for (const bounce of bounces.current) bounce.stop();
		const step = motionDuration.slow / 12;
		bounces.current = spreads.map((value, index) => animate(value, [0, 1, 0], {
			delay: index * step,
			duration: motionDuration.slow,
			ease: motionEase.outPractical,
			times: [0, 0.42, 1],
		}));
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
			const clamp = (value: number) => Math.max(-1, Math.min(1, value));
			targetLeanX.set(clamp((sample.x - box.left - box.width / 2) / (box.width / 2 || 1)));
			targetLeanY.set(clamp((sample.y - box.top - box.height / 2) / (box.height / 2 || 1)));
		});
	}
	function reset() {
		pointer.current = null;
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		frame.current = null;
		for (const value of [targetLeanX, targetLeanY]) value.set(0);
	}
	/** Blur keeps the lean while the pointer is still over the pile (reference restPile). */
	function blur(node: Element) {
		if (!node.matches(":hover")) reset();
	}
	return { lean, leanY, spreads, enter, move, reset, blur };
}

export type AttachmentPilePointer = ReturnType<typeof useAttachmentPilePointer>;
