"use client";

import { useMemo } from "react";
import {
	DndContext,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CrossIcon from "@atlaskit/icon/core/cross";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DeleteIcon, GripVerticalIcon } from "@/components/ui/vpk-icons";
import type { SubagentPrompt } from "@/components/blocks/subagent/data/demo-agents";
import { getSubagentDisplayName } from "@/components/blocks/subagent/lib/subagent-prompts";
import { cn } from "@/lib/utils";

interface ManageSubagentsDialogProps {
	open: boolean;
	onCreateSubagent: () => void;
	onDeleteSubagent: (id: string) => void;
	onOpenChange: (open: boolean) => void;
	onReorderSubagents: (activeId: string, overId: string) => void;
	onToggleSubagent: (id: string, enabled: boolean) => void;
	subagents: ReadonlyArray<SubagentPrompt>;
}

export function ManageSubagentsDialog({
	open,
	onCreateSubagent,
	onDeleteSubagent,
	onOpenChange,
	onReorderSubagents,
	onToggleSubagent,
	subagents,
}: Readonly<ManageSubagentsDialogProps>) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const itemIds = useMemo(() => subagents.map((prompt) => prompt.id), [subagents]);

	function handleDragEnd(event: DragEndEvent): void {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}

		onReorderSubagents(String(active.id), String(over.id));
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-0 overflow-hidden p-0" showCloseButton={false} size="md">
				<div className="flex items-center justify-between gap-2 p-6">
					<DialogTitle className="text-xl font-semibold leading-6 text-text">
						Manage subagents
					</DialogTitle>
					<div className="flex items-center gap-2">
						<Button onClick={onCreateSubagent} type="button" variant="outline">
							Add subagent
						</Button>
						<DialogClose render={<Button aria-label="Close" size="icon" variant="ghost" />}>
							<CrossIcon label="" />
						</DialogClose>
					</div>
				</div>

				<div className="px-6 pb-6">
					<DndContext
						id="manage-subagents-dnd"
						collisionDetection={closestCenter}
						modifiers={[restrictToVerticalAxis]}
						onDragEnd={handleDragEnd}
						sensors={sensors}
					>
						<SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
							<div className="flex flex-col gap-2">
								{subagents.length > 0 ? (
									subagents.map((prompt, index) => (
										<ManageSubagentsRow
											index={index}
											key={prompt.id}
											onDelete={onDeleteSubagent}
											onToggle={onToggleSubagent}
											prompt={prompt}
										/>
									))
								) : (
									<div className="rounded-lg border border-dashed border-border bg-surface p-4 text-center text-sm text-text-subtlest">
										No subagents yet.
									</div>
								)}
							</div>
						</SortableContext>
					</DndContext>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ManageSubagentsRow({
	index,
	onDelete,
	onToggle,
	prompt,
}: Readonly<{
	index: number;
	onDelete: (id: string) => void;
	onToggle: (id: string, enabled: boolean) => void;
	prompt: SubagentPrompt;
}>) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: prompt.id });
	const label = getSubagentDisplayName(prompt);
	const enabled = prompt.enabled !== false;
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			className={cn(
				"flex w-full items-center gap-2 rounded-lg border border-border bg-surface p-2 transition-[box-shadow,opacity] duration-normal",
				!enabled && "opacity-60",
				isDragging && "z-10 opacity-80 shadow-lg",
			)}
			ref={setNodeRef}
			style={style}
		>
			<button
				aria-label={`Reorder subagent ${index + 1}`}
				className="flex cursor-grab touch-none items-center rounded-md p-1 text-icon-subtlest transition-colors duration-normal hover:bg-bg-neutral-subtle-hovered hover:text-icon-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-selected active:cursor-grabbing"
				ref={setActivatorNodeRef}
				type="button"
				{...attributes}
				{...listeners}
			>
				<GripVerticalIcon size="small" />
			</button>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-semibold leading-5 text-text">
					{label}
				</div>
				<div className="truncate text-xs leading-4 text-text-subtlest">
					{prompt.condition.trim() || "No trigger condition set."}
				</div>
			</div>
			<Switch
				checked={enabled}
				label={`${enabled ? "Disable" : "Enable"} ${label}`}
				onCheckedChange={(nextEnabled) => onToggle(prompt.id, nextEnabled)}
				size="sm"
			/>
			<button
				aria-label={`Delete ${label}`}
				className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-subtlest transition-colors duration-normal hover:bg-bg-danger-hovered hover:text-text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-selected"
				onClick={() => onDelete(prompt.id)}
				type="button"
			>
				<DeleteIcon size="small" />
			</button>
		</div>
	);
}
