"use client";

import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectButterAttachmentIcon } from "@/components/blocks/jira-work-item/project-butter/attachment-icon";
import { attachmentDateLabel, type ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { cn } from "@/lib/utils";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

export function ProjectButterAttachmentRow({ faded, item, onPreview, onRemove }: Readonly<{
	faded: boolean;
	item: ProjectButterAttachment;
	onPreview: () => void;
	onRemove: () => void;
}>) {
	function download() {
		if (!item.file) return;
		const url = URL.createObjectURL(item.file);
		const link = document.createElement("a");
		link.href = url;
		link.download = item.name;
		link.click();
		URL.revokeObjectURL(url);
	}
	return (
		<li className="group/attachment flex min-h-11 min-w-0 items-center gap-2 px-3 hover:bg-surface-hovered focus-within:bg-surface-hovered">
			<button className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring", faded && "opacity-50 hover:opacity-100 focus-visible:opacity-100")} onClick={onPreview} type="button">
				<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-bg-neutral"><ProjectButterAttachmentIcon kind={item.kind} /></span>
				<span className="min-w-0 truncate">{item.name}</span>
			</button>
			<div className="shrink-0 opacity-0 group-hover/attachment:opacity-100 group-focus-within/attachment:opacity-100 has-[[aria-expanded=true]]:opacity-100">
				<DropdownMenu>
					<DropdownMenuTrigger render={<Button aria-label={`More actions for ${item.name}`} size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger>
					<DropdownMenuContent align="end" positionerClassName="z-[650]">
						<DropdownMenuItem onSelect={onPreview}>Preview</DropdownMenuItem>
						<DropdownMenuItem disabled={!item.file} onSelect={item.file ? download : undefined}>Download</DropdownMenuItem>
						<DropdownMenuItem onSelect={onRemove} variant="destructive">{item.kind === "confluence" || item.kind === "google-drive" || item.url ? "Remove" : "Delete"}</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<time className="w-8 shrink-0 whitespace-nowrap text-center text-xs text-text-subtlest">{attachmentDateLabel(item.dateAdded)}</time>
			<Avatar label={item.addedBy} size="sm"><AvatarImage src={projectButterPersonAvatar(item.addedBy)} /><AvatarFallback>{item.addedBy.split(" ").map((part) => part[0]).join("")}</AvatarFallback></Avatar>
		</li>
	);
}
