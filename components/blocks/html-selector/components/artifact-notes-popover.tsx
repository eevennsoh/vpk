"use client";

import { useCallback, useState } from "react";
import NoteIcon from "@atlaskit/icon/core/note";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type NotesStatus = "idle" | "loading" | "saving" | "saved" | "error";

interface ArtifactNotesPopoverProps {
	disabled: boolean;
	error: string | null;
	isDirty: boolean;
	loadNotes: () => Promise<string>;
	notes: string;
	saveNotes: () => Promise<void>;
	setNotes: (notes: string) => void;
	status: NotesStatus;
}

function getStatusLabel(status: NotesStatus, isDirty: boolean): string {
	if (status === "loading") {
		return "Loading";
	}
	if (status === "saving") {
		return "Saving";
	}
	if (status === "error") {
		return "Error";
	}
	if (isDirty) {
		return "Unsaved";
	}
	if (status === "saved") {
		return "Saved";
	}
	return "Saved";
}

export function ArtifactNotesPopover({
	disabled,
	error,
	isDirty,
	loadNotes,
	notes,
	saveNotes,
	setNotes,
	status,
}: Readonly<ArtifactNotesPopoverProps>) {
	const [open, setOpen] = useState(false);
	const triggerTitle = disabled ? "Speaker notes are available for saved vpk-html artifacts." : "Speaker notes";
	const handleOpenChange = useCallback((nextOpen: boolean) => {
		setOpen(nextOpen);
		if (nextOpen) {
			void loadNotes();
		}
	}, [loadNotes]);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<Tooltip>
				<TooltipTrigger render={<span className="inline-flex" />}>
					<PopoverTrigger
						render={
							<Button
								type="button"
								variant="ghost"
								size="icon-compact"
								disabled={disabled}
								title={triggerTitle}
								aria-label="Speaker notes"
							/>
						}
					>
						<NoteIcon label="" />
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom">{triggerTitle}</TooltipContent>
			</Tooltip>
			<PopoverContent align="end" side="bottom" className="w-[360px] gap-3 bg-surface-raised p-3 text-text shadow-lg">
				<PopoverHeader>
					<PopoverTitle>Speaker notes</PopoverTitle>
				</PopoverHeader>
				<Textarea
					value={notes}
					onChange={(event) => setNotes(event.currentTarget.value)}
					placeholder="Add narration notes for this artifact."
					className="max-h-72 min-h-36 resize-y"
					disabled={status === "loading" || status === "saving"}
				/>
				<div className="flex items-center justify-between gap-3">
					<span
						className="min-w-0 text-xs text-text-subtle"
						aria-live="polite"
					>
						{error ? error : getStatusLabel(status, isDirty)}
					</span>
					<Button
						type="button"
						size="compact"
						onClick={() => {
							void saveNotes();
						}}
						disabled={!isDirty || status === "loading" || status === "saving"}
						isLoading={status === "saving"}
					>
						Save
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
