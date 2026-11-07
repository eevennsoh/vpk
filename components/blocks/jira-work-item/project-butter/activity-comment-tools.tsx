"use client";

import { useId, useState } from "react";
import EditIcon from "@atlaskit/icon/core/edit";
import LinkIcon from "@atlaskit/icon/core/link";
import PinIcon from "@atlaskit/icon/core/pin";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import type {
	JiraActivityCommentEntry,
	JiraActivityEntry,
	JiraActivityReply,
} from "@/components/blocks/jira-activity";
import { jiraActivitySegmentsToPlainText } from "@/components/blocks/jira-activity";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContextDescriptionEditor } from "@/components/blocks/jira-work-item/team-eu26/components/context-description-editor";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

function commentLink(id: string) {
	return `${location.origin}${location.pathname}#comment-${encodeURIComponent(id)}`;
}

export function ProjectButterTimestamp({
	item,
}: Readonly<{ item: JiraActivityEntry | JiraActivityReply }>) {
	const [full, setFull] = useState(false);
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const tooltipId = useId();
	const parsed = item.createdAtMs ?? Date.parse(item.timestamp.replace(" at ", " "));
	const formatted = Number.isFinite(parsed)
		? new Intl.DateTimeFormat("en-US", {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone: "Asia/Kuala_Lumpur",
			}).format(new Date(parsed))
		: item.timestamp;
	const detailed = Number.isFinite(parsed)
		? new Intl.DateTimeFormat("en-US", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hourCycle: "h23",
				timeZone: "Asia/Kuala_Lumpur",
				timeZoneName: "short",
			}).format(new Date(parsed))
		: item.timestamp;
	const visibleTimestamp = full ? formatted : item.timestamp;
	const showTooltip = tooltipOpen && !full && Number.isFinite(parsed);
	if (!item.timestamp) return null;
	return (
		<Tooltip disabled={full || !Number.isFinite(parsed)} onOpenChange={setTooltipOpen} open={showTooltip}>
			<TooltipTrigger
				render={<button
					aria-describedby={showTooltip ? tooltipId : undefined}
					aria-label={`${visibleTimestamp}. Show ${full ? "relative" : "full"} timestamp`}
					aria-pressed={full}
					className="whitespace-nowrap rounded-sm text-xs font-normal text-text-subtle outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
					onClick={() => setFull((value) => !value)}
					type="button"
				/>}
			>
				<time dateTime={Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined}>{visibleTimestamp}</time>
			</TooltipTrigger>
			<TooltipContent id={tooltipId} positionerClassName="z-[650]" role="tooltip" side="bottom">{detailed}</TooltipContent>
		</Tooltip>
	);

}

export function ProjectButterCopyCommentLink({ id }: Readonly<{ id: string }>) {
	const [copied, setCopied] = useState(false);
	return (
		<Button
			aria-label={copied ? "Comment link copied" : "Copy link to comment"}
			onClick={() => {
				void navigator.clipboard.writeText(commentLink(id)).then(() => setCopied(true));
			}}
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			<LinkIcon label="" size="small" />
		</Button>
	);
}

/** Pins a top-level comment to the head of the feed; pressed while pinned. */
export function ProjectButterPinComment({ pinned, onToggle }: Readonly<{ pinned: boolean; onToggle: () => void }>) {
	const label = pinned ? "Unpin comment" : "Pin comment";
	return (
		<Tooltip>
			<TooltipTrigger render={<Button aria-label={label} aria-pressed={pinned} onClick={onToggle} size="icon-compact" type="button" variant="ghost" />}>
				{pinned ? <PinFilledIcon label="" size="small" /> : <PinIcon label="" size="small" />}
			</TooltipTrigger>
			<TooltipContent positionerClassName="z-[650]">{label}</TooltipContent>
		</Tooltip>
	);
}

export function ProjectButterCommentTools({
	entry,
	reply,
	content,
}: Readonly<{
	entry: JiraActivityCommentEntry;
	reply?: JiraActivityReply;
	content: ProjectButterContent;
}>) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const original = reply ? reply.body : jiraActivitySegmentsToPlainText(entry.body);
	const editable = (reply?.actor ?? entry.actor).name === content.currentUser.name;
	const id = reply?.id ?? entry.id;
	function save() {
		if (!draft.trim()) return;
		content.setActivityEntries((entries) =>
			entries.map((item) =>
				item.id !== entry.id || item.kind !== "comment"
					? item
					: reply
						? {
								...item,
								replies: item.replies?.map((candidate) =>
									candidate.id === reply.id ? { ...candidate, body: draft.trim() } : candidate,
								),
							}
						: { ...item, body: [{ type: "text", text: draft.trim() }] },
			),
		);
		content.recordAudit("Comment", original, draft.trim());
		setEditing(false);
	}
	function remove() {
		content.setActivityEntries((entries) =>
			reply
				? entries.map((item) =>
						item.id !== entry.id || item.kind !== "comment"
							? item
							: {
									...item,
									replies: item.replies?.filter((candidate) => candidate.id !== reply.id),
								},
					)
				: entries.filter((item) => item.id !== entry.id),
		);
		content.recordAudit("Comment", original, "Removed");
	}
	return (
		<>
			{editable ? (
				<Button
					aria-label="Edit comment"
					onClick={() => {
						setDraft(original);
						setEditing(true);
					}}
					size="icon-compact"
					type="button"
					variant="ghost"
				>
					<EditIcon label="" size="small" />
				</Button>
			) : null}
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							aria-label="More comment actions"
							className="[&_svg]:text-icon-subtle aria-expanded:[&_svg]:text-icon-subtle"
							size="icon-compact"
							type="button"
							variant="ghost"
						/>
					}
				>
					<ShowMoreHorizontalIcon label="" size="small" />
				</DropdownMenuTrigger>
				<DropdownMenuContent positionerClassName="z-[650]">
					<DropdownMenuItem
						onSelect={() => {
							void navigator.clipboard.writeText(commentLink(id));
						}}
					>
						Copy link to comment
					</DropdownMenuItem>
					{editable ? (
						<DropdownMenuItem onSelect={remove} variant="destructive">
							Delete comment
						</DropdownMenuItem>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog onOpenChange={setEditing} open={editing}>
				<DialogContent
					className="z-[701]"
					overlayProps={{ forceRender: true, className: "z-[700]" }}
					size="md"
				>
					<DialogTitle>Edit comment</DialogTitle>
					<DialogDescription>Update your comment on this work item.</DialogDescription>
					<ContextDescriptionEditor
						aria-label="Edit comment body"
						onMarkdownChange={setDraft}
						value={draft}
					/>
					<div className="flex justify-end gap-2">
						<Button onClick={() => setEditing(false)} type="button" variant="ghost">
							Cancel
						</Button>
						<Button disabled={!draft.trim()} onClick={save} type="button">
							Save comment
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
