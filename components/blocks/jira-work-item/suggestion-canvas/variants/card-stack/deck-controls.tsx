"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import UndoIcon from "@atlaskit/icon/core/undo";

import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { DISC_GAP, FAN, INSTANT, LEAVE, UNDO_ROOM } from "./constants";
import type { Deck, SwipeDirection } from "./use-deck";

/**
 * Equal neutral discs. Colour is reserved for intent: the disc matching a swipe lights up once releasing would
 * commit it (success for ✓, a deeper neutral for ✕), and pressing gives a small tactile dip.
 */
const DISC =
	"flex size-10 items-center justify-center rounded-full bg-bg-neutral text-icon-subtle outline-none transition-[background-color,color,scale] duration-normal ease-out-practical hover:bg-bg-neutral-hovered hover:text-icon active:scale-95 active:bg-bg-neutral-pressed focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-overlay";

const ARMED: Readonly<Record<SwipeDirection, string>> = {
	accept: "scale-110 bg-bg-success-subtler text-icon-success hover:bg-bg-success-subtler hover:text-icon-success",
	dismiss: "scale-110 bg-bg-neutral-pressed text-icon",
};

function Disc({ label, hint, shortcut, armed, onClick, children }: Readonly<{ label: string; hint: string; shortcut: string; armed?: string | null; onClick: () => void; children: ReactNode }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={<button aria-label={label} className={cn(DISC, armed)} onClick={onClick} type="button" />}>
				{children}
			</TooltipTrigger>
			<TooltipContent className="flex items-center gap-2">
				{hint}
				<Kbd>{shortcut}</Kbd>
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
 * ✕ ✓ under the stack, with ↶ between them only once there is something to undo. The row is laid out for all three
 * at all times with one gap; at rest ✕ and ✓ slide in by half a disc plus half a gap to sit as a pair that same gap
 * apart, and when a decision lands they glide apart while Undo grows into the centre. Only transforms move, so nothing around the row reflows.
 */
export function DeckControls({ deck, label, armed, onCommit, onUndo }: Readonly<DeckControlsProps>) {
	const reduced = useReducedMotion() ?? false;
	const last = deck.lastDecision;
	const field = label.toLowerCase();
	const glide = reduced ? INSTANT : FAN;
	const room = last ? 0 : UNDO_ROOM;
	return (
		<div className="flex items-center justify-center" data-deck-controls="" style={{ gap: DISC_GAP }}>
			<motion.div animate={{ x: room }} initial={false} transition={glide}>
				<Disc armed={armed === "dismiss" ? ARMED.dismiss : null} hint="Dismiss" label={`Dismiss ${field}`} onClick={() => onCommit("dismiss")} shortcut="←">
					<CrossIcon color="currentColor" label="" />
				</Disc>
			</motion.div>
			<div className="grid size-10 place-items-center">
				<AnimatePresence initial={false}>
					{last ? (
						<motion.div
							animate={{ opacity: 1, scale: 1, transition: reduced ? INSTANT : FAN }}
							className="col-start-1 row-start-1"
							exit={{ opacity: 0, scale: 0.6, transition: reduced ? INSTANT : LEAVE }}
							initial={{ opacity: 0, scale: 0.6 }}
							key="undo"
						>
							<Disc hint={deck.undoLabel ?? "Undo"} label={deck.undoLabel ?? "Undo"} onClick={onUndo} shortcut="⌘Z">
								<UndoIcon color="currentColor" label="" />
							</Disc>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
			<motion.div animate={{ x: -room }} initial={false} transition={glide}>
				<Disc armed={armed === "accept" ? ARMED.accept : null} hint="Accept" label={`Accept ${field}`} onClick={() => onCommit("accept")} shortcut="→">
					<CheckMarkIcon color="currentColor" label="" />
				</Disc>
			</motion.div>
		</div>
	);
}
