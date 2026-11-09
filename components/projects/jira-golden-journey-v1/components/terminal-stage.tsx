"use client";

import type { KeyboardEvent } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import type { TerminalDemoController } from "../hooks/use-terminal-demo";
import { TmuxStatusBar } from "./terminal-stage-chrome";
import { TerminalStageClaudePane } from "./terminal-stage-claude-pane";
import { TerminalStageJiraPane } from "./terminal-stage-jira-pane";

// ---------------------------------------------------------------------------
// The configurable "Terminal" design pattern. Jira Golden Journey v1 remains
// the default story; other routes supply their own beats and chrome through the
// controller.
//
// A single tmux-style window. The original presentation pairs a Jira CLI
// dashboard with Claude Code; route-owned stories can choose a Claude-only
// layout when the local coding flow is the sole focus. Presenter-paced:
// click the frame, then →/Space advances each beat (see `useTerminalDemo`).
// Advance affordance lives inside the
// frame (status-bar hint + keyboard); the top bar only shows beat progress.
// Reset is owned by the gallery's Reset control (wired to `restart` in
// `page.tsx`), so there's no dedicated restart button here — `r`/`R` still
// restarts from the keyboard.
// ---------------------------------------------------------------------------

export function TerminalControls({
	controller,
}: Readonly<{ controller: TerminalDemoController }>): React.ReactElement {
	const currentBeat = Math.min(controller.state.beatIndex + 1, controller.beatCount);
	return (
		<div className="flex items-center gap-3 text-sm text-text">
			<Kbd>left</Kbd>
			<span>
				Beat {currentBeat} — {controller.beatCount}
			</span>
			<Kbd>right</Kbd>
		</div>
	);
}

export function TerminalStage({
	controller,
}: Readonly<{ controller: TerminalDemoController }>): React.ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const { state, story, awaitingClick, statusHint, activeStep, revealCount, selectedKey, handleFrameClick } = controller;
	const isClaudeOnly = story.layout === "claude-only";
	const isSplit = !isClaudeOnly && state.split;

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (!awaitingClick) return;
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			handleFrameClick();
		}
	};

	return (
		// Use semantic surfaces throughout the frame so the route-owned Terminal
		// theme controls the demo itself as well as the surrounding Gallery chrome.
		<div className="relative left-1/2 flex h-full min-h-0 w-[100cqw] -translate-x-1/2 items-center justify-center px-8">
			<div
				role={awaitingClick ? "button" : undefined}
				tabIndex={awaitingClick ? 0 : undefined}
				aria-label={awaitingClick ? story.frameAriaLabel : undefined}
				onClick={handleFrameClick}
				onKeyDown={handleKeyDown}
				className={cn(
					"flex h-full max-h-[70vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-surface-raised font-mono text-[13px] text-text shadow-2xl",
					awaitingClick ? "cursor-pointer" : "cursor-default",
				)}
			>
				<div
					className="grid min-h-0 flex-1"
					data-terminal-layout={isClaudeOnly ? "claude-only" : "dual-pane"}
					style={{
						gridTemplateColumns: isClaudeOnly
							? "minmax(0,1fr)"
							: isSplit
								? "minmax(0,1fr) 1px minmax(0,1fr)"
								: "0fr 0px 1fr",
						transition: shouldReduceMotion || isClaudeOnly
							? "none"
							: "grid-template-columns var(--duration-slower) var(--ease-in-out)",
					}}
				>
					{isClaudeOnly ? null : (
						<>
							<div className="min-w-0 overflow-hidden" data-terminal-pane="jira">
								<TerminalStageJiraPane
									pane={state.left}
									items={state.items}
									dashboardVisible={state.dashboardVisible}
									activeStep={activeStep}
									revealCount={revealCount}
									selectedKey={selectedKey}
									story={story}
								/>
							</div>
							<div className={cn("w-px", isSplit ? "bg-border" : "bg-transparent")} />
						</>
					)}
					<div className="min-w-0 overflow-hidden" data-terminal-pane="claude">
						<TerminalStageClaudePane
							pane={state.right}
							activeStep={activeStep}
							revealCount={revealCount}
							story={story}
						/>
					</div>
				</div>
				<TmuxStatusBar split={isSplit} statusHint={statusHint} story={story} />
			</div>
		</div>
	);
}
