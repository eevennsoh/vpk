"use client";

import { useId, useState, type RefCallback } from "react";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";

import { MEASURE } from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-story";
import { PulseSectionLabel } from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-signals";
import {
	PULSE_EYEBROW,
	PULSE_ITEM_BODY,
	PULSE_ITEM_TITLE,
} from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-type";
import type { PulseSuggestedQuestion } from "@/components/blocks/jira-kanban/experimental/pulse/data/pulse-scopes";
import type {
	PulseAnswer,
	PulseScope,
} from "@/components/blocks/jira-kanban/experimental/pulse/types";
import { JiraActivityComposer, type JiraActivityActor } from "@/components/blocks/jira-activity";
import { ContextBarPromptFlyout } from "@/components/ui-custom/context-bar";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { motionEase } from "@/lib/motion";

/**
 * Asking the article a question, and where the answer lands.
 *
 * Pulse is a piece of writing, not a dashboard, so the affordance for asking it
 * something is the one Jira already uses when a human wants to say something
 * about a piece of work: the work item's docked comment composer. It is
 * reused wholesale rather than restyled — a second textarea with Pulse-shaped
 * chrome would be a third composer in a product that already has two, and the
 * reader would have to learn that this box submits the same way the other one
 * does. The dock is a plain static sibling under the scrollport: the article
 * already fades its own bottom edge, and a `sticky` box with a z-index would
 * put a second seam on top of that one.
 *
 * The suggestion above it is scaffolding for the first question only: one
 * context-bar pill in the dock, with the rest stacked straight up on hover or click.
 * Once the reader has asked anything they know the box works, so the pill
 * leaves. It unmounts rather than hiding — a row that stays but goes blank
 * leaves a 40px hole — and the dock carries Motion's `layout` prop so the
 * space it frees is FLIPped with a transform instead of animating `height`,
 * which would re-run layout on every frame.
 *
 * The draft is entity-local state and is not carried across scopes: a question
 * typed under Sprint 24 would otherwise be submitted against PAY-90's answers
 * after a filter change. The shell keys this component by scope identity, so
 * the draft is discarded at the boundary rather than after the reader has
 * pressed send (.agents/rules/gotchas-ui.md).
 *
 * Answers are not a chat log. They are the last section of the article, in the
 * article's ruled rhythm and the article's voice: no bubbles, no avatars, no
 * timestamps, no second speaker. The reader asked, and the piece answered.
 *
 * The composer's author is declared here rather than imported from the work
 * item's `jira-activity-adapter`. That module is the work item's data
 * translator — it pulls in session state, the agent roster and the field
 * editor's status map — and reaching into it for four strings would make Pulse
 * depend on the work item's data layer to draw one 24px face. The identity and
 * the avatar are deliberately the same person; only the declaration is local.
 */
const PULSE_READER: JiraActivityActor = {
	id: "pulse-reader",
	name: "Venn",
	kind: "person",
	avatarSrc: "/avatar-user/venn/venn.png",
};

/** duration-normal + ease-out-practical — a small, frequent surface settling. */
const PULSE_ASK_ENTER: Transition = { duration: 0.15, ease: motionEase.outPractical };
/** duration-fast + ease-in — the reader triggered it; clear out of the way. */
const PULSE_ASK_EXIT: Transition = { duration: 0.1, ease: motionEase.in };
/** VPK's duration tokens do not honour the OS setting, so the guard is explicit. */
const PULSE_ASK_STILL: Transition = { duration: 0 };

/**
 * What the box is for, said in the scope's own words. An epic and a sprint are
 * both named by their key in the brief above, so the placeholder can point at
 * that key and the reader knows exactly what "this" means without a second
 * label restating the scope.
 */
function toPulsePlaceholder(scope: PulseScope | null): string {
	return scope === null ? "Ask about this week…" : `Ask about ${scope.key}…`;
}

export interface PulseInsightsComposerProps {
	/** The epic or sprint the article is narrowed to; `null` is the whole week. */
	scope: PulseScope | null;
	suggestions: readonly PulseSuggestedQuestion[];
	/** True once anything has been asked — retires the suggestion row. */
	hasAsked: boolean;
	onAsk: (question: string) => void;
}

export function PulseInsightsComposer({
	scope,
	suggestions,
	hasAsked,
	onAsk,
}: Readonly<PulseInsightsComposerProps>) {
	const shouldReduceMotion = useReducedMotion();
	// Controlled so submitting a typed question and tapping a suggestion both
	// leave the box empty; an uncontrolled composer would keep the draft alive
	// underneath an answer that has already been given.
	const [draft, setDraft] = useState("");
	const placeholder = toPulsePlaceholder(scope);

	function handleAsk(question: string) {
		const body = question.trim();
		if (body.length === 0) return;
		setDraft("");
		onAsk(body);
	}

	return (
		// `layout` is what keeps the collapse off the layout thread. The
		// suggestions row has to free the space it occupies when it retires —
		// fading in place would leave a 40px hole above the composer — but
		// animating `height` re-runs layout every frame. Motion measures the
		// before and after and FLIPs the difference with a transform instead,
		// which is the escape hatch `no-layout-property-animation` names.
		<motion.div
			className="shrink-0 pt-4"
			layout={shouldReduceMotion ? false : "position"}
			transition={shouldReduceMotion ? PULSE_ASK_STILL : PULSE_ASK_ENTER}
		>
			<div className={cn("mx-auto min-w-0", MEASURE)}>
				<AnimatePresence initial={false}>
					{hasAsked || suggestions.length === 0 ? null : (
						<motion.div
							animate={{ opacity: 1 }}
							// The prompt flyout stacks extra questions up over the article, so
							// this wrapper must not clip. Focus rings still clear the dock
							// because the flyout itself is overflow-visible.
							className="overflow-visible"
							exit={{
								opacity: 0,
								transition: shouldReduceMotion ? PULSE_ASK_STILL : PULSE_ASK_EXIT,
							}}
							initial={{ opacity: 0 }}
							key="pulse-insights-suggestions"
							style={{ willChange: "opacity" }}
							transition={shouldReduceMotion ? PULSE_ASK_STILL : PULSE_ASK_ENTER}
						>
							<div className="pb-3">
								{/* One context-bar pill in the dock; hover or click stacks the
								    rest straight up. `Suggestions` is a horizontal ScrollArea
								    built for a full-width chat pane and would clip the third
								    chip at this 36rem measure. */}
								<ContextBarPromptFlyout
									ariaLabel="Suggested questions"
									icon={
										<LightbulbIcon
											color={token("color.icon.subtle")}
											label=""
											size="small"
										/>
									}
									items={suggestions.map((suggestion) => ({
										id: suggestion.id,
										label: suggestion.question,
										onSelect: () => handleAsk(suggestion.question),
									}))}
								/>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				<JiraActivityComposer
					author={PULSE_READER}
					onSubmit={handleAsk}
					onValueChange={setDraft}
					placeholder={placeholder}
					value={draft}
					variant="comment"
				/>
			</div>
		</motion.div>
	);
}

export interface PulseAnswersProps {
	answers: readonly PulseAnswer[];
	/** `usePulseReading().registerAnchor(anchorId)`, so the ruler can jump here. */
	anchorRef?: RefCallback<HTMLElement>;
	anchorId: string;
}

/**
 * The closing section of the article: everything the reader asked, in the order
 * they asked it, each answered in one paragraph. Ruled like every other Pulse
 * section so it reads as the last page of the piece rather than a transcript
 * pinned to the bottom of it.
 */
export function PulseAnswers({ answers, anchorRef, anchorId }: Readonly<PulseAnswersProps>) {
	const shouldReduceMotion = useReducedMotion();
	const labelId = `${useId()}-pulse-answers`;
	const latest = answers.at(-1) ?? null;

	if (answers.length === 0) {
		return null;
	}

	const enter = shouldReduceMotion ? PULSE_ASK_STILL : PULSE_ASK_ENTER;
	const exit = shouldReduceMotion ? PULSE_ASK_STILL : PULSE_ASK_EXIT;
	const offset = shouldReduceMotion ? 0 : 8;

	return (
		<section
			aria-labelledby={labelId}
			className={cn("mt-8 min-w-0", MEASURE)}
			id={anchorId}
			ref={anchorRef}
		>
			<PulseSectionLabel id={labelId}>Answers</PulseSectionLabel>
			<ol className="mt-3 flex flex-col">
				<AnimatePresence>
					{answers.map((answer) => (
						<motion.li
							animate={{ opacity: 1, y: 0 }}
							className="min-w-0 border-b border-border py-6 first:pt-0 last:border-b-0 last:pb-0"
							// The exit timing lives in the exit variant: a lone `transition`
							// prop would quietly run the exit at the entrance's pace.
							exit={{ opacity: 0, transition: exit, y: offset }}
							initial={{ opacity: 0, y: offset }}
							key={answer.id}
							style={{ willChange: "opacity, transform" }}
							transition={enter}
						>
							<p className={PULSE_EYEBROW}>You asked</p>
							<p className={cn("mt-1 text-pretty", PULSE_ITEM_TITLE)}>{answer.question}</p>
							<p className={cn("mt-2 text-pretty leading-6", PULSE_ITEM_BODY)}>{answer.answer}</p>
						</motion.li>
					))}
				</AnimatePresence>
			</ol>
			{/* The answer arrives below the reading position and moves no focus, so
			    one short cue names what was answered rather than re-reading the prose. */}
			<p aria-live="polite" className="sr-only" role="status">
				{latest === null ? "" : `Answered: ${latest.question}`}
			</p>
		</section>
	);
}
