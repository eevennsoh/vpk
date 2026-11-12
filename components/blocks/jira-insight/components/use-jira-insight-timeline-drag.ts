"use client";

import {
	useCallback,
	useRef,
	useState,
	type PointerEvent,
	type RefObject,
} from "react";

const DRAG_THRESHOLD_PX = 5;

export function useJiraInsightTimelineDrag(
	viewportRef: RefObject<HTMLDivElement | null>,
	onPanEnd: () => void,
) {
	const [isDragging, setIsDragging] = useState(false);
	const isPressedRef = useRef(false);
	const startXRef = useRef(0);
	const startScrollLeftRef = useRef(0);
	const wasDraggedRef = useRef(false);

	const finishPan = useCallback((pointerId: number) => {
		if (!isPressedRef.current) return;
		const wasDragged = wasDraggedRef.current;
		isPressedRef.current = false;
		setIsDragging(false);
		const viewport = viewportRef.current;
		if (viewport?.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);
		if (wasDragged) onPanEnd();
		requestAnimationFrame(() => {
			wasDraggedRef.current = false;
		});
	}, [onPanEnd, viewportRef]);

	const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0 || event.pointerType !== "mouse") return;
		const viewport = viewportRef.current;
		if (!viewport) return;
		isPressedRef.current = true;
		wasDraggedRef.current = false;
		startXRef.current = event.clientX;
		startScrollLeftRef.current = viewport.scrollLeft;
	}, [viewportRef]);

	const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
		if (!isPressedRef.current) return;
		if ((event.buttons & 1) !== 1) {
			finishPan(event.pointerId);
			return;
		}
		const viewport = viewportRef.current;
		if (!viewport) return;
		const delta = event.clientX - startXRef.current;
		if (!wasDraggedRef.current && Math.abs(delta) > DRAG_THRESHOLD_PX) {
			wasDraggedRef.current = true;
			setIsDragging(true);
			viewport.setPointerCapture(event.pointerId);
		}
		if (wasDraggedRef.current) viewport.scrollLeft = startScrollLeftRef.current - delta;
	}, [finishPan, viewportRef]);

	const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
		finishPan(event.pointerId);
	}, [finishPan]);

	const onPointerLeave = useCallback((event: PointerEvent<HTMLDivElement>) => {
		if (isPressedRef.current && !wasDraggedRef.current) finishPan(event.pointerId);
	}, [finishPan]);

	const onLostPointerCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
		finishPan(event.pointerId);
	}, [finishPan]);

	return {
		isDragging,
		onLostPointerCapture,
		onPointerDown,
		onPointerLeave,
		onPointerMove,
		onPointerUp,
		wasDraggedRef,
	};
}
