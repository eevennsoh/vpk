"use client";

import { useId, useState } from "react";
import EditIcon from "@atlaskit/icon/core/edit";
import LinkIcon from "@atlaskit/icon/core/link";
import PinIcon from "@atlaskit/icon/core/pin";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";
import type {
	JiraActivityCommentEntry,
	JiraActivityEntry,
	JiraActivityReply,
} from "@/components/blocks/jira-activity";
import { jiraActivitySegmentsToPlainText } from "@/components/blocks/jira-activity";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/elapsed-time";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ContextDescriptionEditor } from "@/components/blocks/jira-work-item/team-eu26/components/context-description-editor";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { describeRelativeTimeLabel, toCompactRelativeTimeLabel } from "@/lib/elapsed-time";

function commentLink(id: string) {
	return `${location.origin}${location.pathname}#comment-${encodeURIComponent(id)}`;
}

export function ProjectButterTimestamp({
	item,
}: Readonly<{ item: JiraActivityEntry | JiraActivityReply }>) {
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const tooltipId = useId();
	const parsedLabel = Date.parse(item.timestamp.replace(" at ", " "));
	const parsed = Number.isFinite(parsedLabel) ? parsedLabel : item.createdAtMs ?? Number.NaN;
	const hasExactTime = Number.isFinite(parsed);
	const formatted = hasExactTime
		? new Intl.DateTimeFormat("en-US", {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone: "Asia/Kuala_Lumpur",
			}).format(new Date(parsed))
		: undefined;
	if (!item.timestamp) return null;
	const relativeLabel = describeRelativeTimeLabel(item.timestamp, parsed)
		?? (hasExactTime ? <RelativeTime format="long" timestampMs={parsed} /> : item.timestamp);
	const visibleTimestamp = Number.isFinite(parsedLabel)
		? <RelativeTime format="compact" timestampMs={parsed} />
		: <time dateTime={hasExactTime ? new Date(parsed).toISOString() : undefined}>{toCompactRelativeTimeLabel(item.timestamp)}</time>;
	const triggerClassName = "whitespace-nowrap rounded-sm underline-offset-2 outline-none hover:text-text hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring";
	return (
		<Tooltip onOpenChange={setTooltipOpen} open={tooltipOpen}>
			<TooltipTrigger render={<span aria-describedby={tooltipOpen ? tooltipId : undefined} className={triggerClassName} tabIndex={0} />}>
				{visibleTimestamp}
			</TooltipTrigger>
			<TooltipContent id={tooltipId} positionerClassName="z-[650]" role="tooltip" side="bottom">Last run {relativeLabel}{formatted ? <> · {formatted}</> : null}</TooltipContent>
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
			<TooltipTrigger render={<Button aria-label={label} aria-pressed={pinned} className="order-last" data-persistent-activity-action={pinned ? "" : undefined} onClick={onToggle} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost" />}>
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
