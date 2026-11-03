"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AttachmentActionsMenu } from "@/components/blocks/jira-work-item/project-butter/attachment-actions-menu";
import { AttachmentNameCell } from "@/components/blocks/jira-work-item/project-butter/attachment-name-cell";
import { RelatedListCard } from "@/components/blocks/jira-work-item/project-butter/related-list-card";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { attachmentShortDate } from "@/components/blocks/jira-work-item/project-butter/attachment-model";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

function AttachmentRow({ faded, item, onRemove }: Readonly<{ faded: boolean; item: ProjectButterAttachment; onRemove: (item: ProjectButterAttachment) => void }>) {
	const fade = faded ? "related-row-fade group-has-[:focus-visible]/attachment-row:mask-none group-has-[[aria-expanded=true]]/attachment-row:mask-none" : undefined;
	return (
		<motion.li
			className="group/attachment-row flex h-10 min-w-0 items-center gap-3 px-3 transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered has-[:focus-visible]:bg-bg-neutral-subtle-hovered has-[[aria-expanded=true]]:bg-bg-neutral-subtle-hovered"
			data-attachment-row={item.id}
			layout="position"
			transition={{ duration: motionDuration.medium, ease: motionEase.outPractical }}
		>
			<div className="flex min-w-0 flex-1 items-center gap-1.5 pl-1"><AttachmentNameCell faded={faded} item={item} /></div>
			<div className="flex shrink-0 items-center gap-3 pr-1">
				<span className={cn("text-xs whitespace-nowrap text-text-subtlest", fade)}>{attachmentShortDate(item.dateAdded)}</span>
				<Tooltip>
					<TooltipTrigger render={<span className="flex" />}><Avatar label={item.addedBy} size="xs"><AvatarImage src={projectButterPersonAvatar(item.addedBy)} /><AvatarFallback>{item.addedBy.slice(0, 1)}</AvatarFallback></Avatar></TooltipTrigger>
					<TooltipContent positionerClassName="z-[650]" side="bottom">{item.addedBy}</TooltipContent>
				</Tooltip>
				<span className="pointer-events-none opacity-0 group-hover/attachment-row:pointer-events-auto group-hover/attachment-row:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 has-[[aria-expanded=true]]:pointer-events-auto has-[[aria-expanded=true]]:opacity-100">
					<AttachmentActionsMenu item={item} onRemove={onRemove} />
				</span>
			</div>
		</motion.li>
	);
}

/**
 * Project Butter attachments list (reference ProjectButterAttachmentsList): the shared bordered card,
 * 5 rows (4 with the composer), the last shown row faded, and Show N more. Rows are not clickable.
 */
export function AttachmentList({ composer, expanded, items, onExpandedChange, onRemove }: Readonly<{
	composer?: ReactNode;
	expanded: boolean;
	/** Sorted and filtered rows. */
	items: readonly ProjectButterAttachment[];
	onExpandedChange: (expanded: boolean) => void;
	onRemove: (item: ProjectButterAttachment) => void;
}>) {
	return (
		<div data-component="AttachmentsList">
			<RelatedListCard
				composer={composer}
				empty={<li className="px-4 py-3 text-sm text-text-subtle">No matching attachments.</li>}
				expanded={expanded}
				items={items}
				label="Attachments"
				onExpandedChange={onExpandedChange}
				renderItem={(item, { faded }) => <AttachmentRow faded={faded} item={item} key={item.id} onRemove={onRemove} />}
			/>
		</div>
	);
}
