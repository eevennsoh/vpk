"use client";

import { useCallback, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import AiGenerativeTextSummaryIcon from "@atlaskit/icon/core/ai-generative-text-summary";
import { JiraActivityEntryGlyph, type JiraActivityActor, type JiraActivityCommentEntry, type JiraActivityReply } from "@/components/blocks/jira-activity";
import { activityActorVpkLogo } from "@/components/blocks/jira-activity/jira-activity-actor-mention";
import { SuggestionRainbowText } from "@/components/blocks/jira-work-item/project-butter/suggestion-rainbow-text";
import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/elapsed-time";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motionDuration } from "@/lib/motion";
import { formatDetailedTimestamp } from "@/lib/format-detailed-timestamp";
import { cn } from "@/lib/utils";

export type ThreadSummary = Readonly<{ text: string; fixtureReplyCount: number }>;
export function summarizeReplies(replies: readonly JiraActivityReply[]): ThreadSummary {
	if (["onboarding-cursor-reply-1", "onboarding-cursor-reply-2", "onboarding-cursor-reply-3", "onboarding-cursor-reply-4", "onboarding-cursor-reply-5"].every((id, index) => replies[index]?.id === id)) {
		return {
			text: "Annie asked Cursor to check account setup and keyboard navigation. Cursor found that the validation messages need recovery instructions and the error summary needs focus. Annie agreed to include both fixes in the next pass.",
			fixtureReplyCount: 5,
		};
	}
	return { text: replies.slice(0, 1).map((reply) => `${reply.actor.name}: ${reply.body}`).join(""), fixtureReplyCount: 1 };
}

export function draftThreadInstruction(sources: readonly JiraActivityReply[]) {
	const recap = summarizeReplies(sources);
	const context = [recap.text, ...sources.slice(recap.fixtureReplyCount).map((reply) => `${reply.actor.name}: ${reply.body}`)].join("\n\n");
	return `Follow up on the work-item discussion:\n\n${context}\n\nAddress the agreed changes and report what you verified. Flag any open questions before proceeding.`;
}
export const THREAD_DISCLOSURE_SPACING = "[&_[data-jira-activity-replies-disclosure]:has(>div>button[aria-expanded=true])]:pb-1";
const VISIBLE_REPLIES_THREAD_RAIL = [
	"[&_[data-jira-activity-entry-id]:has([aria-hidden=false]_[aria-label=Replies]:not([hidden])>div:not([hidden]))_[data-jira-activity-thread-stem]]:bg-bg-accent-gray-subtler",
	"[&_[data-jira-activity-entry-id]:has([aria-hidden=false]_[aria-label=Replies]:not([hidden])>div:not([hidden]))_[data-jira-activity-thread-stem]]:[background-image:none]",
	"[&_[data-jira-activity-entry-id]:has([aria-hidden=false]_[aria-label=Replies]:not([hidden])>div:not([hidden]))_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:bg-bg-accent-gray-subtler",
	"[&_[data-jira-activity-entry-id]:has([aria-hidden=false]_[aria-label=Replies]:not([hidden])>div:not([hidden]))_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:[background-image:none]",
	"[&_[data-jira-activity-entry-id]:has([aria-hidden=false]_[aria-label=Replies]:not([hidden])>div:not([hidden]))_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:[mask-image:none]",
].join(" ");
export const SESSION_THREAD_RAIL = [
	"[&_[data-jira-activity-thread-stem]]:bg-transparent",
	"[&_[data-jira-activity-thread-stem]]:[background-image:repeating-linear-gradient(to_bottom,var(--ds-border)_0_2px,transparent_2px_5px)]",
	"[&_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:bg-transparent",
	"[&_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:[background-image:repeating-linear-gradient(to_bottom,var(--ds-border)_0_2px,transparent_2px_5px)]",
	"[&_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:[mask-image:linear-gradient(to_bottom,black,transparent)]",
	THREAD_DISCLOSURE_SPACING,
	"[&_[data-jira-activity-replies-disclosure]:has(>div>button[aria-expanded=true])>[data-jira-activity-thread-continuation]]:[mask-image:none]",
	VISIBLE_REPLIES_THREAD_RAIL,
].join(" ");
export const PINNED_THREAD_RAIL = [
	"[&>div>ol>li:has(button[aria-label^=Unpin])]:mb-3",
	"[&>div>ol>li:has(button[aria-label^=Unpin])_[data-jira-activity-timeline-stem]]:hidden",
	"[&>div>ol>li:has(button[aria-label^=Unpin])_[data-jira-activity-thread-stem]]:bg-transparent",
	"[&>div>ol>li:has(button[aria-label^=Unpin])_[data-jira-activity-thread-stem]]:[background-image:repeating-linear-gradient(to_bottom,var(--ds-border)_0_2px,transparent_2px_5px)]",
	"[&>div>ol>li:has(button[aria-label^=Unpin])_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:bg-transparent",
	"[&>div>ol>li:has(button[aria-label^=Unpin])_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:[background-image:repeating-linear-gradient(to_bottom,var(--ds-border)_0_2px,transparent_2px_5px)]",
	"[&>div>ol>li:has(button[aria-label^=Unpin])_[data-jira-activity-replies-disclosure]>[data-jira-activity-thread-continuation]]:[mask-image:linear-gradient(to_bottom,black,transparent)]",
	"[&>div>ol>li:has(button[aria-label^=Unpin])_[data-jira-activity-replies-disclosure]:has(>div>button[aria-expanded=true])>[data-jira-activity-thread-continuation]]:[mask-image:none]",
	VISIBLE_REPLIES_THREAD_RAIL,
].join(" ");
export const SUMMARY_TRANSITION = "[&_[data-jira-activity-entry-id]:has([data-summary-inset])_[data-jira-activity-thread-stem]]:transition-opacity [&_[data-jira-activity-entry-id]:has([data-summary-inset])_[data-jira-activity-thread-stem]]:duration-slow [&_[data-jira-activity-entry-id]:has([data-summary-inset])_[data-jira-activity-thread-stem]]:motion-reduce:transition-none [&_[data-jira-activity-entry-id]:has([data-summary-avatar-stack])_[data-slot=jira-activity-comment-header]:not([data-jira-activity-reply-header])]:transition-[padding] [&_[data-jira-activity-entry-id]:has([data-summary-avatar-stack])_[data-slot=jira-activity-comment-header]:not([data-jira-activity-reply-header])]:duration-slow [&_[data-jira-activity-entry-id]:has([data-summary-avatar-stack])_[data-slot=jira-activity-comment-header]:not([data-jira-activity-reply-header])]:ease-out-practical [&_[data-jira-activity-entry-id]:has([data-summary-avatar-stack])_[data-slot=jira-activity-comment-header]:not([data-jira-activity-reply-header])]:motion-reduce:transition-none";
export const SUMMARIZED_THREAD = "[&_[data-slot=jira-activity-comment-header]:not([data-jira-activity-reply-header])]:ps-(--summary-header-inset) [&_[data-jira-activity-thread-stem]]:opacity-60 [&_[data-summary-thread-continuation]]:block";
const FOLD_TRANSITION = "transition-[grid-template-rows,opacity] duration-slow ease-out-practical motion-reduce:transition-none";
const AVATAR_SIZE = 24;
const AVATAR_STEP = 16;
const IDENTITY_MOTION = { durationMs: motionDuration.slow * 1000, pauseWhenOffscreen: false } as const;

function threadParticipants(entry: JiraActivityCommentEntry) {
	const author = entry.attributedBy;
	const participants: JiraActivityActor[] = [entry.actor];
	if (author) participants.push({ id: author.name, name: author.name, avatarSrc: author.avatarSrc, kind: "person" });
	for (const { actor } of entry.replies ?? []) {
		if (!participants.some((participant) => participant.id === actor.id || participant.name === actor.name)) participants.push(actor);
	}
	return participants;
}

function ThreadHeaderAvatars({ entry, participants, width, avatar, summarized }: Readonly<{
	entry: JiraActivityCommentEntry | undefined;
	participants: readonly JiraActivityActor[];
	width: number;
	avatar: ReactNode;
	summarized: boolean;
}>) {
	const shown = participants.slice(0, 4);
	const pair = entry?.actor.kind === "agent" && entry.attributedBy ? { agent: entry.actor, human: entry.attributedBy } : null;
	const [pairSettled, setPairSettled] = useState(false);
	if (!summarized && pairSettled) setPairSettled(false);
	const onPairSettled = useCallback(() => setPairSettled(true), []);
	const showParticipants = summarized && (!pair || pairSettled);
	return (
		<div className="relative flex size-8 items-center justify-center">
			{pair ? <>
				<span className="sr-only" role="img" aria-label={summarized ? undefined : `${pair.agent.name}, used by ${pair.human.name}`} aria-hidden={summarized} />
				<div aria-hidden className={cn("pointer-events-none absolute left-1 top-1 z-10 transition-transform duration-slow ease-in-out motion-reduce:transition-none", summarized ? "translate-x-1" : null)} data-summary-avatar-pair>
					<HumanAgentAvatar agent={{ name: pair.agent.name, appearance: pair.agent.appearance, avatarSrc: pair.agent.avatarSrc, brandName: pair.agent.brandName, vpkLogo: activityActorVpkLogo(pair.agent) }} human={pair.human} sizePx={24} groupSizePx={24} animate composition={summarized ? "horizontal-group" : "compact"} motion={IDENTITY_MOTION} onAnimationComplete={summarized ? onPairSettled : undefined} />
				</div>
			</> : <div aria-hidden={summarized} className={cn("transition-[opacity,scale] duration-slow ease-out-practical motion-reduce:transition-none", summarized ? "scale-75 opacity-0" : null)}>{avatar}</div>}
			<div
				aria-hidden={!summarized}
				aria-label={summarized ? `Thread participants: ${participants.map(({ name }) => name).join(", ")}` : undefined}
				role="img"
				data-summary-avatar-stack
				data-summary-inset={summarized ? Math.max(0, width - 32) : undefined}
				className="pointer-events-none absolute inset-y-0 left-0 flex items-center"
				style={{ width }}
			>
				{shown.map((actor, index) => pair && index < 2 ? null : (
					<span
						key={actor.id}
						style={{ "--summary-avatar-offset": `${index * AVATAR_STEP}px`, transitionDelay: showParticipants ? `${(index - (pair ? 2 : 0)) * motionDuration.xxshort}s` : undefined, zIndex: shown.length - index } as CSSProperties}
						className={cn(
							"absolute flex size-6 items-center justify-center rounded-full bg-surface ring-1 ring-surface",
							"transition-[translate,scale,opacity] duration-normal ease-out-practical motion-reduce:transition-none",
							showParticipants ? "translate-x-(--summary-avatar-offset) scale-100 opacity-100" : "translate-x-1 scale-75 opacity-0",
						)}
					>
						<JiraActivityEntryGlyph actor={actor} animate={false} sizePx={AVATAR_SIZE} />
					</span>
				))}
			</div>
		</div>
	);
}

type SummaryRun = Readonly<{ sources: readonly JiraActivityReply[]; runAtMs: number; showing: boolean; animate: boolean }>;
type AutoSummary = Readonly<{ entries: readonly JiraActivityCommentEntry[]; active: boolean; activatedAtMs: number; latestReplyEntryIds?: ReadonlySet<string> }>;

export function useWorkItemThreadSummaries(auto?: AutoSummary) {
	const [state, setState] = useState<Readonly<{ active: boolean; runs: ReadonlyMap<string, SummaryRun> }>>(() => ({ active: false, runs: new Map() }));
	const restoreButtons = useRef(new Map<string, HTMLButtonElement>());
	const triggers = useRef(new Map<string, HTMLButtonElement>());
	const idPrefix = useId();
	let runs = state.runs;
	if (auto) {
		const entered = auto.active && !state.active;
		let nextRuns: Map<string, SummaryRun> | undefined;
		if (auto.active) {
			for (const entry of auto.entries) {
				const replies = entry.replies ?? [];
				const previous = runs.get(entry.id);
				if (!replies.length) {
					if (previous) { nextRuns ??= new Map(runs); nextRuns.delete(entry.id); }
					continue;
				}
				const known = new Set(previous?.sources.map((reply) => reply.id) ?? []);
				const added = replies.filter((reply) => !known.has(reply.id));
				if (!previous || added.length) {
					const runAtMs = entered || !previous ? auto.activatedAtMs : Math.max(auto.activatedAtMs, ...added.map((reply) => reply.createdAtMs ?? auto.activatedAtMs));
					nextRuns ??= new Map(runs);
					const showSummary = entered || !auto.latestReplyEntryIds?.has(entry.id);
					nextRuns.set(entry.id, { sources: replies, runAtMs, showing: showSummary, animate: true });
				} else if (entered && !previous.showing) {
					nextRuns ??= new Map(runs);
					nextRuns.set(entry.id, { ...previous, showing: true });
				}
			}
			const ids = new Set(auto.entries.map((entry) => entry.id));
			for (const id of runs.keys()) if (!ids.has(id)) { nextRuns ??= new Map(runs); nextRuns.delete(id); }
		}
		if (nextRuns || state.active !== auto.active) {
			runs = nextRuns ?? runs;
			setState({ active: auto.active, runs });
		}
	}

	return function summaryFor(entry: JiraActivityCommentEntry | undefined, visible = true) {
		const entryId = entry?.id ?? "";
		const run = runs.get(entryId);
		const sources = run?.showing && (auto || run.sources === entry?.replies) ? run.sources : null;
		const participants = entry ? threadParticipants(entry) : [];
		const avatarWidth = AVATAR_SIZE + Math.max(0, Math.min(participants.length, 4) - 1) * AVATAR_STEP;
		const summaryId = `${idPrefix}-${encodeURIComponent(entryId)}`;

		return {
			summarized: sources !== null,
			headerInset: Math.max(0, avatarWidth - 32),
			renderAvatar(_entry: JiraActivityCommentEntry, avatar: ReactNode) {
				return <ThreadHeaderAvatars entry={entry} participants={participants} width={avatarWidth} avatar={avatar} summarized={sources !== null} />;
			},
			renderAction(replies: readonly JiraActivityReply[]) {
				if (!replies.length) return null;
				return (
					<Tooltip>
						<TooltipTrigger render={
							<Button
								ref={(node) => { if (node) triggers.current.set(entryId, node); else triggers.current.delete(entryId); }}
								type="button"
								size="icon-compact"
								variant="ghost"
								selectedAppearance="icon-only"
								aria-label="Summarize thread"
								aria-controls={summaryId}
								aria-expanded={sources !== null}
								onClick={() => {
									setState((current) => {
										const next = new Map(current.runs);
										const previous = next.get(entryId);
										next.set(entryId, auto && previous ? { ...previous, showing: true, animate: false } : { sources: replies, runAtMs: Date.now(), showing: true, animate: true });
										return { ...current, runs: next };
									});
									requestAnimationFrame(() => restoreButtons.current.get(entryId)?.focus({ preventScroll: true }));
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
				const result = auto && sources ? summarizeReplies(sources) : summary;
				return (
					<div className="grid">
						<div
							inert={sources !== null}
							aria-hidden={sources !== null}
							className={cn("grid", sources ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]")}
						>
							<div className="min-h-0" style={{ overflow: sources ? "clip" : undefined }}>{replies}</div>
						</div>
						<div
							id={summaryId}
							inert={sources === null}
							aria-hidden={sources === null}
							className={cn("relative grid", sources && FOLD_TRANSITION, sources ? "grid-rows-[1fr]" : "grid-rows-[0fr] opacity-0")}
						>
							<span aria-hidden className="pointer-events-none absolute -left-6 bottom-8 top-0 hidden w-px -translate-x-1/2 opacity-60 [background-image:repeating-linear-gradient(to_bottom,var(--ds-border)_0_2px,transparent_2px_5px)] [mask-image:linear-gradient(to_bottom,black_60%,transparent)]" data-summary-thread-continuation />
							<div className="min-h-0 overflow-clip">
								<div className="mt-3 grid gap-2 rounded-lg bg-bg-neutral-subtle py-3 pr-3">
									<div className="flex flex-wrap items-center gap-2 text-sm font-medium">
										<AiGenerativeTextSummaryIcon label="" size="small" />
										<span>Thread summary</span>
										{sources && run && (!auto || (auto.active && visible)) ? <span className="text-xs font-normal text-text-subtle">Last run <Tooltip><TooltipTrigger render={<span className="rounded-sm underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} />}><RelativeTime timestampMs={run.runAtMs} /></TooltipTrigger><TooltipContent positionerClassName="z-[650]" role="tooltip" side="bottom">Last run on {formatDetailedTimestamp(run.runAtMs, true)}</TooltipContent></Tooltip></span> : null}
									</div>
									<p className="text-sm text-text">{sources ? run?.animate ? <SuggestionRainbowText key={sources.map((reply) => reply.id).join("|")} text={result.text} onComplete={() => setState((current) => {
										const previous = current.runs.get(entryId);
										if (!previous?.animate || previous.sources !== sources) return current;
										const next = new Map(current.runs);
										next.set(entryId, { ...previous, animate: false });
										return { ...current, runs: next };
									})} /> : result.text : null}</p>
									{sources && sources.length > result.fixtureReplyCount ? (
										<ul className="grid gap-1 text-sm text-text">
											{sources.slice(result.fixtureReplyCount).map((reply) => (
												<li key={reply.id}><strong>{reply.actor.name}</strong> · {reply.body}</li>
											))}
										</ul>
									) : null}
									<div className="mt-2 flex flex-wrap items-center gap-2">
										<Button ref={(node) => { if (node) restoreButtons.current.set(entryId, node); else restoreButtons.current.delete(entryId); }} variant="outline" onClick={() => {
											expandReplies();
											setState((current) => {
												const next = new Map(current.runs);
												const previous = next.get(entryId);
												if (auto && previous) next.set(entryId, { ...previous, showing: false, animate: false });
												else next.delete(entryId);
												return { ...current, runs: next };
											});
											requestAnimationFrame(() => triggers.current.get(entryId)?.focus({ preventScroll: true }));
										}}>Show replies</Button>
										{onDraft && sources ? <Button variant="outline" onClick={() => onDraft(sources)}>{entry?.actor.kind === "agent" ? <span aria-hidden><JiraActivityEntryGlyph actor={entry.actor} animate={false} /></span> : null}Draft instruction</Button> : null}
									</div>
								</div>
							</div>
						</div>
					</div>
				);
			},
		};
	};
}

export function useWorkItemThreadSummary(entry: JiraActivityCommentEntry | undefined) {
	return useWorkItemThreadSummaries()(entry);
}
