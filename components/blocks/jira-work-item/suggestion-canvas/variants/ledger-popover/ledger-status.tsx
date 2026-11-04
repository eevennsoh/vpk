"use client";

import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Button } from "@/components/ui/button";
import { motionDuration, motionEase } from "@/lib/motion";

import { focusKey } from "./ledger-focus";
import { RefreshGlyph } from "./refresh-glyph";

type LedgerStatusKind = "caughtUp" | "nothingNew" | null;

/** True when the latest re-run came back empty. */
export function lastRunFoundNothing(feed: SuggestionFeed): boolean {
	return feed.runs.length > 1 && feed.runs.at(-1)?.ids.length === 0;
}

/**
 * The one status block the ledger shows above its rows, if any. Running lives in the header byline, so a re-run
 * never pushes the list down and back; only its outcome (nothing new) earns a line here.
 */
export function ledgerStatusOf(feed: SuggestionFeed): LedgerStatusKind {
	if (feed.review.pending.length === 0) return "caughtUp";
	if (feed.status === "running") return null;
	return lastRunFoundNothing(feed) ? "nothingNew" : null;
}

const UNFOLD = { duration: motionDuration.medium, ease: motionEase.inOut };
const FOLD = { duration: motionDuration.normal, ease: motionEase.in };
const FADE_IN = { duration: motionDuration.normal, ease: motionEase.outPractical };
const FADE_OUT = { duration: motionDuration.fast, ease: motionEase.in };

/** The byline already says "Just now", so the result line only states the outcome. */
const NOTHING_NEW_COPY = "No new suggestions";

function NothingNew() {
	return (
		<p className="flex items-center gap-2 px-2.5 py-2 text-xs text-text-subtlest">
			<span className="flex text-icon-subtlest"><CheckMarkIcon color="currentColor" label="" size="small" /></span>
			{NOTHING_NEW_COPY}
		</p>
	);
}

/** The caught-up subline is the one tally ("8 accepted · 2 dismissed"); after an empty check it reports that instead, on one line. */
function CaughtUpSubline({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const { accepted, dismissed } = feed.review;
	const tally = [accepted.length > 0 ? `${accepted.length} accepted` : null, dismissed.length > 0 ? `${dismissed.length} dismissed` : null].filter(Boolean).join(" · ");
	// The byline carries "Checking…" during a run, so the tally holds still until the result is in.
	const kind = feed.status === "idle" && lastRunFoundNothing(feed) ? "nothing" : "tally";
	return (
		<span className="relative block min-h-4 text-xs leading-4 text-pretty">
			<AnimatePresence initial={false} mode="wait">
				<motion.span
					animate={{ opacity: 1, transition: FADE_IN }}
					className="block"
					exit={{ opacity: 0, transition: FADE_OUT }}
					initial={{ opacity: 0 }}
					key={`${kind}-${feed.runs.length}`}
				>
					<span className="text-text-subtle tabular-nums">{kind === "nothing" ? "No new suggestions" : tally}</span>
				</motion.span>
			</AnimatePresence>
		</span>
	);
}

/** The byline carries "Checking…"; this button keeps its label, turns its arrow and steps back while the run is out. */
function CaughtUp({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const running = feed.status === "running";
	return (
		<div className="flex items-start gap-3 px-2.5 pt-2 pb-1.5">
			<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-success-subtler text-icon-success">
				<CheckMarkIcon color="currentColor" label="" size="small" />
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<p className="text-sm leading-5 font-medium text-text">All caught up</p>
				<CaughtUpSubline feed={feed} />
			</div>
			<Button
				aria-disabled={running || undefined}
				className="-mr-1 shrink-0 aria-disabled:cursor-default aria-disabled:opacity-(--opacity-disabled)"
				data-focus-key={focusKey.checkAgain}
				onClick={running ? undefined : feed.rerun}
				size="compact"
				type="button"
				variant="ghost"
			>
				<RefreshGlyph running={running} />
				Check again
			</Button>
		</div>
	);
}

/** Running, caught-up and nothing-new states unfold in place above the rows instead of replacing them. */
export function LedgerStatus({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const kind = ledgerStatusOf(feed);
	return (
		<div aria-live="polite">
			<AnimatePresence initial={false}>
				{kind ? (
					<motion.div
						animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
						exit={{ height: 0, opacity: 0, overflow: "hidden", transition: FOLD }}
						initial={{ height: 0, opacity: 0, overflow: "hidden" }}
						key={kind === "nothingNew" ? `nothingNew-${feed.runs.length}` : kind}
						transition={UNFOLD}
					>
						{kind === "caughtUp" ? <CaughtUp feed={feed} /> : <NothingNew />}
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
