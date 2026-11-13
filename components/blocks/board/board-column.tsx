"use client";

import { useDroppable } from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import type { BoardColumnId, BoardTask } from "./board-data";
import { BoardCard } from "./board-card";

interface BoardColumnProps {
	id: BoardColumnId;
	title: string;
	taskIds: string[];
	tasks: BoardTask[];
	isOver?: boolean;
}

const columnAccentColors: Record<BoardColumnId, string> = {
	"todo": "border-t-4 border-t-border-bold",
	"in-progress": "border-t-4 border-t-border-brand",
	"done": "border-t-4 border-t-border-success",
};

export function BoardColumn({
	id,
	title,
	taskIds,
	tasks,
	isOver,
}: BoardColumnProps) {
	const { setNodeRef } = useDroppable({
		id,
		data: { type: "Column" },
	});

	return (
		<div
			className={cn(
				"flex h-full min-h-[400px] flex-col rounded-lg border border-border-subtle bg-surface-raised",
				columnAccentColors[id],
			)}
		>
			{/* Column Header */}
			<div className="px-4 py-3">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-semibold text-text">{title}</h3>
					<span className="rounded-full bg-bg-neutral px-2 py-0.5 text-xs font-medium text-text-subtle">
						{tasks.length}
					</span>
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
					items={taskIds}
					strategy={verticalListSortingStrategy}
				>
					{tasks.length > 0 ? (
						tasks.map((task) => <BoardCard key={task.id} task={task} />)
					) : (
						<div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border-subtle py-8 text-center">
							<p className="text-sm text-text-subtlest">Drop items here</p>
						</div>
					)}
				</SortableContext>
			</div>
		</div>
	);
}
