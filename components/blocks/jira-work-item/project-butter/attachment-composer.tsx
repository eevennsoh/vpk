"use client";

import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import { RelatedComposer, type RelatedComposerDismissReason } from "@/components/blocks/jira-work-item/project-butter/related-composer";
import { attachmentChoiceText, attachmentComposerChoices, attachmentFallbackChoice, type AttachmentComposerChoice } from "@/components/blocks/jira-work-item/project-butter/attachment-catalog";
import { parseWeblink } from "@/components/blocks/jira-work-item/project-butter/attachment-model";

/**
 * Inline "Create new, search or paste existing" row for attachments (renders an `<li>`).
 * Enter commits the highlighted choice, else the first, else the typed text; a pasted link stays in the
 * field to be chosen. No trailing priority/assignee glyphs: those are a work-item create-row quirk.
 */
export function AttachmentComposer({ attachedNames, createSignal, onCommit, onDismiss, onQueryChange, query }: Readonly<{
	/** Display names already attached (case-insensitive). */
	attachedNames: readonly string[];
	createSignal: number;
	onCommit: (choice: AttachmentComposerChoice) => void;
	onDismiss: (reason: RelatedComposerDismissReason) => void;
	onQueryChange: (query: string) => void;
	query: string;
}>) {
	const choices = attachmentComposerChoices(query, attachedNames);
	return (
		<RelatedComposer
			choices={choices}
			createSignal={createSignal}
			label="Add attachment"
			leading={<span aria-hidden className="flex size-4 shrink-0 items-center justify-center text-icon-subtle"><TaskToDoIcon color="currentColor" label="" size="small" /></span>}
			listboxLabel="Matching attachments"
			liveMessage={`${choices.length} matching ${choices.length === 1 ? "attachment" : "attachments"}`}
			onCommit={(choice) => {
				const next = choice ?? attachmentFallbackChoice(query, attachedNames);
				if (next) onCommit(next);
			}}
			onDismiss={onDismiss}
			onPasteText={(text) => parseWeblink(text) ? text.trim() : undefined}
			onQueryChange={onQueryChange}
			query={query}
			renderChoice={(choice) => <>
				<span aria-hidden className="flex size-4 shrink-0 items-center justify-center text-icon-subtle"><TaskToDoIcon color="currentColor" label="" size="small" /></span>
				<span className="min-w-0 truncate">{attachmentChoiceText(choice)}</span>
			</>}
		/>
	);
}
