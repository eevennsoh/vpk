"use client";

import {
	Attachment,
	AttachmentAction,
	AttachmentContent,
	AttachmentGroup,
	AttachmentTitle,
} from "@/components/ui/attachment";
import { usePromptInputAttachments } from "@/components/ui-custom/prompt-input";
import { XIcon } from "@/components/ui/vpk-icons";
import { getAttachmentLabel } from "@/lib/attachment-media";
import { AttachmentPartMedia } from "@/components/ui-custom/attachment-part-media";

export function PendingAttachments() {
	const attachments = usePromptInputAttachments();

	if (attachments.files.length === 0) {
		return null;
	}

	return (
		<AttachmentGroup className="-mx-1 -mt-1 mb-2 snap-none flex-wrap justify-start gap-2 overflow-visible">
			{attachments.files.map((file) => {
				const label = getAttachmentLabel(file);
				return (
					<Attachment
						key={file.id}
						className="h-8 min-w-0 gap-1.5 rounded-md has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-0 has-data-[slot=attachment-media]:px-1.5 has-data-[slot=attachment-media]:py-0"
					>
						<AttachmentPartMedia data={file} className="size-5 rounded bg-surface" iconClassName="size-4" />
						<AttachmentContent>
							<AttachmentTitle>{label}</AttachmentTitle>
						</AttachmentContent>
						<AttachmentAction
							aria-label={`Remove ${label}`}
							className="size-5 rounded"
							onClick={(event) => {
								event.stopPropagation();
								attachments.remove(file.id);
							}}
						>
							<XIcon className="size-3" label="" />
						</AttachmentAction>
					</Attachment>
				);
			})}
		</AttachmentGroup>
	);
}
