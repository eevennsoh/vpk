"use client";

import { useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import AiGenerativeTextSummaryIcon from "@atlaskit/icon/core/ai-generative-text-summary";
import { JiraActivityEntryGlyph, type JiraActivityActor, type JiraActivityCommentEntry, type JiraActivityReply } from "@/components/blocks/jira-activity";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ThreadSummary = Readonly<{ text: string; fixtureReplyCount: number }>;
export const SESSION_THREAD_RAIL = [
	"[&_[data-jira-activity-thread-stem]]:bg-transparent",
	"[&_[data-jira-activity-thread-stem]]:[background-image:repeating-linear-gradient(to_bottom,var(--ds-border)_0_2px,transparent_2px_5px)]",
	"[&_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:bg-transparent",
	"[&_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:[background-image:repeating-linear-gradient(to_bottom,var(--ds-border)_0_2px,transparent_2px_5px)]",
	"[&_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:[mask-image:linear-gradient(to_bottom,black,transparent)]",
	"[&_[data-jira-activity-replies-disclosure]:has(>div>button[aria-expanded=true])]:pb-1",
	"[&_[data-jira-activity-replies-disclosure]:has(>div>button[aria-expanded=true])>[data-jira-activity-thread-continuation]]:[mask-image:none]",
].join(" ");
export const SUMMARY_TRANSITION = "[&_[data-jira-activity-thread-stem]]:transition-opacity [&_[data-jira-activity-thread-stem]]:duration-slow [&_[data-jira-activity-thread-stem]]:motion-reduce:transition-none [&_[data-slot=jira-activity-comment-header]]:transition-[padding] [&_[data-slot=jira-activity-comment-header]]:duration-slow [&_[data-slot=jira-activity-comment-header]]:ease-out-practical [&_[data-slot=jira-activity-comment-header]]:motion-reduce:transition-none";
export const SUMMARIZED_THREAD = "[&_[data-slot=jira-activity-comment-header]]:ps-(--summary-header-inset) [&_[data-jira-activity-thread-stem]]:opacity-60 [&_[data-jira-activity-thread-stem]]:[mask-image:linear-gradient(to_bottom,black_20%,transparent)]";
const FOLD_TRANSITION = "grid transition-[grid-template-rows,opacity] duration-slow ease-out-practical motion-reduce:transition-none";
const AVATAR_SIZE = 24;
const AVATAR_STEP = 16;

function threadParticipants(entry: JiraActivityCommentEntry) {
	const author = entry.attributedBy;
	const participants: JiraActivityActor[] = [entry.actor];
	if (author) participants.push({ id: author.name, name: author.name, avatarSrc: author.avatarSrc, kind: "person" });
	for (const { actor } of entry.replies ?? []) {
		if (!participants.some((participant) => participant.id === actor.id || participant.name === actor.name)) participants.push(actor);
	}
	return participants;
}

function ThreadHeaderAvatars({ participants, width, avatar, summarized }: Readonly<{
	participants: readonly JiraActivityActor[];
	width: number;
	avatar: ReactNode;
	summarized: boolean;
}>) {
	const shown = participants.slice(0, 4);
	return (
		<div className="relative flex size-8 items-center justify-center">
			<div aria-hidden={summarized} className={cn("transition-[opacity,scale] duration-slow ease-out-practical motion-reduce:transition-none", summarized ? "scale-75 opacity-0" : null)}>
				{avatar}
			</div>
			<div
				aria-hidden={!summarized}
				aria-label={summarized ? `Thread participants: ${participants.map(({ name }) => name).join(", ")}` : undefined}
				role="img"
				data-summary-avatar-stack
				className="pointer-events-none absolute inset-y-0 left-0 flex items-center"
				style={{ width }}
			>
				{shown.map((actor, index) => (
					<span
						key={actor.id}
						style={{ "--summary-avatar-offset": `${index * AVATAR_STEP}px`, zIndex: shown.length - index } as CSSProperties}
						className={cn(
							"absolute flex size-6 items-center justify-center rounded-full bg-surface ring-1 ring-surface transition-[translate,scale,opacity] duration-slow ease-out-practical motion-reduce:transition-none",
							"translate-x-(--summary-avatar-offset)",
							summarized ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-75 opacity-0",
						)}
					>
						<JiraActivityEntryGlyph actor={actor} animate={false} sizePx={AVATAR_SIZE} />
					</span>
				))}
			</div>
		</div>
	);
}

export function useWorkItemThreadSummary(entry: JiraActivityCommentEntry | undefined) {
	const [snapshot, setSnapshot] = useState<readonly JiraActivityReply[] | null>(null);
	const sources = snapshot === entry?.replies ? snapshot : null;
	const participants = entry ? threadParticipants(entry) : [];
	const avatarWidth = AVATAR_SIZE + Math.max(0, Math.min(participants.length, 4) - 1) * AVATAR_STEP;
	const restoreButton = useRef<HTMLButtonElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const summaryId = useId();

	return {
		summarized: sources !== null,
		headerInset: Math.max(0, avatarWidth - 32),
		renderAvatar(_entry: JiraActivityCommentEntry, avatar: ReactNode) {
			return <ThreadHeaderAvatars participants={participants} width={avatarWidth} avatar={avatar} summarized={sources !== null} />;
		},
		renderAction(replies: readonly JiraActivityReply[]) {
			if (!replies.length) return null;
			return (
				<Tooltip>
					<TooltipTrigger render={
						<Button
							ref={trigger}
							type="button"
							size="icon-compact"
							variant="ghost"
							selectedAppearance="icon-only"
							aria-label="Summarize thread"
							aria-controls={summaryId}
							aria-expanded={sources !== null}
							onClick={() => {
								setSnapshot(replies);
								requestAnimationFrame(() => restoreButton.current?.focus({ preventScroll: true }));
							}}
						/>
					}>
						<AiGenerativeTextSummaryIcon label="" size="small" />
					</TooltipTrigger>
					<TooltipContent>Summarize thread</TooltipContent>
				</Tooltip>
			);
		},
		renderReplies(replies: ReactNode, expandReplies: () => void, summary: ThreadSummary, onDraft?: (sources: readonly JiraActivityReply[]) => void) {
			return (
				<div className="grid">
					<div
						inert={sources !== null}
						aria-hidden={sources !== null}
						className={cn(FOLD_TRANSITION, sources ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]")}
					>
						<div className="min-h-0" style={{ overflow: sources ? "clip" : undefined }}>{replies}</div>
					</div>
					<div
						id={summaryId}
						inert={sources === null}
						aria-hidden={sources === null}
						className={cn(FOLD_TRANSITION, sources ? "grid-rows-[1fr]" : "grid-rows-[0fr] opacity-0")}
					>
						<div className="min-h-0 overflow-clip">
							<div className="mt-3 grid gap-2 rounded-lg bg-bg-neutral-subtle p-3">
								<div className="flex items-center gap-2 text-sm font-medium">
									<AiGenerativeTextSummaryIcon label="" size="small" />
									Thread summary
								</div>
								<p className="text-sm text-text">{summary.text}</p>
								{sources && sources.length > summary.fixtureReplyCount ? (
									<ul className="grid gap-1 text-sm text-text">
										{sources.slice(summary.fixtureReplyCount).map((reply) => (
											<li key={reply.id}><strong>{reply.actor.name}</strong> · {reply.body}</li>
										))}
									</ul>
								) : null}
								<div className="flex flex-wrap items-center gap-2">
									<Button ref={restoreButton} size="compact" variant="outline" onClick={() => {
										expandReplies();
										setSnapshot(null);
										requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
									}}>Show replies</Button>
									{onDraft && sources ? <Button size="compact" variant="outline" onClick={() => onDraft(sources)}>Draft instruction</Button> : null}
								</div>
							</div>
						</div>
					</div>
				</div>
			);
		},
	};
}
