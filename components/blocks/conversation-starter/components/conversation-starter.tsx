"use client";

import { useMemo, useRef, useState } from "react";
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
	arrayMove,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import CrossIcon from "@atlaskit/icon/core/cross";
import { useLatestRef } from "@/lib/use-latest-ref";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";

import { ConversationStarterRow } from "./conversation-starter-row";
import {
	DEFAULT_STARTER_ICON,
	SAMPLE_CONVERSATION_STARTERS,
	type ConversationStarter,
	type StarterIconKey,
	type StarterIconOption,
} from "../data/starters";

export type { ConversationStarter, StarterIconKey, StarterIconOption } from "../data/starters";

const DEFAULT_MAX_STARTERS = 3;
const EMPTY_STARTERS: readonly ConversationStarter[] = [];

export interface ConversationStarterDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	starters?: readonly ConversationStarter[];
	defaultStarters?: readonly ConversationStarter[];
	onStartersChange?: (starters: readonly ConversationStarter[]) => void;
	onSave?: (starters: readonly ConversationStarter[]) => void;
	onGenerate?: () => readonly ConversationStarter[] | Promise<readonly ConversationStarter[]>;
	maxStarters?: number;
	iconOptions?: readonly StarterIconOption[];
	title?: string;
	saveLabel?: string;
	placeholder?: string;
}

/**
 * Editable, reorderable conversation-starter list rendered in a modal. The list
 * always shows exactly `maxStarters` rows; the trailing clear button empties a
 * row rather than removing it. Drafts are local so Cancel discards and Add
 * commits the trimmed, non-empty starters.
 */
export function ConversationStarterDialog({
	open,
	onOpenChange,
	starters,
	defaultStarters = EMPTY_STARTERS,
	onStartersChange,
	onSave,
	onGenerate,
	maxStarters = DEFAULT_MAX_STARTERS,
	iconOptions,
	title = "Conversation starters",
	saveLabel = "Add",
	placeholder,
}: Readonly<ConversationStarterDialogProps>) {
	const isControlled = typeof starters !== "undefined";
	const seedRef = useLatestRef<readonly ConversationStarter[]>(
		isControlled ? starters : defaultStarters,
	);

	const idCounter = useRef(0);
	const [draftState, setDraftState] = useState(() => ({
		draft: seedDraft(seedRef.current, maxStarters, idCounter),
		isGenerating: false,
		maxStarters,
		open,
	}));
	let resolvedDraftState = draftState;
	if (draftState.open !== open || (open && draftState.maxStarters !== maxStarters)) {
		resolvedDraftState = open
			? {
				draft: seedDraft(seedRef.current, maxStarters, idCounter),
				isGenerating: false,
				maxStarters,
				open,
			}
			: { ...draftState, maxStarters, open };
		setDraftState(resolvedDraftState);
	}
	const { draft, isGenerating } = resolvedDraftState;
	const setDraft = (updater: ConversationStarter[] | ((currentDraft: ConversationStarter[]) => ConversationStarter[])) => {
		setDraftState((currentState) => ({
			...currentState,
			draft: typeof updater === "function" ? updater(currentState.draft) : updater,
		}));
	};
	const setIsGenerating = (isNextGenerating: boolean) => {
		setDraftState((currentState) => ({ ...currentState, isGenerating: isNextGenerating }));
	};

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const itemIds = useMemo(() => draft.map((starter) => starter.id), [draft]);

	function handleTextChange(id: string, text: string): void {
		setDraft((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
	}

	function handleIconChange(id: string, icon: StarterIconKey): void {
		setDraft((prev) => prev.map((s) => (s.id === id ? { ...s, icon } : s)));
	}

	function handleClear(id: string): void {
		setDraft((prev) => prev.map((s) => (s.id === id ? { ...s, text: "" } : s)));
	}

	function handleDragEnd(event: DragEndEvent): void {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setDraft((prev) => {
			const oldIndex = prev.findIndex((s) => s.id === active.id);
			const newIndex = prev.findIndex((s) => s.id === over.id);
			if (oldIndex === -1 || newIndex === -1) return prev;
			return arrayMove(prev, oldIndex, newIndex);
		});
	}

	async function handleGenerate(): Promise<void> {
		setIsGenerating(true);
		try {
			const generated = onGenerate
				? await onGenerate()
				: fallbackGenerate(maxStarters, idCounter);
			setDraft(seedDraft(generated, maxStarters, idCounter));
		} finally {
			setIsGenerating(false);
		}
	}

	function handleSave(): void {
		const cleaned = draft
			.map((s) => ({ ...s, text: s.text.trim() }))
			.filter((s) => s.text.length > 0);
		if (!isControlled) {
			seedRef.current = cleaned;
		}
		onStartersChange?.(cleaned);
		onSave?.(cleaned);
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-0 overflow-hidden p-0" showCloseButton={false} size="md">
				<div className="flex items-center justify-between gap-2 p-6">
					<DialogTitle className="text-xl font-semibold leading-6 text-text">
						{title}
					</DialogTitle>
					<div className="flex items-center gap-2">
						<Button
							isLoading={isGenerating}
							onClick={handleGenerate}
							type="button"
							variant="outline"
						>
							Generate for me
						</Button>
						<DialogClose render={<Button aria-label="Close" size="icon" variant="ghost" />}>
							<CrossIcon label="" />
						</DialogClose>
					</div>
				</div>

				<div className="px-6 pb-6">
					<DndContext
						id="conversation-starter-dnd"
						collisionDetection={closestCenter}
						modifiers={[restrictToVerticalAxis]}
						onDragEnd={handleDragEnd}
						sensors={sensors}
					>
						<SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
							<div className="flex flex-col gap-2">
								{draft.map((starter, index) => (
									<ConversationStarterRow
										key={starter.id}
										index={index}
										iconOptions={iconOptions}
										onClear={handleClear}
										onIconChange={handleIconChange}
										onTextChange={handleTextChange}
										placeholder={placeholder}
										starter={starter}
									/>
								))}
							</div>
						</SortableContext>
					</DndContext>
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-border bg-surface-overlay px-6 pt-4 pb-6">
					<Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
						Cancel
					</Button>
					<Button onClick={handleSave} type="button">
						{saveLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Normalise an incoming list into exactly `max` rows with stable ids: truncate
 * any overflow, then pad with empty rows so the dialog always shows `max` slots.
 */
function seedDraft(
	starters: readonly ConversationStarter[],
	max: number,
	idCounter: React.RefObject<number>,
): ConversationStarter[] {
	const rows: ConversationStarter[] = starters.slice(0, max).map((starter) => ({ ...starter }));
	while (rows.length < max) {
		idCounter.current += 1;
		rows.push({ id: `starter-${idCounter.current}`, text: "", icon: DEFAULT_STARTER_ICON });
	}
	return rows;
}

function fallbackGenerate(
	count: number,
	idCounter: React.RefObject<number>,
): ConversationStarter[] {
	const pool = SAMPLE_CONVERSATION_STARTERS;
	const offset = idCounter.current;
	return Array.from({ length: Math.min(count, pool.length) }, (_, index) => {
		idCounter.current += 1;
		const sample = pool[(offset + index) % pool.length];
		return { id: `starter-gen-${idCounter.current}`, text: sample.text, icon: sample.icon };
	});
}
