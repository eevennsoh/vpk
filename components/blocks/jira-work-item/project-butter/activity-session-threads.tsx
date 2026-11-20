"use client";

import { useId, useState, type ComponentProps, type CSSProperties } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { getAgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import { matchingAgentSessions } from "@/components/blocks/agent-assignment/components/session-choice-items";
import { getTeammateSessionPeople, TeammateSessionAvatars } from "@/components/blocks/agent-assignment/components/teammate-session-avatars";
import { JiraActivity, JiraActivityEntryGlyph, type JiraActivityCommentEntry, type JiraActivityReply } from "@/components/blocks/jira-activity";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ProjectButterSessionStart } from "./activity-session-start";
import { SESSION_THREAD_RAIL, SUMMARIZED_THREAD, SUMMARY_TRANSITION, useWorkItemThreadSummary } from "./activity-thread-summary";
import type { ProjectButterSessionItem } from "./data";

type SessionThread = Readonly<{ entry: JiraActivityCommentEntry; session: ProjectButterSessionItem }>;
type DraftInstruction = (thread: SessionThread, text: string) => void;
type ThreadProps = Pick<ComponentProps<typeof JiraActivity>, "actors" | "currentUser" | "onEntriesChange" | "onSelectReply" | "renderCommentTools" | "renderReplyBody" | "renderTimestamp" | "selectedReply">;

function summarizeReplies(replies: readonly JiraActivityReply[]) {
	if (["onboarding-cursor-reply-1", "onboarding-cursor-reply-2", "onboarding-cursor-reply-3", "onboarding-cursor-reply-4", "onboarding-cursor-reply-5"].every((id, index) => replies[index]?.id === id)) {
		return {
			text: "Annie asked Cursor to check account setup and keyboard navigation. Cursor found that the validation messages need recovery instructions and the error summary needs focus. Annie agreed to include both fixes in the next pass.",
			fixtureReplyCount: 5,
		};
	}
	return {
		text: replies.slice(0, 1).map((reply) => `${reply.actor.name}: ${reply.body}`).join(""),
		fixtureReplyCount: 1,
	};
}

function SessionThreadCard({ thread, onDraft, onOpenSession, latestReplyEntryId, ...activity }: ThreadProps & Readonly<{
	thread: SessionThread;
	onDraft?: DraftInstruction;
	onOpenSession: (id: string) => void;
	latestReplyEntryId?: string | null;
}>) {
	const { entry, session } = thread;
	const summary = useWorkItemThreadSummary(entry);
	const canDraft = onDraft && matchingAgentSessions({ id: session.agent.id ?? session.id, name: session.agent.name }, [session], { includeCompleted: true }).length > 0;
	const previewLatest = latestReplyEntryId === entry.id;

	return (
		<div style={{ "--summary-header-inset": `${summary.summarized ? summary.headerInset : 0}px` } as CSSProperties}>
			<JiraActivity
				{...activity}
				className={cn(SESSION_THREAD_RAIL, SUMMARY_TRANSITION, summary.summarized && SUMMARIZED_THREAD)}
				entries={[{ ...entry, defaultRepliesExpanded: false, replyPreviewCount: previewLatest ? 1 : 0 }]}
				activeEntryId={activity.selectedReply?.entryId}
				composer={null}
				hideHeader
				connectorStyle="thread"
				commentHeaderLayout="inline"
				commentActionsPlacement="hover"
				earlierRepliesSelectedAppearance="icon-only"
				renderCommentBody={() => <ProjectButterSessionStart onOpen={onOpenSession} session={session} />}
				renderCommentAvatar={summary.renderAvatar}
				renderCommentTools={(entry, reply) => (
					<>
						{activity.renderCommentTools?.(entry, reply)}
						{reply ? null : summary.renderAction(entry.replies ?? [])}
					</>
				)}
				renderCommentReplies={(_entry, replies, expand) => summary.renderReplies(replies, expand, summarizeReplies(entry.replies ?? []), canDraft ? (sources) => {
					const recap = summarizeReplies(sources);
					const context = [recap.text, ...sources.slice(recap.fixtureReplyCount).map((reply) => `${reply.actor.name}: ${reply.body}`)].join("\n\n");
					onDraft(thread, `Follow up on the work-item discussion:\n\n${context}\n\nAddress the agreed changes and report what you verified. Flag any open questions before proceeding.`);
				} : undefined)}
				renderEarlierRepliesLabel={(replies, expanded) => expanded ? "Hide replies" : (
					<>
						<span aria-hidden className="flex gap-0.5">
							{[...new Map(replies.map((reply) => [reply.actor.id, reply.actor])).values()].slice(-3).reverse().map((actor) => (
								<JiraActivityEntryGlyph actor={actor} animate={false} key={actor.id} />
							))}
						</span>
						<span>{previewLatest ? "Show " : ""}{replies.length}{previewLatest ? " more" : ""} {replies.length === 1 ? "reply" : "replies"}</span>
					</>
				)}
			/>
		</div>
	);
}

export function ProjectButterActivitySessionThreads({ entries, sessions, ...props }: ThreadProps & Readonly<{
	entries: readonly SessionThread[];
	sessions: readonly ProjectButterSessionItem[];
	onDraft?: DraftInstruction;
	onOpenSession: (id: string) => void;
	latestReplyEntryId?: string | null;
}>) {
	const [expanded, setExpanded] = useState(true);
	const id = useId();
	const mine = entries.filter(({ session }) => getAgentSessionRole(session) === "owner");
	const teammates = entries.filter(({ session }) => getAgentSessionRole(session) !== "owner");
	const teammatesSessions = teammates.map(({ session }) => session);
	const people = getTeammateSessionPeople(teammatesSessions);
	return (
		<div className="grid gap-3">
			{mine.map((thread) => <SessionThreadCard key={thread.entry.id} thread={thread} {...props} />)}
			{teammates.length ? (
				<div>
					<Button
						aria-controls={id}
						aria-expanded={expanded}
						className="gap-2 border-0 ps-0 pe-2"
						onClick={() => setExpanded((open) => !open)}
						selectedAppearance="icon-only"
						variant="ghost"
					>
						<span className="flex min-w-8 shrink-0 justify-center"><TeammateSessionAvatars items={teammatesSessions} /></span>
						{people.size === 1 ? "Using an agent" : "Using agents"}
						<Icon className={expanded ? "rotate-90" : undefined} render={<ChevronRightIcon label="" size="small" />} />
					</Button>
					<div className={expanded ? "grid gap-3 pt-3" : undefined} hidden={!expanded} id={id}>
						{teammates.map((thread) => <SessionThreadCard key={thread.entry.id} thread={thread} {...props} />)}
					</div>
				</div>
			) : null}
			{!entries.length ? <p className="py-2 text-sm text-text-subtle">{sessions.length ? "No session activity yet" : "No agent sessions yet"}</p> : null}
		</div>
	);
}
