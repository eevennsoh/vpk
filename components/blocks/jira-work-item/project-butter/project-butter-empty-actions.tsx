"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import AttachmentIcon from "@atlaskit/icon/core/attachment";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import WorkItemIcon from "@atlaskit/icon/core/work-item";

import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { RelatedTooltip } from "@/components/blocks/jira-work-item/project-butter/related-tooltip";
import { Button } from "@/components/ui/button";
import { motionDuration, motionEase } from "@/lib/motion";

/** One icon-only quick action. It leaves with a short fade (inert while exiting) and siblings reflow. */
function EmptyAction({ buttonRef, icon, label, onClick, shortcut }: Readonly<{ buttonRef: RefObject<HTMLButtonElement | null>; icon: ReactNode; label: string; onClick: () => void; shortcut: string }>) {
	const present = useIsPresent();
	return (
		<motion.span
			animate={{ opacity: 1 }}
			aria-hidden={present ? undefined : true}
			className="flex"
			exit={{ opacity: 0, transition: { duration: motionDuration.fast, ease: motionEase.in } }}
			inert={present ? undefined : true}
			initial={false}
			layout="position"
			transition={{ layout: { duration: motionDuration.medium, ease: motionEase.inOut } }}
		>
			<RelatedTooltip label={label}>
				<Button aria-keyshortcuts={shortcut} aria-label={label} className="text-icon-subtlest hover:text-icon-subtlest" data-related-add onClick={onClick} ref={buttonRef} size="icon" type="button" variant="ghost">{icon}</Button>
			</RelatedTooltip>
		</motion.span>
	);
}

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
			<div aria-label="Add related work" className="pointer-events-none flex items-center gap-2 opacity-0 transition-opacity duration-normal ease-out group-hover/empty-actions:pointer-events-auto group-hover/empty-actions:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 has-[[aria-expanded=true]]:pointer-events-auto has-[[aria-expanded=true]]:opacity-100" role="group">
				<AnimatePresence initial={false}>
					{content.attachments.length === 0 && !attachmentOpen ? <EmptyAction buttonRef={attachment} icon={<AttachmentIcon label="" size="small" />} key="attachments" label="Attachment" onClick={() => content.openRelatedAdd("attachments")} shortcut="Shift+A" /> : null}
					{content.relatedWork.children.length === 0 && !childrenOpen ? <EmptyAction buttonRef={children} icon={<SubtasksIcon label="" size="small" />} key="children" label="Subtask" onClick={() => content.openRelatedAdd("children")} shortcut="Shift+C" /> : null}
					{content.relatedWork.linked.length === 0 && !linkedOpen ? <EmptyAction buttonRef={linked} icon={<WorkItemIcon label="" size="small" />} key="linked" label="Linked work" onClick={() => content.openRelatedAdd("linked")} shortcut="Shift+K" /> : null}
				</AnimatePresence>
			</div>
		</div>
	);
}
