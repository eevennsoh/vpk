"use client";

import DeleteIcon from "@atlaskit/icon/core/delete";
import DownloadIcon from "@atlaskit/icon/core/download";
import LinkBrokenIcon from "@atlaskit/icon/core/link-broken";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-data";
import { attachmentDisplayName, attachmentIsLinked } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-model";

/** Saves a local (dropped) file. Seeded attachments have no bytes, so their Download is disabled. */
export function downloadAttachment(item: ProjectButterAttachment) {
	if (!item.file) return;
	const url = URL.createObjectURL(item.file);
	const link = document.createElement("a");
	link.href = url;
	link.download = attachmentDisplayName(item);
	link.click();
	URL.revokeObjectURL(url);
}

/**
 * Card and row "More actions" (reference AttachmentDropMenu): links and provider content offer Remove,
 * files offer Download and Delete. Both open the confirmation through `onRemove`. There is no Preview.
 * The trigger names its attachment so a list of them stays distinguishable to assistive tech.
 */
export function AttachmentActionsMenu({ item, onRemove, triggerClassName }: Readonly<{
	item: ProjectButterAttachment;
	onRemove: (item: ProjectButterAttachment) => void;
	triggerClassName?: string;
}>) {
	const label = `More actions for ${attachmentDisplayName(item)}`;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button aria-label={label} className={cn(triggerClassName, "[&_svg]:text-icon-subtle aria-expanded:[&_svg]:text-icon-subtle")} size="icon-compact" type="button" variant="ghost" />}>
				<ShowMoreHorizontalIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} positionerClassName="z-[650]">
				{attachmentIsLinked(item) ? (
					<DropdownMenuItem elemBefore={<LinkBrokenIcon label="" size="small" />} onSelect={() => onRemove(item)}>Remove</DropdownMenuItem>
				) : (
					<>
						<DropdownMenuItem disabled={!item.file} elemBefore={<DownloadIcon label="" size="small" />} onSelect={item.file ? () => downloadAttachment(item) : undefined}>Download</DropdownMenuItem>
						<DropdownMenuItem elemBefore={<DeleteIcon label="" size="small" />} onSelect={() => onRemove(item)}>Delete</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
