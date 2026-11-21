"use client";

import { useEffect, useId, useRef, useState } from "react";

import { ContextDescriptionEditor } from "@/components/blocks/jira-work-item/team-eu26/components/context-description-editor";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { ProjectButterContentPreview } from "@/components/blocks/jira-work-item/project-butter/content-preview";
import { DescriptionRainbowText } from "@/components/blocks/jira-work-item/project-butter/description-rainbow-text";
import { motionDuration } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { SuggestionFieldFeedback } from "./suggestion-targets";
import type { RichTextEditorExtensionOptions } from "@/components/ui-custom/rich-text-editor/types";

// Clicking a contenteditable matches :focus-visible, so a pointer gesture marks
// the field and drops the ring. Keyboard focus leaves the mark unset.
const DESCRIPTION_EDITOR_CLASS = "relative min-w-0 rounded-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring data-[pointer-focused]:ring-0!";
const DESCRIPTION_TRAILING_NODE = { notAfter: ["bulletList", "orderedList", "taskList"] } satisfies NonNullable<RichTextEditorExtensionOptions["trailingNode"]>;

export function ProjectButterDescription({ content, empty, onRevealComplete, reveal }: Readonly<{ content: ProjectButterContent; empty: boolean; onRevealComplete?: () => void; reveal?: { id: number; text: string } | null }>) {
	const id = useId();
	const pointerIntent = useRef(false);
	const [pointerFocused, setPointerFocused] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const revealText = reveal && reveal.text === content.descriptionDraft && !content.editingDescription ? reveal.text : null;
	useEffect(() => {
		if (!revealText) return;
		const timer = window.setTimeout(() => onRevealComplete?.(), motionDuration.slowest * 5 * 1000);
		return () => window.clearTimeout(timer);
	}, [onRevealComplete, reveal?.id, revealText]);
	const save = () => {
		content.setDescription(content.descriptionDraft);
		content.setEditingDescription(false);
	};
	const releasePointerFocus = (group: HTMLDivElement) => {
		pointerIntent.current = false;
		delete group.dataset.pointerFocused;
		setPointerFocused(false);
	};
	const editor = (
		<div
			aria-label="Description editor"
			className={cn(DESCRIPTION_EDITOR_CLASS, "grid")}
			data-pointer-focused={pointerFocused ? "" : undefined}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) {
					releasePointerFocus(event.currentTarget);
					save();
				}
			}}
			onFocusCapture={(event) => {
				if (revealText) onRevealComplete?.();
				const fromPointer = pointerIntent.current;
				pointerIntent.current = false;
				if (!fromPointer) releasePointerFocus(event.currentTarget);
				content.setEditingDescription(true);
			}}
			onPointerCancel={(event) => {
				if (!event.currentTarget.contains(document.activeElement)) releasePointerFocus(event.currentTarget);
			}}
			onPointerDown={(event) => {
				pointerIntent.current = true;
				event.currentTarget.dataset.pointerFocused = "";
				setPointerFocused(true);
			}}
			onPointerUp={(event) => {
				if (!event.currentTarget.contains(document.activeElement)) releasePointerFocus(event.currentTarget);
			}}
			role="group"
		>
			<SuggestionFieldFeedback field="description" enabled={!content.editingDescription} />
			{revealText ? <div aria-hidden="true" className={cn("tiptap-editor agent-instructions-tiptap-editor context-description-tiptap-editor pointer-events-none absolute inset-0", empty && "context-description-tiptap-editor-hug")} data-description-reveal="">
				<DescriptionRainbowText key={reveal?.id} onComplete={onRevealComplete} text={revealText} />
			</div> : null}
			<div className={cn("col-start-1 row-start-1 min-w-0", revealText && "opacity-0")}>
			<ContextDescriptionEditor
				aria-label="Work item description"
				hugContent={empty}
				onMarkdownChange={content.setDescriptionDraft}
				placeholder={empty ? "Add description" : "Add a description"}
				placeholderSlot={null}
				trailingNode={DESCRIPTION_TRAILING_NODE}
				value={content.descriptionDraft}
			/>
			</div>
		</div>
	);
	return empty ? (
		<section aria-label="Description" className="-mx-1 px-1 pt-1">{editor}</section>
	) : (
		<section aria-labelledby={`${id}-description`}>
			<h2 className="text-sm font-medium text-text" id={`${id}-description`}>Description</h2>
			<div className="pt-2">
				<ProjectButterContentPreview expanded={expanded} forceExpanded={content.editingDescription || Boolean(reveal)} label="description" onExpandedChange={setExpanded}>{editor}</ProjectButterContentPreview>
			</div>
		</section>
	);
}
