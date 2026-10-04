"use client";

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Lozenge } from "@/components/ui/lozenge";
import { Button } from "@/components/ui/button";
import DeleteIcon from "@atlaskit/icon/core/delete";
import type { Task, Priority } from "@/lib/sprint-board-types";

export interface TaskCardProps {
	task: Task;
	isDragOverlay?: boolean;
	onTaskClick?: (task: Task) => void;
	onDeleteClick?: (task: Task) => void;
}

type LozengeVariant = "neutral" | "warning" | "danger" | "success" | "information" | "discovery" | "accent-red" | "accent-orange" | "accent-yellow" | "accent-green" | "accent-teal" | "accent-blue" | "accent-purple" | "accent-magenta";

/**
 * Priority badge styling
 */
const priorityConfig: Record<Priority, { variant: LozengeVariant; label: string }> = {
	low: { variant: "neutral", label: "Low" },
	medium: { variant: "warning", label: "Medium" },
	high: { variant: "danger", label: "High" },
	critical: { variant: "danger", label: "Critical" },
};

/**
 * Label color to lozenge variant mapping
 */
const labelColorVariantMap: Record<string, LozengeVariant> = {
	blue: "accent-blue",
	green: "accent-green",
	purple: "accent-purple",
	orange: "accent-orange",
	teal: "accent-teal",
	red: "accent-red",
	yellow: "accent-yellow",
	magenta: "accent-magenta",
};

/**
 * TaskCard Component
 *
 * Enhanced draggable task card displaying:
 * - Title and description
 * - Assignee avatar and name
 * - Priority level with visual indicator
 * - Story points
 * - Label tags
 * - Visual feedback during drag operations
 *
 * Uses dnd-kit's useSortable hook for drag-and-drop functionality.
 */
export function TaskCard({ task, isDragOverlay = false, onTaskClick, onDeleteClick }: TaskCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: task.id,
		data: {
			type: "task",
			task,
		},
		disabled: isDragOverlay,
	});

	const style = isDragOverlay
		? undefined
		: {
				transform: CSS.Transform.toString(transform),
				transition,
			};

	const priorityInfo = priorityConfig[task.priority];

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDeleteClick?.(task);
	};

	return (
		<div
			ref={isDragOverlay ? undefined : setNodeRef}
			style={style}
			{...(isDragOverlay ? {} : attributes)}
			{...(isDragOverlay ? {} : listeners)}
			onClick={() => onTaskClick?.(task)}
			className={cn(
				"group/task-card rounded border border-border bg-surface p-3 shadow-sm",
				"cursor-grab active:cursor-grabbing",
				"transition-all hover:shadow-md focus-within:ring-2 focus-within:ring-border-brand",
				isDragging && "opacity-50 shadow-lg",
				isDragOverlay && "cursor-grabbing shadow-xl ring-2 ring-border-brand",
			)}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onTaskClick?.(task);
				}
			}}
		>
			{/* Header: Title, Priority, and Delete Button */}
			<div className="flex items-start justify-between gap-2 mb-2">
				<p className="text-sm font-medium text-text flex-1 leading-snug">{task.title}</p>
				<div className="flex items-center gap-1 shrink-0">
					<Lozenge
						variant={priorityInfo.variant}
						size="compact"
						isBold={task.priority === "critical"}
					>
						{priorityInfo.label}
					</Lozenge>
					{!isDragOverlay ? <Button
							variant="ghost"
							size="icon"
							className="size-5 opacity-0 transition-opacity group-hover/task-card:opacity-100"
							onClick={handleDelete}
							title="Delete task"
						>
							<DeleteIcon label="Delete" size="small" />
						</Button> : null}
				</div>
			</div>

			{/* Description (if available) */}
			{task.description ? <p className="text-xs text-text-subtle mb-2 line-clamp-2">{task.description}</p> : null}

			{/* Labels */}
			{task.labels && task.labels.length > 0 ? <div className="flex flex-wrap gap-1 mb-2">
					{task.labels.map((label, idx) => (
						<Lozenge
							key={`${task.id}-label-${idx}`}
							variant={labelColorVariantMap[label.color]}
							size="compact"
						>
							{label.text}
						</Lozenge>
					))}
				</div> : null}

			{/* Footer: Assignee, Story Points */}
			<div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle">
				<div className="flex items-center gap-2 min-w-0">
					{/* Assignee Avatar */}
					<Avatar size="sm" className="shrink-0">
						<AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
						<AvatarFallback>
							{task.assignee.name
								.split(" ")
								.map((n) => n[0])
								.join("")
								.toUpperCase()}
						</AvatarFallback>
					</Avatar>
					{/* Assignee Name */}
					<p className="text-xs text-text-subtle truncate">{task.assignee.name}</p>
				</div>

				{/* Story Points Badge */}
				{task.storyPoints ? <div className="flex items-center gap-1 shrink-0">
						<span className="text-xs text-text-subtle">pts:</span>
						<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-bg-neutral px-1 text-xs font-medium text-text">
							{task.storyPoints}
						</span>
					</div> : null}
			</div>
		</div>
	);
}
