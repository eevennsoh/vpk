"use client";

import { useRef, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import FileIcon from "@atlaskit/icon/core/file";
import ImageIcon from "@atlaskit/icon/core/image";
import LinkIcon from "@atlaskit/icon/core/link";
import VideoIcon from "@atlaskit/icon/core/video";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectButterAttachmentRow } from "@/components/blocks/jira-work-item/project-butter/attachment-row";
import { ProjectButterExpandControl } from "@/components/blocks/jira-work-item/project-butter/project-butter-expand-control";
import { attachmentFromFile, matchesAttachmentFilter, type AttachmentFilter, type ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

const FILTERS = [
	{ value: "all", label: "All" },
	{ value: "documents", label: "Documents", icon: FileIcon },
	{ value: "images", label: "Images", icon: ImageIcon },
	{ value: "videos", label: "Videos", icon: VideoIcon },
	{ value: "links", label: "Links", icon: LinkIcon },
] as const;

export function ProjectButterAttachments({ content }: Readonly<{ content: ProjectButterContent }>) {
	const [filter, setFilter] = useState<AttachmentFilter>("all");
	const [expanded, setExpanded] = useState(false);
	const [adding, setAdding] = useState(false);
	const [name, setName] = useState("");
	const [preview, setPreview] = useState<ProjectButterAttachment | null>(null);
	const [removeId, setRemoveId] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const filtered = content.attachments.filter((item) => matchesAttachmentFilter(item, filter));
	const visible = expanded ? filtered : filtered.slice(0, 5);
	const remaining = filtered.length - visible.length;
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
		<section aria-label="Attachments" className="min-w-0 space-y-3">
			<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
				<h3 className="text-sm font-medium text-text">Attachments</h3>
				<div className="flex items-center gap-1">
					<Tabs onValueChange={(value) => { const next = FILTERS.find((option) => option.value === value); if (next) { setFilter(next.value); setExpanded(false); } }} value={filter}>
						<TabsList aria-label="Filter attachments">{FILTERS.map((option) => <TabsTrigger aria-label={option.label} key={option.value} value={option.value}>{"icon" in option ? <option.icon label="" size="small" /> : option.label}</TabsTrigger>)}</TabsList>
					</Tabs>
					<Button aria-label="Add attachment" onClick={() => setAdding((value) => !value)} size="icon" type="button" variant="ghost"><AddIcon label="" size="small" /></Button>
					<DropdownMenu><DropdownMenuTrigger render={<Button aria-label="More attachment actions" size="icon" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent align="end" positionerClassName="z-[650]"><DropdownMenuItem onSelect={() => fileInput.current?.click()}>Upload files</DropdownMenuItem><DropdownMenuItem onSelect={() => setAdding(true)}>Add link or content</DropdownMenuItem><DropdownMenuItem disabled={content.attachments.length === 0} onSelect={() => setRemoveId("all")} variant="destructive">Delete all attachments</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
				</div>
			</div>
			<input aria-label="Upload attachment files" className="sr-only" multiple onChange={(event) => { const files = [...(event.currentTarget.files ?? [])]; content.setAttachments((items) => [...files.map(attachmentFromFile), ...items]); event.currentTarget.value = ""; }} ref={fileInput} tabIndex={-1} type="file" />
			{adding ? <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); addNamedAttachment(); }}><Input aria-label="Attachment name or URL" autoFocus onChange={(event) => setName(event.currentTarget.value)} placeholder="Enter a name or paste a link" value={name} /><Button disabled={!name.trim()} type="submit">Add</Button><Button onClick={() => setAdding(false)} type="button" variant="ghost">Cancel</Button></form> : null}
			<div className="relative rounded-lg border border-border pb-1">
				<ul aria-label="Attachments" className="pb-1">{visible.map((item, index) => <ProjectButterAttachmentRow faded={remaining > 0 && index === visible.length - 1} item={item} key={item.id} onPreview={() => setPreview(item)} onRemove={() => setRemoveId(item.id)} />)}</ul>
				{filtered.length === 0 ? <p className="p-4 text-sm text-text-subtle">No attachments match this filter.</p> : null}
				{filtered.length > 5 ? <ProjectButterExpandControl expanded={expanded} label={remaining > 0 ? `Show ${remaining} more` : "Show less"} onClick={() => setExpanded((value) => !value)} /> : null}
			</div>
			<Dialog onOpenChange={(open) => { if (!open) setPreview(null); }} open={preview !== null}><DialogContent className="z-[701]" overlayProps={{ forceRender: true, className: "z-[700]" }} size="md"><DialogTitle>{preview?.name}</DialogTitle><DialogDescription>{preview ? `${preview.addedBy} · ${preview.dateAdded}` : "Attachment preview"}</DialogDescription>{preview?.url ? <a className="text-link hover:underline" href={preview.url} rel="noreferrer" target="_blank">Open link</a> : <p className="text-sm text-text-subtle">{preview?.file ? `${preview.file.type || "File"} · ${preview.file.size.toLocaleString("en-US")} bytes` : "Linked work item attachment"}</p>}</DialogContent></Dialog>
			<Dialog onOpenChange={(open) => { if (!open) setRemoveId(null); }} open={removeId !== null}><DialogContent className="z-[701]" overlayProps={{ forceRender: true, className: "z-[700]" }}><DialogTitle>{removeId === "all" ? "Delete all attachments?" : "Remove attachment?"}</DialogTitle><DialogDescription>This removes the attachment from this work item.</DialogDescription><div className="flex justify-end gap-2"><Button onClick={() => setRemoveId(null)} type="button" variant="ghost">Cancel</Button><Button onClick={() => { content.setAttachments((items) => removeId === "all" ? [] : items.filter((item) => item.id !== removeId)); setRemoveId(null); }} type="button" variant="destructive">Remove</Button></div></DialogContent></Dialog>
		</section>
	);
}
