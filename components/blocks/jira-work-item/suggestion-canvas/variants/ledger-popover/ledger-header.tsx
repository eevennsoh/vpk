"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Image from "next/image";
import CrossIcon from "@atlaskit/icon/core/cross";
import { AnimatePresence, motion } from "motion/react";

import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { TeamworkGraphMark } from "@/components/ui-custom/teamwork-graph-mark";
import { motionDuration, motionEase } from "@/lib/motion";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { focusKey, isQuietlyFocused } from "./ledger-focus";
import { RefreshGlyph } from "./refresh-glyph";

function AgentMark() {
	return (
		<Avatar animate={false} shape="hexagon" size="xs">
			<span className="flex size-full items-center justify-center bg-blue-700">
				<Image alt="" className="size-2.5!" height={10} src="/1p/agent-lanyard/glyph-jira-triage.svg" width={10} />
			</span>
		</Avatar>
	);
}

/** "2m ago" reads as "2m" in the byline; "Just now" stays as written. */
export function lastRunLabel(feed: SuggestionFeed): string {
	const ranAt = feed.runs.at(-1)?.ranAt ?? "";
	return ranAt.endsWith(" ago") ? ranAt.slice(0, -4) : ranAt;
}

const ICON_BUTTON = "flex size-7 items-center justify-center rounded-md text-icon-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-icon active:bg-bg-neutral-subtle-pressed focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Re-run control. Once pressed, its "Check again" tooltip stays shut until the pointer has really left the button
 * (checked against its box, since re-renders can fire stray leave events) and come back, so no label pops over the
 * panel when the run finishes under a resting pointer. While running, the arrow turns and the byline says "Checking…".
 */
function RefreshButton({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const running = feed.status === "running";
	const [tipOpen, setTipOpen] = useState(false);
	const [quiet, setQuiet] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const onPointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
		if (!inside) setQuiet(false);
	};
	return (
		<Tooltip
			onOpenChange={(next) => setTipOpen(next && !quiet && !running && !isQuietlyFocused(buttonRef.current))}
			open={tipOpen && !quiet && !running}
		>
			<TooltipTrigger
				render={(
					<button
						aria-disabled={running || undefined}
						aria-label={running ? "Checking for new suggestions" : "Check for new suggestions"}
						className={cn(ICON_BUTTON, running ? "cursor-default text-icon hover:bg-transparent" : null)}
						data-focus-key={focusKey.refresh}
						onClick={() => {
							setQuiet(true);
							setTipOpen(false);
							if (!running) feed.rerun();
						}}
						onPointerLeave={onPointerLeave}
						ref={buttonRef}
						type="button"
					/>
				)}
			>
				<RefreshGlyph running={running} />
			</TooltipTrigger>
			<TooltipContent>Check again</TooltipContent>
		</Tooltip>
	);
}

/** The sweep dips only as far as text-subtle, so "Checking…" stays legible at every frame. */
const SHIMMER_FLOOR = { "--shimmer-color": token("color.text.subtle") } as CSSProperties;

const FADE_IN = { duration: motionDuration.normal, ease: motionEase.outPractical };
const FADE_OUT = { duration: motionDuration.fast, ease: motionEase.in };

/** The byline's time slot doubles as the run status: "Checking…" shimmers in place, so the list never shifts for a re-run. */
function RunTime({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const running = feed.status === "running";
	return (
		<span aria-live="polite" className="inline-grid">
			<AnimatePresence initial={false} mode="wait">
				<motion.span
					animate={{ opacity: 1, transition: FADE_IN }}
					className="tabular-nums"
					exit={{ opacity: 0, transition: FADE_OUT }}
					initial={{ opacity: 0 }}
					key={running ? "running" : `ran-${feed.runs.length}`}
				>
					{running ? <Shimmer as="span" className="text-text" style={SHIMMER_FLOOR}>Checking…</Shimmer> : lastRunLabel(feed)}
				</motion.span>
			</AnimatePresence>
		</span>
	);
}

export interface LedgerHeaderProps {
	feed: SuggestionFeed;
	titleId: string;
	/** Content is scrolled beneath the header: a hairline separates them. */
	scrolled: boolean;
	onClose: () => void;
}

export function LedgerHeader({ feed, titleId, scrolled, onClose }: Readonly<LedgerHeaderProps>) {
	const { agent } = SUGGESTION_WORK_ITEM;
	// Caught up, the status block carries "Check again" and the footer "Done": the header keeps only the title, at the same height.
	const caughtUp = feed.review.pending.length === 0;
	return (
		<header
			className={cn(
				"relative flex flex-col gap-1 px-4 pt-3 pb-2.5",
				"after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border after:transition-opacity after:duration-fast after:ease-out-practical",
				scrolled ? "after:opacity-100" : "after:opacity-0",
			)}
		>
			<div className="flex min-h-7 items-center gap-2">
				<h2 className="min-w-0 flex-1 text-text" id={titleId} style={{ font: token("font.heading.xsmall") }}>Work item suggestions</h2>
				{caughtUp ? null : (
					<div className="-mr-1.5 flex items-center gap-px">
						<RefreshButton feed={feed} />
						<button aria-label="Close suggestions" className={ICON_BUTTON} onClick={onClose} type="button">
							<CrossIcon color="currentColor" label="" size="small" />
						</button>
					</div>
				)}
			</div>
			<p className="-mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-4 text-text-subtlest">
				<AgentMark />
				<span className="text-text-subtle">{agent.name}</span>
				<span aria-hidden="true">·</span>
				<RunTime feed={feed} />
				<span aria-hidden="true">·</span>
				<span className="inline-flex items-center gap-1">
					<TeamworkGraphMark className="size-3" />
					Teamwork Graph
				</span>
			</p>
		</header>
	);
}
