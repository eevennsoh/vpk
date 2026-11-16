"use client";

import { useLayoutEffect, useRef } from "react";

const TAB_SEPARATOR_CLEARANCE_PX = 1;

export function useBoardViewConfigurationHost(enabled: boolean) {
	const headerRef = useRef<HTMLElement>(null);
	const tabStripRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const host = hostRef.current;
		const header = headerRef.current;
		const containingBlock = host?.offsetParent;
		if (!enabled || !host || !header || !(containingBlock instanceof HTMLElement)) return;
		const updatePosition = () => {
			const boundary = tabStripRef.current?.querySelector('[role="tablist"]') ?? tabStripRef.current ?? header;
			const top = boundary.getBoundingClientRect().bottom + TAB_SEPARATOR_CLEARANCE_PX - containingBlock.getBoundingClientRect().top;
			host.style.top = `${top}px`;
		};
		updatePosition();
		let frame: number | null = null;
		const observer = new ResizeObserver(() => {
			if (frame !== null) return;
			frame = requestAnimationFrame(() => {
				frame = null;
				updatePosition();
			});
		});
		observer.observe(header);
		observer.observe(containingBlock);
		const tabList = tabStripRef.current?.querySelector('[role="tablist"]');
		if (tabList) observer.observe(tabList);
		return () => {
			observer.disconnect();
			if (frame !== null) cancelAnimationFrame(frame);
		};
	}, [enabled]);

	return { headerRef, tabStripRef, hostRef };
}
