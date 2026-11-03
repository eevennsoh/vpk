"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";

import { Button } from "@/components/ui/button";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { UNDO_TEXT } from "./menu-chrome";
import { QuietValue } from "./quiet-value";
import { useElementEvents } from "./use-element-events";

/** How a decision was made, so focus follows keyboard reviewers but never jumps under a mouse. */
export type DecideVia = "keyboard" | "pointer";
export type RowMove = "next" | "previous" | "first" | "last";

export interface QuietRowProps {
	suggestion: WorkItemSuggestion;
	decision: SuggestionDecision;
	/** The roving tab stop: only this row, and its own actions, are in the tab order. */
	tabbable: boolean;
	/** Arrived on the latest run and not yet acknowledged. */
	isNew: boolean;
	whyOpen: boolean;
	whyPopupId: string;
	hintId: string;
	onAccept: (via: DecideVia) => void;
	onDismiss: (via: DecideVia) => void;
	onUndo: (via: DecideVia) => void;
	onMove: (move: RowMove) => void;
	onFocusRow: () => void;
	onWhyToggle: (anchor: HTMLElement) => void;
	/** Pointer rest on the suggestion text, or keyboard focus on the row; the panel debounces it into the why card. */
	onHoverStart: (anchor: HTMLElement, via: "pointer" | "focus") => void;
	onHoverCancel: () => void;
	onHoverEnd: () => void;
	/** Receipts hold while hovered or keyboard-focused, so Undo never vanishes from under the cursor. */
	onHold: (holding: boolean) => void;
}

const COLLAPSE_IN = { duration: motionDuration.medium, ease: motionEase.inOut };
const COLLAPSE_OUT = { duration: motionDuration.normal, ease: motionEase.in };
const ROW_KEYS: Readonly<Record<string, RowMove>> = { ArrowDown: "next", ArrowUp: "previous", Home: "first", End: "last" };
const via = (event: { detail: number }): DecideVia => (event.detail === 0 ? "keyboard" : "pointer");
/** ✕/✓ rest invisible and arrive with the row's hover or focus; they stay in the tab order and show on touch. */
const REVEAL = "opacity-0 transition-opacity duration-xxshort ease-out-practical group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100";
/** A receipt's Undo lands where ✕/✓ just were; ignore the rest of a double-click or an immediate second tap. */
const UNDO_GUARD_MS = 450;

export function Receipt({ decision, label }: Readonly<{ decision: Exclude<SuggestionDecision, "pending">; label: string }>) {
	const accepted = decision === "accepted";
	return (
		<span className="flex min-w-0 items-center gap-1.5 text-xs leading-4">
			<span className={cn("flex size-4 shrink-0 items-center justify-center", accepted ? "text-icon-success" : "text-icon-subtlest")}>
				{accepted ? <CheckMarkIcon color="currentColor" label="" size="small" /> : <CrossIcon color="currentColor" label="" size="small" />}
			</span>
			<span className="text-text-subtle">{label}</span>
			<span className="text-text-subtlest">{accepted ? "added" : "dismissed"}</span>
		</span>
	);
}

/**
 * One suggestion: a muted label, the full value, and quiet icon actions that brighten on hover or focus.
 * The row is a single roving tab stop: ↑/↓ move, Enter or → accepts, Delete or ← dismisses, I opens why.
 */
export function QuietRow(props: Readonly<QuietRowProps>) {
	const { suggestion, decision, tabbable, isNew, whyOpen, whyPopupId, hintId, onAccept, onDismiss, onUndo, onMove, onFocusRow, onWhyToggle, onHoverStart, onHoverCancel, onHoverEnd, onHold } = props;
	const pending = decision === "pending";
	const { label } = suggestion;
	const tabIndex = tabbable ? 0 : -1;

	const rowRef = useRef<HTMLDivElement>(null);
	const decidedAt = useRef(0);
	useElementEvents(rowRef, {
		pointerover: (event) => {
			if (event.pointerType !== "mouse" || !rowRef.current) return;
			if (!pending) {
				onHold(true);
				return;
			}
			/** The road to ✕/✓ never opens the card; only resting on the suggestion itself does. */
			if (event.target instanceof Element && event.target.closest("[data-row-actions]")) onHoverCancel();
			else onHoverStart(rowRef.current, "pointer");
		},
		pointerleave: (event) => {
			if (event.pointerType !== "mouse") return;
			if (pending) onHoverEnd();
			else onHold(false);
		},
		focusin: (event) => {
			onFocusRow();
			if (!rowRef.current || event.target !== rowRef.current || !rowRef.current.matches(":focus-visible")) return;
			if (pending) onHoverStart(rowRef.current, "focus");
			else onHold(true);
		},
		focusout: (event) => {
			const next = event.relatedTarget;
			if (!pending && !(next instanceof Node && rowRef.current?.contains(next))) onHold(false);
		},
		keydown: (event) => {
			const move = ROW_KEYS[event.key];
			if (move) {
				event.preventDefault();
				onMove(move);
				return;
			}
			if (event.target !== rowRef.current || event.metaKey || event.ctrlKey || event.altKey) return;
			const key = event.key.toLowerCase();
			if (!pending) {
				if (key === "enter" || key === "z") {
					event.preventDefault();
					onUndo("keyboard");
				}
				return;
			}
			if (key === "enter" || key === "arrowright") onAccept("keyboard");
			else if (key === "delete" || key === "backspace" || key === "arrowleft") onDismiss("keyboard");
			else if ((key === "i" || key === "?") && rowRef.current) onWhyToggle(rowRef.current);
			else return;
			event.preventDefault();
		},
	});

	return (
		<div
			aria-describedby={pending ? hintId : undefined}
			aria-keyshortcuts={pending ? "Enter ArrowRight Delete ArrowLeft I" : "Enter"}
			aria-label={pending ? `${label}: ${suggestion.valueText}` : `${label} ${decision === "accepted" ? "added" : "dismissed"}`}
			className={cn(
				"group/row relative rounded-lg px-2.5 py-1.5 outline-none transition-colors duration-xxshort ease-out-practical focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
				pending ? "hover:bg-bg-neutral-subtle-hovered" : null,
				whyOpen ? "bg-bg-neutral-subtle-hovered" : null,
			)}
			data-decision={decision}
			data-row-id={suggestion.id}
			ref={rowRef}
			role="group"
			tabIndex={tabIndex}
		>
			<div className="flex min-h-6 items-center gap-2">
				{pending ? (
					<span className="flex items-center gap-1.5 text-xs leading-4 text-text-subtlest">
						{isNew ? <span aria-hidden="true" className="size-1.5 rounded-full bg-icon-discovery" /> : null}
						{label}
						{isNew ? <span className="sr-only">, new</span> : null}
					</span>
				) : <Receipt decision={decision} label={label} />}
				<span className="flex-1" />
				{pending ? (
					<div className="-my-0.5 -mr-1 flex shrink-0 items-center gap-0.5" data-row-actions="">
						<Button
							aria-controls={whyOpen ? whyPopupId : undefined}
							aria-expanded={whyOpen}
							aria-label={`Why ${label} was suggested`}
							className={cn(
								REVEAL,
								"text-icon-subtlest hover:[&_svg]:text-icon",
								"aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:opacity-100 aria-expanded:[&_svg]:text-icon-discovery",
							)}
							onClick={(event) => onWhyToggle(event.currentTarget.closest<HTMLElement>("[data-row-id]") ?? event.currentTarget)}
							size="icon-compact"
							tabIndex={-1}
							type="button"
							variant="ghost"
						>
							<LightbulbIcon color="currentColor" label="" size="small" />
						</Button>
						<Button
							aria-label={`Dismiss ${label} suggestion`}
							className={cn(REVEAL, "text-icon-subtle hover:[&_svg]:text-icon", whyOpen ? "opacity-100" : null)}
							onClick={(event) => {
								decidedAt.current = event.timeStamp;
								onDismiss(via(event));
							}}
							size="icon-compact"
							tabIndex={tabIndex}
							type="button"
							variant="ghost"
						>
							<CrossIcon color="currentColor" label="" size="small" />
						</Button>
						<Button
							aria-label={`Accept ${label} suggestion`}
							className={cn(REVEAL, "text-icon hover:bg-bg-success-subtler hover:[&_svg]:text-icon-success active:bg-bg-success-subtler-pressed", whyOpen ? "opacity-100" : null)}
							onClick={(event) => {
								decidedAt.current = event.timeStamp;
								onAccept(via(event));
							}}
							size="icon-compact"
							tabIndex={tabIndex}
							type="button"
							variant="ghost"
						>
							<CheckMarkIcon color="currentColor" label="" size="small" />
						</Button>
					</div>
				) : (
					<Button
						aria-label={`Undo ${label} ${decision === "accepted" ? "accept" : "dismiss"}`}
						className={cn("-my-0.5 -mr-1", UNDO_TEXT)}
						onClick={(event) => {
							if (event.detail > 1 || event.timeStamp - decidedAt.current < UNDO_GUARD_MS) return;
							onUndo(via(event));
						}}
						size="compact"
						tabIndex={tabIndex}
						type="button"
						variant="ghost"
					>
						Undo
					</Button>
				)}
			</div>
			<AnimatePresence initial={false}>
				{pending ? (
					<motion.div
						animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
						exit={{ height: 0, opacity: 0, overflow: "hidden", transition: COLLAPSE_OUT }}
						initial={{ height: 0, opacity: 0, overflow: "hidden" }}
						key="value"
						transition={COLLAPSE_IN}
					>
						<div className="pt-0.5 pb-1"><QuietValue value={suggestion.value} /></div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
