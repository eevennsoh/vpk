"use client";

import Image from "next/image";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProjectButterAttachmentIcon } from "@/components/blocks/jira-work-item/project-butter/attachment-icon";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { attachmentDisplayName, attachmentType } from "@/components/blocks/jira-work-item/project-butter/attachment-model";
import { cn } from "@/lib/utils";

/**
 * List-row name: a 16px type icon (or image thumbnail) pulled into the row padding, then the
 * truncated display name with a full-name tooltip. `faded` masks the text, never the icon.
 */
export function AttachmentNameCell({ faded = false, item }: Readonly<{ faded?: boolean; item: ProjectButterAttachment }>) {
	const name = attachmentDisplayName(item);
	const thumbnail = attachmentType(item) === "image" && item.previewSrc;
	return (
		<span className="flex min-w-0 items-center" data-component="AttachmentNameCell">
			{thumbnail ? (
				<Image alt="" className="-ml-1.5 mr-1 size-4 shrink-0 rounded-xs object-cover" data-attachment-thumb height={16} src={item.previewSrc ?? ""} unoptimized={item.previewSrc?.startsWith("blob:")} width={16} />
			) : (
				<span className="-ml-1.5 mr-1 flex size-4 shrink-0 items-center justify-center" data-attachment-thumb><ProjectButterAttachmentIcon kind={item.kind} /></span>
			)}
			<Tooltip>
				<TooltipTrigger render={<span className={cn("block min-w-0 truncate text-sm text-text", faded && "related-row-fade group-has-[:focus-visible]/attachment-row:mask-none group-has-[[aria-expanded=true]]/attachment-row:mask-none")} />}>{name}</TooltipTrigger>
				<TooltipContent positionerClassName="z-[650]" side="bottom">{name}</TooltipContent>
			</Tooltip>
		</span>
	);
}
