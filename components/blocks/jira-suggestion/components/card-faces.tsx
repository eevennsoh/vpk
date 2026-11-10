"use client";

import type { ReactNode, RefObject } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import UndoIcon from "@atlaskit/icon/core/undo";

import type { SuggestionValue, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { CardFace } from "./card-face";
import { CardWhy } from "./card-why";
import type { SwipeDirection } from "./use-deck";

/** A complete, short reminder of what was decided; a paragraph has no honest short form, so it gets none (never cut off). */
export function valueGist(value: SuggestionValue): string | null {
	switch (value.kind) {
		case "paragraph":
			return null;
		case "date":
			return value.display;
		case "person":
			return value.person.name;
		case "issue":
			return value.issue.key;
		case "labels":
			return `${value.labels.length} ${value.labels.length === 1 ? "label" : "labels"}`;
		case "checklist":
			return `${value.items.length} criteria`;
		default: {
			const unreachable: never = value;
			return unreachable;
		}
	}
}

/** What every face needs to open its reasoning card. */
export interface WhyProps {
	whyOpen: boolean;
	onWhyOpenChange: (open: boolean) => void;
	whyAnchor: RefObject<HTMLElement | null>;
	whyContainer: HTMLElement | null;
}

/**
 * The top card's face: its label turns into the decision a drag would make. Its "Why · N sources" line is not part of
 * the face: SuggestionCard pins it to the paper's bottom edge, so the face is never taller than the paper mid-morph.
 */
export function TopFace({ suggestion, isNew, progress }: Readonly<{ suggestion: WorkItemSuggestion; isNew: boolean; progress: MotionValue<number> }>) {
	const acceptHint = useTransform(progress, [0, 1], [0, 1]);
	const dismissHint = useTransform(progress, [-1, 0], [1, 0]);
	const labelFade = useTransform(progress, [-0.6, 0, 0.6], [0, 1, 0]);
	return (
		<CardFace
			className={FACE_PADDING}
			isNew={isNew}
			label={(
				<>
					<motion.span className="col-start-1 row-start-1 text-text-subtle" style={{ opacity: labelFade }}>{suggestion.label}</motion.span>
					<motion.span aria-hidden="true" className="col-start-1 row-start-1 inline-flex items-center gap-1 text-text-success" style={{ opacity: acceptHint }}>
						<CheckMarkIcon color="currentColor" label="" size="small" />
						Accept
					</motion.span>
					<motion.span aria-hidden="true" className="col-start-1 row-start-1 inline-flex items-center gap-1 text-text-subtle" style={{ opacity: dismissHint }}>
						<CrossIcon color="currentColor" label="" size="small" />
						Dismiss
					</motion.span>
				</>
			)}
			suggestion={suggestion}
		/>
	);
}

/** The quiet "Why · N sources" line along the top card's lower edge. */
export function TopWhy({ suggestion, whyOpen, onWhyOpenChange, whyAnchor, whyContainer }: Readonly<WhyProps & { suggestion: WorkItemSuggestion }>) {
	if (suggestion.reason.evidence.length === 0) return null;
	return <CardWhy anchor={whyAnchor} appearance="line" container={whyContainer} onOpenChange={onWhyOpenChange} open={whyOpen} suggestion={suggestion} />;
}

/** Every face shares one padding, so a card changing face (row, sheet, top) never shifts its label or value. */
const FACE_PADDING = "px-4 pt-2.5 pb-3";

const ROUND = "flex size-7 pointer-coarse:size-8 items-center justify-center rounded-full outline-none transition-colors duration-xxshort ease-out-practical focus-visible:ring-2 focus-visible:ring-ring";

function RoundAction({ label, hint, className, onClick, children }: Readonly<{ label: string; hint: string; className: string; onClick: () => void; children: ReactNode }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={<button aria-label={label} className={cn(ROUND, className)} onClick={onClick} type="button" />}>{children}</TooltipTrigger>
			<TooltipContent>{hint}</TooltipContent>
		</Tooltip>
	);
}

/**
 * A pending list row: label with the lightbulb, ✕ and ✓ on the right, then the full value. The controls are part of the
 * face, so they fade in with it as the row lands rather than popping in afterwards. A sheet wears this face without
 * controls while it gathers under the top card, so its content never outgrows its paper mid-flight.
 */
export function RowFace({ suggestion, isNew, controls, onDecide, whyOpen, onWhyOpenChange, whyAnchor, whyContainer }: Readonly<WhyProps & { suggestion: WorkItemSuggestion; isNew: boolean; controls: boolean; onDecide: (direction: SwipeDirection) => void }>) {
	const field = suggestion.label.toLowerCase();
	return (
		<CardFace
			actions={controls ? (
				<>
					{suggestion.reason.evidence.length ? <CardWhy anchor={whyAnchor} appearance="icon" container={whyContainer} onOpenChange={onWhyOpenChange} open={whyOpen} suggestion={suggestion} /> : null}
					<RoundAction className="text-icon-subtle hover:bg-bg-neutral-subtle-hovered hover:text-icon active:bg-bg-neutral-subtle-pressed" hint="Dismiss" label={`Dismiss ${field}`} onClick={() => onDecide("dismiss")}>
						<CrossIcon color="currentColor" label="" size="small" />
					</RoundAction>
					<RoundAction className="text-icon-subtle hover:bg-bg-success-subtler hover:text-icon-success active:bg-bg-success-subtler-pressed" hint="Accept" label={`Accept ${field}`} onClick={() => onDecide("accept")}>
						<CheckMarkIcon color="currentColor" label="" size="small" />
					</RoundAction>
				</>
			) : null}
			className={FACE_PADDING}
			isNew={isNew}
			suggestion={suggestion}
		/>
	);
}

/** A decided list row folds to one quiet line: which way it went, a complete gist of the value, and Undo. */
export function DecidedFace({ suggestion, decision, onRestore }: Readonly<{ suggestion: WorkItemSuggestion; decision: SuggestionDecision; onRestore: () => void }>) {
	const accepted = decision === "accepted";
	return (
		<div className="flex min-h-10 items-center gap-2 px-4 text-sm">
			<span className={cn("flex shrink-0", accepted ? "text-icon-success" : "text-icon-subtlest")}>
				{accepted ? <CheckMarkIcon color="currentColor" label="" size="small" /> : <CrossIcon color="currentColor" label="" size="small" />}
			</span>
			<span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
				<span className={accepted ? "text-text" : "text-text-subtle"}>{suggestion.label}</span>
				<span className="text-xs text-text-subtlest">{[accepted ? "Added" : "Dismissed", valueGist(suggestion.value)].filter(Boolean).join(" · ")}</span>
			</span>
			<button
				aria-label={`Undo ${suggestion.label.toLowerCase()}`}
				className="-mr-2 inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs text-text-subtle outline-none transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:ring-2 focus-visible:ring-ring"
				onClick={onRestore}
				type="button"
			>
				<UndoIcon color="currentColor" label="" size="small" />
				Undo
			</button>
		</div>
	);
}
