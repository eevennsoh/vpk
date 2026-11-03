"use client";

import { useRef, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RelatedEmptyState } from "@/components/blocks/jira-work-item/project-butter/related-empty-state";
import { RelatedWorkGroup } from "@/components/blocks/jira-work-item/project-butter/related-work-group";
import { ProjectButterAttachmentPiles } from "@/components/blocks/jira-work-item/project-butter/attachment-piles";
import { attachmentFromFile, type ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

// Interim attachments UI on the shared group shell; the attachments track replaces the form, menu and preview.
export function ProjectButterAttachments({ asSectionHeader, content, emptyState = false, onDismissGroup }: Readonly<{
	asSectionHeader: boolean;
	content: ProjectButterContent;
	/** Every related group is empty: show the empty state row. */
	emptyState?: boolean;
	onDismissGroup?: () => void;
}>) {
	const adding = content.attachmentEditor.composerOpen;
	const setAdding = (composerOpen: boolean) => content.setAttachmentEditor((editor) => ({ ...editor, composerOpen }));
	const [name, setName] = useState("");
	// Dialog content outlives `open` so the exit transition fades the last item instead of a blank popup.
	const [preview, setPreview] = useState<ProjectButterAttachment | null>(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [removeId, setRemoveId] = useState<string | null>(null);
	const [removeOpen, setRemoveOpen] = useState(false);
	function openPreview(item: ProjectButterAttachment) { setPreview(item); setPreviewOpen(true); }
	function confirmRemove(id: string) { setRemoveId(id); setRemoveOpen(true); }
	const fileInput = useRef<HTMLInputElement>(null);
	function addNamedAttachment() {
		const value = name.trim();
		if (!value) return;
		let url: string | undefined;
		try { const candidate = new URL(value); if (candidate.protocol === "https:" || candidate.protocol === "http:") url = candidate.href; } catch { /* A plain name creates a local attachment record. */ }
		content.setAttachments((items) => [{ id: crypto.randomUUID(), name: value, kind: url ? "link" : "file", addedBy: "Annie Cook", dateAdded: "Just now", url }, ...items]);
		setName("");
		setAdding(false);
	}
	return (
		<RelatedWorkGroup
			asSectionHeader={asSectionHeader}
			extra={<>
				<Button aria-keyshortcuts="Shift+A" aria-label="Add attachment" data-related-add onClick={() => content.openRelatedAdd("attachments")} size="icon-compact" type="button" variant="ghost"><AddIcon label="" size="small" /></Button>
				<DropdownMenu><DropdownMenuTrigger render={<Button aria-label="More attachment actions" size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent align="end" positionerClassName="z-[650]"><DropdownMenuItem onSelect={() => fileInput.current?.click()}>Upload files</DropdownMenuItem><DropdownMenuItem onSelect={() => content.openRelatedAdd("attachments")}>Add link or content</DropdownMenuItem><DropdownMenuItem disabled={content.attachments.length === 0} onSelect={() => confirmRemove("all")} variant="destructive">Delete all attachments</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
			</>}
			id="section-attachments"
			label="Attachments"
			relatedType="attachments"
			revealKey={content.attachmentEditor.createSignal}
		>
			<input aria-label="Upload attachment files" className="sr-only" multiple onChange={(event) => { const files = [...(event.currentTarget.files ?? [])]; content.setAttachments((items) => [...files.map(attachmentFromFile), ...items]); event.currentTarget.value = ""; }} ref={fileInput} tabIndex={-1} type="file" />
			{adding ? <form aria-label="Add attachment" className="my-3 flex gap-2" onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAdding(false); }} onSubmit={(event) => { event.preventDefault(); addNamedAttachment(); }}><Input aria-label="Attachment name or URL" autoFocus onChange={(event) => setName(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setAdding(false); } }} placeholder="Enter a name or paste a link" value={name} /><Button disabled={!name.trim()} type="submit">Add</Button><Button onClick={() => setAdding(false)} type="button" variant="ghost">Cancel</Button></form> : null}
			{content.attachments.length > 0 ? <ProjectButterAttachmentPiles items={content.attachments} onPreview={openPreview} onRemove={(item) => confirmRemove(item.id)} /> : adding ? null : emptyState ? <RelatedEmptyState kind="attachments" onAdd={() => content.openRelatedAdd("attachments")} onDismiss={onDismissGroup} /> : <p className="py-4 text-sm text-text-subtle">No attachments yet.</p>}
			<Dialog onOpenChange={setPreviewOpen} open={previewOpen}><DialogContent className="z-[701]" overlayProps={{ forceRender: true, className: "z-[700]" }} size="md"><DialogTitle>{preview?.name}</DialogTitle><DialogDescription>{preview ? `${preview.addedBy} · ${preview.dateAdded}` : "Attachment preview"}</DialogDescription>{preview?.url ? <a className="text-link hover:underline" href={preview.url} rel="noreferrer" target="_blank">Open link</a> : <p className="text-sm text-text-subtle">{preview?.file ? `${preview.file.type || "File"} · ${preview.file.size.toLocaleString("en-US")} bytes` : "Linked work item attachment"}</p>}</DialogContent></Dialog>
			<Dialog onOpenChange={setRemoveOpen} open={removeOpen}><DialogContent className="z-[701]" overlayProps={{ forceRender: true, className: "z-[700]" }}><DialogTitle>{removeId === "all" ? "Delete all attachments?" : "Remove attachment?"}</DialogTitle><DialogDescription>This removes the attachment from this work item.</DialogDescription><div className="flex justify-end gap-2"><Button onClick={() => setRemoveOpen(false)} type="button" variant="ghost">Cancel</Button><Button onClick={() => { content.setAttachments((items) => removeId === "all" ? [] : items.filter((item) => item.id !== removeId)); setRemoveOpen(false); }} type="button" variant="destructive">Remove</Button></div></DialogContent></Dialog>
		</RelatedWorkGroup>
	);
}
