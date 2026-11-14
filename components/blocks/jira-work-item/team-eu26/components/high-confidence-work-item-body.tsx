"use client";

import { useState, type ReactNode } from "react";
import FilesIcon from "@atlaskit/icon/core/files";
import ImageIcon from "@atlaskit/icon/core/image";
import LinkIcon from "@atlaskit/icon/core/link";
import PageIcon from "@atlaskit/icon/core/page";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import VideoIcon from "@atlaskit/icon/core/video";

import { WorkItemsTable } from "@/components/blocks/jira-work-item/team-eu26/components/work-items-table";
import { CollapsibleWorkItemSection } from "@/components/blocks/jira-work-item/team-eu26/components/collapsible-work-item-section";
import {
	WORK_ITEM_TABLE_BODY_ROW_CLASS,
	WORK_ITEM_TABLE_CELL_CLASS,
	WORK_ITEM_TABLE_CLASS,
	WORK_ITEM_TABLE_CONTAINER_CLASS,
	WORK_ITEM_TABLE_HEADER_CLASS,
	WORK_ITEM_TABLE_HEADER_ROW_CLASS,
	WORK_ITEM_TABLE_HEAD_CLASS,
} from "@/components/blocks/jira-work-item/team-eu26/components/work-item-table-styles";
import { ContextEditableDescription } from "@/components/blocks/jira-work-item/team-eu26/components/context-editable-header";
import {
	TEAM_EU26_ATTACHMENTS,
	TEAM_EU26_LINKED_ITEMS,
	TEAM_EU26_SUBITEMS,
	type TeamEu26Attachment,
	type TeamEu26AttachmentKind,
	type TeamEu26TableWorkItem,
} from "@/components/blocks/jira-work-item/team-eu26/data/high-confidence-work-item";
import { toWorkItemChildItems } from "@/components/blocks/jira-work-item/team-eu26/lib/child-items-progress";
import { ChildItemsProgressBar } from "@/components/blocks/jira-work-item/components/work-item-modal/child-items-progress-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfluenceIcon, LoomIcon } from "@/components/ui/logo";
import { GoogleDriveLogo } from "@/components/ui/logo-third-party";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type AttachmentFilter = "all" | "file" | "image" | "link" | "video";

const ATTACHMENT_FILTERS: readonly {
	icon?: ReactNode;
	label: string;
	value: AttachmentFilter;
}[] = [
	{ label: "All", value: "all" },
	{ icon: <FilesIcon label="" size="small" />, label: "Files", value: "file" },
	{ icon: <ImageIcon label="" size="small" />, label: "Images", value: "image" },
	{ icon: <VideoIcon label="" size="small" />, label: "Videos", value: "video" },
	{ icon: <LinkIcon label="" size="small" />, label: "Links", value: "link" },
];

const LINK_ATTACHMENT_KINDS: readonly TeamEu26AttachmentKind[] = ["confluence", "google-drive", "loom"];

function initials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function attachmentMatchesFilter(attachment: TeamEu26Attachment, filter: AttachmentFilter): boolean {
	if (filter === "all") return true;
	if (filter === "link") return LINK_ATTACHMENT_KINDS.includes(attachment.kind);
	return attachment.kind === filter;
}

function AttachmentIcon({ attachment }: Readonly<{ attachment: TeamEu26Attachment }>) {
	if (attachment.kind === "confluence") return <ConfluenceIcon aria-hidden size="xxsmall" />;
	if (attachment.kind === "google-drive") return <GoogleDriveLogo aria-hidden borderless size="xxsmall" />;
	if (attachment.kind === "loom") return <LoomIcon aria-hidden size="xxsmall" />;
	if (attachment.kind === "image") return <ImageIcon label="" size="small" />;
	if (attachment.kind === "video") return <VideoIcon label="" size="small" />;
	return <PageIcon label="" size="small" />;
}

function AttachmentPanel({
	filter,
	onShowAllChange,
	showAll,
}: Readonly<{
	filter: AttachmentFilter;
	onShowAllChange: () => void;
	showAll: boolean;
}>) {
	const filteredAttachments = TEAM_EU26_ATTACHMENTS.filter((attachment) =>
		attachmentMatchesFilter(attachment, filter),
	);
	const visibleAttachments = showAll ? filteredAttachments : filteredAttachments.slice(0, 5);

	return (
		<>
			<div className={WORK_ITEM_TABLE_CONTAINER_CLASS}>
				<Table className={WORK_ITEM_TABLE_CLASS}>
					<TableHeader className={WORK_ITEM_TABLE_HEADER_CLASS}>
						<TableRow className={WORK_ITEM_TABLE_HEADER_ROW_CLASS}>
							<TableHead className={cn(WORK_ITEM_TABLE_HEAD_CLASS, "w-auto")}>Name</TableHead>
							<TableHead className={cn(WORK_ITEM_TABLE_HEAD_CLASS, "w-36")}>Date added</TableHead>
							<TableHead className={cn(WORK_ITEM_TABLE_HEAD_CLASS, "w-32")}>Added by</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{visibleAttachments.map((attachment) => (
							<TableRow className={WORK_ITEM_TABLE_BODY_ROW_CLASS} key={attachment.id}>
								<TableCell className={cn(WORK_ITEM_TABLE_CELL_CLASS, "overflow-hidden")}>
									<a className="flex min-w-0 items-center gap-2 text-text hover:underline" href={`#attachment-${attachment.id}`}>
										<span aria-hidden className="flex size-6 shrink-0 items-center justify-center text-icon-information"><AttachmentIcon attachment={attachment} /></span>
										<span className="min-w-0 truncate text-sm text-text">{attachment.name}</span>
									</a>
								</TableCell>
								<TableCell className={WORK_ITEM_TABLE_CELL_CLASS}>{attachment.dateAdded}</TableCell>
								<TableCell className={WORK_ITEM_TABLE_CELL_CLASS}>
									<Avatar animate={false} label={attachment.addedBy} size="sm"><AvatarFallback>{initials(attachment.addedBy)}</AvatarFallback></Avatar>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			{filteredAttachments.length > 5 ? (
				<Button className="h-auto px-0 text-text-subtle" onClick={onShowAllChange} size="compact" type="button" variant="link">
					{showAll ? "Show fewer attachments" : "Show more attachments"}
				</Button>
			) : null}
		</>
	);
}

export function HighConfidenceWorkItemBody() {
	const [attachmentFilter, setAttachmentFilter] = useState<AttachmentFilter>("all");
	const [showAllAttachments, setShowAllAttachments] = useState(false);
	const [showAllLinkedItems, setShowAllLinkedItems] = useState(false);
	const [announcement, setAnnouncement] = useState("");
	const [statuses, setStatuses] = useState<Record<string, TeamEu26TableWorkItem["status"]>>(() =>
		Object.fromEntries(
			[...TEAM_EU26_SUBITEMS, ...TEAM_EU26_LINKED_ITEMS].map((item) => [item.key, item.status]),
		),
	);
	const childItems = toWorkItemChildItems(TEAM_EU26_SUBITEMS, statuses);
	const visibleLinkedItems = showAllLinkedItems ? TEAM_EU26_LINKED_ITEMS : TEAM_EU26_LINKED_ITEMS.slice(0, 1);

	return (
		<article aria-label="Team EU26 work item content" className="flex min-w-0 flex-col gap-4" data-team-eu26-high-confidence-body>
			<p aria-live="polite" className="sr-only">{announcement}</p>
			<CollapsibleWorkItemSection headingId="team-eu26-description-heading" label="Description">
				<ContextEditableDescription />
			</CollapsibleWorkItemSection>

			<Tabs
				className="gap-2"
				onValueChange={(value) => value ? setAttachmentFilter(value as AttachmentFilter) : undefined}
				value={attachmentFilter}
			>
				<CollapsibleWorkItemSection
					actions={() => (
						<>
							<TabsList aria-label="Filter attachments" size="default" variant="default">
								{ATTACHMENT_FILTERS.map((filter) => (
									<TabsTrigger
										aria-label={filter.icon ? filter.label : undefined}
										key={filter.value}
										value={filter.value}
									>
										{filter.icon ?? filter.label}
									</TabsTrigger>
								))}
							</TabsList>
							<Button aria-label="More attachment actions" onClick={() => setAnnouncement("Attachment actions opened")} size="icon" type="button" variant="ghost">
								<ShowMoreHorizontalIcon label="" size="small" />
							</Button>
						</>
					)}
					headingId="team-eu26-attachments-heading"
					label="Attachments"
				>
					{ATTACHMENT_FILTERS.map((filter) => (
						<TabsContent className="space-y-2" key={filter.value} value={filter.value}>
							<AttachmentPanel
								filter={filter.value}
								onShowAllChange={() => setShowAllAttachments((current) => !current)}
								showAll={showAllAttachments}
							/>
						</TabsContent>
					))}
				</CollapsibleWorkItemSection>
			</Tabs>

			<CollapsibleWorkItemSection
				headingId="team-eu26-subtasks-heading"
				label="Subtasks"
				trailingAction={<Button aria-label="Show subtask actions" onClick={() => setAnnouncement("Subtask actions opened")} size="icon-compact" type="button" variant="ghost"><ShowMoreHorizontalIcon label="" size="small" /></Button>}
			>
				<ChildItemsProgressBar items={childItems} />
				<WorkItemsTable aria-label="Subitems" items={TEAM_EU26_SUBITEMS} onStatusChange={(key, status) => setStatuses((current) => ({ ...current, [key]: status }))} statuses={statuses} />
			</CollapsibleWorkItemSection>

			<CollapsibleWorkItemSection
				headingId="team-eu26-linked-heading"
				label="Linked work items"
				trailingAction={(
					<Button aria-label={showAllLinkedItems ? "Show fewer linked work items" : "Show more linked work items"} onClick={() => setShowAllLinkedItems((current) => !current)} size="icon-compact" type="button" variant="ghost">
						<ShowMoreHorizontalIcon label="" size="small" />
					</Button>
				)}
			>
				<WorkItemsTable aria-label="Linked work items" items={visibleLinkedItems} onStatusChange={(key, status) => setStatuses((current) => ({ ...current, [key]: status }))} relationship statuses={statuses} />
			</CollapsibleWorkItemSection>
		</article>
	);
}
