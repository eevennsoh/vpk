"use client";

import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import UndoIcon from "@atlaskit/icon/core/undo";

import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { Deck, SwipeDirection } from "./use-deck";

const BASE =
	"flex items-center justify-center rounded-full outline-none transition-[background-color,scale] duration-normal ease-out-practical focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-overlay disabled:pointer-events-none disabled:opacity-(--opacity-disabled)";

/**
 * ✕ and ✓ are the same size: a neutral fill for dismiss, a success fill for accept. Dark theme takes the bold
 * success fill, since the subtler one reads as a dull olive disc there.
 */
const LOOK: Readonly<Record<SwipeDirection, string>> = {
	accept: "size-10 bg-bg-success-subtler text-icon-success hover:bg-bg-success-subtler-hovered active:bg-bg-success-subtler-pressed data-armed:scale-110 data-armed:bg-bg-success-subtler-pressed dark:bg-success dark:text-icon-inverse dark:hover:bg-success-hovered dark:active:bg-success-pressed dark:data-armed:bg-success-pressed",
	dismiss: "size-10 bg-bg-neutral text-icon-subtle hover:bg-bg-neutral-hovered hover:text-icon active:bg-bg-neutral-pressed data-armed:scale-110 data-armed:bg-bg-neutral-pressed data-armed:text-icon",
};

function DecisionButton({ direction, label, armed, onClick }: Readonly<{ direction: SwipeDirection; label: string; armed: boolean; onClick: () => void }>) {
	const accept = direction === "accept";
	return (
		<Tooltip>
			<TooltipTrigger
				render={(
					<button
						aria-keyshortcuts={accept ? "ArrowRight" : "ArrowLeft"}
						aria-label={`${accept ? "Accept" : "Dismiss"} ${label.toLowerCase()}`}
						className={cn(BASE, LOOK[direction])}
						data-armed={armed ? "" : undefined}
						onClick={onClick}
						type="button"
					/>
				)}
			>
				{accept ? <CheckMarkIcon color="currentColor" label="" /> : <CrossIcon color="currentColor" label="" />}
			</TooltipTrigger>
			<TooltipContent className="flex items-center gap-2">
				{accept ? "Accept" : "Dismiss"}
				<Kbd>{accept ? "→" : "←"}</Kbd>
			</TooltipContent>
		</Tooltip>
	);
}

export interface DeckControlsProps {
	deck: Deck;
	label: string;
	armed: SwipeDirection | null;
	onCommit: (direction: SwipeDirection) => void;
	onUndo: () => void;
}

/**
 * ✕ and ✓ either side of a labelled Undo. The Undo slot is always reserved so ✕ and ✓ never move; the button
 * appears once there is something to undo. The button matching a swipe lights up once releasing would commit it.
 */
export function DeckControls({ deck, label, armed, onCommit, onUndo }: Readonly<DeckControlsProps>) {
	const last = deck.lastDecision;
	return (
		<div className="flex items-center justify-center gap-3">
			<DecisionButton armed={armed === "dismiss"} direction="dismiss" label={label} onClick={() => onCommit("dismiss")} />
			<span className="flex w-20 items-center justify-center">
				{last ? <UndoButton last={last} onUndo={onUndo} /> : null}
			</span>
			<DecisionButton armed={armed === "accept"} direction="accept" label={label} onClick={() => onCommit("accept")} />
		</div>
	);
}

/** Undo as a word, not a stray glyph: subtle text on a neutral pill that fills on hover. Shared with the caught-up state. */
export function UndoButton({ last, onUndo, className }: Readonly<{ last: NonNullable<Deck["lastDecision"]>; onUndo: () => void; className?: string }>) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={(
					<button
						aria-keyshortcuts="Control+Z Meta+Z"
						aria-label={`Undo ${last.decision === "accept" ? "accepting" : "dismissing"} ${last.ids.length === 1 ? "the last suggestion" : `${last.ids.length} suggestions`}`}
						className={cn(BASE, "h-8 gap-1 bg-bg-neutral-subtle px-3 text-xs font-medium text-text-subtle ring-1 ring-border ring-inset hover:bg-bg-neutral-subtle-hovered hover:text-text active:bg-bg-neutral-subtle-pressed", className)}
						onClick={onUndo}
						type="button"
					/>
				)}
			>
				<UndoIcon color="currentColor" label="" size="small" />
				Undo
			</TooltipTrigger>
			<TooltipContent className="flex items-center gap-2">
				Undo
				<Kbd>⌘Z</Kbd>
			</TooltipContent>
		</Tooltip>
	);
}
