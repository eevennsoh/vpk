"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import AddIcon from "@atlaskit/icon/core/add";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Column as ColumnType, ColumnId, Task } from "@/lib/sprint-board-types";
import { TaskCard } from "./task-card";

interface ColumnProps {
	column: ColumnType;
	tasks: Task[];
	isOver?: boolean;
	onTaskClick?: (task: Task) => void;
	onDeleteTask?: (task: Task) => void;
	onAddToColumn?: (columnId: ColumnId) => void;
}

const columnHeaderColors: Record<ColumnId, string> = {
	todo: "border-t-4 border-t-border-bold",
	"in-progress": "border-t-4 border-t-border-brand",
	done: "border-t-4 border-t-border-success",
};

export function Column({ column, tasks, isOver, onTaskClick, onDeleteTask, onAddToColumn }: ColumnProps) {
	const { setNodeRef } = useDroppable({
		id: column.id,
		data: { type: "Column", column },
	});

	return (
		<div
			className={cn(
				"flex h-full min-h-[400px] flex-col rounded-lg border border-border-subtle bg-surface-raised",
				columnHeaderColors[column.id],
			)}
		>
			{/* Column Header */}
			<div className="px-4 py-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h3 className="text-sm font-semibold text-text">{column.title}</h3>
						<span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bg-neutral px-1.5 text-[11px] font-semibold text-text-subtle">
							{tasks.length}
						</span>
					</div>
					{onAddToColumn ? (
						<Button
							variant="ghost"
							size="icon"
							className="size-6"
							onClick={() => onAddToColumn(column.id)}
						>
							<AddIcon label="Add task" size="small" />
						</Button>
					) : null}
				</div>
			</div>

			{/* Drop Zone */}
			<div
				ref={setNodeRef}
				className={cn(
					"flex-1 space-y-2 overflow-y-auto p-3 transition-colors duration-medium",
					isOver && "rounded-b-lg bg-surface-selected",
				)}
			>
				<SortableContext
					items={column.taskIds}
					strategy={verticalListSortingStrategy}
				>
					{tasks.length > 0 ? (
						tasks.map((task) => (
							<TaskCard
								key={task.id}
								task={task}
								onTaskClick={onTaskClick}
								onDeleteClick={onDeleteTask}
							/>
						))
					) : (
						<div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border-subtle py-8 text-center">
							<p className="text-sm text-text-subtlest">
								Drop items here
							</p>
						</div>
					)}
				</SortableContext>
			</div>
		</div>
	);
}
