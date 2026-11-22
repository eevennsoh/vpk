"use client";

import type { FileUIPart } from "ai";

import { Attachment, AttachmentGroup } from "@/components/ui/attachment";
import { getFileAttachmentId } from "@/lib/attachment-media";
import { AttachmentPartMedia } from "@/components/ui-custom/attachment-part-media";

interface UserMessageAttachmentsProps {
	attachments: ReadonlyArray<FileUIPart>;
	/** Prefix for each attachment key, e.g. the message id when several turns share a file. */
	keyScope?: string;
}

/** Read-only 96px thumbnails above a user turn, right-aligned with the bubble. */
export function UserMessageAttachments({ attachments, keyScope }: Readonly<UserMessageAttachmentsProps>) {
	if (attachments.length === 0) {
		return null;
	}

	return (
		<AttachmentGroup className="ml-auto w-fit snap-none flex-wrap justify-end gap-2 overflow-visible p-0">
			{attachments.map((attachment) => {
				const id = getFileAttachmentId(attachment, keyScope);
				return (
					<Attachment
						key={id}
						orientation="vertical"
						className="size-24 gap-0 rounded-lg border-0 bg-transparent has-data-[slot=attachment-media]:p-0"
					>
						<AttachmentPartMedia
							data={{ ...attachment, id }}
							className="size-full rounded-none"
							iconClassName="size-4"
						/>
					</Attachment>
				);
			})}
		</AttachmentGroup>
	);
}
