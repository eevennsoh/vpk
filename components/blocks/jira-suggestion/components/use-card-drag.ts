"use client";

import { useRef, useState, type PointerEvent } from "react";
import { animate, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";

import { COMMIT_DISTANCE, FLICK_MIN_DISTANCE, FLICK_VELOCITY, SPRING_BACK, TAP_SLOP } from "./constants";
import type { SwipeDirection } from "./use-deck";

interface DragState {
	pointerId: number;
	startX: number;
	startY: number;
	/** The canvas zoom, so travel is measured in the card's own pixels. */
	scale: number;
	lastX: number;
	lastTime: number;
	velocity: number;
	moved: boolean;
}

export interface CardDragOptions {
	/** Only the top card follows the pointer. */
	enabled: boolean;
	onCommit: (direction: SwipeDirection) => void;
	/** A press that never became a swipe. */
	onTap: () => void;
	/** Signed drag progress (-1…1) while grabbed, null when let go without deciding. */
	onGrab: (progress: MotionValue<number> | null) => void;
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Horizontal swipe for the top card: it follows the pointer, commits past a distance (or on a flick) and springs back
 * otherwise. A press without travel is a tap. `dragX` is the card's swipe offset, separate from its pose in the stack.
 */
export function useCardDrag({ enabled, onCommit, onTap, onGrab }: Readonly<CardDragOptions>) {
	const reduced = useReducedMotion() ?? false;
	const drag = useRef<DragState | null>(null);
	const [dragging, setDragging] = useState(false);
	const dragX = useMotionValue(0);
	const progress = useTransform(dragX, (value) => clamp(value / COMMIT_DISTANCE, -1, 1));

	const onPointerDown = (event: PointerEvent<HTMLElement>) => {
		if (!enabled || event.button !== 0 || (event.target as Element).closest("button, a, input, [data-suggestion-value-scroll]")) return;
		const element = event.currentTarget;
		element.setPointerCapture(event.pointerId);
		const scale = element.getBoundingClientRect().width / element.offsetWidth || 1;
		drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, scale, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, moved: false };
	};

	const onPointerMove = (event: PointerEvent<HTMLElement>) => {
		const state = drag.current;
		if (!state || state.pointerId !== event.pointerId) return;
		if (!state.moved) {
			if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < TAP_SLOP * state.scale) return;
			state.moved = true;
			setDragging(true);
			onGrab(progress);
		}
		const elapsed = event.timeStamp - state.lastTime;
		if (elapsed > 0) state.velocity = (event.clientX - state.lastX) / state.scale / elapsed;
		state.lastX = event.clientX;
		state.lastTime = event.timeStamp;
		dragX.set((event.clientX - state.startX) / state.scale);
	};

	const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
		const state = drag.current;
		if (!state || state.pointerId !== event.pointerId) return;
		drag.current = null;
		if (!state.moved) {
			if (event.type === "pointerup") onTap();
			return;
		}
		setDragging(false);
		const distance = dragX.get();
		const flicked = Math.abs(state.velocity) > FLICK_VELOCITY && Math.abs(distance) > FLICK_MIN_DISTANCE && Math.sign(state.velocity) === Math.sign(distance);
		if (Math.abs(distance) > COMMIT_DISTANCE || flicked) {
			onCommit(distance > 0 ? "accept" : "dismiss");
			return;
		}
		onGrab(null);
		if (reduced) dragX.set(0);
		else animate(dragX, 0, SPRING_BACK);
	};

	return {
		dragX,
		progress,
		dragging,
		handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd },
	};
}
