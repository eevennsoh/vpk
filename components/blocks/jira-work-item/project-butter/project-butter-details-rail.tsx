"use client";

import type { Ref } from "react";
import { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import { WorkItemSidePanelResizeHandle } from "@/components/blocks/jira-work-item/team-eu26/components/work-item-side-panel-resize-handle";

const DETAILS_DEFAULT_WIDTH_PX = 420;
const DETAILS_MIN_WIDTH_PX = 280;
const DETAILS_MAX_WIDTH_PX = 640;
/** The description column always keeps this much room, however wide the rail is dragged. */
const MAIN_COLUMN_MIN_WIDTH_PX = 480;

/**
 * Wide-layout Details column with the experimental work items' drag handle: hovering the column
 * reveals the pill, which scales slightly on hover; drag or arrow keys resize, double-click resets.
 * The handle sits on the rail's left edge — the midpoint of the two columns' 24px gutters.
 */
export function ProjectButterDetailsRail({ ref }: Readonly<{ ref: Ref<HTMLDivElement> }>) {
	const resize = useSidebarResize({ defaultWidth: DETAILS_DEFAULT_WIDTH_PX, direction: "rtl", maxWidth: DETAILS_MAX_WIDTH_PX, minWidth: DETAILS_MIN_WIDTH_PX });
	return (
		<div
			className="group/butter-details relative hidden min-h-0 min-w-0 @[860px]/butter:block"
			data-project-butter-details-rail
			style={{ minWidth: DETAILS_MIN_WIDTH_PX, width: `min(${resize.sidebarWidth}px, calc(100cqw - ${MAIN_COLUMN_MIN_WIDTH_PX}px))` }}
		>
			<div className="h-full min-w-0 overflow-y-auto px-6 pb-8" ref={ref} />
			<WorkItemSidePanelResizeHandle
				ariaLabel="Resize details panel"
				className="bg-transparent! hover:bg-transparent! data-[active]:bg-transparent! group-hover/butter-details:[&>div]:opacity-100"
				resize={resize}
				testId="project-butter-details-resize-handle"
			/>
		</div>
	);
}
