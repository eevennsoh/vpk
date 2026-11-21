"use client";

import { useId, useState, type ReactElement } from "react";

import LoomIcon from "@atlaskit/icon-lab/core/loom";
import PageLiveDocIcon from "@atlaskit/icon-lab/core/page-live-doc";
import FilesIcon from "@atlaskit/icon/core/files";
import LinkIcon from "@atlaskit/icon/core/link";
import PageIcon from "@atlaskit/icon/core/page";
import SearchIcon from "@atlaskit/icon/core/search";
import UploadIcon from "@atlaskit/icon/core/upload";
import VideoIcon from "@atlaskit/icon/core/video";
import WhiteboardIcon from "@atlaskit/icon/core/whiteboard";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	CONTEXT_POPOVER_ROW_CLASS,
	CONTEXT_POPOVER_SECTION_HEADING_CLASS,
	CONTEXT_POPOVER_TABS_LIST_CLASS,
	PopoverSubmitField,
	SuggestionPanel,
} from "@/components/blocks/jira-work-item/experimental-v3/components/context-popover-parts";
import { useJiraWorkItemActions } from "@/components/blocks/jira-work-item/experimental-v3/context-jira-work-item";
import {
	ATTACHMENT_CREATE_OPTIONS,
	ATTACHMENT_RECENT,
	ATTACHMENT_SUGGESTED,
	createCreatedAttachment,
	createLinkedContentAttachment,
	createUploadedAttachment,
	getAttachmentLabel,
	type AttachmentCreateKind,
} from "@/components/blocks/jira-work-item/data/context-fixtures";
import { cn } from "@/lib/utils";
import type { WorkItemAttachment } from "@/app/contexts/context-work-item-modal";

/**
 * Create-new rows use the ADS single-purpose content-type glyphs at product
 * parity: each object type owns a reserved icon plus its accent icon token.
 * Size is left at the new-core default (`medium` = 16px); `size="small"` would
 * render 12px, which is the object-inline size, not the menu size.
 */
const CREATE_OPTION_ICON: Record<AttachmentCreateKind, { Glyph: typeof PageIcon; tone: string }> = {
	page: { Glyph: PageIcon, tone: "text-icon-accent-blue" },
	"live-doc": { Glyph: PageLiveDocIcon, tone: "text-icon-accent-magenta" },
	whiteboard: { Glyph: WhiteboardIcon, tone: "text-icon-accent-teal" },
	"loom-video": { Glyph: LoomIcon, tone: "text-icon-accent-blue" },
};

/** Attachment rows reuse the create-new glyphs so one object type reads the same everywhere. */
const ATTACHMENT_EXT_ICON: Record<string, { Glyph: typeof PageIcon; tone: string }> = {
	page: CREATE_OPTION_ICON.page,
	doc: CREATE_OPTION_ICON["live-doc"],
	whiteboard: CREATE_OPTION_ICON.whiteboard,
	loom: CREATE_OPTION_ICON["loom-video"],
};

function attachmentIcon(attachment: Readonly<WorkItemAttachment>): { Glyph: typeof PageIcon; tone: string } {
	if (attachment.ext === "link") return { Glyph: LinkIcon, tone: "text-icon-subtle" };
	const byContentType = ATTACHMENT_EXT_ICON[attachment.ext];
	if (byContentType) return byContentType;
	if (attachment.thumbnailKind === "video") return { Glyph: VideoIcon, tone: "text-icon-subtle" };
	return { Glyph: FilesIcon, tone: "text-icon-subtle" };
}

function AttachmentResultItem({ attachment, onSelect }: Readonly<{ attachment: WorkItemAttachment; onSelect: () => void }>) {
	const { Glyph, tone } = attachmentIcon(attachment);
	return (
		<button type="button" onClick={onSelect} className={CONTEXT_POPOVER_ROW_CLASS}>
			<span className={cn("shrink-0", tone)}>
				<Glyph label="" color="currentColor" />
			</span>
			<span className="min-w-0 flex-1 truncate">{getAttachmentLabel(attachment)}</span>
		</button>
	);
}

interface AttachmentsPopoverProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	tooltip?: string;
	trigger: ReactElement;
}

export function AttachmentsPopover({
	open: controlledOpen,
	onOpenChange,
	tooltip,
	trigger,
}: Readonly<AttachmentsPopoverProps>) {
	const actions = useJiraWorkItemActions();
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const open = controlledOpen ?? uncontrolledOpen;
	const setOpen = onOpenChange ?? setUncontrolledOpen;
	const [query, setQuery] = useState("");
	const [displayName, setDisplayName] = useState("");
	const displayNameId = useId();
	const searchHintId = useId();

	const add = (item: WorkItemAttachment) => {
		actions.addContextResource("attachment", item);
		setQuery("");
		setDisplayName("");
		setOpen(false);
	};

	const trimmedQuery = query.trim();
	const matchesQuery = (attachment: Readonly<WorkItemAttachment>) =>
		getAttachmentLabel(attachment).toLowerCase().includes(trimmedQuery.toLowerCase());
	const recent = trimmedQuery ? ATTACHMENT_RECENT.filter(matchesQuery) : ATTACHMENT_RECENT;
	const suggested = trimmedQuery ? ATTACHMENT_SUGGESTED.filter(matchesQuery) : ATTACHMENT_SUGGESTED;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			{tooltip ? (
				<Tooltip>
					<TooltipTrigger render={<span className="inline-flex" />}>
						<PopoverTrigger render={trigger} />
					</TooltipTrigger>
					<TooltipContent positionerClassName="z-[502]">{tooltip}</TooltipContent>
				</Tooltip>
			) : (
				<PopoverTrigger render={trigger} />
			)}
			<PopoverContent align="start" className="w-[22rem] p-0" positionerClassName="z-[502]">
				<Tabs defaultValue="upload" className="gap-0">
					<TabsList className={CONTEXT_POPOVER_TABS_LIST_CLASS}>
						<TabsTrigger value="upload">Upload files</TabsTrigger>
						<TabsTrigger value="link">Add link</TabsTrigger>
						<TabsTrigger value="create">Create new</TabsTrigger>
					</TabsList>

					<TabsContent value="upload" className="p-2.5">
						<button
							type="button"
							onClick={() => add(createUploadedAttachment())}
							className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-border-bold bg-bg-neutral-subtle px-3 py-6 text-center transition-colors hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
						>
							<span className="text-icon-subtle">
								<UploadIcon label="" color="currentColor" />
							</span>
							<span className="text-sm font-medium text-text">Drop files or click to upload</span>
							<span className="text-xs text-text-subtlest">Files attach directly to this work item</span>
						</button>
					</TabsContent>

					<TabsContent value="link" className="flex max-h-[24rem] flex-col gap-2.5 overflow-y-auto p-2.5">
						<div className="flex flex-col gap-1">
							<PopoverSubmitField
								ariaLabel="Search content or paste a link"
								leading={
								<span className="shrink-0 pl-1 text-icon-subtlest">
										<SearchIcon label="" color="currentColor" />
									</span>
								}
								onChange={setQuery}
								onSubmit={() => add(createLinkedContentAttachment(query, displayName))}
								placeholder="Search content or paste a link"
								submitLabel="Attach this link"
								value={query}
							/>
							<span id={searchHintId} className="sr-only">
								Press Enter to attach the pasted link.
							</span>
						</div>

						<div className="flex flex-col gap-1">
							<Label htmlFor={displayNameId}>Display name (optional)</Label>
							<Input
								id={displayNameId}
								value={displayName}
								onChange={(event) => setDisplayName(event.target.value)}
							/>
						</div>

						<section className="flex flex-col gap-0.5">
							<h3 className={CONTEXT_POPOVER_SECTION_HEADING_CLASS}>{trimmedQuery ? "Results" : "Recently viewed"}</h3>
							{recent.length > 0 ? (
								recent.map((attachment) => (
									<AttachmentResultItem key={attachment.id} attachment={attachment} onSelect={() => add({ ...attachment })} />
								))
							) : (
								<p className="px-2 py-2 text-sm text-text-subtlest">No matching content. Press Enter to attach it as a link.</p>
							)}
						</section>

						{suggested.length > 0 ? (
							<SuggestionPanel title={`${suggested.length} suggested ${suggested.length === 1 ? "attachment" : "attachments"}`}>
								{suggested.map((attachment) => (
									<AttachmentResultItem
										key={attachment.id}
										attachment={attachment}
										onSelect={() => add({ ...attachment })}
									/>
								))}
							</SuggestionPanel>
						) : null}
					</TabsContent>

					<TabsContent value="create" className="flex flex-col gap-0.5 p-2.5">
						{ATTACHMENT_CREATE_OPTIONS.map((option) => {
							const { Glyph, tone } = CREATE_OPTION_ICON[option.id];
							return (
								<button
									key={option.id}
									type="button"
									onClick={() => add(createCreatedAttachment(option))}
									className={CONTEXT_POPOVER_ROW_CLASS}
								>
									<span className={cn("shrink-0", tone)}>
										<Glyph label="" color="currentColor" />
									</span>
									<span className="min-w-0 flex-1 truncate">{option.label}</span>
								</button>
							);
						})}
					</TabsContent>
				</Tabs>
			</PopoverContent>
		</Popover>
	);
}
