"use client";

import { useMotionValue, useSpring } from "motion/react";
import { useRef } from "react";

import { measureSessionDragChipPointer } from "@/components/blocks/jira-issue/agent-session-drag";
import type { PointerDragPosition } from "@/components/ui-custom/hooks/use-pointer-drag";
import { stepPeelSurfaceTravel, type PeelSurfaceTravel } from "@/components/visual/peel/peel-geometry";

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
	const originX = useMotionValue(0);
	const direction = useMotionValue(0);
	const travel = useRef<PeelSurfaceTravel>({ direction: 0, extremeX: 0 });
	const springX = useSpring(pointerX, SESSION_DRAG_CHIP_POINTER_SPRING);
	const springY = useSpring(pointerY, SESSION_DRAG_CHIP_POINTER_SPRING);
	const x = shouldReduceMotion ? pointerX : springX;
	const y = shouldReduceMotion ? pointerY : springY;

	function snapResolvedPointer(next: PointerDragPosition) {
		pointerX.jump(next.x);
		pointerY.jump(next.y);
		springX.jump(next.x);
		springY.jump(next.y);
	}

	function beginGesture(pointer: PointerDragPosition, host?: HTMLElement | null) {
		const next = sessionDragPointerInContainingBlock(pointer, host);
		originX.jump(next.x);
		direction.jump(0);
		travel.current.direction = 0;
		travel.current.extremeX = next.x;
		snapResolvedPointer(next);
	}

	function snapToPointer(pointer: PointerDragPosition, host?: HTMLElement | null) {
		const next = sessionDragPointerInContainingBlock(pointer, host);
		direction.set(stepPeelSurfaceTravel(travel.current, next.x));
		snapResolvedPointer(next);
	}

	function followPointer(pointer: PointerDragPosition, host?: HTMLElement | null) {
		const next = sessionDragPointerInContainingBlock(pointer, host);
		direction.set(stepPeelSurfaceTravel(travel.current, next.x));
		pointerX.set(next.x);
		pointerY.set(next.y);
	}

	// Lighting follows user travel; the visual follower may recoil after input stops.
	return { beginGesture, followPointer, snapToPointer, originX, direction, x, y };
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
