"use client";

import { useId, useRef, useState } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { ContextDescriptionEditor } from "@/components/blocks/jira-work-item/team-eu26/components/context-description-editor";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Clicking a contenteditable matches :focus-visible, so a pointer gesture marks
// the field and drops the ring. Keyboard focus leaves the mark unset.
const DESCRIPTION_EDITOR_CLASS = "min-w-0 rounded-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring data-[pointer-focused]:ring-0!";

export function ProjectButterDescription({ content, empty }: Readonly<{ content: ProjectButterContent; empty: boolean }>) {
	const id = useId();
	const pointerIntent = useRef(false);
	const [pointerFocused, setPointerFocused] = useState(false);
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
			className={DESCRIPTION_EDITOR_CLASS}
			data-pointer-focused={pointerFocused ? "" : undefined}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) {
					releasePointerFocus(event.currentTarget);
					save();
				}
			}}
			onFocusCapture={(event) => {
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
			<ContextDescriptionEditor
				aria-label="Work item description"
				hugContent={empty}
				onMarkdownChange={content.setDescriptionDraft}
				placeholder={empty ? "Add description" : "Add a description"}
				placeholderSlot={null}
				value={content.descriptionDraft}
			/>
		</div>
	);
	return empty ? (
		<section aria-label="Description" className="-mx-1 -mb-4 px-1 pt-1">{editor}</section>
	) : (
		<Collapsible defaultOpen onOpenChange={(open) => { if (!open) save(); }}>
			<section aria-labelledby={`${id}-description`}>
				<h2 id={`${id}-description`}>
					<CollapsibleTrigger className="group flex items-center gap-2 rounded-sm text-left text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-ring">
						Description<span className="text-icon-subtle group-data-[panel-open]:rotate-90"><ChevronRightIcon label="" size="small" /></span>
					</CollapsibleTrigger>
				</h2>
				<CollapsibleContent className="-mx-1 px-1 pb-1 pt-2" hiddenUntilFound={false} keepMounted>
					{editor}
				</CollapsibleContent>
			</section>
		</Collapsible>
	);
}
