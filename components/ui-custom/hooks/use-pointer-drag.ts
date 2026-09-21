"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type PointerDragPosition = Readonly<{ x: number; y: number }>;
export type PointerDragBounds = Readonly<{
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}>;

function clampPosition(
	position: PointerDragPosition,
	bounds?: PointerDragBounds,
): PointerDragPosition {
	if (!bounds) return position;
	return {
		x: Math.min(bounds.maxX, Math.max(bounds.minX, position.x)),
		y: Math.min(bounds.maxY, Math.max(bounds.minY, position.y)),
	};
}

/**
 * Controlled pointer-drag binding for a single element.
 *
 * - Captures the pointer on `pointerdown` so the drag survives leaving the
 *   element, and releases it on `pointerup` / `pointercancel`.
 * - Movement past 2px on either axis marks the gesture as a drag, which
 *   swallows exactly one following `click` so a drag never activates the
 *   element. `bind.onClick` returns false for that swallowed click so a host
 *   can also cancel its own composed activation handler. Call `onActivate`
 *   for the click behaviour instead of wiring your own `onClick` — spreading
 *   `bind` would overwrite it.
 * - Arrow keys nudge by 2px (10px with Shift) through the same clamp.
 *
 * `position` is fully controlled: the hook never stores it, it only reports
 * the next value through `onPositionChange`.
 */
export function usePointerDrag(
	position: PointerDragPosition,
	onPositionChange: (position: PointerDragPosition) => void,
	bounds?: PointerDragBounds,
	onActivate?: () => void,
) {
	const [dragging, setDragging] = useState(false);
	const draggingRef = useRef(false);
	const movedRef = useRef(false);
	const originRef = useRef({ pointerX: 0, pointerY: 0, x: position.x, y: position.y });

	function onPointerDown(event: PointerEvent<HTMLElement>) {
		event.currentTarget.setPointerCapture(event.pointerId);
		draggingRef.current = true;
		movedRef.current = false;
		originRef.current = {
			pointerX: event.clientX,
			pointerY: event.clientY,
			x: position.x,
			y: position.y,
		};
		setDragging(true);
	}

	function onPointerMove(event: PointerEvent<HTMLElement>) {
		if (!draggingRef.current) return;
		const pointerDeltaX = event.clientX - originRef.current.pointerX;
		const pointerDeltaY = event.clientY - originRef.current.pointerY;
		if (Math.abs(pointerDeltaX) > 2 || Math.abs(pointerDeltaY) > 2) movedRef.current = true;
		onPositionChange(clampPosition({
			x: originRef.current.x + pointerDeltaX,
			y: originRef.current.y + pointerDeltaY,
		}, bounds));
	}

	function onPointerEnd(event: PointerEvent<HTMLElement>) {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		draggingRef.current = false;
		setDragging(false);
	}

	function onClick() {
		if (movedRef.current) {
			movedRef.current = false;
			return false;
		}
		onActivate?.();
		return true;
	}

	function onKeyDown(event: KeyboardEvent<HTMLElement>) {
		const amount = event.shiftKey ? 10 : 2;
		const delta = {
			ArrowLeft: { x: -amount, y: 0 },
			ArrowRight: { x: amount, y: 0 },
			ArrowUp: { x: 0, y: -amount },
			ArrowDown: { x: 0, y: amount },
		}[event.key];
		if (!delta) return;
		event.preventDefault();
		onPositionChange(clampPosition({ x: position.x + delta.x, y: position.y + delta.y }, bounds));
	}

	return {
		position,
		dragging,
		bind: {
			onClick,
			onPointerDown,
			onPointerMove,
			onPointerUp: onPointerEnd,
			onPointerCancel: onPointerEnd,
			onKeyDown,
		},
	};
}
