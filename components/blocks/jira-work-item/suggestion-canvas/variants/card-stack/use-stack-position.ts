"use client";

import { useEffect } from "react";
import { animate, useMotionValue, type MotionValue } from "motion/react";

import { FADE, PEEK_STEP, SCALE_STEP, SETTLE } from "./constants";

interface StackPositionOptions {
	index: number;
	/** The top card's signed drag progress while it is handled; null when nothing is being dragged. */
	promote: MotionValue<number> | null;
	reduced: boolean;
	/** A new suggestion slides in from one step behind its slot. */
	entering: boolean;
}

/**
 * Where a card sits in the stack: its drop and scale, plus how much of its content shows through the veil.
 * While the top card is dragged, the cards behind rise in proportion to the drag, so a committed swipe promotes
 * them without a jump; otherwise they settle into their slot from wherever they are.
 */
export function useStackPosition({ index, promote, reduced, entering }: Readonly<StackPositionOptions>) {
	const startDepth = entering ? index + 1 : index;
	const y = useMotionValue(startDepth * PEEK_STEP);
	const scale = useMotionValue(1 - startDepth * SCALE_STEP);
	const content = useMotionValue(index === 0 ? 1 : 0);
	const veil = useMotionValue(index === 0 ? 0 : 1);

	useEffect(() => {
		if (promote && index > 0) {
			const follow = (value: number) => {
				const lift = Math.abs(value);
				const depth = index - lift;
				y.set(depth * PEEK_STEP);
				scale.set(1 - depth * SCALE_STEP);
				if (index === 1) {
					content.set(lift);
					veil.set(1 - lift);
				}
			};
			follow(promote.get());
			return promote.on("change", follow);
		}
		const targets: [MotionValue<number>, number][] = [
			[y, index * PEEK_STEP],
			[scale, 1 - index * SCALE_STEP],
			[content, index === 0 ? 1 : 0],
			[veil, index === 0 ? 0 : 1],
		];
		if (reduced) {
			for (const [value, target] of targets) value.set(target);
			return undefined;
		}
		const controls = targets.map(([value, target], position) => animate(value, target, position < 2 ? SETTLE : FADE));
		return () => controls.forEach((control) => control.stop());
	}, [content, index, promote, reduced, scale, veil, y]);

	return { y, scale, content, veil };
}
