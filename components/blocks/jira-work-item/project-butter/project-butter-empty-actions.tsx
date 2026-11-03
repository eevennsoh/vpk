"use client";

import { useEffect, useRef } from "react";
import AttachmentIcon from "@atlaskit/icon/core/attachment";
import LinkIcon from "@atlaskit/icon/core/link";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";

import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Button } from "@/components/ui/button";

export function ProjectButterEmptyActions({ content }: Readonly<{ content: ProjectButterContent }>) {
	const attachment = useRef<HTMLButtonElement>(null);
	const children = useRef<HTMLButtonElement>(null);
	const linked = useRef<HTMLButtonElement>(null);
	const attachmentOpen = content.attachmentEditor.composerOpen;
	const childrenOpen = content.relatedEditor.children.composerOpen;
	const linkedOpen = content.relatedEditor.linked.composerOpen;
	const previous = useRef({ attachmentOpen, childrenOpen, linkedOpen });
	useEffect(() => {
		const closed = previous.current.attachmentOpen && !attachmentOpen ? attachment.current
			: previous.current.childrenOpen && !childrenOpen ? children.current
				: previous.current.linkedOpen && !linkedOpen ? linked.current : null;
		previous.current = { attachmentOpen, childrenOpen, linkedOpen };
		if (closed && document.activeElement === document.body) closed.focus();
	}, [attachmentOpen, childrenOpen, linkedOpen]);
	return (
		<div className="group/empty-actions flex items-center">
			<div aria-label="Add related work" className="pointer-events-none flex items-center gap-2 opacity-0 transition-opacity duration-normal ease-out group-hover/empty-actions:pointer-events-auto group-hover/empty-actions:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 motion-reduce:transition-none" role="group">
				{content.attachments.length === 0 && !attachmentOpen ? <Button aria-label="Add attachment" aria-keyshortcuts="Shift+A" data-related-add onClick={() => content.openRelatedAdd("attachments")} ref={attachment} size="icon" type="button" variant="ghost"><AttachmentIcon label="" size="small" /></Button> : null}
				{content.relatedWork.children.length === 0 && !childrenOpen ? <Button aria-label="Add child work item" aria-keyshortcuts="Shift+C" data-related-add onClick={() => content.openRelatedAdd("children")} ref={children} size="icon" type="button" variant="ghost"><SubtasksIcon label="" size="small" /></Button> : null}
				{content.relatedWork.linked.length === 0 && !linkedOpen ? <Button aria-label="Add linked work" aria-keyshortcuts="Shift+K" data-related-add onClick={() => content.openRelatedAdd("linked")} ref={linked} size="icon" type="button" variant="ghost"><LinkIcon label="" size="small" /></Button> : null}
			</div>
		</div>
	);
}
