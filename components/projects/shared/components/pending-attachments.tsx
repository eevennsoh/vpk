"use client";

import {
	AttachmentItem,
	AttachmentInfo,
	AttachmentPreview,
	AttachmentRemove,
	Attachment,
} from "@/components/ui-custom/attachment";
import { usePromptInputAttachments } from "@/components/ui-custom/prompt-input";

export function PendingAttachments() {
	const attachments = usePromptInputAttachments();

	if (attachments.files.length === 0) {
		return null;
	}

	return (
		<Attachment variant="inline" className="mb-3 justify-start">
			{attachments.files.map((file) => (
				<AttachmentItem
					key={file.id}
					data={file}
					onRemove={() => attachments.remove(file.id)}
				>
					<AttachmentPreview />
					<AttachmentInfo />
					<AttachmentRemove className="opacity-100" />
				</AttachmentItem>
			))}
		</Attachment>
	);
}
