"use client";

import { useState, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragHandleVerticalIcon from "@atlaskit/icon/core/drag-handle-vertical";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import { PROJECT_BUTTER_DETAIL_FIELDS, type ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter/details-model";

export function DetailsFieldRow({ children, filled, id, onClear, onHide, onMove, first, last }: Readonly<{
	children: ReactNode;
	filled: boolean;
	id: ProjectButterDetailFieldId;
	onClear?: () => void;
	onHide?: () => void;
	onMove: (direction: -1 | 1) => void;
	first: boolean;
	last: boolean;
}>) {
	const [actionsOpen, setActionsOpen] = useState(false);
	const { attributes, listeners, isDragging, setActivatorNodeRef, setNodeRef, transform } = useSortable({ id });
	const label = PROJECT_BUTTER_DETAIL_FIELDS[id];
	return (
		<div
			aria-label={`${label} field`}
			className={cn("group/butter-field relative min-w-0 rounded-md", isDragging ? "z-30 bg-surface-overlay" : undefined)}
			data-field-filled={filled}
			data-field-id={id}
			data-field-label={label}
			ref={setNodeRef}
			role="group"
			style={{ transform: CSS.Transform.toString(transform), transition: isDragging ? undefined : "transform var(--duration-medium) var(--ease-out-practical)", boxShadow: isDragging ? token("elevation.shadow.overlay") : undefined }}
		>
			{filled ? <div className="mb-0.5 min-w-0 text-xs leading-4 text-text-subtle">{label}</div> : null}
			<div className="relative -mx-2 flex min-h-8 min-w-0 items-start rounded-md px-2 transition-colors duration-fast ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
				<div className="min-w-0 flex-1 pr-14 [&_[data-slot=detail-value-trigger]]:min-h-8">{children}</div>
				<div className={cn("absolute right-0 top-0 flex shrink-0 items-center opacity-0 transition-opacity duration-fast ease-out-practical group-hover/butter-field:opacity-100 group-focus-within/butter-field:opacity-100", actionsOpen || isDragging ? "opacity-100" : undefined)}>
					<Button {...attributes} {...listeners} aria-label={`Drag to reorder ${label} field`} className="touch-pan-x" ref={setActivatorNodeRef} size="icon-compact" type="button" variant="ghost"><DragHandleVerticalIcon label="" size="small" /></Button>
					<DropdownMenu onOpenChange={setActionsOpen} open={actionsOpen}>
						<DropdownMenuTrigger render={<Button aria-label={`More ${label.toLowerCase()} field actions`} size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger>
						<DropdownMenuContent align="end" positionerClassName="z-[700]">
							<DropdownMenuItem disabled={first} onSelect={() => onMove(-1)}>Move up</DropdownMenuItem>
							<DropdownMenuItem disabled={last} onSelect={() => onMove(1)}>Move down</DropdownMenuItem>
							{onClear || onHide ? <DropdownMenuSeparator /> : null}
							{onClear ? <DropdownMenuItem onSelect={onClear}>Clear {label.toLowerCase()}</DropdownMenuItem> : null}
							{onHide ? <DropdownMenuItem onSelect={onHide}>Hide field</DropdownMenuItem> : <DropdownMenuItem disabled>Pinned by default</DropdownMenuItem>}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}
