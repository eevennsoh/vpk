import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";

interface RowEdge {
	midpoint: number;
	edge: number;
}

interface BoundaryDrag {
	handle: HTMLElement;
	root: HTMLElement;
	pointerId: number;
	startY: number;
	pointerY: number;
	grabOffset: number;
	rest: number;
	above: readonly RowEdge[];
	below: readonly RowEdge[];
	listeners: AbortController;
	frame: number;
}

function readRowEdges(root: HTMLElement, side: "sprint" | "backlog", top: number) {
	return Array.from(root.querySelectorAll(`[data-sprint-boundary-side="${side}"] [data-backlog-item-row]`), (row) => {
		const rect = row.getBoundingClientRect();
		return {
			midpoint: rect.top + rect.height / 2 - top,
			edge: (side === "sprint" ? rect.top : rect.bottom) - top,
		};
	});
}

function snapToRows(drag: BoundaryDrag, rootTop: number) {
	const y = drag.pointerY - drag.grabOffset - rootTop;
	const movingDown = y > drag.rest;
	const rows = movingDown ? drag.below : drag.above;
	let count = 0;
	let edge = drag.rest;
	for (const row of rows) {
		if (movingDown ? y < row.midpoint : y > row.midpoint) break;
		count++;
		edge = row.edge;
	}
	return { delta: movingDown ? count : -count, edge };
}

export function useSprintBoundaryDrag({
	rootRef,
	lineRef,
	labelRef,
	sprintItems,
	backlogItems,
	disabled,
	onMove,
}: Readonly<{
	rootRef: RefObject<HTMLDivElement | null>;
	lineRef: RefObject<HTMLDivElement | null>;
	labelRef: RefObject<HTMLSpanElement | null>;
	sprintItems: readonly unknown[];
	backlogItems: readonly unknown[];
	disabled: boolean;
	onMove: (delta: number) => void;
}>) {
	const drag = useRef<BoundaryDrag | null>(null);
	const didDrag = useRef(false);

	const finish = useCallback(() => {
		const current = drag.current;
		if (!current) return;
		drag.current = null;
		cancelAnimationFrame(current.frame);
		current.listeners.abort();
		if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
		if (lineRef.current) lineRef.current.hidden = true;
		delete current.root.dataset.draggingSprintBoundary;
	}, [lineRef]);

	useEffect(() => finish, [backlogItems, disabled, finish, sprintItems]);

	function schedulePreview(current: BoundaryDrag) {
		if (current.frame) return;
		current.frame = requestAnimationFrame(() => {
			current.frame = 0;
			const line = lineRef.current;
			const label = labelRef.current;
			if (!didDrag.current || !line || !label) return;
			const { delta, edge } = snapToRows(current, current.root.getBoundingClientRect().top);
			const count = sprintItems.length + delta;
			const text = `${count} work ${count === 1 ? "item" : "items"} in sprint`;
			if (label.textContent !== text) label.textContent = text;
			line.style.transform = `translateY(${edge}px)`;
			line.hidden = false;
			current.root.dataset.draggingSprintBoundary = "";
		});
	}

	function onPointerDown(event: PointerEvent<HTMLElement>) {
		const root = rootRef.current;
		if (!root || disabled || drag.current || !event.isPrimary || event.button !== 0) return;
		const handle = event.currentTarget;
		const { top } = root.getBoundingClientRect();
		const handleRect = handle.getBoundingClientRect();
		const handleCenter = handleRect.top + handleRect.height / 2;
		const listeners = new AbortController();
		const current: BoundaryDrag = {
			handle,
			root,
			pointerId: event.pointerId,
			startY: event.clientY,
			pointerY: event.clientY,
			grabOffset: event.clientY - handleCenter,
			rest: handleCenter - top,
			above: readRowEdges(root, "sprint", top).reverse(),
			below: readRowEdges(root, "backlog", top),
			listeners,
			frame: 0,
		};
		didDrag.current = false;
		drag.current = current;
		handle.setPointerCapture(event.pointerId);
		window.addEventListener("scroll", () => schedulePreview(current), { capture: true, signal: listeners.signal });
		window.addEventListener("resize", finish, { signal: listeners.signal });
		window.addEventListener("blur", finish, { signal: listeners.signal });
		window.addEventListener("keydown", (keyEvent) => {
			if (keyEvent.key !== "Escape" || !didDrag.current) return;
			keyEvent.preventDefault();
			finish();
		}, { signal: listeners.signal });
	}

	function onPointerMove(event: PointerEvent<HTMLElement>) {
		const current = drag.current;
		if (!current || event.pointerId !== current.pointerId) return;
		current.pointerY = event.clientY;
		if (Math.abs(current.pointerY - current.startY) >= 4) didDrag.current = true;
		schedulePreview(current);
	}

	function onPointerUp(event: PointerEvent<HTMLElement>) {
		const current = drag.current;
		if (!current || event.pointerId !== current.pointerId) return;
		current.pointerY = event.clientY;
		const rect = current.root.getBoundingClientRect();
		const withinWidth = event.clientX >= rect.left && event.clientX <= rect.right;
		const { delta } = snapToRows(current, rect.top);
		finish();
		if (didDrag.current && withinWidth && !disabled && delta !== 0) onMove(delta);
	}

	function cancelPointer(event: PointerEvent<HTMLElement>) {
		if (event.pointerId === drag.current?.pointerId) finish();
	}

	function onClickCapture(event: MouseEvent<HTMLElement>) {
		if (event.detail === 0 || !didDrag.current) return;
		didDrag.current = false;
		event.preventDefault();
		event.stopPropagation();
	}

	return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancelPointer, onLostPointerCapture: cancelPointer, onClickCapture };
}
