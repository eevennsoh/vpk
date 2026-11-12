"use client";

import { useState, type RefObject } from "react";
import type { ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-data";
import { AttachmentConfirmDialog, type AttachmentConfirmTarget } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-confirm-dialog";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter-v1/use-project-butter-content";

/** Revokes the object URL a dropped image used for its preview. */
function releasePreview(item: ProjectButterAttachment) {
	if (item.previewSrc?.startsWith("blob:")) URL.revokeObjectURL(item.previewSrc);
}

/**
 * Attachment delete / delete-all confirmation, owned above the Attachments group: deleting the last
 * attachment can hide the group, and the dialog must survive that to play its exit fade. When the
 * control that opened it is gone, focus lands on the Attachments add button, else the first
 * Related work trigger, never on <body>.
 */
export function useAttachmentRemoval(content: ProjectButterContent, sectionRef: RefObject<HTMLElement | null>) {
	const [target, setTarget] = useState<AttachmentConfirmTarget | null>(null);
	const [open, setOpen] = useState(false);
	const [opener, setOpener] = useState<HTMLElement | null>(null);
	function requestRemove(next: AttachmentConfirmTarget) {
		setOpener(document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null);
		setTarget(next);
		setOpen(true);
	}
	function confirm() {
		setOpen(false);
		if (!target) return;
		const removed = target.kind === "all" ? content.attachments : content.attachments.filter((item) => item.id === target.item.id);
		content.setAttachments((items) => target.kind === "all" ? [] : items.filter((item) => item.id !== target.item.id));
		removed.forEach(releasePreview);
	}
	function finalFocus(): HTMLElement | true {
		if (opener?.isConnected) return opener;
		const section = sectionRef.current;
		return section?.querySelector<HTMLElement>("#section-attachments [data-related-add]")
			?? section?.querySelector<HTMLElement>("button:not([disabled])")
			?? true;
	}
	const dialog = <AttachmentConfirmDialog finalFocus={finalFocus} onConfirm={confirm} onOpenChange={setOpen} open={open} target={target} />;
	return { dialog, requestRemove };
}
