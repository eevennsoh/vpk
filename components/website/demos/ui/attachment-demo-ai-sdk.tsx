"use client";

import { AttachmentPartMedia } from "@/components/ui-custom/attachment-part-media";
import { UserMessageAttachments } from "@/components/projects/shared/components/user-message-attachments";
import {
	Attachment,
	AttachmentContent,
	AttachmentDescription,
	AttachmentGroup,
	AttachmentTitle,
} from "@/components/ui/attachment";
import { getAttachmentLabel, type AttachmentData } from "@/lib/attachment-media";

const PARTS: AttachmentData[] = [
	{ id: "image", type: "file", mediaType: "image/svg+xml", filename: "canvas.svg", url: "/avatar-project/canvas.svg" },
	{ id: "pdf", type: "file", mediaType: "application/pdf", filename: "quarterly-report.pdf", url: "" },
	{ id: "audio", type: "file", mediaType: "audio/mpeg", filename: "podcast-episode.mp3", url: "" },
	{
		id: "source",
		type: "source-document",
		sourceId: "src-1",
		mediaType: "text/html",
		title: "Atlassian Design System",
		filename: "atlassian.design",
	},
];

/** AI SDK `FileUIPart` / `SourceDocumentUIPart` values mapped onto Attachment, as the chat surfaces render them. */
export function AttachmentDemoAiSdkParts() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-6">
			<AttachmentGroup className="w-full snap-none flex-wrap overflow-visible">
				{PARTS.map((part) => (
					<Attachment key={part.id} className="w-56">
						<AttachmentPartMedia data={part} />
						<AttachmentContent>
							<AttachmentTitle>{getAttachmentLabel(part)}</AttachmentTitle>
							<AttachmentDescription>{part.mediaType}</AttachmentDescription>
						</AttachmentContent>
					</Attachment>
				))}
			</AttachmentGroup>
			<UserMessageAttachments
				attachments={[
					{ type: "file", mediaType: "image/svg+xml", filename: "graph.svg", url: "/avatar-project/graph.svg" },
					{ type: "file", mediaType: "application/pdf", filename: "brief.pdf", url: "" },
				]}
			/>
		</div>
	);
}
