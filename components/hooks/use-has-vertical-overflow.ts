"use client";

import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";

export interface VerticalOverflowMetrics {
	clientHeight: number;
	maxHeight: number;
	scrollHeight: number;
	scrollTop: number;
}

export interface VerticalOverflowState {
	hasVerticalOverflow: boolean;
	hasReachedVerticalLimit: boolean;
	hasScrolledFromTop: boolean;
	hasScrolledToBottom: boolean;
	showTopScrollMask: boolean;
	showBottomScrollMask: boolean;
}

export interface HasVerticalOverflowResult<T extends HTMLElement> {
	hasVerticalOverflow: boolean;
	hasReachedVerticalLimit: boolean;
	hasScrolledFromTop: boolean;
	hasScrolledToBottom: boolean;
	ref: RefCallback<T>;
	showTopScrollMask: boolean;
	showBottomScrollMask: boolean;
}

export interface VerticalOverflowOptions {
	/** Track projected scroll bounds for hosts with animated descendants. */
	trackAnimatedOverflow?: boolean;
}

const EMPTY_VERTICAL_OVERFLOW_STATE: VerticalOverflowState = {
	hasReachedVerticalLimit: false,
	hasScrolledFromTop: false,
	hasScrolledToBottom: true,
	hasVerticalOverflow: false,
	showBottomScrollMask: false,
	showTopScrollMask: false,
};

export function getVerticalOverflowState(metrics: VerticalOverflowMetrics | null): VerticalOverflowState {
	if (!metrics) {
		return EMPTY_VERTICAL_OVERFLOW_STATE;
	}

	const hasVerticalOverflow = metrics.scrollHeight - metrics.clientHeight > 1;
	const hasFiniteMaxHeight = Number.isFinite(metrics.maxHeight) && metrics.maxHeight > 0;
	const hasReachedVerticalLimit = hasFiniteMaxHeight && metrics.clientHeight >= metrics.maxHeight - 1;
	const hasScrolledFromTop = metrics.scrollTop > 1;
	const hasScrolledToBottom = metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop <= 1;

	return {
		hasReachedVerticalLimit,
		hasScrolledFromTop,
		hasScrolledToBottom,
		hasVerticalOverflow,
		showBottomScrollMask: hasVerticalOverflow && !hasScrolledToBottom,
		showTopScrollMask: hasVerticalOverflow && hasScrolledFromTop,
	};
}

function getElementVerticalOverflowState(element: HTMLElement | null): VerticalOverflowState {
	if (!element) {
		return EMPTY_VERTICAL_OVERFLOW_STATE;
	}

	return getVerticalOverflowState({
		clientHeight: element.clientHeight,
		maxHeight: Number.parseFloat(getComputedStyle(element).maxHeight),
		scrollHeight: element.scrollHeight,
		scrollTop: element.scrollTop,
	});
}

function isBoxlessLayoutWrapper(element: Element): boolean {
	if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
		return false;
	}

	return window.getComputedStyle(element).display === "contents";
}

// A `display: contents` wrapper generates no box, so a ResizeObserver on it
// reports 0x0 once and never fires again. Descend past those wrappers to the
// nearest descendants that actually own layout, so the observed set stays
// bounded without going blind to content growth beneath them.
export function getVerticalOverflowResizeTargets(element: Element): Element[] {
	const resizeTargets: Element[] = [element];

	const collectLayoutOwners = (parent: Element) => {
		for (const child of parent.children) {
			if (isBoxlessLayoutWrapper(child)) {
				collectLayoutOwners(child);
			} else {
				resizeTargets.push(child);
			}
		}
	};
	collectLayoutOwners(element);

	return resizeTargets;
}

export function subscribeToVerticalOverflow(element: HTMLElement, updateScrollState: () => void, { trackAnimatedOverflow = false }: VerticalOverflowOptions = {}): () => void {
	let measurementFrame = 0;
	const measure = () => {
		measurementFrame = 0;
		updateScrollState();
	};
	const scheduleMeasurement = () => {
		if (!measurementFrame) measurementFrame = window.requestAnimationFrame(measure);
	};
	element.addEventListener("scroll", scheduleMeasurement, { passive: true });

	if (typeof ResizeObserver === "undefined") {
		window.addEventListener("resize", scheduleMeasurement);
		return () => {
			window.cancelAnimationFrame(measurementFrame);
			element.removeEventListener("scroll", scheduleMeasurement);
			window.removeEventListener("resize", scheduleMeasurement);
		};
	}

	const resizeObserver = new ResizeObserver(scheduleMeasurement);
	const observedResizeTargets = new Set<Element>();
	const syncResizeTargets = () => {
		const nextResizeTargets = new Set(getVerticalOverflowResizeTargets(element));

		for (const target of observedResizeTargets) {
			if (!nextResizeTargets.has(target)) {
				resizeObserver.unobserve(target);
			}
		}

		for (const target of nextResizeTargets) {
			if (!observedResizeTargets.has(target)) {
				resizeObserver.observe(target);
			}
		}

		observedResizeTargets.clear();
		for (const target of nextResizeTargets) {
			observedResizeTargets.add(target);
		}
	};
	syncResizeTargets();

	const mutationObserver = typeof MutationObserver === "undefined"
		? null
		: new MutationObserver((records) => {
				if (records.some((record) => record.type === "childList" || record.attributeName === "class")) {
					syncResizeTargets();
				}
				scheduleMeasurement();
			});
	// Layout projection changes scrollable bounds through transforms without
	// resizing the observed boxes. Remeasure when those styles settle too.
	mutationObserver?.observe(element, { attributes: trackAnimatedOverflow, attributeFilter: trackAnimatedOverflow ? ["style", "class"] : undefined, childList: true, subtree: true });

	return () => {
		window.cancelAnimationFrame(measurementFrame);
		element.removeEventListener("scroll", scheduleMeasurement);
		resizeObserver.disconnect();
		mutationObserver?.disconnect();
	};
}

export function useHasVerticalOverflow<T extends HTMLElement>({ trackAnimatedOverflow = false }: VerticalOverflowOptions = {}): HasVerticalOverflowResult<T> {
	const elementRef = useRef<T | null>(null);
	const [element, setElement] = useState<T | null>(null);
	const [hasVerticalOverflow, setHasVerticalOverflow] = useState(false);
	const [hasReachedVerticalLimit, setHasReachedVerticalLimit] = useState(false);
	const [hasScrolledFromTop, setHasScrolledFromTop] = useState(false);
	const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

	const updateScrollState = useCallback(() => {
		const nextState = getElementVerticalOverflowState(elementRef.current);

		setHasVerticalOverflow(nextState.hasVerticalOverflow);
		setHasReachedVerticalLimit(nextState.hasReachedVerticalLimit);
		setHasScrolledFromTop(nextState.hasScrolledFromTop);
		setHasScrolledToBottom(nextState.hasScrolledToBottom);
	}, []);

	const ref = useCallback<RefCallback<T>>(
		(node) => {
			elementRef.current = node;
			setElement(node);
			updateScrollState();
			// Layout can settle after a rich text editor or virtualized list attaches.
			// Recompute once the browser has applied final dimensions.
			if (node && typeof window !== "undefined") {
				window.requestAnimationFrame(updateScrollState);
			}
		},
		[updateScrollState],
	);

	useEffect(() => {
		if (!element) return undefined;
		return subscribeToVerticalOverflow(element, updateScrollState, { trackAnimatedOverflow });
	}, [element, updateScrollState, trackAnimatedOverflow]);

	return {
		hasVerticalOverflow,
		hasReachedVerticalLimit,
		hasScrolledFromTop,
		hasScrolledToBottom,
		ref,
		showTopScrollMask: hasVerticalOverflow && hasScrolledFromTop,
		showBottomScrollMask: hasVerticalOverflow && !hasScrolledToBottom,
	};
}
