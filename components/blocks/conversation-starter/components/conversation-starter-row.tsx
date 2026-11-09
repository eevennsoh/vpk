"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CrossCircleIcon from "@atlaskit/icon/core/cross-circle";
import DragHandleVerticalIcon from "@atlaskit/icon/core/drag-handle-vertical";

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

import { StarterIconPicker } from "./starter-icon-picker";
import type {
	ConversationStarter,
	StarterIconKey,
	StarterIconOption,
} from "../data/starters";

export interface ConversationStarterRowProps {
	starter: ConversationStarter;
	index: number;
	placeholder?: string;
	iconOptions?: readonly StarterIconOption[];
	onTextChange: (id: string, text: string) => void;
	onIconChange: (id: string, icon: StarterIconKey) => void;
	onClear: (id: string) => void;
}

/**
 * A single draggable conversation-starter editor: an icon-picker button next to
 * an `InputGroup` field whose start addon is the drag grip and end addon clears
 * the text. Drag listeners bind to the grip only so the input keeps its caret.
 */
export function ConversationStarterRow({
	starter,
	index,
	placeholder = "Write a new conversation starter",
	iconOptions,
	onTextChange,
	onIconChange,
	onClear,
}: Readonly<ConversationStarterRowProps>) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: starter.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn("flex w-full items-center gap-2", isDragging && "z-10 opacity-80")}
		>
			<StarterIconPicker
				value={starter.icon}
				onChange={(icon) => onIconChange(starter.id, icon)}
				options={iconOptions}
			/>
			<InputGroup>
				<InputGroupAddon align="inline-start" className="text-icon-subtlest">
					<button
						aria-label={`Reorder conversation starter ${index + 1}`}
						className="flex cursor-grab touch-none items-center active:cursor-grabbing"
						ref={setActivatorNodeRef}
						type="button"
						{...attributes}
						{...listeners}
					>
						<DragHandleVerticalIcon label="" size="small" color="currentColor" />
					</button>
				</InputGroupAddon>
				<InputGroupInput
					aria-label={`Conversation starter ${index + 1}`}
					onChange={(event) => onTextChange(starter.id, event.target.value)}
					placeholder={placeholder}
					value={starter.text}
				/>
				<InputGroupAddon align="inline-end" className="text-icon-subtlest">
					<InputGroupButton
						aria-label={`Clear conversation starter ${index + 1}`}
						onClick={() => onClear(starter.id)}
						className="text-icon-subtlest"
						shape="circle"
						size="icon-xs"
					>
						<CrossCircleIcon label="" size="small" color="currentColor" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</div>
	);
}
