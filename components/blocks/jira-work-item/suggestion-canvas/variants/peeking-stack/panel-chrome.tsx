"use client";

import type { MouseEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import { SUGGESTION_WORK_ITEM, type WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { AgentMark, ICON_BUTTON } from "./card-parts";
import { lastRunFoundNothing, stackStatusOf } from "./stack-order";

/** "2m ago" reads as "2m" in the byline; "Just now" stays as written. */
function lastRunLabel(feed: SuggestionFeed): string {
	const ranAt = feed.runs.at(-1)?.ranAt ?? "";
	return ranAt.endsWith(" ago") ? ranAt.slice(0, -4) : ranAt;
}

export function PanelHeader({ feed, titleId, onClose }: Readonly<{ feed: SuggestionFeed; titleId: string; onClose: () => void }>) {
	// The status row owns re-running while it shows (running or caught up), so the header never doubles it.
	const kind = stackStatusOf(feed);
	const showRerun = kind !== "running" && kind !== "caughtUp";
	return (
		<header className="flex flex-col gap-1 px-4 pt-3 pb-2">
			<div className="flex items-center gap-2">
				<h2 className="min-w-0 flex-1 text-text" id={titleId} style={{ font: token("font.heading.xsmall") }}>Work item suggestions</h2>
				<div className="-mr-1.5 flex items-center gap-px">
					{showRerun ? (
						<Tooltip>
							<TooltipTrigger render={<button aria-label="Check for new suggestions" className={ICON_BUTTON} onClick={feed.rerun} type="button" />}>
								<RefreshIcon color="currentColor" label="" size="small" />
							</TooltipTrigger>
							<TooltipContent>Check again</TooltipContent>
						</Tooltip>
					) : null}
					<button aria-label="Close suggestions" className={ICON_BUTTON} onClick={onClose} type="button">
						<CrossIcon color="currentColor" label="" size="small" />
					</button>
				</div>
			</div>
			<p className="-mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs leading-4 text-text-subtlest">
				<AgentMark />
				<span className="text-text-subtle">{SUGGESTION_WORK_ITEM.agent.name}</span>
				<span aria-hidden="true">·</span>
				<span className="tabular-nums">{lastRunLabel(feed)}</span>
				<span aria-hidden="true">·</span>
				<span className="inline-flex items-center gap-1">
					<TeamworkGraphMark className="size-3" />
					Teamwork Graph
				</span>
			</p>
		</header>
	);
}

/** For buttons that unmount once they act: hand focus to the dialog so keyboard users are not dropped to the page. */
function keepFocusInDialog(action: () => void) {
	return (event: MouseEvent<HTMLButtonElement>) => {
		const dialog = event.currentTarget.closest<HTMLElement>("[role=dialog]");
		action();
		dialog?.focus();
	};
}

const UNFOLD = { duration: motionDuration.medium, ease: motionEase.inOut };
const FOLD = { duration: motionDuration.normal, ease: motionEase.in };
const ROW = "flex items-center gap-2.5 px-2 pt-1 pb-2.5";

function CaughtUp({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const nothingNew = lastRunFoundNothing(feed);
	return (
		<div className={ROW}>
			<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-success-subtler text-icon-success">
				<CheckMarkIcon color="currentColor" label="" size="small" />
			</span>
			<div className="flex min-w-0 flex-1 flex-col">
				<p className="text-sm leading-5 font-medium text-text">All caught up</p>
				<AnimatePresence initial={false} mode="popLayout">
					<motion.p
						animate={{ opacity: 1, y: 0, transition: { duration: motionDuration.medium, ease: motionEase.outPractical } }}
						className="text-xs leading-4 text-text-subtle tabular-nums"
						exit={{ opacity: 0, y: -4, transition: { duration: motionDuration.fast, ease: motionEase.in } }}
						initial={{ opacity: 0, y: 4 }}
						key={nothingNew ? `checked-${feed.runs.length}` : "tally"}
					>
						{nothingNew ? "Checked just now · nothing new" : "Nothing left to review"}
					</motion.p>
				</AnimatePresence>
			</div>
			<Button className="-mr-3 shrink-0" onClick={keepFocusInDialog(feed.rerun)} size="compact" type="button" variant="ghost">
				<RefreshIcon color="currentColor" label="" size="small" />
				Check again
			</Button>
		</div>
	);
}

/** Running, caught-up and nothing-new unfold in place above the rows instead of replacing them. */
export function PanelStatus({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const kind = stackStatusOf(feed);
	return (
		<div aria-live="polite">
			<AnimatePresence initial={false}>
				{kind ? (
					<motion.div
						animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
						exit={{ height: 0, opacity: 0, overflow: "hidden", transition: FOLD }}
						initial={{ height: 0, opacity: 0, overflow: "hidden" }}
						key={kind}
						transition={UNFOLD}
					>
						{kind === "running" ? (
							<div className={ROW}>
								<span className="flex size-6 shrink-0 items-center justify-center"><TWGLoader label="Checking Teamwork Graph" size="small" /></span>
								<Shimmer as="span" className="text-xs text-text-subtle">Looking for anything new across your work</Shimmer>
							</div>
						) : kind === "caughtUp" ? <CaughtUp feed={feed} /> : (
							<p className={cn(ROW, "text-xs text-text-subtlest")}>
								<span className="flex size-6 shrink-0 items-center justify-center text-icon-subtlest"><CheckMarkIcon color="currentColor" label="" size="small" /></span>
								Checked just now · nothing new
							</p>
						)}
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}

/**
 * One continuous track across the footer's top edge, doubling as its divider: applied, then dismissed, then what is
 * left, so it stays calm at any count and the row below holds only the count and the actions.
 */
function ProgressTrack({ feed, total }: Readonly<{ feed: SuggestionFeed; total: number }>) {
	const share = (count: number) => `${total > 0 ? (count / total) * 100 : 0}%`;
	return (
		<span aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-0 flex h-0.5 overflow-hidden rounded-full bg-bg-neutral">
			<span className="h-full bg-icon-success transition-[width] duration-medium ease-in-out" style={{ width: share(feed.review.accepted.length) }} />
			<span className="h-full bg-icon-subtlest transition-[width] duration-medium ease-in-out" style={{ width: share(feed.review.dismissed.length) }} />
		</span>
	);
}

export function PanelFooter({ feed, ordered, onAcceptAll, onClose }: Readonly<{ feed: SuggestionFeed; ordered: readonly WorkItemSuggestion[]; onAcceptAll: () => void; onClose: () => void }>) {
	const total = ordered.length;
	const reviewed = total - feed.review.pending.length;
	const done = feed.review.pending.length === 0;
	return (
		<footer className="relative flex h-12 shrink-0 items-center gap-1 px-4">
			<ProgressTrack feed={feed} total={total} />
			<span className="min-w-0 flex-1 text-xs leading-4 text-text-subtlest tabular-nums">
				<span className="text-text-subtle">{reviewed}</span> of {total} reviewed
			</span>
			{done ? (
				// Ghost text ends on the content edge, in the same column as Undo and the accept tick above.
				<Button className="-mr-3" onClick={onClose} size="compact" type="button" variant="ghost">Done</Button>
			) : (
				<>
					<Button onClick={keepFocusInDialog(feed.review.dismissAll)} size="compact" type="button" variant="ghost">Dismiss all</Button>
					<Button onClick={keepFocusInDialog(onAcceptAll)} size="compact" type="button">Accept all</Button>
				</>
			)}
		</footer>
	);
}
