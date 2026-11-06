"use client";

import Image from "next/image";
import { Attachment, AttachmentActions, AttachmentHeader, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AttachmentActionsMenu } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-actions-menu";
import { ProjectButterAttachmentIcon } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-icon";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-data";
import { attachmentDisplayName } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-model";

/** Grid card (reference AttachmentCard). Clicking it does nothing; `onRemove` absent (piled, arriving) means no actions. */
export function ProjectButterAttachmentCard({ item, onRemove }: Readonly<{ item: ProjectButterAttachment; onRemove?: (item: ProjectButterAttachment) => void }>) {
	const fullName = attachmentDisplayName(item);
	const extension = fullName === item.name ? undefined : `.${item.extension}`;
	return (
		<Attachment variant="preview">
			<AttachmentHeader className="gap-1.5">
				<span className="flex size-4 shrink-0 items-center justify-center"><ProjectButterAttachmentIcon kind={item.kind} /></span>
				<Tooltip>
					<TooltipTrigger render={<span className="flex max-w-[calc(100%-24px)] min-w-0 items-baseline transition-[max-width] duration-medium ease-out-practical group-hover/attachment:max-w-[calc(100%-52px)] group-focus-within/attachment:max-w-[calc(100%-52px)] group-has-[[aria-expanded=true]]/attachment:max-w-[calc(100%-52px)]" />}>
						<AttachmentTitle>{item.name}</AttachmentTitle>{extension ? <span className="shrink-0">{extension}</span> : null}
					</TooltipTrigger>
					<TooltipContent positionerClassName="z-[650]" side="bottom">{fullName}</TooltipContent>
				</Tooltip>
			</AttachmentHeader>
			<AttachmentMedia variant="preview">{item.previewSrc ? <Image alt="" height={160} src={item.previewSrc} unoptimized={item.previewSrc.startsWith("blob:")} width={280} /> : null}</AttachmentMedia>
			{onRemove ? (
				<AttachmentActions className="translate-x-2.5 opacity-0 transition-[opacity,translate] duration-medium ease-out-practical group-hover/attachment:-translate-x-1 group-hover/attachment:opacity-100 group-focus-within/attachment:-translate-x-1 group-focus-within/attachment:opacity-100 has-[[aria-expanded=true]]:-translate-x-1 has-[[aria-expanded=true]]:opacity-100">
					<AttachmentActionsMenu item={item} onRemove={onRemove} />
				</AttachmentActions>
			) : null}
		</Attachment>
	);
}
