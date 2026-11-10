"use client";

import { useCallback, useLayoutEffect, useRef, useState, type Ref } from "react";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import { WorkItemSidePanelResizeHandle } from "@/components/blocks/jira-work-item/team-eu26/components/work-item-side-panel-resize-handle";
import { DETAILS_DEFAULT_WIDTH_PX, DETAILS_MAX_WIDTH_PX, DETAILS_MIN_WIDTH_PX, projectButterDetailsMaxWidth } from "@/components/blocks/jira-work-item/project-butter/details-rail-model";

/**
 * Wide-layout Details column with the experimental work items' drag handle: hovering the column
 * reveals the pill, which scales slightly on hover; drag or arrow keys resize, double-click resets.
 * The handle sits on the rail's left edge — the midpoint of the two columns' 24px gutters.
 * The resize bound tracks the layout width (like the experimental split), so the hook's width,
 * `aria-valuenow`, and the rendered rail never disagree.
 */
export function ProjectButterDetailsRail({ ref }: Readonly<{ ref: Ref<HTMLDivElement> }>) {
	const railRef = useRef<HTMLDivElement>(null);
	const { ref: scrollRef, showTopScrollMask } = useHasVerticalOverflow<HTMLDivElement>();
	const setScrollRef = useCallback((element: HTMLDivElement | null) => {
		scrollRef(element);
		if (typeof ref === "function") ref(element);
		else if (ref) ref.current = element;
	}, [ref, scrollRef]);
	const [maxWidth, setMaxWidth] = useState(DETAILS_MAX_WIDTH_PX);
	const resize = useSidebarResize({ defaultWidth: DETAILS_DEFAULT_WIDTH_PX, direction: "rtl", maxWidth, minWidth: DETAILS_MIN_WIDTH_PX, minWidthResistance: true });
	useLayoutEffect(() => {
		const layout = railRef.current?.parentElement;
		if (!layout || typeof ResizeObserver === "undefined") return;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const width = layout.getBoundingClientRect().width;
			if (width > 0) setMaxWidth(projectButterDetailsMaxWidth(width));
		};
		const observer = new ResizeObserver(() => { if (!frame) frame = requestAnimationFrame(measure); });
		observer.observe(layout);
		measure();
		return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
	}, []);
	return (
		<div
			className="group/butter-details relative hidden min-h-0 min-w-0 @[860px]/butter:block"
			data-project-butter-details-rail
			ref={railRef}
			style={{ width: resize.sidebarWidth }}
		>
			<div className="h-full min-w-0 overflow-y-auto px-6 pb-8" ref={setScrollRef} style={buildScrollMaskStyle({ fadeTop: showTopScrollMask, fadeBottom: false })} />
			<WorkItemSidePanelResizeHandle
				ariaLabel="Resize details panel"
				className="bg-transparent! hover:bg-transparent! data-[active]:bg-transparent! group-hover/butter-details:[&>div]:opacity-100"
				resize={resize}
				testId="project-butter-details-resize-handle"
			/>
		</div>
	);
}
