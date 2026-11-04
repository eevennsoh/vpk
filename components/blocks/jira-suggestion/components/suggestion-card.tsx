"use client";

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useState, type Ref } from "react";
import { AnimatePresence, animate, motion, useMotionValue, usePresence, usePresenceData, useReducedMotion, useTransform, type MotionValue, type Transition } from "motion/react";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-review";
import { cn } from "@/lib/utils";

import { CARD_PAPER, CARD_PAPER_STYLE } from "./card-face";
import { DecidedFace, RowFace, TopFace, TopWhy, type WhyProps } from "./card-faces";
import { ARRIVAL_DROP, CONTENT_IN, FADE, FADE_OUT, FADE_START, FLY_DISTANCE, GATHER_CONTENT_OUT, INSTANT, LEAVE, MORPH, PARK, PARK_LANDING, PEEK_FROM, SETTLE, UNPARK, WHY_IN } from "./constants";
import { clamp, useCardDrag } from "./use-card-drag";
import type { SwipeDirection } from "./use-deck";

/** What the card is right now: the stack's top card, a blank sheet behind it, or a row in the unpacked list. */
export type CardRole = "top" | "sheet" | "row";
/** How a card leaves: flung off the side it was decided to, dissolved (a decided card gathering into an empty stack), or at once (already hidden). */
export type CardExit = SwipeDirection | "fade" | "silent";
/** How a card first appears: in place, back from the side it left by (undo), dropped in (a re-run's find), or faded into its list slot (a decided card that was not in the stack). */
export type CardEntrance = "none" | SwipeDirection | "new" | "reveal";

export interface CardPose {
	x: number;
	y: number;
	rotate: number;
}

export interface SuggestionCardProps extends WhyProps {
	suggestion: WorkItemSuggestion;
	decision: SuggestionDecision;
	role: CardRole;
	pose: CardPose;
	/** How the card travels to a new pose: the morph between modes, or the quicker fan within the stack. */
	poseTransition: Transition;
	/** This card's place in the morph's stagger. */
	delay: number;
	/** The stack ⇄ list morph is in flight. */
	morphing: boolean;
	/**
	 * Out of sight exactly behind the last sheet (a pending card beyond the visible ones, or a decided card gathering
	 * away). It fades out once it has landed there and back in as it starts to move, so however many cards are
	 * pending, the stack casts one clean elevation instead of a pile of shadows.
	 */
	parked: boolean;
	/** Called once a parked card has landed behind the last sheet and faded there, so it can be removed unseen. */
	onParked?: () => void;
	/**
	 * The top card's drag progress while it is grabbed, given to the sheet right behind it: that sheet's face reads
	 * through as the grab nears a commit, so the next suggestion is already legible when the swipe lands.
	 */
	peekProgress: MotionValue<number> | null;
	zIndex: number;
	isNew: boolean;
	entrance: CardEntrance;
	/** The list's depth tail scales and lifts this card's slot. Returns the cleanup. */
	registerDepth: (element: HTMLElement) => () => void;
	onCommit: (direction: SwipeDirection) => void;
	onGrab: (progress: MotionValue<number> | null) => void;
	onTap: () => void;
	onDecide: (direction: SwipeDirection) => void;
	onRestore: () => void;
	ref?: Ref<HTMLDivElement>;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
	if (typeof ref === "function") ref(value);
	else if (ref) ref.current = value;
}

/**
 * One suggestion's card, a single element for its whole life. The same node is a blank sheet tilted behind the top
 * card, the top card itself, and a row in the list, so switching modes only moves it: Motion's layout animation
 * carries it from its stack pose to its list slot and back. The paper's shadow softens into the raised elevation
 * for list rows while the content fades in for the top card and rows, and out for sheets.
 */
export function SuggestionCard({
	suggestion, decision, role, pose, poseTransition, delay, morphing, parked, onParked, peekProgress, zIndex, isNew, entrance, registerDepth,
	onCommit, onGrab, onTap, onDecide, onRestore, whyOpen, onWhyOpenChange, whyAnchor, whyContainer, ref,
}: Readonly<SuggestionCardProps>) {
	const [isPresent, safeToRemove] = usePresence();
	const exitKind = usePresenceData() as CardExit | undefined;
	const reduced = useReducedMotion() ?? false;
	const [arrival] = useState(entrance);
	const top = role === "top";
	const sheet = role === "sheet";

	const { dragX, progress, dragging, handlers } = useCardDrag({
		enabled: top && isPresent,
		onCommit,
		onTap,
		onGrab: (grabbed) => {
			if (grabbed) onWhyOpenChange(false);
			onGrab(grabbed);
		},
	});
	const poseX = useMotionValue(pose.x);
	const poseY = useMotionValue(pose.y - (arrival === "new" ? ARRIVAL_DROP : 0));
	const poseRotate = useMotionValue(pose.rotate);
	const appear = useMotionValue(arrival === "none" ? 1 : 0);
	const shown = useMotionValue(parked ? 0 : 1);
	const x = useTransform([poseX, dragX], ([base, offset]: number[]) => base + offset);
	const rotate = useTransform([poseRotate, dragX], ([base, offset]: number[]) => base + clamp(offset / 240, -1, 1) * 6);
	const opacity = useTransform([appear, shown, dragX], ([appeared, visible, offset]: number[]) => appeared * visible * (1 - clamp((Math.abs(offset) - FADE_START) / (FLY_DISTANCE - FADE_START), 0, 1)));
	const acceptEdge = useTransform(progress, [0, 1], [0, 1]);
	const contentShown = useMotionValue(sheet ? 0 : 1);
	const peek = useMotionValue(0);
	const contentOpacity = useTransform([contentShown, peek], ([base, peeked]: number[]) => Math.max(base, peeked));

	// Arrivals: back from the side it left by, or dropped in from just above. Before paint, so nothing flashes.
	const playArrival = useEffectEvent(() => {
		if (arrival === "none") return;
		if (reduced) {
			appear.set(1);
			return;
		}
		if (arrival !== "new") {
			dragX.jump((arrival === "accept" ? 1 : -1) * FLY_DISTANCE * 0.5);
			animate(dragX, 0, SETTLE);
		}
		animate(appear, 1, arrival === "reveal" ? { ...CONTENT_IN, delay: CONTENT_IN.delay + delay } : FADE);
	});
	// The arrival plays once, on mount.
	useLayoutEffect(() => {
		playArrival();
	}, []);

	const settle = useEffectEvent((target: CardPose) => {
		const transition = reduced ? INSTANT : poseTransition;
		animate(poseX, target.x, transition);
		animate(poseY, target.y, transition);
		animate(poseRotate, target.rotate, transition);
	});
	useEffect(() => settle({ x: pose.x, y: pose.y, rotate: pose.rotate }), [pose.x, pose.y, pose.rotate]);

	// Parked only once its own flight has landed: during a gather the fade waits out this card's stagger plus the
	// spring's settle, so it dissolves exactly behind the last sheet, never in the open. (Motion's layout-animation
	// callbacks are not reliable here: an interrupted flight never reports completing.)
	const park = useEffectEvent((isParked: boolean) => {
		if (reduced) return animate(shown, isParked ? 0 : 1, INSTANT);
		if (!isParked) return animate(shown, 1, UNPARK);
		return animate(shown, 0, morphing ? { ...PARK, delay: delay + PARK_LANDING } : PARK);
	});
	const parkedDone = useEffectEvent(() => onParked?.());
	useEffect(() => {
		let cancelled = false;
		const controls = park(parked);
		if (parked) void controls.then(() => (cancelled ? undefined : parkedDone()));
		return () => {
			cancelled = true;
			controls.stop();
		};
	}, [parked]);

	// The face fades out as the card becomes a sheet (once it is on its way under, while gathering) and in as it becomes
	// the top card or a row. A face already reading through a drag carries on from there instead of starting over.
	const reveal = useEffectEvent((isSheet: boolean) => {
		if (reduced) {
			contentShown.set(isSheet ? 0 : 1);
			peek.set(0);
			return undefined;
		}
		if (isSheet) return animate(contentShown, 0, morphing ? { ...GATHER_CONTENT_OUT, delay: GATHER_CONTENT_OUT.delay + delay } : FADE_OUT);
		const from = Math.max(contentShown.get(), peek.get());
		contentShown.jump(from);
		peek.jump(0);
		return animate(contentShown, 1, from > 0 ? FADE : { ...CONTENT_IN, delay: CONTENT_IN.delay + delay });
	});
	useLayoutEffect(() => {
		const controls = reveal(sheet);
		return () => controls?.stop();
	}, [sheet]);

	useEffect(() => {
		if (peekProgress) return peekProgress.on("change", (value) => peek.set(clamp((Math.abs(value) - PEEK_FROM) / (1 - PEEK_FROM), 0, 1)));
		if (peek.get() === 0) return undefined;
		const controls = animate(peek, 0, reduced ? INSTANT : FADE_OUT);
		return () => controls.stop();
	}, [peek, peekProgress, reduced]);

	const leave = useEffectEvent(() => {
		const kind = exitKind ?? "fade";
		if (kind === "silent") return Promise.resolve();
		if (kind === "fade" || reduced) return animate(appear, 0, reduced ? INSTANT : FADE_OUT);
		return animate(dragX, (kind === "accept" ? 1 : -1) * FLY_DISTANCE, LEAVE);
	});
	useEffect(() => {
		if (isPresent) return;
		let cancelled = false;
		void leave().then(() => (cancelled ? undefined : safeToRemove()));
		return () => {
			cancelled = true;
		};
	}, [isPresent, safeToRemove]);

	const slotRef = useCallback((element: HTMLDivElement | null) => {
		if (!element) return undefined;
		assignRef(ref, element);
		const release = registerDepth(element);
		return () => {
			assignRef(ref, null);
			release();
		};
	}, [ref, registerDepth]);

	const why = { whyOpen, onWhyOpenChange, whyAnchor, whyContainer };
	const morph = { layout: { ...MORPH, delay } };
	// A card keeps a face no taller than its paper in every role: the top card's Why line lives on the paper's edge (below),
	// a sheet wears the row face without controls, and a decided card keeps its one-line receipt even as it gathers.
	const face = top
		? <TopFace isNew={isNew} progress={progress} suggestion={suggestion} />
		: decision === "pending"
			? <RowFace {...why} controls={role === "row"} isNew={isNew} onDecide={onDecide} suggestion={suggestion} />
			: <DecidedFace decision={decision} onRestore={onRestore} suggestion={suggestion} />;

	return (
		<div
			aria-hidden={sheet || undefined}
			className={cn("origin-bottom", sheet ? "absolute inset-0" : "relative")}
			ref={slotRef}
			role={role === "row" ? "listitem" : undefined}
			style={{ zIndex }}
		>
			<motion.div
				className={cn(
					"relative",
					CARD_PAPER,
					"transition-shadow duration-slower ease-in-out",
					parked ? "shadow-none" : role === "row" || sheet ? "shadow-sm" : null,
					// The paper clips its face, so while its size morphs nothing inside can hang past its rounded edge.
					"overflow-hidden",
					sheet ? "h-full cursor-pointer" : null,
					top ? "pb-7" : null,
					top ? cn("touch-pan-y select-none", dragging ? "cursor-grabbing" : "cursor-grab") : null,
					isPresent ? null : "pointer-events-none",
				)}
				data-top-card={top ? "" : undefined}
				layout
				{...(top ? handlers : null)}
				style={{ ...CARD_PAPER_STYLE, x, y: poseY, rotate, opacity }}
				transition={morph}
			>
				<motion.div inert={sheet} layout="position" style={{ opacity: contentOpacity }} transition={morph}>
					{face}
				</motion.div>
				{/*
				  * The top card's Why line sits on the paper's lower edge, outside the face, in the room its pb-7 keeps. The
				  * paper grows that room as it flies into the top slot; the line fades in once the flight has landed (or
				  * with the face, when a sheet steps up), and fades out as the card unpacks into a row.
				  */}
				<AnimatePresence initial={false}>
					{top ? (
						<motion.div className="absolute inset-x-4 bottom-2 flex h-6 items-center" exit={{ opacity: 0, transition: reduced ? INSTANT : FADE_OUT }} key="why" layout="position" transition={morph}>
							<motion.div style={{ opacity: contentOpacity }}>
								<motion.div animate={{ opacity: 1, transition: reduced ? INSTANT : { ...WHY_IN, delay: WHY_IN.delay + delay } }} initial={morphing ? { opacity: 0 } : false}>
									<TopWhy {...why} suggestion={suggestion} />
								</motion.div>
							</motion.div>
						</motion.div>
					) : null}
				</AnimatePresence>
				{/* The success edge confirms which way a drag would land; the label and the lit ✓ carry the rest. */}
				{top ? <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-border-success ring-inset" style={{ opacity: acceptEdge }} /> : null}
			</motion.div>
		</div>
	);
}
