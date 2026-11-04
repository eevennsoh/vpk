"use client";

import { useState, type ReactNode, type Ref } from "react";
import CollapseVerticalIcon from "@atlaskit/icon/core/collapse-vertical";
import CrossIcon from "@atlaskit/icon/core/cross";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { cn } from "@/lib/utils";

export type ViewMode = "stack" | "list";

const ICON_BUTTON =
	"flex size-7 pointer-coarse:size-8 items-center justify-center rounded-md text-icon-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-icon active:bg-bg-neutral-subtle-pressed focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-default aria-disabled:hover:bg-transparent aria-disabled:hover:text-icon-subtle aria-disabled:active:bg-transparent";

const relative = (ranAt: string) => {
	const minutes = /^(\d+)m ago$/.exec(ranAt);
	return minutes ? `${minutes[1]} min ago` : ranAt.toLowerCase();
};

/**
 * When the agent last looked: "Suggested 2 min ago" for the run that brought the latest finds, or "Checked just now"
 * when the latest check found nothing, so a quiet check is acknowledged rather than looking like nothing happened.
 */
export function headline(feed: SuggestionFeed): string {
	const last = feed.runs.at(-1);
	if (last && feed.runs.length > 1 && last.ids.length === 0) return `Checked ${relative(last.ranAt)}`;
	return `Suggested ${relative(feed.runs.findLast((run) => run.ids.length > 0)?.ranAt ?? last?.ranAt ?? "")}`;
}

function HeaderButton({ label, tip, disabled = false, onClick, buttonRef, children }: Readonly<{ label: string; tip: string; disabled?: boolean; onClick: () => void; buttonRef?: Ref<HTMLButtonElement>; children: ReactNode }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={<button aria-disabled={disabled || undefined} aria-label={label} className={ICON_BUTTON} onClick={disabled ? undefined : onClick} ref={buttonRef} type="button" />}>
				{children}
			</TooltipTrigger>
			<TooltipContent>{tip}</TooltipContent>
		</Tooltip>
	);
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
	titleId: string;
	view: ViewMode;
	/** Omitted when there is nothing to lay out (an empty stack). */
	onToggleView?: () => void;
	/** Omitted where the body offers its own Check again (caught up), so there is one way to re-run, not two side by side. */
	onRerun?: () => void;
	onClose: () => void;
	toggleRef: Ref<HTMLButtonElement>;
}

/** "Suggested 2 min ago" (or the running check), then view toggle · re-run · close. */
export function PanelHeader({ feed, titleId, view, onToggleView, onRerun, onClose, toggleRef }: Readonly<PanelHeaderProps>) {
	const running = feed.status === "running";
	return (
		<header className="flex h-11 shrink-0 items-center gap-2 pr-2 pl-4">
			<h2 className="min-w-0 flex-1 text-sm" id={titleId}>
				<span className="sr-only">Work item suggestions. </span>
				{running ? (
					<Shimmer as="span" className="text-sm font-medium text-text-subtle">Checking for suggestions…</Shimmer>
				) : (
					<span aria-live="polite" className="font-medium text-text-subtle">{headline(feed)}</span>
				)}
			</h2>
			<div className="flex items-center gap-0.5">
				{onToggleView ? (
					<HeaderButton buttonRef={toggleRef} label={view === "stack" ? "Show as list" : "Show as stack"} onClick={onToggleView} tip={view === "stack" ? "Show all" : "Stack"}>
						{view === "stack" ? <ListBulletedIcon color="currentColor" label="" size="small" /> : <CollapseVerticalIcon color="currentColor" label="" size="small" />}
					</HeaderButton>
				) : null}
				{onRerun ? (
					<HeaderButton disabled={running} label={running ? "Checking for new suggestions" : "Check for new suggestions"} onClick={onRerun} tip="Check again">
						<RefreshGlyph running={running} />
					</HeaderButton>
				) : null}
				<HeaderButton label="Close suggestions" onClick={onClose} tip="Close">
					<CrossIcon color="currentColor" label="" size="small" />
				</HeaderButton>
			</div>
		</header>
	);
}
