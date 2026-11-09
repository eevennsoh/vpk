"use client";

import type { KeyboardEvent } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import type { TerminalDemoController } from "../hooks/use-terminal-demo";
import { TmuxStatusBar } from "./terminal-stage-chrome";
import { TerminalStageClaudePane } from "./terminal-stage-claude-pane";
import { TerminalStageJiraPane } from "./terminal-stage-jira-pane";

// ---------------------------------------------------------------------------
// The "Terminal" design pattern for the Jira Golden Journey v0 gallery.
//
// A single tmux-style window telling the story "monitor your Jira work and
// code at the same time": a Claude Code session (right) and an invented
// "Jira CLI" sessions dashboard (left) that live-updates as Claude works.
// Presenter-paced: click the frame to split, then →/Space/click advances
// each beat (see `useTerminalDemo`). Advance affordance lives inside the
// frame (status-bar hint + keyboard); the top bar only shows beat progress.
// Reset is owned by the gallery's Reset control (wired to `restart` in
// `page.tsx`), so there's no dedicated restart button here — `r`/`R` still
// restarts from the keyboard.
// ---------------------------------------------------------------------------

export function TerminalStage({
	controller,
}: Readonly<{ controller: TerminalDemoController }>): React.ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const { state, awaitingClick, statusHint, activeStep, revealCount, selectedKey, handleFrameClick } = controller;

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
				aria-label={awaitingClick ? "Split the terminal to open Jira" : undefined}
				onClick={handleFrameClick}
				onKeyDown={handleKeyDown}
				className={cn(
					"flex h-full max-h-[70vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-surface-raised font-mono text-[13px] text-text shadow-2xl",
					awaitingClick ? "cursor-pointer" : "cursor-default",
				)}
			>
				<div
					className="grid min-h-0 flex-1"
					style={{
						gridTemplateColumns: state.split ? "minmax(0,1fr) 1px minmax(0,1fr)" : "0fr 0px 1fr",
						transition: shouldReduceMotion
							? "none"
							: "grid-template-columns var(--duration-slower) var(--ease-in-out)",
					}}
				>
					<div className="min-w-0 overflow-hidden">
						<TerminalStageJiraPane
							pane={state.left}
							items={state.items}
							dashboardVisible={state.dashboardVisible}
							activeStep={activeStep}
							revealCount={revealCount}
							selectedKey={selectedKey}
						/>
					</div>
					<div className={cn("w-px", state.split ? "bg-border" : "bg-transparent")} />
					<div className="min-w-0 overflow-hidden">
						<TerminalStageClaudePane pane={state.right} activeStep={activeStep} revealCount={revealCount} />
					</div>
				</div>
				<TmuxStatusBar split={state.split} statusHint={statusHint} />
			</div>
		</div>
	);
}
