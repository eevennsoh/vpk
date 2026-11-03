"use client";

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { animate, motion, useMotionValue, usePresence, usePresenceData, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import type { WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { CardFace } from "./card-face";
import { CardWhy } from "./card-why";
import { COMMIT_DISTANCE, FADE, FADE_START, FLICK_MIN_DISTANCE, FLICK_VELOCITY, FLY_DISTANCE, LEAVE, SETTLE, SPRING_BACK } from "./constants";
import type { CardEntrance, SwipeDirection } from "./use-deck";
import { useStackPosition } from "./use-stack-position";
import { useEasedLength } from "./use-eased-length";

export interface SwipeCardProps {
	suggestion: WorkItemSuggestion;
	/** 0 is the top card; 1 and 2 peek out behind it. */
	index: number;
	entrance: CardEntrance;
	/** Found by the latest re-run and not yet seen: the label row carries a New mark. */
	isNew: boolean;
	/** The top card's natural height. The top card animates to it; peeks borrow it so the stack reads as one deck. */
	height: number | null;
	onCommit: (direction: SwipeDirection) => void;
	/** The top card hands its signed drag progress (-1…1) to the deck when grabbed, and null when let go without deciding. */
	onGrab: (progress: MotionValue<number> | null) => void;
	/** The top card's drag progress while it is being handled, so cards behind can promote with it. */
	promote: MotionValue<number> | null;
	whyOpen: boolean;
	onWhyOpenChange: (open: boolean) => void;
	whyAnchor: RefObject<HTMLElement | null>;
	whyContainer: HTMLElement | null;
}

interface DragState {
	pointerId: number;
	startX: number;
	scale: number;
	lastX: number;
	lastTime: number;
	velocity: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * One suggestion card. The top card follows the pointer with a slight tilt, tints faintly toward its decision,
 * and commits past a threshold; cards behind it rise and reveal their content as it moves away.
 */
export function SwipeCard({ suggestion, index, entrance, isNew, height, onCommit, onGrab, promote, whyOpen, onWhyOpenChange, whyAnchor, whyContainer }: Readonly<SwipeCardProps>) {
	const isTop = index === 0;
	const [isPresent, safeToRemove] = usePresence();
	const exitDirection = usePresenceData() as SwipeDirection | undefined;
	const reduced = useReducedMotion() ?? false;
	const drag = useRef<DragState | null>(null);
	const [dragging, setDragging] = useState(false);

	const x = useMotionValue(0);
	const progress = useTransform(x, (value) => clamp(value / COMMIT_DISTANCE, -1, 1));
	const rotate = useTransform(x, [-240, 240], [-6, 6]);
	const appear = useMotionValue(entrance == null ? 1 : 0);
	const opacity = useTransform([x, appear], ([offset, shown]: number[]) => shown * (1 - clamp((Math.abs(offset) - FADE_START) / (FLY_DISTANCE - FADE_START), 0, 1)));
	const acceptTint = useTransform(progress, [0, 1], [0, 1]);
	const dismissTint = useTransform(progress, [-1, 0], [1, 0]);
	/**
	 * The colour stays a whisper (it turns muddy on dark surfaces): the success edge, the label line and the lit
	 * button carry the decision.
	 */
	const acceptWash = useTransform(progress, [0, 1], [0, 0.5]);
	const acceptEdge = useTransform(progress, [0, 1], [0, 1]);
	const dismissWash = useTransform(progress, [-1, 0], [0.7, 0]);
	const labelFade = useTransform(progress, [-0.6, 0, 0.6], [0, 1, 0]);
	const { y, scale, content, veil } = useStackPosition({ index, promote, reduced, entering: entrance === "new" });
	const cardHeight = useEasedLength(height);

	const entered = useRef(false);
	useEffect(() => {
		if (entered.current) return;
		entered.current = true;
		if ((entrance === "accept" || entrance === "dismiss") && !reduced) {
			x.set((entrance === "accept" ? 1 : -1) * FLY_DISTANCE * 0.5);
			animate(x, 0, SETTLE);
		}
		if (reduced) appear.set(1);
		else animate(appear, 1, FADE);
	}, [appear, entrance, reduced, x]);

	useEffect(() => {
		if (isPresent) return undefined;
		// A decided top card flies off the way it was swiped; a card leaving from behind (the deck thinning while the agent runs) just fades.
		const sign = exitDirection === "dismiss" ? -1 : 1;
		const flies = isTop && !reduced;
		const leave = flies ? animate(x, sign * FLY_DISTANCE, LEAVE) : animate(appear, 0, reduced ? { duration: 0 } : FADE);
		leave.then(safeToRemove);
		return () => leave.stop();
	}, [appear, exitDirection, isPresent, isTop, reduced, safeToRemove, x]);

	const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (!isTop || !isPresent || event.button !== 0 || (event.target as Element).closest("button, a, input")) return;
		const element = event.currentTarget;
		element.setPointerCapture(event.pointerId);
		const scaleFactor = element.getBoundingClientRect().width / element.offsetWidth || 1;
		drag.current = { pointerId: event.pointerId, startX: event.clientX, scale: scaleFactor, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0 };
		setDragging(true);
		onWhyOpenChange(false);
		onGrab(progress);
	};

	const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const state = drag.current;
		if (!state || state.pointerId !== event.pointerId) return;
		const elapsed = event.timeStamp - state.lastTime;
		if (elapsed > 0) state.velocity = (event.clientX - state.lastX) / state.scale / elapsed;
		state.lastX = event.clientX;
		state.lastTime = event.timeStamp;
		x.set((event.clientX - state.startX) / state.scale);
	};

	const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
		const state = drag.current;
		if (!state || state.pointerId !== event.pointerId) return;
		drag.current = null;
		setDragging(false);
		const distance = x.get();
		const flicked = Math.abs(state.velocity) > FLICK_VELOCITY && Math.abs(distance) > FLICK_MIN_DISTANCE && Math.sign(state.velocity) === Math.sign(distance);
		if (Math.abs(distance) > COMMIT_DISTANCE || flicked) {
			onCommit(distance > 0 ? "accept" : "dismiss");
			return;
		}
		onGrab(null);
		if (reduced) x.set(0);
		else animate(x, 0, SPRING_BACK);
	};

	const lifted = isTop && (dragging || !isPresent);
	const label = (
		<>
			<motion.span className="col-start-1 row-start-1 text-text-subtle" style={{ opacity: labelFade }}>{suggestion.label}</motion.span>
			<motion.span aria-hidden="true" className="col-start-1 row-start-1 inline-flex items-center gap-1 text-text-success" style={{ opacity: acceptTint }}>
				<CheckMarkIcon color="currentColor" label="" size="small" />
				Accept {suggestion.label.toLowerCase()}
			</motion.span>
			<motion.span aria-hidden="true" className="col-start-1 row-start-1 inline-flex items-center gap-1 text-text-subtle" style={{ opacity: dismissTint }}>
				<CrossIcon color="currentColor" label="" size="small" />
				Dismiss {suggestion.label.toLowerCase()}
			</motion.span>
		</>
	);

	return (
		<motion.div
			aria-hidden={isTop ? undefined : true}
			className={cn("absolute inset-x-0 top-0 origin-bottom", isTop && isPresent ? null : "pointer-events-none")}
			data-card-index={index}
			inert={isTop && isPresent ? undefined : true}
			style={{ y, scale, zIndex: isPresent ? 10 - index : 20 }}
		>
			<motion.div
				className={cn("origin-bottom touch-pan-y rounded-xl transition-shadow duration-normal ease-out-practical select-none", isTop ? (dragging ? "cursor-grabbing" : "cursor-grab") : null)}
				onLostPointerCapture={onPointerEnd}
				onPointerCancel={onPointerEnd}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerEnd}
				style={{ x, rotate, boxShadow: token(lifted ? "elevation.shadow.overlay" : "elevation.shadow.raised"), willChange: isTop ? "transform" : undefined }}
			>
				<motion.div
					className={cn(
						"relative flex flex-col overflow-hidden rounded-xl bg-surface-overlay",
						isTop ? "group-focus-visible/deck:ring-2 group-focus-visible/deck:ring-ring" : null,
					)}
					style={{ height: cardHeight, opacity }}
				>
					<motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-surface-sunken" style={{ opacity: veil }} />
					<motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-bg-success" style={{ opacity: acceptWash }} />
					<motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] border border-border-success" style={{ opacity: acceptEdge }} />
					<motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-bg-neutral-subtle-hovered" style={{ opacity: dismissWash }} />
					<motion.div className="relative flex flex-1 flex-col" style={{ opacity: content }}>
						<CardFace
							className="flex-1"
							isNew={isNew}
							label={isTop ? label : undefined}
							suggestion={suggestion}
							why={isTop ? <CardWhy anchor={whyAnchor} container={whyContainer} onOpenChange={onWhyOpenChange} open={whyOpen} suggestion={suggestion} /> : null}
						/>
					</motion.div>
					{/* Light theme lets the raised shadow alone define the card; dark needs a hairline, since shadows barely read there. */}
					{isTop ? <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] dark:border dark:border-border" /> : null}
				</motion.div>
			</motion.div>
		</motion.div>
	);
}
