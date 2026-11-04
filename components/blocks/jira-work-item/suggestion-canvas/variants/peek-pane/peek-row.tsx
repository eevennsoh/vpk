"use client";

import type { FocusEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { DecidedLine } from "./decided-line";
import { PeekValue } from "./value";

const COLLAPSE = { duration: motionDuration.medium, ease: motionEase.inOut };
const COLLAPSE_EXIT = { duration: motionDuration.normal, ease: motionEase.in };

export interface PeekRowProps {
	suggestion: WorkItemSuggestion;
	decision: SuggestionDecision;
	isNew: boolean;
	/** Part of the latest decision, so it keeps Undo on screen. */
	recent: boolean;
	/** The pane is explaining this row. */
	peeked: boolean;
	pinned: boolean;
	paneId: string;
	onHover: () => void;
	onLeave: () => void;
	onFocusVisible: () => void;
	onTogglePin: () => void;
	/** `keyboard` is true when the press came from a key, so focus is only restored for keyboard users. */
	onAccept: (keyboard: boolean) => void;
	onDismiss: (keyboard: boolean) => void;
	onUndo: (keyboard: boolean) => void;
}

function IconAction({ label, tip, onClick, tone }: Readonly<{ label: string; tip: string; onClick: (keyboard: boolean) => void; tone: "accept" | "dismiss" }>) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={(
					<Button
						aria-label={label}
						data-peek-focus={tone}
						className={tone === "accept" ? "hover:bg-bg-success-subtler hover:[&_svg]:text-icon-success active:bg-bg-success-subtler" : "hover:[&_svg]:text-icon"}
						onClick={(event) => onClick(event.detail === 0)}
						size="icon-compact"
						type="button"
						variant="ghost"
					/>
				)}
			>
				{tone === "accept" ? <CheckMarkIcon color="currentColor" label="" size="small" /> : <CrossIcon color="currentColor" label="" size="small" />}
			</TooltipTrigger>
			<TooltipContent>{tip}</TooltipContent>
		</Tooltip>
	);
}

function NewMark() {
	return (
		<span className="inline-flex items-center gap-1 text-xs leading-4 font-medium text-text-discovery">
			<span aria-hidden="true" className="size-1.5 rounded-full bg-icon-discovery" />
			New
		</span>
	);
}

type WhyState = "idle" | "peeking" | "pinned";

/**
 * The quiet "Why" affordance. At rest it is hidden, so a list of six rows shows only its ✕|✓ pairs; it appears on row
 * hover or focus within (it stays in the tab order) and always on touch. Peeking lifts the text; pinned turns
 * brand-blue with a pin glyph so a held pane is unmistakable.
 */
function WhyChip({ label, paneId, state, onClick }: Readonly<{ label: string; paneId: string; state: WhyState; onClick: () => void }>) {
	return (
		<button
			aria-controls={paneId}
			aria-label={state === "pinned" ? `Unpin why ${label} was suggested` : `Pin why ${label} was suggested`}
			aria-pressed={state === "pinned"}
			className={cn(
				"mr-1 inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 text-xs font-medium outline-none transition-[opacity,color] duration-xxshort ease-out-practical focus-visible:ring-2 focus-visible:ring-ring",
				state === "pinned" ? "bg-bg-brand-subtlest pl-1 text-text-brand hover:bg-bg-brand-subtlest-hovered" : null,
				state === "peeking" ? "text-text" : null,
				state === "idle" ? "text-text-subtlest opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 hover:bg-bg-neutral-subtle-hovered hover:text-text-subtle [@media(hover:none)]:opacity-100" : null,
			)}
			onClick={onClick}
			type="button"
		>
			{state === "pinned" ? <PinFilledIcon color="currentColor" label="" size="small" /> : null}
			Why
		</button>
	);
}

/** One suggestion: the field label, its full value, a quiet "Why", and a dismiss/accept pair. Decided rows fold to one line with Undo. */
export function PeekRow({ suggestion, decision, isNew, recent, peeked, pinned, paneId, onHover, onLeave, onFocusVisible, onTogglePin, onAccept, onDismiss, onUndo }: Readonly<PeekRowProps>) {
	const pending = decision === "pending";
	const handleFocus = (event: FocusEvent<HTMLLIElement>) => {
		if (pending && event.target.matches(":focus-visible")) onFocusVisible();
	};
	return (
		<motion.li
			animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
			aria-label={`${suggestion.label}: ${suggestion.valueText}`}
			className="relative"
			data-decision={decision}
			data-peek-row={suggestion.id}
			exit={{ height: 0, opacity: 0, overflow: "hidden", transition: COLLAPSE_EXIT }}
			initial={{ height: 0, opacity: 0, overflow: "hidden" }}
			onFocus={handleFocus}
			onPointerEnter={pending ? onHover : undefined}
			onPointerLeave={pending ? onLeave : undefined}
			transition={COLLAPSE}
		>
			<div
				className={cn(
					"group/row relative mx-1.5 rounded-lg px-2.5 transition-colors duration-xxshort ease-out-practical",
					pending ? "py-2 hover:bg-bg-neutral-subtle-hovered" : "py-1",
					peeked ? "bg-bg-neutral-subtle-hovered" : null,
				)}
				data-peek-anchor=""
			>
				{pending ? (
					<div className="flex min-h-6 items-center gap-2">
						<span className="text-xs leading-4 text-text-subtle">{suggestion.label}</span>
						{isNew ? <NewMark /> : null}
						<span className="flex-1" />
						<div className="-mr-1 flex items-center gap-0.5">
							<WhyChip label={suggestion.label} onClick={onTogglePin} paneId={paneId} state={peeked ? (pinned ? "pinned" : "peeking") : "idle"} />
							<IconAction label={`Dismiss ${suggestion.label} suggestion`} onClick={onDismiss} tip="Dismiss" tone="dismiss" />
							<IconAction label={`Accept ${suggestion.label} suggestion`} onClick={onAccept} tip="Accept" tone="accept" />
						</div>
					</div>
				) : (
					<DecidedLine decision={decision} id={suggestion.id} label={suggestion.label} onUndo={onUndo} recent={recent} />
				)}
				<AnimatePresence initial={false}>
					{pending ? (
						<motion.div
							animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
							exit={{ height: 0, opacity: 0, overflow: "hidden", transition: COLLAPSE_EXIT }}
							initial={{ height: 0, opacity: 0, overflow: "hidden" }}
							key="value"
							transition={COLLAPSE}
						>
							<div className="pt-1"><PeekValue value={suggestion.value} /></div>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		</motion.li>
	);
}
