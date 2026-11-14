"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCssDurationTokenMs } from "@/components/projects/rovo-core/lib/css-duration";

const SIDEBAR_MOTION_DURATION_CSS_VARIABLE = "--duration-medium";
const SIDEBAR_MOTION_FALLBACK_MS = 200;

/**
 * Hover-reveal for a collapsed sidebar: hovering the toggle shows it, and leaving the toggle or the
 * revealed sidebar hides it again after the sidebar motion duration, so the pointer can travel from
 * the toggle onto the sidebar without it closing.
 */
export function useSidebarHoverReveal() {
	const [hoverRevealActive, setHoverRevealActive] = useState(false);
	const hoverLeaveTimerRef = useRef<number | null>(null);

	const clearHoverTimer = useCallback(() => {
		if (hoverLeaveTimerRef.current) {
			window.clearTimeout(hoverLeaveTimerRef.current);
			hoverLeaveTimerRef.current = null;
		}
	}, []);

	const scheduleSidebarHoverClose = useCallback(() => {
		clearHoverTimer();
		hoverLeaveTimerRef.current = window.setTimeout(
			() => {
				setHoverRevealActive(false);
			},
			getCssDurationTokenMs(SIDEBAR_MOTION_DURATION_CSS_VARIABLE, SIDEBAR_MOTION_FALLBACK_MS),
		);
	}, [clearHoverTimer]);

	const handleSidebarHoverEnter = useCallback(() => {
		clearHoverTimer();
		setHoverRevealActive(true);
	}, [clearHoverTimer]);

	const handleSidebarHoverLeave = useCallback(() => {
		scheduleSidebarHoverClose();
	}, [scheduleSidebarHoverClose]);

	const handleSidebarContentMouseEnter = useCallback(() => {
		clearHoverTimer();
	}, [clearHoverTimer]);

	const handleSidebarContentMouseLeave = useCallback(() => {
		scheduleSidebarHoverClose();
	}, [scheduleSidebarHoverClose]);

	useEffect(() => {
		return () => clearHoverTimer();
	}, [clearHoverTimer]);

	return {
		handleSidebarContentMouseEnter,
		handleSidebarContentMouseLeave,
		handleSidebarHoverEnter,
		handleSidebarHoverLeave,
		hoverRevealActive,
	};
}
