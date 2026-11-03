"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragHandleVerticalIcon from "@atlaskit/icon/core/drag-handle-vertical";
import { TeamEuRailPanel } from "@/components/blocks/jira-work-item/team-eu26/components/team-eu-rail-panel";
import { Button } from "@/components/ui/button";
import { token } from "@/lib/tokens";

export function ProjectButterSortablePanel({ actions, children, defaultOpen = true, footer, id, sidePanel, title }: Readonly<{
	actions: ReactNode;
	children: ReactNode;
	defaultOpen?: boolean;
	footer?: ReactNode;
	id: string;
	sidePanel: boolean;
	title: string;
}>) {
	const { attributes, listeners, isDragging, setActivatorNodeRef, setNodeRef, transform } = useSortable({ id });
	return (
		<div data-panel-id={id} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition: isDragging ? undefined : "transform var(--duration-medium) var(--ease-out-practical)", position: "relative", zIndex: isDragging ? 30 : undefined, boxShadow: isDragging ? token("elevation.shadow.overlay") : undefined }}>
			<TeamEuRailPanel
				alwaysShowHeaderActions
				defaultOpen={defaultOpen}
				footer={footer}
				headerActions={<div className="-mr-1 flex items-center gap-1 opacity-0 group-hover/rail-panel:opacity-100 group-focus-within/rail-panel:opacity-100 has-[[aria-expanded=true]]:opacity-100">{actions}<Button {...attributes} {...listeners} aria-label={`Drag to reorder ${title}`} className="touch-none [&_svg]:text-icon-subtle" ref={setActivatorNodeRef} size="icon-compact" type="button" variant="ghost"><DragHandleVerticalIcon label="" size="small" /></Button></div>}
				surface={sidePanel ? "inline" : "card"}
				title={title}
			>
				<div className={sidePanel ? "pb-4" : "px-4 pb-4"}>{children}</div>
			</TeamEuRailPanel>
		</div>
	);
}
