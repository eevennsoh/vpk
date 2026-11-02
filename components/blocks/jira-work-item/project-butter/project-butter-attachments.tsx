"use client";

import { useRef, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProjectButterAttachmentPiles } from "@/components/blocks/jira-work-item/project-butter/attachment-piles";
import { attachmentFromFile, type ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

export function ProjectButterAttachments({ content }: Readonly<{ content: ProjectButterContent }>) {
	const { attachmentComposerOpen: adding, setAttachmentComposerOpen: setAdding } = content;
	const [open, setOpen] = useState(true);
	const [name, setName] = useState("");
	const [preview, setPreview] = useState<ProjectButterAttachment | null>(null);
	const [removeId, setRemoveId] = useState<string | null>(null);
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
		<Collapsible onOpenChange={setOpen} open={open}>
		<section aria-label="Attachments" className="min-w-0">
			<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
				<h3><CollapsibleTrigger className="group flex items-center gap-2 rounded-sm text-left text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-ring">Attachments<span className="text-icon-subtle group-data-[panel-open]:rotate-90"><ChevronRightIcon label="" size="small" /></span></CollapsibleTrigger></h3>
				{open ? <div className="flex items-center gap-1">
					<Button aria-label="Add attachment" onClick={() => setAdding((value) => !value)} size="icon" type="button" variant="ghost"><AddIcon label="" size="small" /></Button>
					<DropdownMenu><DropdownMenuTrigger render={<Button aria-label="More attachment actions" size="icon" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent align="end" positionerClassName="z-[650]"><DropdownMenuItem onSelect={() => fileInput.current?.click()}>Upload files</DropdownMenuItem><DropdownMenuItem onSelect={() => setAdding(true)}>Add link or content</DropdownMenuItem><DropdownMenuItem disabled={content.attachments.length === 0} onSelect={() => setRemoveId("all")} variant="destructive">Delete all attachments</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
				</div> : null}
			</div>
			<CollapsibleContent hiddenUntilFound={false} keepMounted>
			<input aria-label="Upload attachment files" className="sr-only" multiple onChange={(event) => { const files = [...(event.currentTarget.files ?? [])]; content.setAttachments((items) => [...files.map(attachmentFromFile), ...items]); event.currentTarget.value = ""; }} ref={fileInput} tabIndex={-1} type="file" />
			{adding ? <form className="my-3 flex gap-2" onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAdding(false); }} onSubmit={(event) => { event.preventDefault(); addNamedAttachment(); }}><Input aria-label="Attachment name or URL" autoFocus onChange={(event) => setName(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setAdding(false); } }} placeholder="Enter a name or paste a link" value={name} /><Button disabled={!name.trim()} type="submit">Add</Button><Button onClick={() => setAdding(false)} type="button" variant="ghost">Cancel</Button></form> : null}
			{content.attachments.length > 0 ? <ProjectButterAttachmentPiles items={content.attachments} onPreview={setPreview} onRemove={(item) => setRemoveId(item.id)} /> : adding ? null : <p className="py-4 text-sm text-text-subtle">No attachments yet.</p>}
			</CollapsibleContent>
			<Dialog onOpenChange={(open) => { if (!open) setPreview(null); }} open={preview !== null}><DialogContent className="z-[701]" overlayProps={{ forceRender: true, className: "z-[700]" }} size="md"><DialogTitle>{preview?.name}</DialogTitle><DialogDescription>{preview ? `${preview.addedBy} · ${preview.dateAdded}` : "Attachment preview"}</DialogDescription>{preview?.url ? <a className="text-link hover:underline" href={preview.url} rel="noreferrer" target="_blank">Open link</a> : <p className="text-sm text-text-subtle">{preview?.file ? `${preview.file.type || "File"} · ${preview.file.size.toLocaleString("en-US")} bytes` : "Linked work item attachment"}</p>}</DialogContent></Dialog>
			<Dialog onOpenChange={(open) => { if (!open) setRemoveId(null); }} open={removeId !== null}><DialogContent className="z-[701]" overlayProps={{ forceRender: true, className: "z-[700]" }}><DialogTitle>{removeId === "all" ? "Delete all attachments?" : "Remove attachment?"}</DialogTitle><DialogDescription>This removes the attachment from this work item.</DialogDescription><div className="flex justify-end gap-2"><Button onClick={() => setRemoveId(null)} type="button" variant="ghost">Cancel</Button><Button onClick={() => { content.setAttachments((items) => removeId === "all" ? [] : items.filter((item) => item.id !== removeId)); setRemoveId(null); }} type="button" variant="destructive">Remove</Button></div></DialogContent></Dialog>
		</section>
		</Collapsible>
	);
}
