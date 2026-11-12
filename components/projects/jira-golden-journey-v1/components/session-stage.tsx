"use client";

import { useState } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { FOCUS_RING_CLIP_GUTTER } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ScreenNavigatorController } from "../hooks/use-screen-navigator";
import type { SessionScreen } from "../data/session-screens";
import { ForYouStage, JiraDesignWorkspaceStage } from "./for-you-stage";
import type { JiraDesignView } from "./jira-design-view-tabs";
import { KanbanStage } from "./kanban-stage";
import { RovoStage } from "./rovo-stage";
import { TerminalBeatScreen } from "./terminal-beat-screen";
import { TerminalLiveScreen } from "./terminal-live-screen";

// ---------------------------------------------------------------------------
// The Local/Global session cards share one presenter: an ordered set of screens
// navigated left/right. Mirrors the terminal demo's beat stepping (see
// `TerminalControls` / `useTerminalDemo`) — the gallery top bar shows position +
// prev/next, and the stage renders the current configured scenario.
// ---------------------------------------------------------------------------

/**
 * Position label for the top bar. When the active screen belongs to a section,
 * it reads `<section> · <position-in-section> of <count-in-section>` (e.g.
 * `Terminal · 1 of 4`) so the counter resets per section as more sections are
 * added. Singleton runs display only the section name (e.g. `Kanban`). The
 * position is measured within the CONTIGUOUS run of same-section screens around
 * the active one, so a section name reused in a later block still counts from 1.
 * Screens without a section fall back to `Screen N of M`.
 */
function sectionLabel(screens: readonly SessionScreen[], index: number): string {
	const activeIndex = Math.min(Math.max(index, 0), screens.length - 1);
	const section = screens[activeIndex]?.section;
	if (!section) {
		return `Screen ${Math.min(index + 1, screens.length)} of ${screens.length}`;
	}
	let start = activeIndex;
	while (start > 0 && screens[start - 1]?.section === section) start -= 1;
	let end = activeIndex;
	while (end < screens.length - 1 && screens[end + 1]?.section === section) end += 1;
	const position = activeIndex - start + 1;
	const total = end - start + 1;
	if (total === 1) return section;
	// U+00B7 MIDDLE DOT between the section name and its position.
	return `${section} \u00b7 ${position} of ${total}`;
}

interface SectionRun {
	/** Section label, or the screen title when the screen has no `section`. */
	label: string;
	/** Index of the first screen in this run — where the dropdown jumps to. */
	startIndex: number;
}

/**
 * Collapses the screen list into the ordered set of jumpable destinations for
 * the section dropdown: one entry per CONTIGUOUS run of same-section screens
 * (matching how `sectionLabel` counts), so a section name reused in a later
 * block yields a separate entry. Screens without a section become their own
 * single-screen entry labeled by title, so every screen stays reachable.
 */
function sectionRuns(screens: readonly SessionScreen[]): readonly SectionRun[] {
	const runs: SectionRun[] = [];
	for (let i = 0; i < screens.length; i += 1) {
		const screen = screens[i];
		const previous = screens[i - 1];
		const startsNewRun =
			i === 0 || !screen?.section || screen.section !== previous?.section;
		if (startsNewRun) {
			runs.push({ label: screen?.section ?? screen?.title ?? `Screen ${i + 1}`, startIndex: i });
		}
	}
	return runs;
}

/**
 * Index into `sectionRuns` of the run that contains `index` — the run whose
 * `startIndex` is the greatest one still ≤ the active index.
 */
function activeRunIndex(runs: readonly SectionRun[], index: number): number {
	let active = 0;
	for (let i = 0; i < runs.length; i += 1) {
		if (runs[i]!.startIndex <= index) active = i;
		else break;
	}
	return active;
}

/** Connected section-run selector rendered in the wide Gallery top bar. */
export function SessionScreenControls({
	screens,
	controller,
}: Readonly<{
	screens: readonly SessionScreen[];
	controller: ScreenNavigatorController;
}>): React.ReactElement {
	const { index, goTo } = controller;
	const runs = sectionRuns(screens);
	const activeRun = activeRunIndex(runs, index);

	return (
		<div
			className={cn(
				"scrollbar-none max-w-[calc(100vw-12rem)] overflow-x-auto",
				FOCUS_RING_CLIP_GUTTER,
			)}
		>
			<ButtonGroup
				aria-label="Open a Jira Golden Journey section"
				className="w-max [&>[data-slot]~[data-slot]]:-ml-px [&>[data-slot]~[data-slot]]:border-l!"
				variant="connected"
			>
				{runs.map((run, runIndex) => (
					<Button
						aria-pressed={runIndex === activeRun}
						className="aria-pressed:z-10"
						key={run.startIndex}
						onClick={() => goTo(run.startIndex)}
						size="compact"
						type="button"
						variant="outline"
					>
						{runIndex === activeRun ? sectionLabel(screens, index) : run.label}
					</Button>
				))}
			</ButtonGroup>
		</div>
	);
}

/** Screen-level previous/dropdown/next navigator rendered below the large breakpoint. */
export function CompactSessionScreenControls({
	screens,
	controller,
}: Readonly<{
	screens: readonly SessionScreen[];
	controller: ScreenNavigatorController;
}>): React.ReactElement {
	const { index, canPrev, canNext, prev, next, goTo } = controller;
	const runs = sectionRuns(screens);
	const activeRun = activeRunIndex(runs, index);

	return (
		<div className="flex items-center text-sm text-text">
			<Button
				type="button"
				variant="outline"
				size="icon-compact"
				className="mr-2"
				aria-label="Previous screen"
				onClick={prev}
				disabled={!canPrev}
			>
				<ChevronLeftIcon label="" size="small" />
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<button
							type="button"
							className="mr-2 flex items-center gap-1 rounded-sm px-1 py-0.5 tabular-nums text-text outline-none hover:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring/50"
							aria-label="Jump to section"
						/>
					}
				>
					<span>{sectionLabel(screens, index)}</span>
					<ChevronDownIcon label="" size="small" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="center" portalled={false}>
					{runs.map((run, runIndex) => (
						<DropdownMenuItem
							key={run.startIndex}
							selected={runIndex === activeRun}
							onSelect={() => goTo(run.startIndex)}
						>
							{run.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<Button
				type="button"
				variant="outline"
				size="icon-compact"
				aria-label="Next screen"
				onClick={next}
				disabled={!canNext}
			>
				<ChevronRightIcon label="" size="small" />
			</Button>
		</div>
	);
}

/**
 * Renders the active card's current screen:
 *   - `design` → a named golden-path design pattern from its own stage
 *     component (e.g. "kanban" → `KanbanStage`), keyed by screen id so it mounts
 *     fresh when navigated to.
 *   - `liveBeat` → the LIVE Terminal presenter, reconciled to that beat. The
 *     component is intentionally NOT keyed by screen id, so a run of live
 *     screens shares one persistent presenter instance and animates between
 *     beats (split, typing, output, board) as the card steps.
 *   - `terminalBeat` → the Terminal demo frozen at that beat (keyed by screen id
 *     so each is a fresh, discrete snapshot).
 *   - otherwise → the configured screen title.
 */
export function SessionStage({
	screens,
	controller,
}: Readonly<{
	screens: readonly SessionScreen[];
	controller: ScreenNavigatorController;
}>): React.ReactElement {
	const screen = screens[controller.index] ?? screens[0];
	if (screen?.design === "kanban") {
		const scenario = screen.scenario === "local-completed" || screen.scenario === "global-assignment"
			? screen.scenario
			: "local-review";
		return <KanbanStage key={screen.id} scenario={scenario} />;
	}

	if (screen?.design === "rovo") {
		return <RovoStage key={screen.id} />;
	}

	if (screen?.design === "for-you") {
		return <ForYouStage key={screen.id} />;
	}

	if (screen?.design === "jira-kanban") {
		return <JiraDesignStage key={screen.id} />;
	}

	if (screen?.liveBeat != null) {
		return <TerminalLiveScreen targetBeat={screen.liveBeat} />;
	}

	if (screen?.terminalBeat != null) {
		return <TerminalBeatScreen key={screen.id} beat={screen.terminalBeat} />;
	}

	return (
		<div className="flex h-full w-full items-center justify-center">
			<h2 className="text-center font-semibold text-4xl tracking-tight text-text sm:text-6xl">
				{screen?.title}
			</h2>
		</div>
	);
}

function JiraDesignStage(): React.ReactElement {
	const [view, setView] = useState<JiraDesignView>("board");

	return <JiraDesignWorkspaceStage onViewChange={setView} view={view} />;
}
