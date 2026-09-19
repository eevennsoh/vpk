import type {
	KeyboardEvent as ReactKeyboardEvent,
	MouseEvent,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "@/lib/utils";
import { createLatestAnimationFrame } from "@/lib/latest-animation-frame";

const COLLAPSE_THRESHOLD_OFFSET = 40;
const COLLAPSE_VISUAL_MIN_WIDTH = 80;
const KEYBOARD_RESIZE_STEP = 10;
const MIN_WIDTH_RESISTANCE_RANGE = 40;

export function getResistedMinimumWidth(rawWidth: number, startWidth: number, minWidth: number) {
	const resistanceBoundary = Math.min(startWidth, minWidth + MIN_WIDTH_RESISTANCE_RANGE);
	if (rawWidth >= resistanceBoundary) {
		return rawWidth;
	}

	const availableWidth = resistanceBoundary - minWidth;
	if (availableWidth <= 0) {
		return minWidth;
	}

	const overdrag = resistanceBoundary - rawWidth;
	return minWidth + availableWidth * Math.exp(-overdrag / MIN_WIDTH_RESISTANCE_RANGE);
}

interface UseSidebarResizeOptions {
	defaultWidth: number;
	maxWidth: number;
	minWidth: number;
	/**
	 * Progressively resists pointer movement toward the minimum instead of
	 * entering the collapse-preview range. The resisted width persists on
	 * release, so the panel never snaps back from an overdrag.
	 */
	minWidthResistance?: boolean;
	onCollapse?: () => void;
	/**
	 * Drag direction that grows the panel.
	 * - "ltr" (default): handle on the right of a left-anchored panel; drag right → grow.
	 * - "rtl": handle on the left of a right-anchored panel; drag left → grow.
	 */
	direction?: "ltr" | "rtl";
}

interface UseSidebarResizeResult {
	isResizeHandleHovered: boolean;
	isResizing: boolean;
	maxWidth: number;
	onResizeHandleDoubleClick: (event: MouseEvent) => void;
	onResizeHandleKeyDown: (event: ReactKeyboardEvent) => void;
	onResizeHandlePointerDown: (event: ReactPointerEvent) => void;
	onResizeHandlePointerEnter: () => void;
	onResizeHandlePointerLeave: () => void;
	minWidth: number;
	sidebarWidth: number;
	willCollapse: boolean;
}

export function useSidebarResize({
	defaultWidth,
	maxWidth,
	minWidth,
	minWidthResistance = false,
	onCollapse,
	direction = "ltr",
}: UseSidebarResizeOptions): UseSidebarResizeResult {
	const deltaSign = direction === "rtl" ? -1 : 1;
	const [sidebarWidth, setSidebarWidth] = useState(defaultWidth);
	const [isResizing, setIsResizing] = useState(false);
	const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
	const [willCollapse, setWillCollapse] = useState(false);
	const startXRef = useRef(0);
	const startWidthRef = useRef(defaultWidth);
	const lastValidWidthRef = useRef(defaultWidth);
	const willCollapseRef = useRef(false);
	const collapseThreshold = minWidth - COLLAPSE_THRESHOLD_OFFSET;

	// Re-clamp the committed width when the bounds change so a shrinking
	// container cannot strand the panel outside them. The updater stays pure;
	// `lastValidWidthRef` is synced by the committed-width effect below.
	useEffect(() => {
		setSidebarWidth((currentWidth) => clamp(currentWidth, minWidth, maxWidth));
	}, [maxWidth, minWidth]);

	const onResizeHandlePointerEnter = useCallback(() => {
		setIsResizeHandleHovered(true);
	}, []);

	const onResizeHandlePointerLeave = useCallback(() => {
		setIsResizeHandleHovered(false);
	}, []);

	const onResizeHandleDoubleClick = useCallback(
		(event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			setSidebarWidth(defaultWidth);
			lastValidWidthRef.current = defaultWidth;
			willCollapseRef.current = false;
			setWillCollapse(false);
		},
		[defaultWidth],
	);

	const onResizeHandlePointerDown = useCallback(
		(event: ReactPointerEvent) => {
			event.preventDefault();
			startXRef.current = event.clientX;
			startWidthRef.current = sidebarWidth;
			willCollapseRef.current = false;
			setWillCollapse(false);
			setIsResizing(true);
			(event.target as HTMLElement).setPointerCapture(event.pointerId);
		},
		[sidebarWidth],
	);

	const onResizeHandleKeyDown = useCallback(
		(event: ReactKeyboardEvent) => {
			let nextWidth: number;

			switch (event.key) {
				case "ArrowLeft":
					nextWidth = sidebarWidth - KEYBOARD_RESIZE_STEP * deltaSign;
					break;
				case "ArrowRight":
					nextWidth = sidebarWidth + KEYBOARD_RESIZE_STEP * deltaSign;
					break;
				case "Home":
					nextWidth = minWidth;
					break;
				case "End":
					nextWidth = maxWidth;
					break;
				default:
					return;
			}

			event.preventDefault();
			event.stopPropagation();
			const clampedWidth = clamp(nextWidth, minWidth, maxWidth);
			setSidebarWidth(clampedWidth);
			lastValidWidthRef.current = clampedWidth;
			willCollapseRef.current = false;
			setWillCollapse(false);
		},
		[deltaSign, maxWidth, minWidth, sidebarWidth],
	);

	useEffect(() => {
		if (!isResizing) {
			return;
		}

		const getPointerWidth = (clientX: number) => {
				const delta = (clientX - startXRef.current) * deltaSign;
				const rawWidth = startWidthRef.current + delta;
				const nextWidth = minWidthResistance
					? getResistedMinimumWidth(rawWidth, startWidthRef.current, minWidth)
					: rawWidth;
				return clamp(Math.round(nextWidth), minWidth, maxWidth);
			};

			const resizeFrame = createLatestAnimationFrame<number>({
				requestFrame: (callback) => requestAnimationFrame(callback),
				cancelFrame: (id) => cancelAnimationFrame(id),
				onFrame: (clientX) => {
				const delta = (clientX - startXRef.current) * deltaSign;
				const rawWidth = startWidthRef.current + delta;
				if (minWidthResistance) {
					setSidebarWidth(getPointerWidth(clientX));
					return;
				}

				const shouldCollapse = rawWidth < collapseThreshold;
				willCollapseRef.current = shouldCollapse;
				setWillCollapse(shouldCollapse);

				if (shouldCollapse) {
					setSidebarWidth(Math.max(rawWidth, COLLAPSE_VISUAL_MIN_WIDTH));
				} else {
					setSidebarWidth(clamp(rawWidth, minWidth, maxWidth));
				}
			},
		});
		const handlePointerMove = (event: PointerEvent) => {
			resizeFrame.schedule(event.clientX);
		};

		const handlePointerUp = (event: PointerEvent) => {
			resizeFrame.cancel();
			const rawWidth = startWidthRef.current + (event.clientX - startXRef.current) * deltaSign;
			if (minWidthResistance) {
				const finalWidth = getPointerWidth(event.clientX);
				lastValidWidthRef.current = finalWidth;
				setSidebarWidth(finalWidth);
			} else if (rawWidth < collapseThreshold && onCollapse) {
				setSidebarWidth(lastValidWidthRef.current);
				onCollapse();
			} else {
				const finalDelta = (event.clientX - startXRef.current) * deltaSign;
				const finalWidth = clamp(startWidthRef.current + finalDelta, minWidth, maxWidth);
				lastValidWidthRef.current = finalWidth;
				setSidebarWidth(finalWidth);
			}
			willCollapseRef.current = false;
			setWillCollapse(false);
			setIsResizing(false);
		};
		const handlePointerCancel = () => {
			resizeFrame.cancel();
			setSidebarWidth(lastValidWidthRef.current);
			willCollapseRef.current = false;
			setWillCollapse(false);
			setIsResizing(false);
		};

		document.addEventListener("pointermove", handlePointerMove);
		document.addEventListener("pointerup", handlePointerUp);
		document.addEventListener("pointercancel", handlePointerCancel);
		return () => {
			resizeFrame.dispose();
			document.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerup", handlePointerUp);
			document.removeEventListener("pointercancel", handlePointerCancel);
		};
	}, [collapseThreshold, deltaSign, isResizing, maxWidth, minWidth, minWidthResistance, onCollapse]);

	useEffect(() => {
		if (!isResizing && sidebarWidth >= minWidth) {
			lastValidWidthRef.current = sidebarWidth;
		}
	}, [isResizing, minWidth, sidebarWidth]);

	return {
		isResizeHandleHovered,
		isResizing,
		maxWidth,
		onResizeHandleDoubleClick,
		onResizeHandleKeyDown,
		onResizeHandlePointerDown,
		onResizeHandlePointerEnter,
		onResizeHandlePointerLeave,
		minWidth,
		sidebarWidth,
		willCollapse,
	};
}
