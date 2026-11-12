"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { ContextDescriptionEditor } from "@/components/blocks/jira-work-item/team-eu26/components/context-description-editor";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter-v1/use-project-butter-content";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DescriptionRainbowText } from "@/components/blocks/jira-work-item/project-butter-v1/description-rainbow-text";
import { motionDuration } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { RichTextEditorExtensionOptions } from "@/components/ui-custom/rich-text-editor/types";

// Clicking a contenteditable matches :focus-visible, so a pointer gesture marks
// the field and drops the ring. Keyboard focus leaves the mark unset.
const DESCRIPTION_EDITOR_CLASS = "relative min-w-0 rounded-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring data-[pointer-focused]:ring-0!";
const DESCRIPTION_TRAILING_NODE = { notAfter: ["bulletList", "orderedList", "taskList"] } satisfies NonNullable<RichTextEditorExtensionOptions["trailingNode"]>;

export function ProjectButterDescription({ content, empty, onRevealComplete, reveal }: Readonly<{ content: ProjectButterContent; empty: boolean; onRevealComplete?: () => void; reveal?: { id: number; text: string } | null }>) {
	const id = useId();
	const pointerIntent = useRef(false);
	const [pointerFocused, setPointerFocused] = useState(false);
	const [settlingReveal, setSettlingReveal] = useState<typeof reveal>(null);
	const reduced = useReducedMotion();
	const revealText = reveal && reveal.text === content.descriptionDraft && !content.editingDescription ? reveal.text : null;
	const settling = Boolean(revealText) && settlingReveal === reveal;
	const startSettling = useCallback(() => {
		if (reduced) onRevealComplete?.();
		else setSettlingReveal(reveal ?? null);
	}, [onRevealComplete, reduced, reveal]);
	useEffect(() => {
		if (!settling) return;
		const timer = window.setTimeout(() => onRevealComplete?.(), motionDuration.slow * 1000);
		return () => window.clearTimeout(timer);
	}, [onRevealComplete, settling]);
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
			className={DESCRIPTION_EDITOR_CLASS}
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
			{revealText ? <div aria-hidden="true" className={cn("tiptap-editor agent-instructions-tiptap-editor context-description-tiptap-editor pointer-events-none absolute inset-0 transition-opacity duration-slow ease-out-practical", empty && "context-description-tiptap-editor-hug", settling ? "opacity-0" : "opacity-100")} data-description-reveal="">
				<DescriptionRainbowText key={reveal?.id} onComplete={startSettling} text={revealText} />
			</div> : null}
			<div className={cn(settling && "transition-opacity duration-slow ease-out-practical", revealText && !settling ? "opacity-0" : "opacity-100")}>
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
