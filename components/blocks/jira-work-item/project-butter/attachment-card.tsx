"use client";

import Image from "next/image";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Attachment, AttachmentHeader, AttachmentMedia, AttachmentTitle, AttachmentActions, AttachmentAction, AttachmentTrigger } from "@/components/ui/attachment";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProjectButterAttachmentIcon } from "@/components/blocks/jira-work-item/project-butter/attachment-icon";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";

export interface AttachmentCardActions {
	onPreview: (item: ProjectButterAttachment) => void;
	onRemove: (item: ProjectButterAttachment) => void;
}

export function ProjectButterAttachmentCard({ item, onPreview, onRemove }: Readonly<AttachmentCardActions & { item: ProjectButterAttachment }>) {
	const extension = item.kind === "file" || item.kind === "image" || item.kind === "video" ? /\.[a-z0-9]+$/iu.exec(item.name)?.[0] : undefined;
	const name = extension ? item.name.slice(0, -extension.length) : item.name;
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
		<Attachment variant="preview">
			<AttachmentHeader>
				<span className="flex size-4 shrink-0 items-center justify-center"><ProjectButterAttachmentIcon kind={item.kind} /></span>
				<span className="flex min-w-0 flex-1 items-baseline gap-1 group-hover/attachment:pr-5 group-focus-within/attachment:pr-5 group-has-[[aria-expanded=true]]/attachment:pr-5" title={item.name}><AttachmentTitle>{name}</AttachmentTitle>{extension ? <span className="shrink-0">{extension}</span> : null}</span>
			</AttachmentHeader>
			<AttachmentMedia variant="preview">{item.previewSrc ? <Image alt="" height={160} src={item.previewSrc} width={280} /> : null}</AttachmentMedia>
			<AttachmentTrigger aria-label={`Preview ${item.name}`} onClick={() => onPreview(item)} />
			<AttachmentActions className="opacity-0 group-hover/attachment:opacity-100 group-focus-within/attachment:opacity-100 has-[[aria-expanded=true]]:opacity-100">
				<DropdownMenu>
					<DropdownMenuTrigger render={<AttachmentAction aria-label={`More actions for ${item.name}`} />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger>
					<DropdownMenuContent align="end" positionerClassName="z-[650]">
						<DropdownMenuItem onSelect={() => onPreview(item)}>Preview</DropdownMenuItem>
						<DropdownMenuItem disabled={!item.file} onSelect={item.file ? download : undefined}>Download</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => onRemove(item)} variant="destructive">{item.kind === "confluence" || item.kind === "google-drive" || item.url ? "Remove" : "Delete"}</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</AttachmentActions>
		</Attachment>
	);
}
