"use client";

import Image from "next/image";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import QuestionCircleFilledIcon from "@atlaskit/icon-lab/core/question-circle-filled";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefCallback } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";

import type { AgentListState } from "@/components/blocks/agent-list";
import {
	AGENT_SESSION_ARRIVAL_TRANSITION,
	AGENT_SESSION_USER_NOTCH_MORPH_TRANSITION,
} from "@/components/blocks/agent-session/agent-session-arrival-motion";
import { AgentSessionMediumDrag } from "@/components/blocks/agent-session/agent-session-medium-drag";
import { AgentSessionNotchMark } from "@/components/blocks/agent-session/agent-session-notch";
import {
	toAgentSessionVisibleIdentity,
	type AgentSessionItem,
} from "@/components/blocks/agent-session/agent-session-types";
import type { JiraIssueAgentSessionDragBinding } from "@/components/blocks/jira-issue/agent-session-drag";
import {
	bindAgentSessionFlyoutActions,
	resolveAgentSessionWorkItemKey,
	toAgentSessionUntrackedWorkFlyoutItem,
} from "@/components/blocks/agent-session/agent-session-work-item";
import type { JiraSidebarSessionItem } from "@/components/blocks/product-sidebar/variants/jira";
import {
	AGENT_SESSION_NOTCH_MAGNIFY_IN,
	AGENT_SESSION_NOTCH_MAGNIFY_OUT,
	AGENT_SESSION_NOTCH_NO_NEAREST,
	AGENT_SESSION_NOTCH_POINTER_AWAY,
	AGENT_SESSION_NOTCH_TONE,
	AGENT_SESSION_USER_NOTCH_DIAMETER,
	toAgentSessionNotchMagnification,
	toAgentSessionUserNotchDiameter,
	toNearestAgentSessionNotchIndex,
	type AgentSessionNotchProximity,
} from "@/components/blocks/agent-session/agent-session-notch-magnify";
import {
	createJiraSessionFlyoutHandle,
	JiraSessionFlyoutSurface,
	JiraSessionFlyoutTrigger,
	type JiraSessionFlyoutHandle,
} from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { Icon } from "@/components/ui/icon";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { cn } from "@/lib/utils";

import {
	advanceAgentSessionRailOrder,
	releaseAgentSessionRailOrder,
	settleAgentSessionRailOrder,
	toAgentSessionRailHitSlopStyle,
	toAgentSessionRailViewportMaxHeight,
} from "./agent-session-column-rail-viewport";
import type { AgentSessionColumnNotchShape } from "./agent-session-column-types";
import { useAgentSessionUserNotchArrival } from "./use-agent-session-user-notch-arrival";
import { useAgentSessionRailHoverIntent } from "./use-agent-session-rail-hover-intent";

export { AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS } from "./agent-session-column-rail-viewport";

/**
 * The collapsed form of the Agent Session column.
 *
 * The board's status columns collapse into a vertical pill under a header that
 * keeps the count in the same slot it uses when expanded. This column is
 * different: its contents are sessions, each of which is a live thing worth
 * reaching, so it collapses into a rail of compact markers instead of a label —
 * one per session, in list order. The count and expand control live in the
 * column header, not on the rail.
 *
 * Circular markers are the default and are the compact form of the same human
 * avatar shown on the expanded card. Running sessions dock as dots that grow
 * from 4px toward a 12px cap; pointer or keyboard focus reveals the face. An
 * arriving running session shows that face, then morphs it onto its 4px rest
 * disc. Needs-input and complete arrivals use the same reveal, hold, and morph
 * for a 12px question or filled check icon. All three settle onto the 4px dot;
 * a status revision can replay its icon inside the stable notch row without
 * replacing the flyout or drag target. Line markers retain the original
 * horizontal treatment and falloff.
 *
 * Circle unread uses `color.icon.subtle`; reviewed dots stay `icon.disabled`. Size
 * carries proximity and the face carries direct interest. Lifecycle remains
 * spoken, while line mode retains its previous selected/new tone treatment.
 *
 * The rail is the plane below the header and, because the board pins this
 * column outside its horizontal scrollport, it stays put while the reader
 * scrolls to the last status column.
 */

/** Reach centered dots: a 3rem band ends before the last visible session. */
const AGENT_SESSION_RAIL_FADE_SIZE = "6rem";

// Wait out the board's longest surrounding motion window (duration-slowest)
// before the gutter claims attention as the final first-visit animation.
const AGENT_SESSION_GUTTER_INTRO_LEAD_DELAY_SECONDS = 0.6;
const AGENT_SESSION_GUTTER_INTRO_VISUAL_DURATION_SECONDS = 0.3;
// 40ms steps overlap each 300ms visual settle by 260ms, so sibling dots move together.
const AGENT_SESSION_GUTTER_INTRO_STAGGER_SECONDS = 0.04;
const AGENT_SESSION_GUTTER_INTRO_VARIANTS: Variants = {
	rest: { opacity: 1, transform: "scale(1)" },
	wave: (index: number) => ({
		opacity: [0, 1],
		transform: ["scale(3)", "scale(1)"],
		transition: {
			bounce: 0,
			delay: AGENT_SESSION_GUTTER_INTRO_LEAD_DELAY_SECONDS
				+ index * AGENT_SESSION_GUTTER_INTRO_STAGGER_SECONDS,
			type: "spring",
			visualDuration: AGENT_SESSION_GUTTER_INTRO_VISUAL_DURATION_SECONDS,
		},
	}),
};


/** Spoken state, so the rail still names a lifecycle it no longer paints. */
const NOTCH_STATE_LABEL: Record<AgentListState, string> = {
	attention: "needs attention",
	complete: "finished",
	"needs-input": "needs input",
	running: "running",
};

/**
 * The rail's dock: one pointer position and one swell amount, shared by every
 * notch on it.
 *
 * Two cadences, for the reason Pulse's ruler has two. `pointerY` updates every
 * frame and reaches the notches through motion values, which write straight to
 * the DOM — a rail of marks re-rendering through React on every mouse pixel
 * would stall the column. `magnify` is animated separately so the whole slope
 * fades out on leave instead of collapsing, and it is a plain 0–1 scalar with a
 * finite parked pointer behind it.
 *
 * `nearestIndex` is resolved here rather than in each mark for the same reason a
 * mark cannot know it is the tallest: selection is a property of the rail, not
 * of one notch. Computing it once per pointer move also keeps the marks' own
 * transforms free of any cross-notch comparison.
 *
 * Centres are measured, not derived. The Pulse ruler is a fixed-height track
 * whose marks know their own fractional offset; this is a scrolling flex list,
 * so the only honest source of a notch's position is the DOM. They are stored in
 * the list's *content* space, which makes them survive scrolling: a wheel event
 * moves the pointer through them rather than invalidating them. A re-measure on
 * entry, and whenever the list length changes, covers everything else.
 */
function useNotchDock(itemCount: number, enabled: boolean) {
	const listRef = useRef<HTMLUListElement | null>(null);
	const centersRef = useRef<number[]>([]);
	const clientYRef = useRef<number | null>(null);
	const pointerY = useMotionValue(AGENT_SESSION_NOTCH_POINTER_AWAY);
	const magnify = useMotionValue(0);
	const nearestIndex = useMotionValue(AGENT_SESSION_NOTCH_NO_NEAREST);

	const trackPointer = useCallback((clientY: number) => {
		const list = listRef.current;
		if (list === null) {
			return;
		}
		clientYRef.current = clientY;
		const offset = clientY - list.getBoundingClientRect().top + list.scrollTop;
		pointerY.set(offset);
		nearestIndex.set(toNearestAgentSessionNotchIndex(centersRef.current, offset));
	}, [nearestIndex, pointerY]);

	// Measuring and republishing are one operation on purpose, because measuring
	// alone cannot reach the marks: centres live in a ref, and writing a ref
	// notifies no `useTransform`. Only setting the pointer's motion value
	// recomputes the slope and the selection against the new geometry. Split into
	// two functions, a caller could measure and leave a stationary pointer
	// pointing at where the notches used to be until the next move or scroll.
	const remeasure = useCallback(() => {
		const list = listRef.current;
		if (list === null) {
			return;
		}
		const listRect = list.getBoundingClientRect();
		centersRef.current = Array.from(list.children, (child: Element) => {
			const rect = child.getBoundingClientRect();
			return rect.top - listRect.top + list.scrollTop + rect.height / 2;
		});
		const clientY = clientYRef.current;
		if (clientY !== null) {
			trackPointer(clientY);
		}
	}, [trackPointer]);

	// An arrival slides the notches below it into place over a quarter second. If
	// the pointer is already on the rail the slope would keep pointing at where
	// they were, so the new geometry is picked up as soon as the list changes —
	// including when the pointer never moves, which is the whole reason the
	// republish above is not optional.
	useEffect(() => {
		if (!enabled) {
			return;
		}
		remeasure();
	}, [enabled, itemCount, remeasure]);

	function handlePointerEnter(event: PointerEvent<HTMLUListElement>) {
		// Touch has no hover: a finger sliding here is a scroll, and docking under
		// it would fight the gesture. Tap still opens the flyout.
		if (event.pointerType === "touch" || event.buttons !== 0) {
			return;
		}
		remeasure();
	}

	function resetPointer() {
		clientYRef.current = null;
		magnify.stop();
		magnify.set(0);
		pointerY.set(AGENT_SESSION_NOTCH_POINTER_AWAY);
		nearestIndex.set(AGENT_SESSION_NOTCH_NO_NEAREST);
	}

	function handlePointerMove(event: PointerEvent<HTMLUListElement>) {
		// A dragged notch retains pointer capture: its moves still bubble here
		// while the pointer searches the board for a drop target. Docking is hover
		// feedback only, so pressed pointers must also clear any parked position.
		if (event.buttons !== 0) {
			resetPointer();
			return;
		}
		if (event.pointerType === "touch") {
			return;
		}
		trackPointer(event.clientY);
		if (magnify.get() !== 1) {
			animate(magnify, 1, AGENT_SESSION_NOTCH_MAGNIFY_IN);
		}
	}

	function handlePointerUp(event: PointerEvent<HTMLUListElement>) {
		const list = listRef.current;
		if (event.pointerType === "touch" || list === null) {
			return;
		}
		const rect = list.getBoundingClientRect();
		if (
			event.clientX < rect.left
			|| event.clientX > rect.right
			|| event.clientY < rect.top
			|| event.clientY > rect.bottom
		) {
			return;
		}
		trackPointer(event.clientY);
		animate(magnify, 1, AGENT_SESSION_NOTCH_MAGNIFY_IN);
	}

	function handlePointerLeave() {
		clientYRef.current = null;
		// Selection stays put through the retreat so the colour drains on the same
		// beat as the swell; parking it early would blink the mark to subtlest a
		// frame after the pointer left, ahead of everything else.
		animate(magnify, 0, AGENT_SESSION_NOTCH_MAGNIFY_OUT).then(() => {
			pointerY.set(AGENT_SESSION_NOTCH_POINTER_AWAY);
			nearestIndex.set(AGENT_SESSION_NOTCH_NO_NEAREST);
		});
	}

	function handleScroll() {
		const clientY = clientYRef.current;
		if (clientY === null) {
			return;
		}
		// Centres are in content space, so a scroll only moves the pointer through
		// them — without this the slope would freeze mid-wheel.
		trackPointer(clientY);
	}

	return { centersRef, handlePointerEnter, handlePointerLeave, handlePointerMove, handlePointerUp, handleScroll, listRef, magnify, nearestIndex, pointerY, resetPointer };
}

function AgentSessionGutterIntro({
	children,
	index,
	onComplete,
	play,
	shouldReduceMotion,
}: Readonly<{
	children: ReactNode;
	index: number;
	onComplete?: () => void;
	play: boolean;
	shouldReduceMotion: boolean | null;
}>) {
	const shouldPlayIntro = play && shouldReduceMotion === false;
	let animationState: "rest" | "wave" | undefined;
	if (shouldReduceMotion === null) {
		animationState = undefined;
	} else if (shouldPlayIntro) {
		animationState = "wave";
	} else {
		animationState = "rest";
	}

	return (
		<motion.span
			animate={animationState}
			className="grid size-3 shrink-0 place-items-center opacity-0 motion-reduce:opacity-100"
			custom={index}
			data-agent-session-gutter-intro=""
			initial={false}
			onAnimationComplete={shouldPlayIntro ? onComplete : undefined}
			style={{ willChange: shouldPlayIntro ? "opacity, transform" : undefined }}
			variants={AGENT_SESSION_GUTTER_INTRO_VARIANTS}
		>
			{children}
		</motion.span>
	);
}

function useAgentSessionUserNotchLifecycle({
	avatarSrc,
	isArriving,
	isHighlighted,
	onArrivalComplete,
	shouldReduceMotion,
	state,
}: Readonly<{
	avatarSrc?: string;
	isArriving: boolean;
	isHighlighted: boolean;
	onArrivalComplete?: () => void;
	shouldReduceMotion: boolean | null;
	state: AgentSessionItem["state"];
}>) {
	const hasStateGlyph = state === "needs-input" || state === "complete";
	const hasArrivalVisual = Boolean(avatarSrc) || hasStateGlyph;
	const reducedArrivalStateRef = useRef<AgentSessionItem["state"] | null>(null);
	const finishReducedArrival = useEffectEvent(() => onArrivalComplete?.());
	useEffect(() => {
		if (!isArriving) {
			reducedArrivalStateRef.current = null;
			return;
		}
		if (hasStateGlyph && shouldReduceMotion === true && reducedArrivalStateRef.current !== state) {
			reducedArrivalStateRef.current = state;
			finishReducedArrival();
		}
	}, [hasStateGlyph, isArriving, shouldReduceMotion, state]);
	const { arrivalExiting, arrivalPending, arrivalReveal, shouldPlayScaleArrival } = useAgentSessionUserNotchArrival({
		hasAvatar: hasArrivalVisual,
		isArriving,
		onArrivalComplete,
		shouldReduceMotion,
	});
	const showAvatar = isHighlighted || (!hasStateGlyph && arrivalReveal);
	const showStateGlyph = hasStateGlyph && arrivalReveal && !isHighlighted;
	const isMorphing = arrivalExiting && !isHighlighted;
	// The rest disc is the morph's destination, so it has to be under the face
	// before the face starts collapsing — otherwise the photo dissolves to bare
	// plane and a separate dot fades up behind it, which is the flash. It is
	// hidden only for the pre-reveal frame, when there is no face to sit under;
	// from reveal onward an opaque 12px face covers it, so its own 150ms fade-in
	// plays out unseen during the hold and it is solid by the time the morph
	// starts. Hover keeps its own crossfade.
	const hideRestDisc = hasArrivalVisual && (
		(arrivalPending && !arrivalReveal) || isHighlighted
	);
	return { arrivalExiting, arrivalReveal, shouldPlayScaleArrival, showAvatar, showStateGlyph, isMorphing, hideRestDisc };
}

function AgentSessionUserNotchStateGlyph({
	avatarSrc,
	arrivalMorphScale,
	isMorphing,
	showStateGlyph,
	state,
}: Readonly<{
	avatarSrc?: string;
	arrivalMorphScale: number;
	isMorphing: boolean;
	showStateGlyph: boolean;
	state: AgentSessionItem["state"];
}>) {
	if (state !== "needs-input" && state !== "complete") return null;
	return (
		<span
			aria-hidden="true"
			className={cn(
				// The filled icons have transparent cutouts. This plane-colored
				// disc occludes the 4px rest beneath them until the matched-size
				// morph lets that dot take over again.
				"absolute inset-0 grid size-3 place-items-center rounded-full bg-surface motion-reduce:transition-none",
				avatarSrc ? "group-data-[hovered]/notch:opacity-0 group-has-[:focus-visible]/notch:opacity-0" : null,
				showStateGlyph && !isMorphing
					? "opacity-100 scale-100"
					: "scale-[var(--agent-session-user-notch-morph)] opacity-0",
			)}
			data-agent-session-state-mark={state}
			style={{
				"--agent-session-user-notch-morph": String(arrivalMorphScale),
				transition: isMorphing
					? AGENT_SESSION_USER_NOTCH_MORPH_TRANSITION
					: undefined,
			} as CSSProperties}
		>
			<Icon
				aria-hidden
				className={cn(
					"size-3 [&>span]:size-3! [&_svg]:size-3!",
					state === "needs-input" ? "text-icon-information" : "text-icon-success",
				)}
				render={state === "needs-input"
					? <QuestionCircleFilledIcon color="currentColor" label="" size="small" />
					: <StatusSuccessIcon color="currentColor" label="" size="small" />}
			/>
		</span>
	);
}

/** Arrival face or lifecycle glyph morphs onto the same resting dot. */
function AgentSessionUserNotch({
	avatarSrc,
	introIndex,
	isArriving,
	isHighlighted,
	isNew,
	onArrivalComplete,
	onIntroComplete,
	playIntro,
	proximity,
	state,
}: Readonly<{
	avatarSrc?: string;
	introIndex: number;
	isArriving: boolean;
	isHighlighted: boolean;
	isNew: boolean;
	onArrivalComplete?: () => void;
	onIntroComplete?: () => void;
	playIntro: boolean;
	proximity?: AgentSessionNotchProximity;
	state: AgentSessionItem["state"];
}>) {
	const shouldReduceMotion = useReducedMotion();
	const {
		arrivalExiting, arrivalReveal, shouldPlayScaleArrival,
		showAvatar, showStateGlyph, isMorphing, hideRestDisc,
	} = useAgentSessionUserNotchLifecycle({
		avatarSrc, isArriving, isHighlighted, onArrivalComplete, shouldReduceMotion, state,
	});
	const arrivalMorphScale = AGENT_SESSION_USER_NOTCH_DIAMETER.rest
		/ AGENT_SESSION_USER_NOTCH_DIAMETER.peak;
	const parkedPointerY = useMotionValue(AGENT_SESSION_NOTCH_POINTER_AWAY);
	const parkedMagnify = useMotionValue(0);
	const pointerY = proximity?.pointerY ?? parkedPointerY;
	const magnify = proximity?.magnify ?? parkedMagnify;
	const centersRef = proximity?.centersRef ?? null;
	const index = proximity?.index ?? AGENT_SESSION_NOTCH_NO_NEAREST;
	const falloff = useTransform([pointerY, magnify], ([pointer, amount]: number[]) => {
		if (centersRef === null || pointer < 0 || amount <= 0) {
			return 0;
		}
		const center = centersRef.current[index];
		return center === undefined
			? 0
			: toAgentSessionNotchMagnification(pointer - center) * amount;
	});
	const dotScale = useTransform(
		falloff,
		(value) => `scale(${toAgentSessionUserNotchDiameter(value) / AGENT_SESSION_USER_NOTCH_DIAMETER.rest})`,
	);
	const restingScale = toAgentSessionUserNotchDiameter(0)
		/ AGENT_SESSION_USER_NOTCH_DIAMETER.rest;

	return (
		<AgentSessionGutterIntro
			index={introIndex}
			onComplete={onIntroComplete}
			play={playIntro}
			shouldReduceMotion={shouldReduceMotion}
		>
			<motion.span
				animate={shouldPlayScaleArrival ? { scale: 1 } : undefined}
				aria-hidden="true"
				className="relative grid size-3 shrink-0 place-items-center"
				data-arrival-exiting={arrivalExiting || undefined}
				data-arrival-reveal={arrivalReveal || undefined}
				initial={shouldPlayScaleArrival ? { scale: 0 } : false}
				onAnimationComplete={() => {
					if (shouldPlayScaleArrival) {
						onArrivalComplete?.();
					}
				}}
				style={{ willChange: shouldPlayScaleArrival ? "transform" : undefined }}
				transition={AGENT_SESSION_ARRIVAL_TRANSITION}
			>
				<motion.span
					className={cn(
						"size-1 rounded-full transition-opacity duration-normal ease-out-practical motion-reduce:transition-none",
						avatarSrc
							? "group-data-[hovered]/notch:opacity-0 group-has-[:focus-visible]/notch:opacity-0"
							: null,
						hideRestDisc ? "opacity-0" : null,
					)}
					data-arrival-rest-hidden={hideRestDisc || undefined}
					style={{
						backgroundColor: isNew
							? AGENT_SESSION_NOTCH_TONE.unread
							: AGENT_SESSION_NOTCH_TONE.rest,
						transform: proximity === undefined
							? `scale(${restingScale})`
							: dotScale,
					}}
				/>
				<AgentSessionUserNotchStateGlyph
					avatarSrc={avatarSrc}
					arrivalMorphScale={arrivalMorphScale}
					isMorphing={isMorphing}
					showStateGlyph={showStateGlyph}
					state={state}
				/>
				{avatarSrc ? (
					<Image
						alt=""
						className={cn(
							"absolute inset-0 size-3 rounded-full object-cover",
							"motion-reduce:transition-none",
							"group-data-[hovered]/notch:scale-100 group-data-[hovered]/notch:opacity-100",
							"group-has-[:focus-visible]/notch:scale-100 group-has-[:focus-visible]/notch:opacity-100",
							// Morphing and settled share one target: the face ends the
							// beat exactly where it already sits, so completing the
							// arrival only drops the transition — it never re-snaps.
							showAvatar && !isMorphing
								? "opacity-100 scale-100"
								: "scale-[var(--agent-session-user-notch-morph)] opacity-0",
						)}
						height={12}
						src={avatarSrc}
						style={{
							"--agent-session-user-notch-morph": String(arrivalMorphScale),
							transition: isMorphing
								? AGENT_SESSION_USER_NOTCH_MORPH_TRANSITION
								: undefined,
						} as CSSProperties}
						width={12}
					/>
				) : null}
			</motion.span>
		</AgentSessionGutterIntro>
	);
}

/**
 * One session, as a user dot. Contiguous 24px targets divide the visual gap
 * equally between neighbors. The centered 20px anchor keeps flyout placement
 * and focus rings independent of the wider button; the face stays capped at 12px.
 *
 * Arrival layout lives on the list item, not the flyout trigger. Base UI closes
 * a preview card when its active trigger unmounts, and Motion's layout
 * projection can replace that host — which made each notch open its own flyout
 * instead of sliding the rail's shared popup. A stable `div` is the trigger host
 * so sliding down the notches crossfades in place, the same as the expanded
 * cards. The row still carries `layout="position"` so an arrival slides the
 * notches below it down instead of jumping them.
 *
 * A notch is also a drag handle, so a session can be pulled onto a work item
 * from the collapsed rail exactly as it can from the expanded cards. The drag
 * host wraps the flyout trigger rather than sitting between the trigger and the
 * button: `JiraSessionFlyoutTrigger` clones its child to add `onFocusCapture`,
 * and a component child would swallow that prop and cost the rail its
 * keyboard-opens-the-flyout behavior. `preserveSourceFootprint` holds the row at
 * its measured 24px while the chip travels, so lifting a notch out never
 * reflows the rail under the pointer.
 */
function AgentSessionNotch({
	animateLayout,
	flyoutHandle,
	flyoutSession,
	hitSlopPx,
	introIndex,
	isArriving,
	isHighlighted,
	isHovered,
	isLeaving,
	isNew,
	isStatusReentering,
	item,
	notchShape,
	onArrivalComplete,
	onIntroComplete,
	onView,
	playIntro,
	proximity,
	sessionDrag,
}: Readonly<{
	animateLayout: boolean;
	flyoutHandle: JiraSessionFlyoutHandle;
	flyoutSession: JiraSidebarSessionItem;
	hitSlopPx: number;
	introIndex: number;
	isArriving: boolean;
	isHighlighted: boolean;
	isHovered: boolean;
	isLeaving: boolean;
	isNew: boolean;
	isStatusReentering: boolean;
	item: AgentSessionItem;
	notchShape: AgentSessionColumnNotchShape;
	onArrivalComplete?: () => void;
	onIntroComplete?: () => void;
	onView?: (item: AgentSessionItem) => void;
	playIntro: boolean;
	proximity?: AgentSessionNotchProximity;
	sessionDrag?: JiraIssueAgentSessionDragBinding;
}>) {
	const shouldReduceMotion = useReducedMotion();
	const visibleIdentity = toAgentSessionVisibleIdentity(item);

	// The beat, not the mark: expanding and re-collapsing the column remounts the
	// rail, and a notch that is still unreviewed stays lit without regrowing.
	return (
		<motion.li
			aria-hidden={isLeaving || undefined}
			className={cn(
				"group/notch flex h-6 w-full shrink-0 items-center",
				isLeaving ? "opacity-0" : "opacity-100",
			)}
			data-hovered={isHovered || undefined}
			data-agent-session-status-exit={isLeaving || undefined}
			data-agent-session-status-reentry={isStatusReentering || undefined}
			inert={isLeaving || undefined}
			layout={shouldReduceMotion || !animateLayout || isLeaving || isStatusReentering ? false : "position"}
			// Standalone rails animate order; the in-flow column keeps filters instant.
			layoutDependency={introIndex}
			style={{
				transition: isLeaving
					? "opacity var(--duration-fast) var(--ease-in)"
					: undefined,
			}}
			transition={AGENT_SESSION_ARRIVAL_TRANSITION}
		>
			{/* The drag host is a block child rather than the flex item itself, so
			    the trigger keeps filling the rail whether or not a binding mounted
			    a wrapper around it. */}
			<div className="w-full min-w-0">
				<AgentSessionMediumDrag
					item={item}
					preserveSourceFootprint
					sessionDrag={sessionDrag}
					shouldReduceMotion={shouldReduceMotion}
					source="untracked"
				>
					{(bind) => (
						<JiraSessionFlyoutTrigger
							closeDelay={160}
							data-session-id={item.id}
							delay={0}
							handle={flyoutHandle}
							render={
								<div
									className="mx-auto flex h-5 items-center rounded-xs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
									style={{ width: `calc(100% - ${hitSlopPx * 2}px)` }}
								/>
							}
							session={flyoutSession}
						>
							<button
								{...bind}
								aria-roledescription={bind ? "Draggable agent session" : undefined}
								className="flex h-6 shrink-0 items-center justify-center rounded-xs outline-none"
								data-agent-session-notch=""
								data-highlighted={isHighlighted || undefined}
								data-new={isNew || undefined}
								data-testid={"agent-session-notch-" + item.id}
								draggable={false}
								style={toAgentSessionRailHitSlopStyle(hitSlopPx)}
								// Spread first, then override: `usePointerDrag`'s own
								// `onClick` is not the activation guard here — the drag
								// host's `onClickCapture` already swallows the click that
								// follows a published drag.
								onClick={onView === undefined ? undefined : () => onView(item)}
								type="button"
							>
								<span className="sr-only">
									{`${item.title} — ${NOTCH_STATE_LABEL[item.state]}${isNew ? ", newly synced" : ""}`}
								</span>
								{notchShape === "line" ? (
									<AgentSessionNotchMark
										isArriving={isArriving}
										isHighlighted={isHighlighted}
										isNew={isNew}
										onArrivalComplete={onArrivalComplete}
										proximity={proximity}
									/>
								) : (
									<AgentSessionUserNotch
										avatarSrc={visibleIdentity.avatarSrc}
										introIndex={introIndex}
										isArriving={isArriving}
										isHighlighted={isHighlighted}
										isNew={isNew}
										key={item.state}
										onArrivalComplete={onArrivalComplete}
										onIntroComplete={onIntroComplete}
										playIntro={playIntro}
										proximity={proximity}
										state={item.state}
									/>
								)}
							</button>
						</JiraSessionFlyoutTrigger>
					)}
				</AgentSessionMediumDrag>
			</div>
		</motion.li>
	);
}

export function AgentSessionColumnRail({
	animateLayout = true,
	arrivingItemIds,
	capturedItemIds,
	getSuggestedWorkItemKey,
	getSuggestedWorkItemKeys,
	highlightedItemId,
	hitSlopPx = 0,
	items,
	maxVisibleItems,
	newItemIds,
	stateChangeVersions,
	notchShape = "circle",
	onArrivalComplete,
	onArchiveSession,
	onCreateWorkItem,
	onIntroComplete,
	onItemHover,
	onLinkWorkItem,
	onSubtasks,
	onView,
	playIntro = false,
	sessionDrag,
	showUntrackedWorkFooter,
}: Readonly<{
	animateLayout?: boolean;
	/** Subset of `newItemIds` whose arrival beat has not played yet. */
	arrivingItemIds?: ReadonlySet<string>;
	capturedItemIds?: ReadonlySet<string>;
	getSuggestedWorkItemKey?: (item: AgentSessionItem) => string | undefined;
	getSuggestedWorkItemKeys?: (item: AgentSessionItem) => readonly string[] | undefined;
	highlightedItemId?: string | null;
	/** Widen the scrollport and its real buttons equally on both sides, preserving the marker axis. */
	hitSlopPx?: number;
	items: readonly AgentSessionItem[];
	/**
	 * Caps the scrollport to this many notches. Gutter rest passes ten;
	 * hover preview and column presentation omit it so every session can show.
	 */
	maxVisibleItems?: number;
	newItemIds?: ReadonlySet<string>;
	/** Revision increases retire the previous marker in place before the updated marker enters from the top. */
	stateChangeVersions?: ReadonlyMap<string, number>;
	notchShape?: AgentSessionColumnNotchShape;
	onArrivalComplete?: (itemId: string) => void;
	onArchiveSession?: (item: AgentSessionItem) => void;
	onCreateWorkItem?: (item: AgentSessionItem) => void;
	onIntroComplete?: () => void;
	onItemHover?: (item: AgentSessionItem | null) => void;
	onLinkWorkItem?: (item: AgentSessionItem, workItemKey?: string) => void;
	onSubtasks?: (item: AgentSessionItem) => void;
	onView?: (item: AgentSessionItem) => void;
	playIntro?: boolean;
	/**
	 * Makes each notch a drag handle, so a session can be pulled onto a work item
	 * without expanding the column first. The same binding the expanded cards
	 * take — without it the notches render exactly as before.
	 */
	sessionDrag?: JiraIssueAgentSessionDragBinding;
	showUntrackedWorkFooter?: boolean;
}>) {
	// One payload-aware flyout for the whole rail, exactly as Agent List does:
	// the popup stays mounted and follows the hovered notch, so sliding down the
	// rail crossfades instead of remounting a card per notch.
	const [flyoutHandle] = useState(createJiraSessionFlyoutHandle);
	const hoverIntent = useAgentSessionRailHoverIntent(flyoutHandle);
	const hoveredItem = items.find((item) => item.id === hoverIntent.activeItemId) ?? null;
	const publishItemHover = useEffectEvent((item: AgentSessionItem | null) => onItemHover?.(item));
	useEffect(() => {
		publishItemHover(hoveredItem);
		return () => publishItemHover(null);
	}, [hoveredItem]);
	const flyoutActions = useMemo(
		() => bindAgentSessionFlyoutActions(items, {
			capturedItemIds,
			onArchiveSession,
			onCreateWorkItem,
			onLinkWorkItem,
			onSubtasks,
		}),
		[capturedItemIds, items, onArchiveSession, onCreateWorkItem, onLinkWorkItem, onSubtasks],
	);
	const shouldReduceMotion = useReducedMotion();
	const [orderState, setOrderState] = useState(() => advanceAgentSessionRailOrder(
		undefined,
		items,
		stateChangeVersions,
		shouldReduceMotion === true,
	));
	let order = orderState;
	if (
		orderState.inputItems !== items
		|| orderState.inputVersions !== stateChangeVersions
		|| (shouldReduceMotion === true && orderState.phase !== "rest")
	) {
		// Resolve before painting children: an effect would flash the updated
		// notch at the top before its old-position exit could be seen.
		order = advanceAgentSessionRailOrder(
			orderState,
			items,
			stateChangeVersions,
			shouldReduceMotion === true,
		);
		setOrderState(order);
	}
	useEffect(() => {
		if (order.phase === "exit") {
			const timeout = window.setTimeout(() => {
				setOrderState(releaseAgentSessionRailOrder);
			}, 100); // duration-fast
			return () => window.clearTimeout(timeout);
		}
		if (order.phase === "enter") {
			// Keep projection disabled for the frame that moves this stable row to
			// the top, then let later unrelated arrivals move it normally.
			let settleFrame = 0;
			const paintFrame = window.requestAnimationFrame(() => {
				settleFrame = window.requestAnimationFrame(() => {
					setOrderState(settleAgentSessionRailOrder);
				});
			});
			return () => {
				window.cancelAnimationFrame(paintFrame);
				window.cancelAnimationFrame(settleFrame);
			};
		}
		return undefined;
	}, [order.phase, order.changingItemId]);
	const visibleItems = order.visibleItems;
	const railViewportMaxHeight = toAgentSessionRailViewportMaxHeight(
		visibleItems.length,
		maxVisibleItems,
	);
	// Under reduced motion the rail keeps its dock switched off entirely and the
	// marks fall back to their own row's hover treatment, which resolves
	// instantly. A slope that follows the cursor is exactly the kind of ambient
	// motion the setting asks us to drop.
	const isDocked = shouldReduceMotion !== true;
	const dock = useNotchDock(visibleItems.length, isDocked);
	const {
		ref: overflowRef,
		showBottomScrollMask,
		showTopScrollMask,
	} = useHasVerticalOverflow<HTMLUListElement>();
	const listRef = dock.listRef;
	const setListRef = useCallback<RefCallback<HTMLUListElement>>((node) => {
		listRef.current = node;
		overflowRef(node);
	}, [listRef, overflowRef]);
	// Mask-image on a plain scrollport — the same style `ScrollMask` puts on
	// `[data-slot="scroll-mask-viewport"]`. A surface overlay cannot fade 1px
	// marks (white-on-hairline). This node is not a Motion host, so a transform
	// cannot create a containing box that ignores the mask.
	const scrollMaskStyle = useMemo(
		() => buildScrollMaskStyle({
			fadeBottom: showBottomScrollMask,
			fadeSize: AGENT_SESSION_RAIL_FADE_SIZE,
			fadeTop: showTopScrollMask,
			scrollbarWidth: 0,
		}),
		[showBottomScrollMask, showTopScrollMask],
	);

	return (
		<>
			{/* The list takes no name of its own: the column region already carries
			    one, and a second copy of it only adds noise to the reading order.

			    It is also the dock's pointer surface — one listener for the whole
			    rail, rather than a hover handler per notch, because the swell is a
			    property of the distance between them. The 20px visual anchor
			    sits 2px inside each 24px button, so py-0.5 leaves its focus ring
			    the same clearance and preserves the original marker centers.
			    Hosts can add equal hit slop with a wider list and matching negative
			    margins; the widened buttons then fill the whole list width, with the
			    extra width preserving focus-ring clearance. Those hosts must allow
			    the rail past the section edges.
			    Gutter rest still caps the
			    viewport at ten notches; a hover-scaled hit area and column
			    presentation omit that cap so every session can show inside the
			    column height. Standalone rails retain per-notch arrival layout. */}
			<ul
				className={cn(
					"scrollbar-none flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto overscroll-contain py-0.5",
					hitSlopPx > 0 ? "px-0" : "px-1",
				)}
				data-agent-session-column-rail=""
				onPointerDown={isDocked ? dock.resetPointer : undefined}
				onPointerEnter={isDocked ? dock.handlePointerEnter : undefined}
				onPointerLeave={isDocked ? dock.handlePointerLeave : undefined}
				onPointerMove={isDocked ? dock.handlePointerMove : undefined}
				onPointerUp={isDocked ? dock.handlePointerUp : undefined}
				onScroll={isDocked ? dock.handleScroll : undefined}
				ref={setListRef}
				style={{
					...scrollMaskStyle,
					...(hitSlopPx === 0 ? {} : toAgentSessionRailHitSlopStyle(hitSlopPx)),
					maxHeight: railViewportMaxHeight,
				}}
			>
				{visibleItems.map((item: AgentSessionItem, index: number) => (
					<AgentSessionNotch
						animateLayout={animateLayout}
						flyoutHandle={flyoutHandle}
						hitSlopPx={hitSlopPx}
						flyoutSession={toAgentSessionUntrackedWorkFlyoutItem(
							item,
							resolveAgentSessionWorkItemKey(
								item,
								getSuggestedWorkItemKey,
								getSuggestedWorkItemKeys,
							),
						)}
						introIndex={index}
						isArriving={!(order.phase === "exit" && order.changingItemId === item.id)
							&& ((arrivingItemIds ?? newItemIds)?.has(item.id) ?? false)}
						isHighlighted={item.id === highlightedItemId}
						isHovered={item.id === hoverIntent.activeItemId}
						isLeaving={order.phase === "exit" && order.changingItemId === item.id}
						isNew={newItemIds?.has(item.id) ?? false}
						isStatusReentering={order.phase === "enter" && order.changingItemId === item.id}
						item={item}
						key={item.id}
						notchShape={notchShape}
						onArrivalComplete={onArrivalComplete === undefined
							? undefined
							: () => onArrivalComplete(item.id)}
						onIntroComplete={index === visibleItems.length - 1
							? onIntroComplete
							: undefined}
						onView={onView}
						playIntro={playIntro}
						proximity={isDocked ? {
							centersRef: dock.centersRef,
							index,
							magnify: dock.magnify,
							nearestIndex: dock.nearestIndex,
							pointerY: dock.pointerY,
						} : undefined}
						sessionDrag={sessionDrag}
					/>
				))}
			</ul>
			<JiraSessionFlyoutSurface
				capturedSessionIds={capturedItemIds}
				content="untracked-work"
				handle={flyoutHandle}
				instantPosition
				onOpenChange={hoverIntent.onOpenChange}
				popupRef={hoverIntent.popupRef}
				onAddAsSubtask={flyoutActions.onAddAsSubtask}
				onArchiveSession={flyoutActions.onArchiveSession}
				onCreateWorkItem={flyoutActions.onCreateWorkItem}
				onLinkWorkItem={flyoutActions.onLinkWorkItem}
				showUntrackedWorkFooter={showUntrackedWorkFooter}
			/>
		</>
	);
}
