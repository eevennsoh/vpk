"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { DecisionPair } from "./decision-pair";
import { focusKey } from "./ledger-focus";
import { LedgerValue } from "./ledger-value";
import { WhyPopover } from "./why-popover";

export interface LedgerRowProps {
	suggestion: WorkItemSuggestion;
	decision: SuggestionDecision;
	/** Arrived on the latest run and not yet seen. */
	isNew: boolean;
	/** First row under a run divider: it drops its top hairline. */
	leading: boolean;
	/** The caught-up recap list: decided rows show state as one small glyph and Undo waits for hover or focus. */
	compact: boolean;
	whyOpen: boolean;
	/** Another row's why card is open, so this row keeps its hover tint to itself. */
	otherWhyOpen: boolean;
	onWhyOpenChange: (open: boolean) => void;
	whyBoundary: Element | null;
	onAccept: () => void;
	onDismiss: () => void;
	onUndo: () => void;
}

const COLLAPSE = { duration: motionDuration.medium, ease: motionEase.inOut };
const COLLAPSE_EXIT = { duration: motionDuration.normal, ease: motionEase.in };
/** Arrivals unfold a touch slower than a collapse so the eye catches where they land. */
const ARRIVE = { duration: motionDuration.slow, ease: motionEase.inOut };

function DecidedStatus({ decision }: Readonly<{ decision: Exclude<SuggestionDecision, "pending"> }>) {
	return decision === "accepted" ? (
		<span className="inline-flex items-center gap-1 text-xs text-text-success">
			<CheckMarkIcon color="currentColor" label="" size="small" />
			Accepted
		</span>
	) : (
		<span className="inline-flex items-center gap-1 text-xs text-text-subtlest">
			<CrossIcon color="currentColor" label="" size="small" />
			Dismissed
		</span>
	);
}

/** The recap list's state glyph: a quiet ✓ or ✕ before the label instead of a repeated word. */
function DecidedGlyph({ decision }: Readonly<{ decision: Exclude<SuggestionDecision, "pending"> }>) {
	return decision === "accepted" ? (
		<span className="-ml-0.5 flex text-icon-success"><CheckMarkIcon color="currentColor" label="Accepted" size="small" /></span>
	) : (
		<span className="-ml-0.5 flex text-icon-subtlest"><CrossIcon color="currentColor" label="Dismissed" size="small" /></span>
	);
}

const NEW_FADE = { duration: motionDuration.medium, ease: motionEase.outPractical };
const NEW_FADE_OUT = { duration: motionDuration.slower, ease: motionEase.in };

/** A brand dot and "New" mark a fresh arrival; both fade together once the batch is seen or decided. */
function NewTag({ show }: Readonly<{ show: boolean }>) {
	return (
		<AnimatePresence initial={false}>
			{show ? (
				<motion.span
					animate={{ opacity: 1, transition: NEW_FADE }}
					aria-hidden="true"
					className="inline-flex items-center gap-1 text-xs leading-4 font-medium text-text-brand"
					exit={{ opacity: 0, transition: NEW_FADE_OUT }}
					initial={{ opacity: 0 }}
					key="new"
				>
					<span className="size-1.5 rounded-full bg-icon-brand" />
					New
				</motion.span>
			) : null}
		</AnimatePresence>
	);
}

/** The opening sentence of a passage, whole: a recap reads as the gist, never as a clipped string. */
function firstSentence(text: string): string {
	return text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;
}

/** What a decided row recaps, so Undo is an informed choice. Prose leads with its first sentence; lists name their first item and the rest. */
function recapOf(suggestion: WorkItemSuggestion): string {
	switch (suggestion.value.kind) {
		case "paragraph":
			return firstSentence(suggestion.value.text);
		case "checklist": {
			const [first, ...rest] = suggestion.value.items;
			if (rest.length === 0) return first ?? "";
			return `${first} Plus ${rest.length} more ${rest.length === 1 ? "criterion" : "criteria"}.`;
		}
		case "labels":
			return suggestion.value.labels.join(", ");
		default:
			return suggestion.valueText;
	}
}

/**
 * One suggestion: field label above its full value, a quiet Why link and a ✕|✓ pair.
 * Hairlines separate rows; they step aside for the tinted row so it reads as one soft surface.
 */
export function LedgerRow({ suggestion, decision, isNew, leading, compact, whyOpen, otherWhyOpen, onWhyOpenChange, whyBoundary, onAccept, onDismiss, onUndo }: Readonly<LedgerRowProps>) {
	const rowRef = useRef<HTMLLIElement>(null);
	const pending = decision === "pending";
	return (
		<motion.li
			animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
			aria-label={`${isNew ? "New: " : ""}${suggestion.label}: ${suggestion.valueText}`}
			className={cn(
				"group/row relative rounded-lg transition-colors duration-xxshort ease-out-practical",
				"before:pointer-events-none before:absolute before:inset-x-2.5 before:top-0 before:h-px before:bg-border before:transition-opacity before:duration-xxshort first:before:hidden",
				leading ? "before:hidden" : null,
				// Only pending rows take a hover tint, so only they lift the hairline beneath them; an open card's row does the same.
				pending && !otherWhyOpen ? "hover:bg-bg-neutral-subtle-hovered hover:before:opacity-0" : null,
				otherWhyOpen ? null : "[li[data-row][data-decision=pending]:hover+&]:before:opacity-0",
				"[li[data-row][data-why-open]+&]:before:opacity-0",
				whyOpen ? "bg-bg-neutral-subtle-hovered before:opacity-0" : null,
			)}
			data-decision={decision}
			data-row=""
			data-why-open={whyOpen || undefined}
			exit={{ height: 0, opacity: 0, overflow: "hidden", transition: COLLAPSE_EXIT }}
			initial={{ height: 0, opacity: 0, overflow: "hidden" }}
			ref={rowRef}
			transition={ARRIVE}
		>
			<div className={cn("px-2.5 transition-[padding] duration-medium ease-in-out", pending ? "pt-2.5 pb-3" : "py-2")}>
				<div className={cn("flex min-h-6 items-center", compact && !pending ? "gap-1.5" : "gap-2")}>
					{!pending && compact ? <DecidedGlyph decision={decision} /> : null}
					<span className={cn("text-xs", pending ? "text-text-subtle" : compact ? "text-text-subtle" : "text-text-subtlest")}>{suggestion.label}</span>
					{pending ? <NewTag show={isNew} /> : compact ? null : <DecidedStatus decision={decision} />}
					<span className="flex-1" />
					{pending ? (
						<>
							<WhyPopover boundary={whyBoundary} onOpenChange={onWhyOpenChange} open={whyOpen} row={rowRef} suggestion={suggestion} />
							<DecisionPair onAccept={onAccept} onDismiss={onDismiss} suggestion={suggestion} />
						</>
					) : (
						<button
							aria-label={`Undo ${suggestion.label} ${decision === "accepted" ? "accept" : "dismiss"}`}
							className={cn(
								"-mr-1 inline-flex h-6 items-center rounded-md px-1.5 text-xs text-text-subtle outline-none transition-[background-color,color,opacity] duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:ring-2 focus-visible:ring-ring",
								// The recap list keeps Undo in the tab order but only shows it on hover or focus (always on touch).
								compact ? "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" : null,
							)}
							data-focus-key={focusKey.undo(suggestion.id)}
							onClick={onUndo}
							type="button"
						>
							Undo
						</button>
					)}
				</div>
				<AnimatePresence initial={false}>
					{pending ? (
						<motion.div
							animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
							exit={{ height: 0, opacity: 0, overflow: "hidden", transition: COLLAPSE_EXIT }}
							initial={{ height: 0, opacity: 0, overflow: "hidden" }}
							key="value"
							transition={COLLAPSE}
						>
							<div className="pt-1"><LedgerValue plain={suggestion.id === "components" || suggestion.id === "fixVersion"} value={suggestion.value} /></div>
						</motion.div>
					) : (
						<motion.p
							animate={{ height: "auto", opacity: 1 }}
							className={cn("overflow-hidden text-xs leading-4 text-pretty text-text-subtlest", compact ? "pl-4" : null)}
							exit={{ height: 0, opacity: 0, transition: COLLAPSE_EXIT }}
							initial={{ height: 0, opacity: 0 }}
							key="recap"
							transition={COLLAPSE}
						>
							{recapOf(suggestion)}
						</motion.p>
					)}
				</AnimatePresence>
			</div>
		</motion.li>
	);
}
