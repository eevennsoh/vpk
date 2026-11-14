"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useSidebar as useGlobalSidebar } from "@/app/contexts/context-sidebar";
import { TOP_NAV_HEADER_HEIGHT_PX } from "@/components/blocks/top-navigation/layout-constants";
import { useSidebarHoverReveal } from "@/components/projects/rovo-core/hooks/use-sidebar-hover-reveal";
import { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";

export interface RovoAppShellSidebarChromeOptions {
	/** The shell's chat state; only `sidebarOpen` and `setSidebarOpen` are read. */
	chat: { setSidebarOpen: (open: boolean) => void; sidebarOpen: boolean };
	/** Sidebar widths in px. Rovo opens at 320 (min 240), Studio at 216 (min 216). */
	widths: { defaultWidth: number; maxWidth: number; minWidth: number };
	/**
	 * Studio only (drift item c, kept per product until the owner decides): suppress the chrome's
	 * width/border transition until a frame after mount and while the sidebar is being resized.
	 * Rovo always transitions.
	 */
	gateWidthTransitionUntilMounted?: boolean;
}

/**
 * The thread sidebar's chrome for a Rovo app shell: two-way sync with the global (top-navigation)
 * sidebar toggle, hover-reveal while collapsed, the resizable width, and the styles that carry it.
 */
export function useRovoAppShellSidebarChrome({
	chat,
	gateWidthTransitionUntilMounted = false,
	widths,
}: Readonly<RovoAppShellSidebarChromeOptions>) {
	// Bridge the global sidebar context (TopNavigation toggle) with the local
	// shadcn SidebarProvider so the nav bar button controls the thread sidebar.
	const globalSidebar = useGlobalSidebar();
	const globalSidebarVisibleRef = useRef(globalSidebar.isVisible);

	useEffect(() => {
		if (globalSidebar.isVisible !== globalSidebarVisibleRef.current) {
			globalSidebarVisibleRef.current = globalSidebar.isVisible;
			chat.setSidebarOpen(globalSidebar.isVisible);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only react to global sidebar changes
	}, [globalSidebar.isVisible]);

	useEffect(() => {
		if (chat.sidebarOpen !== globalSidebarVisibleRef.current) {
			globalSidebarVisibleRef.current = chat.sidebarOpen;
			globalSidebar.setSidebarVisible(chat.sidebarOpen);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only react to local sidebar changes
	}, [chat.sidebarOpen]);

	const hoverReveal = useSidebarHoverReveal();
	const isHoverOpen = hoverReveal.hoverRevealActive && !chat.sidebarOpen;

	const sidebarResize = useSidebarResize({
		defaultWidth: widths.defaultWidth,
		minWidth: widths.minWidth,
		maxWidth: widths.maxWidth,
		onCollapse: useCallback(() => {
			chat.setSidebarOpen(false);
		}, [chat]),
	});
	const sidebarStyle = {
		"--sidebar-width": `${sidebarResize.sidebarWidth}px`,
	} as CSSProperties;
	const headerHeightStyle: CSSProperties = {
		height: `${TOP_NAV_HEADER_HEIGHT_PX}px`,
	};

	// Gate the persistent chrome's width/border transition so it never plays on
	// first paint. The chrome renders at its final geometry during hydration,
	// but a post-mount state settle (the global-sidebar bridge syncing
	// sidebarOpen, or a responsive width pass) would otherwise trigger the
	// transition-[width,border-color] animation on every refresh — the chrome
	// visibly slides into place. Flipping the flag a frame after mount lets that
	// initial settle apply instantly; only user-driven toggles after load animate.
	const [hasMountedChrome, setHasMountedChrome] = useState(false);
	useEffect(() => {
		if (!gateWidthTransitionUntilMounted) {
			return;
		}
		const frame = requestAnimationFrame(() => setHasMountedChrome(true));
		return () => cancelAnimationFrame(frame);
	}, [gateWidthTransitionUntilMounted]);
	const isChromeWidthTransitionEnabled = gateWidthTransitionUntilMounted
		? hasMountedChrome && !sidebarResize.isResizing
		: true;

	return {
		handleSidebarContentMouseEnter: hoverReveal.handleSidebarContentMouseEnter,
		handleSidebarContentMouseLeave: hoverReveal.handleSidebarContentMouseLeave,
		handleSidebarHoverEnter: hoverReveal.handleSidebarHoverEnter,
		handleSidebarHoverLeave: hoverReveal.handleSidebarHoverLeave,
		headerHeightStyle,
		isChromeWidthTransitionEnabled,
		isHoverOpen,
		sidebarResize,
		sidebarStyle,
	};
}
