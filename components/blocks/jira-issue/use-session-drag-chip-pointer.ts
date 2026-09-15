"use client";

import { useMotionValue, useSpring } from "motion/react";

import { measureSessionDragChipPointer } from "@/components/blocks/jira-issue/agent-session-drag";
import type { PointerDragPosition } from "@/components/ui-custom/hooks/use-pointer-drag";

const SESSION_DRAG_CHIP_POINTER_SPRING = {
	damping: 26,
	mass: 0.6,
	stiffness: 420,
	restDelta: 0.01,
} as const;

/**
 * Viewport-space pointer follow for a travelling mention chip. Layout shifts
 * (a collapsing row, a growing attach chin) must not move the pill off the
 * cursor — only the pointer itself should.
 */
export function useSessionDragChipPointer(shouldReduceMotion: boolean | null) {
	const pointerX = useMotionValue(0);
	const pointerY = useMotionValue(0);
	const springX = useSpring(pointerX, SESSION_DRAG_CHIP_POINTER_SPRING);
	const springY = useSpring(pointerY, SESSION_DRAG_CHIP_POINTER_SPRING);
	const x = shouldReduceMotion ? pointerX : springX;
	const y = shouldReduceMotion ? pointerY : springY;

	function snapToPointer(pointer: PointerDragPosition, host?: HTMLElement | null) {
		const next = sessionDragPointerInContainingBlock(pointer, host);
		pointerX.jump(next.x);
		pointerY.jump(next.y);
		springX.jump(next.x);
		springY.jump(next.y);
	}

	function followPointer(pointer: PointerDragPosition, host?: HTMLElement | null) {
		const next = sessionDragPointerInContainingBlock(pointer, host);
		pointerX.set(next.x);
		pointerY.set(next.y);
	}

	return { followPointer, snapToPointer, x, y };
}

function sessionDragPointerInContainingBlock(
	pointer: PointerDragPosition,
	host?: HTMLElement | null,
): PointerDragPosition {
	let node = host?.parentElement ?? null;
	while (node) {
		const { contain, filter, perspective, transform, willChange } = getComputedStyle(node);
		const createsContainingBlock = transform !== "none"
			|| filter !== "none"
			|| perspective !== "none"
			|| contain === "paint"
			|| willChange.split(",").some((token) => token.trim() === "transform");
		if (createsContainingBlock) {
			const rect = node.getBoundingClientRect();
			return measureSessionDragChipPointer(pointer, rect);
		}
		node = node.parentElement;
	}
	return pointer;
}
