"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { attachmentIsLinked } from "@/components/blocks/jira-work-item/project-butter/attachment-model";

export type AttachmentConfirmTarget = { kind: "all" } | { kind: "item"; item: ProjectButterAttachment };

/** Reference copy (AttachmentsManageMenu / AttachmentDropMenu): delete all, delete a file, remove linked content. */
export function attachmentConfirmCopy(target: AttachmentConfirmTarget) {
	if (target.kind === "all") return { title: "Delete all attachments?", body: "All attachments will be permanently deleted.", action: "Delete" };
	return attachmentIsLinked(target.item)
		? { title: "Remove content?", body: "Once removed, it'll no longer appear in this work item.", action: "Remove" }
		: { title: "Permanently delete this attachment?", body: "Once you delete, it's gone for good.", action: "Delete" };
}

/**
 * Small danger modal above the work item dialog (z-[701] over a z-[700] blanket). Escape, the close
 * button and a blanket click cancel; Base UI returns focus to the element that opened it.
 * `target` outlives `open` so the exit fade keeps its copy.
 */
export function AttachmentConfirmDialog({ onConfirm, onOpenChange, open, target }: Readonly<{
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	target: AttachmentConfirmTarget | null;
}>) {
	const copy = target ? attachmentConfirmCopy(target) : null;
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="z-[701] gap-4" overlayProps={{ forceRender: true, className: "z-[700]" }} size="sm">
				<DialogTitle variant="destructive">{copy?.title}</DialogTitle>
				<DialogDescription className="text-text">{copy?.body}</DialogDescription>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} type="button" variant="ghost">Cancel</Button>
					<Button onClick={onConfirm} type="button" variant="destructive">{copy?.action}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
