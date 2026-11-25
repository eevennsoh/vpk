"use client";

import { useEffect, useState, type ReactNode, type Ref } from "react";
import CollapseVerticalIcon from "@atlaskit/icon/core/collapse-vertical";
import CrossIcon from "@atlaskit/icon/core/cross";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import TextReviewIcon from "@atlaskit/icon-lab/core/text-review";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shimmer } from "@/components/ui/shimmer";
import { cn } from "@/lib/utils";
import { LIST_HEADER_TOP_INSET } from "./constants";

export type ViewMode = "stack" | "list";

const ICON_BUTTON =
	"flex size-7 any-pointer-coarse:size-8 items-center justify-center rounded-md text-icon-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-icon active:bg-bg-neutral-subtle-pressed focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-default aria-disabled:hover:bg-transparent aria-disabled:hover:text-icon-subtle aria-disabled:active:bg-transparent";

/** How long ago a run finished: "just now", "5 min ago", "2 hr ago". */
export function runAge(at: number, now: number): string {
	const minutes = Math.floor(Math.max(0, now - at) / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.floor(minutes / 60);
	return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)} d ago`;
}

/** The current time, refreshed every 30 seconds so run ages stay honest while the panel is open. */
function useNow(): number {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(timer);
	}, []);
	return now;
}

/** Acknowledge checks that found no new suggestions in the heading. */
export function headline(feed: SuggestionFeed, now: number): string {
	const last = feed.runs.at(-1);
	if (last && feed.runs.length > 1 && last.ids.length === 0) return `Checked ${runAge(last.at, now)}`;
	return "Suggestions for you";
}

function HeaderButton({ label, tip, disabled = false, onClick, buttonRef, children, portalOutsidePanel }: Readonly<{ label: string; tip: string; disabled?: boolean; onClick: () => void; buttonRef?: Ref<HTMLButtonElement>; children: ReactNode; portalOutsidePanel?: boolean }>) {
	const tooltip = (
		<Tooltip>
			<TooltipTrigger render={<button aria-disabled={disabled || undefined} aria-label={label} className={ICON_BUTTON} onClick={disabled ? undefined : onClick} ref={buttonRef} type="button" />}>
				{children}
			</TooltipTrigger>
			<TooltipContent positionerClassName={portalOutsidePanel ? "z-[650]" : undefined}>{tip}</TooltipContent>
		</Tooltip>
	);
	return portalOutsidePanel ? <TooltipProvider>{tooltip}</TooltipProvider> : tooltip;
}

/** The refresh arrow turns while the agent re-runs, finishing its turn before settling upright. */
function RefreshGlyph({ running }: Readonly<{ running: boolean }>) {
	const [spinning, setSpinning] = useState(running);
	if (running && !spinning) setSpinning(true);
	return (
		<span aria-hidden="true" className={cn("flex", spinning ? "animate-spin" : null)} onAnimationIteration={() => (running ? undefined : setSpinning(false))}>
			<RefreshIcon color="currentColor" label="" size="small" />
		</span>
	);
}

export interface PanelHeaderProps {
	feed: SuggestionFeed;
	title?: string;
	titleId: string;
	view: ViewMode;
	floating: boolean;
	/** Omitted when there is nothing to lay out (an empty stack). */
	onToggleView?: () => void;
	/** Re-run the suggestion check from the header; its tooltip says when the last run finished. */
	onRerun?: () => void;
	onClose: () => void;
	toggleRef: Ref<HTMLButtonElement>;
	rerunRef?: Ref<HTMLButtonElement>;
}

export function PanelHeader({ feed, title, titleId, view, floating, onToggleView, onRerun, onClose, toggleRef, rerunRef }: Readonly<PanelHeaderProps>) {
	const running = feed.status === "running";
	const now = useNow();
	const lastRun = feed.runs.at(-1);
	return (
		<header
			className={cn("flex h-11 shrink-0 items-center gap-2 pl-4", view === "list" ? "pr-4" : "pr-2", floating ? "relative z-10" : null)}
			style={{ marginTop: view === "list" ? LIST_HEADER_TOP_INSET : undefined }}
		>
			<h2 className="min-w-0 flex-1 text-sm" id={titleId}>
				<span className="sr-only">Work item suggestions. </span>
				{running ? (
					<Shimmer as="span" className="text-sm font-medium text-text-subtle">Checking for suggestions…</Shimmer>
				) : (
					<span aria-live="polite" className="font-medium text-text">{title ?? headline(feed, now)}</span>
				)}
			</h2>
			<div className="flex items-center gap-0.5">
				{onToggleView ? (
					<HeaderButton buttonRef={toggleRef} label={view === "stack" ? "Show as list" : "Show as stack"} onClick={onToggleView} tip={view === "stack" ? "Show all" : "Stack"}>
						{view === "stack" ? <ListBulletedIcon color="currentColor" label="" size="small" /> : <CollapseVerticalIcon color="currentColor" label="" size="small" />}
					</HeaderButton>
				) : null}
				{onRerun ? (
					<HeaderButton
						buttonRef={rerunRef}
						disabled={running}
						label={running ? "Checking for new suggestions" : "Check for new suggestions"}
						onClick={onRerun}
						portalOutsidePanel={floating}
						tip={running ? "Checking for new suggestions…" : lastRun ? `Last run ${runAge(lastRun.at, now)}` : "Check again"}
					>
						{floating ? <TextReviewIcon color="currentColor" label="" size="small" /> : <RefreshGlyph running={running} />}
					</HeaderButton>
				) : null}
				<HeaderButton label="Close suggestions" onClick={onClose} portalOutsidePanel={floating} tip="Close">
					<CrossIcon color="currentColor" label="" size="small" />
				</HeaderButton>
			</div>
		</header>
	);
}
