"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import CrossIcon from "@atlaskit/icon/core/cross";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionReview } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { motionRecipe } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { relativeTime, type RunNotice } from "./use-run-notice";

function AgentMark() {
	return (
		<Avatar animate={false} shape="hexagon" size="xs">
			<span className="flex size-full items-center justify-center bg-blue-700">
				<Image alt="" className="size-2.5" height={10} src="/1p/agent-lanyard/glyph-jira-triage.svg" width={10} />
			</span>
		</Avatar>
	);
}

function bylineKey(notice: RunNotice): string {
	return notice == null ? "idle" : notice.kind;
}

/**
 * The byline's middle segment, the only part that changes: when the agent last ran, or what its last run did.
 * While a run is in flight this is the popover's single live status; the Refresh control only goes quiet.
 */
function BylineStatus({ notice, ranAt }: Readonly<{ notice: RunNotice; ranAt: string }>) {
	if (notice == null) return <span className="tabular-nums">{relativeTime(ranAt)}</span>;
	switch (notice.kind) {
		case "running":
			return <Shimmer as="span" className="text-xs leading-4">Looking for more…</Shimmer>;
		case "found":
			return (
				<span className="inline-flex items-center gap-1 font-medium text-text-discovery">
					<span aria-hidden="true" className="size-1.5 rounded-full bg-icon-discovery" />
					{notice.count} new
				</span>
			);
		case "nothing":
			return <span>Nothing new · {relativeTime(notice.ranAt)}</span>;
		default: {
			const unreachable: never = notice;
			return unreachable;
		}
	}
}

/** The source never moves: a Teamwork Graph mark set in the action column, named by its tooltip. */
function SourceMark() {
	return (
		<Tooltip>
			<TooltipTrigger
				render={<span aria-label="Sourced from Teamwork Graph" className="flex size-6 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" role="img" tabIndex={0} />}
			>
				<TeamworkGraphMark className="size-3" />
			</TooltipTrigger>
			<TooltipContent>Sourced from Teamwork Graph</TooltipContent>
		</Tooltip>
	);
}

export interface PeekHeaderProps {
	titleId: string;
	ranAt: string;
	notice: RunNotice;
	running: boolean;
	onRerun: () => void;
	onClose: () => void;
}

export function PeekHeader({ titleId, ranAt, notice, running, onRerun, onClose }: Readonly<PeekHeaderProps>) {
	return (
		<header className="flex flex-col gap-0.5 pt-3 pr-2.5 pb-2 pl-4">
			<div className="flex items-center gap-2">
				<h2 className="min-w-0 flex-1 text-text" id={titleId} style={{ font: token("font.heading.xsmall") }}>Work item suggestions</h2>
				<div className="-my-1 flex items-center">
					<Tooltip>
						<TooltipTrigger
							render={(
								<Button
									aria-disabled={running || undefined}
									aria-label={running ? "Checking for new suggestions" : "Check for new suggestions"}
									className="aria-disabled:opacity-40"
									onClick={running ? undefined : onRerun}
									size="icon"
									type="button"
									variant="ghost"
								/>
							)}
						>
							<RefreshIcon color="currentColor" label="" size="small" />
						</TooltipTrigger>
						<TooltipContent>{running ? "Checking…" : "Check for new suggestions"}</TooltipContent>
					</Tooltip>
					<Button aria-label="Close suggestions" onClick={onClose} size="icon" type="button" variant="ghost">
						<CrossIcon color="currentColor" label="" size="small" />
					</Button>
				</div>
			</div>
			{/* Right inset lines the source mark up with the close button above and the accept column below. */}
			<div className="flex h-6 items-center gap-2 pr-1">
				<p className="flex min-w-0 flex-1 items-center gap-x-1.5 text-xs leading-4 whitespace-nowrap text-text-subtlest">
					<AgentMark />
					<span className="text-text-subtle">{SUGGESTION_WORK_ITEM.agent.name}</span>
					<span aria-hidden="true">·</span>
					<span aria-live="polite" className="relative inline-flex min-w-0 items-center">
						<AnimatePresence initial={false} mode="popLayout">
							<motion.span
								animate={{ opacity: 1, transition: motionRecipe.popup.enter }}
								className="inline-flex items-center"
								exit={{ opacity: 0, transition: motionRecipe.popup.exit }}
								initial={{ opacity: 0 }}
								key={bylineKey(notice)}
							>
								<BylineStatus notice={notice} ranAt={ranAt} />
							</motion.span>
						</AnimatePresence>
					</span>
				</p>
				<SourceMark />
			</div>
		</header>
	);
}

/**
 * A hairline that doubles as the footer divider and the review progress. It fills by everything reviewed, so it
 * always agrees with "N of M reviewed": what was added in green, what was dismissed after it in a quiet grey.
 */
function ProgressTrack({ review }: Readonly<{ review: SuggestionReview }>) {
	const total = Math.max(review.suggestions.length, 1);
	const segment = "h-full transition-[width] duration-medium ease-in-out";
	return (
		<span aria-hidden="true" className="absolute inset-x-0 top-0 flex h-0.5 bg-bg-neutral">
			<span className={cn(segment, "bg-icon-success")} style={{ width: `${(review.accepted.length / total) * 100}%` }} />
			<span className={cn(segment, "bg-icon-subtlest")} style={{ width: `${(review.dismissed.length / total) * 100}%` }} />
		</span>
	);
}

export interface PeekFooterProps {
	review: SuggestionReview;
	/** `keyboard` is true when the press came from a key, so focus is only moved for keyboard users. */
	onAcceptAll: (keyboard: boolean) => void;
	onDismissAll: (keyboard: boolean) => void;
	onClose: () => void;
}

export function PeekFooter({ review, onAcceptAll, onDismissAll, onClose }: Readonly<PeekFooterProps>) {
	const total = review.suggestions.length;
	const done = review.pending.length === 0;
	return (
		<footer className="relative flex items-center gap-1 py-2.5 pr-2.5 pl-4">
			<ProgressTrack review={review} />
			<span aria-live="polite" className="min-w-0 flex-1 text-xs leading-4 whitespace-nowrap text-text-subtle tabular-nums">
				{`${total - review.pending.length} of ${total} reviewed`}
			</span>
			{done ? (
				<Button data-peek-focus="done" onClick={onClose} size="compact" type="button" variant="outline">Done</Button>
			) : (
				<>
					<Button onClick={(event) => onDismissAll(event.detail === 0)} size="compact" type="button" variant="ghost">Dismiss all</Button>
					<Button onClick={(event) => onAcceptAll(event.detail === 0)} size="compact" type="button">Accept all</Button>
				</>
			)}
		</footer>
	);
}
