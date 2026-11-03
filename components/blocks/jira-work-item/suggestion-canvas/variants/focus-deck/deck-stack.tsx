"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motionDuration, motionEase, motionRecipe } from "@/lib/motion";
import { cn } from "@/lib/utils";

import type { SuggestionDecision, SuggestionReview } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { CompletionSummary } from "./completion-summary";
import { FocusCard } from "./focus-card";
import type { DeckDirection, FocusDeck } from "./use-focus-deck";

const SEGMENT_TONE: Readonly<Record<SuggestionDecision, string>> = {
	pending: "bg-bg-neutral-hovered",
	accepted: "bg-success",
	dismissed: "bg-border-bold",
};

const DECISION_LABEL: Readonly<Record<SuggestionDecision, string>> = { pending: "to review", accepted: "accepted", dismissed: "dismissed" };

const CARD_VARIANTS: Variants = {
	enter: (direction: DeckDirection) => ({ opacity: 0, x: 28 * direction }),
	center: { opacity: 1, x: 0, transition: { duration: motionDuration.medium, ease: motionEase.out } },
	exit: (direction: DeckDirection) => ({ opacity: 0, x: -28 * direction, transition: motionRecipe.popup.exit }),
};

function NavButton({ direction, deck, disabled }: Readonly<{ direction: DeckDirection; deck: FocusDeck; disabled: boolean }>) {
	const label = direction === -1 ? "Previous suggestion" : "Next suggestion";
	return (
		<Tooltip>
			<TooltipTrigger
				render={<Button aria-keyshortcuts={direction === -1 ? "ArrowLeft" : "ArrowRight"} aria-label={label} disabled={disabled} onClick={() => deck.step(direction)} size="icon-compact" type="button" variant="ghost" />}
			>
				{direction === -1 ? <ChevronLeftIcon label="" size="small" /> : <ChevronRightIcon label="" size="small" />}
			</TooltipTrigger>
			<TooltipContent className="flex items-center gap-1.5">{label}<Kbd>{direction === -1 ? "←" : "→"}</Kbd></TooltipContent>
		</Tooltip>
	);
}

/** Position, prev/next, and one segment per suggestion coloured by its decision. Segments jump to that card. */
export function DeckProgress({ review, deck }: Readonly<{ review: SuggestionReview; deck: FocusDeck }>) {
	const total = review.suggestions.length;
	const decided = total - review.pending.length;
	return (
		<div className="flex items-center gap-3">
			<span className="shrink-0 text-sm text-text-subtle tabular-nums">
				<span className="font-semibold text-text">{deck.complete ? total : deck.cursor + 1}</span> / {total}
			</span>
			<ol aria-label={`Review progress, ${decided} of ${total} decided`} className="flex flex-1 gap-1">
				{review.suggestions.map((suggestion, index) => {
					const decision = review.decisionOf(suggestion.id);
					const current = !deck.complete && index === deck.cursor;
					return (
						<li className="flex flex-1" key={suggestion.id}>
							<Tooltip>
								<TooltipTrigger
									render={(
										<button
											aria-current={current ? "step" : undefined}
											aria-label={`${suggestion.label}, ${DECISION_LABEL[decision]}`}
											className="group/segment flex h-4 flex-1 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-border-focused"
											onClick={() => deck.goTo(index)}
											type="button"
										/>
									)}
								>
									<span
										className={cn(
											"h-1 w-full rounded-full transition-colors duration-normal ease-out-practical",
											current && decision === "pending" ? "bg-primary" : SEGMENT_TONE[decision],
											current ? "h-1.5" : "group-hover/segment:opacity-70",
											current && decision !== "pending" ? "outline-2 outline-offset-2 outline-border-focused" : null,
										)}
									/>
								</TooltipTrigger>
								<TooltipContent>{suggestion.label} · {DECISION_LABEL[decision]}</TooltipContent>
							</Tooltip>
						</li>
					);
				})}
			</ol>
			<span className="flex shrink-0 items-center gap-0.5">
				<NavButton deck={deck} direction={-1} disabled={deck.complete || deck.cursor === 0} />
				<NavButton deck={deck} direction={1} disabled={deck.complete || deck.cursor === total - 1} />
			</span>
		</div>
	);
}

/** The focus card, the peeking cards behind it, and the completion summary in the same slot. */
export function DeckStack({ review, deck }: Readonly<{ review: SuggestionReview; deck: FocusDeck }>) {
	const { current } = deck;
	const behind = deck.complete ? 0 : Math.min(2, review.pending.filter((suggestion) => suggestion.id !== current?.id).length);
	const total = review.suggestions.length;

	return (
		<div className="relative min-h-0 flex-1">
			<div className="absolute inset-x-0 top-0 bottom-5 flex flex-col">
				<div className="relative flex max-h-full min-h-0 flex-col">
					{[2, 1].map((depth) => (
						<div
							aria-hidden="true"
							className="absolute inset-0 rounded-2xl border border-border bg-surface-raised transition-opacity duration-medium ease-out"
							key={depth}
							style={{ transform: `translateY(${depth * 8}px) scaleX(${1 - depth * 0.04})`, transformOrigin: "bottom center", opacity: depth <= behind ? 1 - depth * 0.3 : 0 }}
						/>
					))}
					<AnimatePresence custom={deck.direction} initial={false} mode="wait">
						<motion.div
							animate="center"
							className="relative flex min-h-0 flex-col"
							custom={deck.direction}
							exit="exit"
							initial="enter"
							key={deck.complete ? "complete" : current?.id}
							style={{ willChange: "transform, opacity" }}
							variants={CARD_VARIANTS}
						>
							{deck.complete ? (
								<CompletionSummary deck={deck} review={review} />
							) : current ? (
								<FocusCard
									decision={review.decisionOf(current.id)}
									hasNext={deck.cursor < total - 1}
									onAccept={deck.accept}
									onDismiss={deck.dismiss}
									onNext={() => deck.step(1)}
									onUndo={() => deck.undo(current.id)}
									position={{ index: deck.cursor, total }}
									suggestion={current}
								/>
							) : null}
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}
