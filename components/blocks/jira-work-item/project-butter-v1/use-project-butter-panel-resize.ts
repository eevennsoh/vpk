"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const MIN_WIDTH = 440;
const MAX_WIDTH = 620;
const clampWidth = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
type PanelDrag = { element: HTMLDivElement; frame: number | null; nextWidth: number; pointerId: number; right: number };

export function useProjectButterPanelResize(enabled: boolean) {
	const [width, setWidth] = useState(MIN_WIDTH);
	const drag = useRef<PanelDrag | null>(null);
	const finish = useCallback((commit: boolean) => {
		const current = drag.current;
		if (!current) return;
		drag.current = null;
		if (current.frame !== null) cancelAnimationFrame(current.frame);
		if (commit) setWidth(current.nextWidth);
		delete current.element.dataset.resizing;
		if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
	}, []);
	useEffect(() => () => finish(false), [enabled, finish]);
	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (!enabled || event.button !== 0 || drag.current) return;
		event.preventDefault();
		const element = event.currentTarget;
		const right = element.parentElement?.getBoundingClientRect().right;
		if (right === undefined) return;
		element.focus();
		element.setPointerCapture(event.pointerId);
		element.dataset.resizing = "true";
		drag.current = { element, frame: null, nextWidth: width, pointerId: event.pointerId, right };
	};
	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const current = drag.current;
		if (!current || current.pointerId !== event.pointerId) return;
		current.nextWidth = clampWidth(current.right - event.clientX);
		if (current.frame !== null) return;
		current.frame = requestAnimationFrame(() => {
			current.frame = null;
			setWidth(current.nextWidth);
		});
	};
	const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
		if (drag.current?.pointerId === event.pointerId) finish(true);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!enabled) return;
		const nextWidth = event.key === "Home" ? MIN_WIDTH : event.key === "End" ? MAX_WIDTH
			: event.key === "ArrowLeft" ? width + 20 : event.key === "ArrowRight" ? width - 20 : null;
		if (nextWidth === null) return;
		event.preventDefault();
		finish(false);
		setWidth(clampWidth(nextWidth));
	};
	return {
		width,
		separatorProps: {
			"aria-valuemin": MIN_WIDTH, "aria-valuemax": MAX_WIDTH, "aria-valuenow": width,
			onKeyDown, onPointerDown, onPointerMove, onPointerUp: onPointerEnd,
			onPointerCancel: onPointerEnd, onLostPointerCapture: onPointerEnd,
		},
	};
}
