"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import AiSparkleIcon from "@atlaskit/icon/core/ai-sparkle";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import UndoIcon from "@atlaskit/icon/core/undo";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROVO_COLOR_SWATCHES } from "@/lib/rovo-colors";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { SUGGESTION_WORK_ITEM, type WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { GhostValueView } from "./ghost-value-view";
import { WhyCard } from "./why-card";

const [blue, orange, purple] = ROVO_COLOR_SWATCHES;
/** The Rovo spectrum as a slim edge rule: the one "this came from AI" signal on a provisional value. */
const AI_RULE_STYLE: CSSProperties = { backgroundImage: `linear-gradient(to bottom, ${blue.cssVar}, ${purple.cssVar}, ${orange.cssVar})` };
const WHY_SURFACE_STYLE: CSSProperties = { boxShadow: token("elevation.shadow.overlay") };
const ACTIONS_SURFACE_STYLE: CSSProperties = { boxShadow: token("elevation.shadow.raised") };

export interface GhostFieldProps {
	suggestion: WorkItemSuggestion;
	decision: SuggestionDecision;
	/** Just decided: glow once. */
	flashing: boolean;
	/** Just decided: keep Undo visible without hover for a short window. */
	undoable: boolean;
	onAccept: () => void;
	onDismiss: () => void;
	onUndo: () => void;
	/** Which side the why card opens to; rail rows open over the main column. */
	whySide?: "left" | "bottom";
	/** Hide the field label when a heading above already names the field. */
	labelHidden?: boolean;
}

function IconAction({ label, onClick, tone, children }: Readonly<{ label: string; onClick: () => void; tone: "accept" | "dismiss"; children: ReactNode }>) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={(
					<Button
						aria-label={label}
						className={cn(
							"size-7 rounded-full",
							tone === "accept"
								? "text-icon-subtle hover:bg-bg-success-subtler hover:text-icon-success [&_svg]:text-current"
								: "text-icon-subtle hover:bg-bg-neutral-subtle-hovered hover:text-icon [&_svg]:text-current",
						)}
						onClick={onClick}
						size="icon-compact"
						type="button"
						variant="ghost"
					/>
				)}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function StateNote({ decision, undoable, verbose }: Readonly<{ decision: SuggestionDecision; undoable: boolean; verbose: boolean }>) {
	if (decision === "pending") {
		return (
			<span className="flex items-center gap-1 text-xs text-text-discovery">
				<span className="text-icon-discovery"><AiSparkleIcon color="currentColor" label="" size="small" /></span>
				<span className={verbose ? undefined : "sr-only"}>Suggested by {SUGGESTION_WORK_ITEM.agent.name}</span>
			</span>
		);
	}
	if (decision === "accepted") {
		return (
			<span className="flex items-center gap-1 text-xs text-text-subtlest">
				<span className={cn("transition-colors duration-slower ease-out", undoable ? "text-icon-success" : "text-icon-subtlest")}>
					<CheckMarkIcon color="currentColor" label="" size="small" />
				</span>
				<span className={cn(undoable ? "text-text-success" : null)}>Accepted</span>
			</span>
		);
	}
	return <span className="text-xs text-text-subtlest">Dismissed</span>;
}

function Placeholder({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	return (
		<span className="flex items-center gap-2 text-sm text-text-subtlest">
			{suggestion.id === "dueDate" ? <CalendarIcon color="currentColor" label="" size="small" /> : null}
			{suggestion.currentDisplay}
		</span>
	);
}

/**
 * One Details field holding an AI proposal in place. Pending: the full value in soft ink on a faint
 * discovery wash with a Rovo edge rule, plus Dismiss/Accept. Accepted: the same value in solid ink, so
 * nothing jumps. Dismissed: the empty field returns. Every state keeps Undo reachable by keyboard.
 */
export function GhostField({ suggestion, decision, flashing, undoable, onAccept, onDismiss, onUndo, whySide = "left", labelHidden = false }: Readonly<GhostFieldProps>) {
	const labelId = useId();
	const pending = decision === "pending";
	const dismissed = decision === "dismissed";

	return (
		<div
			aria-labelledby={labelId}
			className="group/ghost relative -mx-1 rounded-lg px-2 py-1.5"
			data-decision={decision}
			role="group"
		>
			<span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 rounded-[inherit] bg-linear-to-r from-bg-discovery-subtler/60 via-bg-discovery-subtler/25 to-transparent transition-opacity duration-medium ease-out", pending ? "opacity-100" : "opacity-0")} />
			<span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 rounded-[inherit] bg-bg-success-subtler/50 transition-opacity ease-out", flashing && !dismissed ? "opacity-100 duration-fast" : "opacity-0 duration-slowest")} />
			<span aria-hidden="true" className={cn("pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full transition-opacity duration-medium ease-out", pending ? "opacity-100" : "opacity-0")} style={AI_RULE_STYLE} />

			<div className="relative flex min-h-7 items-center gap-2">
				<span className={cn("text-xs text-text-subtle", labelHidden ? "sr-only" : null)} id={labelId}>{suggestion.label}</span>
				<StateNote decision={decision} undoable={undoable} verbose={labelHidden} />
				<span className="flex-1" />
				{pending ? (
					<span
						className="-my-0.5 -mr-1 flex items-center gap-0.5 rounded-full bg-transparent p-0.5 transition-colors duration-normal ease-out-practical group-hover/ghost:bg-surface-raised group-focus-within/ghost:bg-surface-raised group-hover/ghost:[box-shadow:var(--ghost-actions-shadow)] group-focus-within/ghost:[box-shadow:var(--ghost-actions-shadow)]"
						style={{ "--ghost-actions-shadow": ACTIONS_SURFACE_STYLE.boxShadow } as CSSProperties}
					>
						<IconAction label={`Dismiss suggested ${suggestion.label.toLowerCase()}`} onClick={onDismiss} tone="dismiss">
							<CrossIcon color="currentColor" label="" size="small" />
						</IconAction>
						<IconAction label={`Accept suggested ${suggestion.label.toLowerCase()}`} onClick={onAccept} tone="accept">
							<CheckMarkIcon color="currentColor" label="" size="small" />
						</IconAction>
					</span>
				) : (
					<Button
						aria-label={`Undo ${decision === "accepted" ? "accepting" : "dismissing"} ${suggestion.label.toLowerCase()}`}
						className={cn(
							"-my-0.5 -mr-1 h-6 gap-1 px-2 text-xs transition-opacity duration-normal ease-out-practical focus-visible:opacity-100 group-hover/ghost:opacity-100",
							undoable ? "opacity-100" : "opacity-0",
						)}
						onClick={onUndo}
						size="compact"
						type="button"
						variant="ghost"
					>
						<UndoIcon color="currentColor" label="" size="small" />
						Undo
					</Button>
				)}
			</div>

			<div className="relative mt-0.5">
				{dismissed ? (
					<div className="animate-in fade-in duration-medium ease-out"><Placeholder suggestion={suggestion} /></div>
				) : (
					<Popover>
						<PopoverTrigger
							aria-label={`${suggestion.label}: ${suggestion.valueText}. Show why this was suggested`}
							className="-mx-1 block w-[calc(100%+0.5rem)] cursor-help rounded-md px-1 py-0.5 text-left outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-border-focused data-[popup-open]:bg-bg-neutral-subtle-hovered"
							closeDelay={120}
							delay={350}
							nativeButton={false}
							openOnHover
							render={<div />}
						>
							<GhostValueView provisional={pending} value={suggestion.value} />
						</PopoverTrigger>
						<PopoverContent
							align="start"
							className="w-[22rem] gap-0 p-0"
							side={whySide}
							sideOffset={whySide === "left" ? 20 : 8}
							style={WHY_SURFACE_STYLE}
						>
							<WhyCard suggestion={suggestion} />
						</PopoverContent>
					</Popover>
				)}
			</div>
		</div>
	);
}
