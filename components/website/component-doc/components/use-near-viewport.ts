"use client";

import { useEffect, useState, type RefObject } from "react";

/** How far below the viewport an element starts counting as near, so it mounts before it is seen. */
const NEAR_VIEWPORT_MARGIN = "0px 0px 800px 0px";

/**
 * True once `ref`'s element has come near the viewport, and stays true. With `enabled` false it
 * is true from the start, so callers can make deferral an opt-in.
 */
export function useNearViewport(ref: RefObject<Element | null>, enabled: boolean): boolean {
	const [isNear, setIsNear] = useState(!enabled);

	useEffect(() => {
		const node = ref.current;
		if (isNear || !node) {
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					observer.disconnect();
					setIsNear(true);
				}
			},
			{ rootMargin: NEAR_VIEWPORT_MARGIN },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [isNear, ref]);

	return isNear;
}
