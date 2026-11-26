"use client";

import type { Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import CrossIcon from "@atlaskit/icon/core/cross";
import UndoIcon from "@atlaskit/icon/core/undo";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Icon } from "@/components/ui/icon";
import { motionRecipe } from "@/lib/motion";

import { FADE_OUT, FAN, INSTANT } from "./constants";
import { HeaderButton, PanelHeaderLayout } from "./panel-header";
import { SuggestionsStatusIcon } from "./suggestions-status-icon";
import type { Deck } from "./use-deck";

/**
 * The compact confirmation keeps Undo for the last decision beside Check again and the optional close action.
 */
export function CaughtUp({ feed, deck, checkRef, onUndo, onClose, onRerun }: Readonly<{ feed: SuggestionFeed; deck: Deck; checkRef: Ref<HTMLButtonElement>; onUndo: () => void; onClose?: () => void; onRerun?: () => void }>) {
	const running = feed.status === "running";
	const line = deck.completionLabel;
	const last = deck.lastDecision;
	const reduced = useReducedMotion() ?? false;
	return (
		<motion.div animate={{ opacity: 1, transition: motionRecipe.popup.enter }} initial={{ opacity: 0 }}>
			<PanelHeaderLayout floating={Boolean(onClose)} view="list">
			<div className="flex h-5 shrink-0 items-center justify-center text-icon-success"><Icon aria-hidden render={<StatusSuccessIcon color="currentColor" label="" size="medium" spacing="none" />} /></div>
			<div className="min-w-0 flex-1">
				<p aria-live="polite" className="grid text-sm leading-5 font-medium text-text-subtle">
					<AnimatePresence initial={false} mode="popLayout">
						<motion.span
							animate={{ opacity: 1, y: 0, transition: motionRecipe.popup.enter }}
							className="col-start-1 row-start-1"
							exit={{ opacity: 0, y: -4, transition: motionRecipe.popup.exit }}
							initial={{ opacity: 0, y: 4 }}
							key={line}
						>
							{line}
						</motion.span>
					</AnimatePresence>
				</p>
				<span aria-live="polite" className="sr-only">{running ? "Checking for anything new…" : ""}</span>
			</div>
			{/* Undo steps aside while a check runs (never a dead disabled button); Check again glides to centre and back. */}
			<div className="flex shrink-0 items-center gap-1">
				<AnimatePresence initial={false} mode="popLayout">
					{last && !running ? (
						<motion.div
							animate={{ opacity: 1, scale: 1, transition: reduced ? INSTANT : FAN }}
							exit={{ opacity: 0, scale: 0.8, transition: reduced ? INSTANT : FADE_OUT }}
							initial={{ opacity: 0, scale: 0.8 }}
							key="undo"
						>
							<HeaderButton label={deck.undoLabel ?? "Undo"} onClick={onUndo} portalOutsidePanel tip="Undo"><UndoIcon color="currentColor" label="" size="medium" /></HeaderButton>
						</motion.div>
					) : null}
					<motion.div key="check" layout="position" transition={reduced ? INSTANT : FAN}>
						<HeaderButton buttonRef={checkRef} disabled={running} label="Check again" onClick={onRerun ?? feed.rerun} portalOutsidePanel tip="Check again"><SuggestionsStatusIcon state={running ? "loading" : "done"} /></HeaderButton>
					</motion.div>
				</AnimatePresence>
				{onClose ? <HeaderButton label="Close suggestions" onClick={onClose} portalOutsidePanel tip="Close"><CrossIcon color="currentColor" label="" size="medium" /></HeaderButton> : null}
			</div>
			</PanelHeaderLayout>
		</motion.div>
	);
}
