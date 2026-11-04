"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

import { Spinner } from "@/components/ui/spinner";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

const GROW = { duration: motionDuration.slow, ease: motionEase.inOut };
const SHRINK = { duration: motionDuration.normal, ease: motionEase.in };

/**
 * The timeline gutter matches the header's agent mark: the 16px slot from 20px to 36px, centred at 28px.
 * Content starts at 42px, the byline's text column, so every run and row hangs under "Jira Triage Agent".
 * The gutter is always reserved, so the thread can appear with a second run without moving a single line.
 */
const GUTTER = "absolute left-7 -translate-x-1/2";
/** The thread and its nodes only mean something once there is more than one run to connect. */
const THREAD_FADE = "transition-opacity duration-medium ease-out-practical";
export const CONTENT_INSET = "pl-10.5 pr-5";

export type RunTone = "new" | "open" | "settled";

/** The node on the thread: a dot whose weight says whether the run still needs you. Only runs get nodes. */
export function RunDot({ tone }: Readonly<{ tone: RunTone }>) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"size-2 rounded-full ring-3 ring-surface-overlay transition-colors duration-medium ease-out-practical",
				tone === "new" ? "bg-icon-information" : tone === "open" ? "bg-icon-subtle" : "bg-border-bold",
			)}
		/>
	);
}

/**
 * A check that found nothing: a hollow ring, the same size as a run's dot but with nothing inside.
 * Not a tick, so it never reads as one more item in the column of accepted receipts beside it.
 */
export function CheckedNode() {
	return <span aria-hidden="true" className="size-2 rounded-full border-[1.5px] border-icon-subtlest bg-surface-overlay ring-3 ring-surface-overlay" />;
}

export interface RunSectionProps {
	node: ReactNode;
	/** Accessible name for the section, e.g. "Run 2, just now". */
	label: string;
	when: ReactNode;
	meta?: ReactNode;
	/** Draw the thread and node. Off while there is a single run: one point is not a timeline. */
	showThread: boolean;
	/** A newer run sits above: the thread enters this node from the top. */
	hasNewer: boolean;
	/** An older run sits below: the thread leaves this node and runs through the section. */
	hasOlder: boolean;
	children?: ReactNode;
}

function Thread({ visible, className }: Readonly<{ visible: boolean; className: string }>) {
	return <span aria-hidden="true" className={cn(GUTTER, THREAD_FADE, "w-px bg-border", visible ? "opacity-100" : "opacity-0", className)} />;
}

/**
 * One agent run: a sticky timestamp line with its node on the thread, then its suggestions.
 * Each section draws its own thread segments, so the line is continuous across empty runs and sticky headers.
 * Enters by growing in place so newer runs push history down rather than jump.
 */
export function RunSection({ node, label, when, meta, showThread, hasNewer, hasOlder, children }: Readonly<RunSectionProps>) {
	return (
		<motion.li
			animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
			aria-label={label}
			className="relative"
			exit={{ height: 0, opacity: 0, overflow: "hidden", transition: SHRINK }}
			initial={{ height: 0, opacity: 0, overflow: "hidden" }}
			transition={GROW}
		>
			<div className={cn("sticky top-0 z-10 flex h-8 items-center bg-surface-overlay", CONTENT_INSET)}>
				{hasNewer ? <Thread className="top-0 h-1/2" visible={showThread} /> : null}
				{hasOlder ? <Thread className="top-1/2 bottom-0" visible={showThread} /> : null}
				<span className={cn(GUTTER, THREAD_FADE, "top-1/2 flex size-4 -translate-y-1/2 items-center justify-center", showThread ? "opacity-100" : "opacity-0")}>{node}</span>
				<p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs leading-4">
					<span className="font-medium text-text-subtle">{when}</span>
					{meta != null ? (
						<>
							<span aria-hidden="true" className="text-text-subtlest">·</span>
							{meta}
						</>
					) : null}
				</p>
			</div>
			{children != null || hasOlder ? (
				<div className={cn("relative", children != null ? "pb-2" : null)}>
					{hasOlder ? <Thread className="inset-y-0" visible={showThread} /> : null}
					{children}
				</div>
			) : null}
		</motion.li>
	);
}

/**
 * The working node: the shared spinner on a faint track of the same circle, so the signal stays legible at every
 * point of the arc's loop, even when the arc itself is at its shortest. The track is drawn in the spinner's own
 * geometry (its 50-unit viewBox, radius 20, stroke 4) at the same size class, so it scales with the spinner exactly.
 */
function WorkingNode() {
	return (
		<span className="relative flex size-5 items-center justify-center rounded-full bg-surface-overlay">
			<svg aria-hidden="true" className="absolute size-5 text-border" fill="none" viewBox="0 0 50 50">
				<circle cx="25" cy="25" r="20" stroke="currentColor" strokeWidth="4" />
			</svg>
			<Spinner className="relative text-icon-information" label="" size="lg" variant="inherit" />
		</span>
	);
}

/** The placeholder run while the agent re-checks. The spinner on the thread is the panel's one working signal. */
export function RunningSection({ hasOlder }: Readonly<{ hasOlder: boolean }>) {
	return (
		<RunSection
			hasNewer={false}
			hasOlder={hasOlder}
			label="Checking for new suggestions"
			node={<WorkingNode />}
			showThread={hasOlder}
			when="Checking for new suggestions…"
		/>
	);
}
