"use client";

import { useEffect, useRef, useState } from "react";

import type {
	JiraSessionFlyoutHandle,
	JiraSessionFlyoutSurfaceProps,
} from "@/components/blocks/product-sidebar/variants/jira-session-flyout";

const SCROLL_SETTLE_FALLBACK_MS = 120;

/** Track the active session preview and dismiss it when its list starts scrolling. */
export function useAgentSessionScrollPreview(handle: JiraSessionFlyoutHandle) {
	const activeScrollport = useRef<HTMLElement | null>(null);
	const dismissedScrollport = useRef<HTMLElement | null>(null);
	const hoverRearmed = useRef(true);
	const scrollSettled = useRef(true);
	const scrollSettleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [activeItemId, setActiveItemId] = useState<string | null>(null);

	useEffect(() => {
		function clearScrollSettleTimeout() {
			if (scrollSettleTimeout.current !== null) {
				clearTimeout(scrollSettleTimeout.current);
				scrollSettleTimeout.current = null;
			}
		}
		function finishScroll(event?: Event) {
			if (event !== undefined && dismissedScrollport.current !== event.target) return;
			clearScrollSettleTimeout();
			scrollSettled.current = true;
		}
		function dismissOnResize() {
			if (activeScrollport.current) handle.close();
		}
		function dismissOnScroll(event: Event) {
			const port = activeScrollport.current ?? dismissedScrollport.current;
			if (port !== event.target) return;
			dismissedScrollport.current = port;
			hoverRearmed.current = false;
			scrollSettled.current = false;
			handle.close();
			clearScrollSettleTimeout();
			scrollSettleTimeout.current = setTimeout(finishScroll, SCROLL_SETTLE_FALLBACK_MS);
		}
		function rearmHoverAfterScroll() {
			if (!scrollSettled.current || hoverRearmed.current) return;
			hoverRearmed.current = true;
			dismissedScrollport.current = null;
		}
		document.addEventListener("scroll", dismissOnScroll, true);
		document.addEventListener("scrollend", finishScroll, true);
		document.addEventListener("pointermove", rearmHoverAfterScroll, true);
		window.addEventListener("resize", dismissOnResize);
		return () => {
			document.removeEventListener("scroll", dismissOnScroll, true);
			document.removeEventListener("scrollend", finishScroll, true);
			document.removeEventListener("pointermove", rearmHoverAfterScroll, true);
			window.removeEventListener("resize", dismissOnResize);
			clearScrollSettleTimeout();
		};
	}, [handle]);

	const onOpenChange: NonNullable<JiraSessionFlyoutSurfaceProps["onOpenChange"]> = (open, details) => {
		if (open && details.reason === "trigger-hover" && !hoverRearmed.current) {
			details.cancel();
			return;
		}
		activeScrollport.current = open
			? details.trigger?.closest<HTMLElement>("[data-agent-session-column-scrollport]") ?? null
			: null;
		if (!open && hoverRearmed.current) dismissedScrollport.current = null;
		setActiveItemId(open ? details.trigger?.getAttribute("data-session-id") ?? null : null);
	};

	return { activeItemId, onOpenChange };
}
