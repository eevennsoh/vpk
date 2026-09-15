"use client";

import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { animate, motion, type MotionValue } from "motion/react";

import { sessionDragChipViewportStyle } from "@/components/blocks/jira-issue/agent-session-drag";

import { AgentSessionCohortChip } from "./agent-session-cohort-chip";
import {
	measureSessionDragGeometry,
	resolveSessionDragMorph,
	sessionDragGeometryRelativeToPointer,
	SESSION_DRAG_CHIP_ENTER_TRANSITION,
	type SessionDragGeometry,
} from "./agent-session-drag-motion";
import type { AgentSessionItem } from "./agent-session-types";
import type { SessionCohort } from "./session-cohort";

/** The pointer follower and one-shot layout morph own separate transforms. */
export function AgentSessionDragOverlay({
	chipOrigin,
	cohort,
	isDraggedOut,
	pointerX,
	pointerY,
	reduceMotion,
}: Readonly<{
	/** Source boxes relative to the pointer on the move that published the drag. */
	chipOrigin: SessionDragGeometry | null;
	cohort: SessionCohort<AgentSessionItem>;
	isDraggedOut: boolean;
	pointerX: MotionValue<number>;
	pointerY: MotionValue<number>;
	reduceMotion: boolean;
}>) {
	const followerRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const follower = followerRef.current;
		if (!follower || reduceMotion) return;
		const pill = follower.querySelector<HTMLElement>("[data-session-drag-pill]");
		const surface = pill?.querySelector<HTMLElement>("[data-session-drag-surface]");
		const identity = pill?.querySelector<HTMLElement>("[data-session-drag-identity]");
		const label = pill?.querySelector<HTMLElement>("[data-session-drag-label]");
		if (!pill || !surface || !identity || !label) return;
		const traveller = pill.parentElement?.matches("[data-session-cohort-chip]") ? pill.parentElement : pill;

		// Read all geometry before Motion writes. The fixed follower is the
		// pointer coordinate space; source list projection cannot affect it.
		const geometry = measureSessionDragGeometry(pill);
		const pointerRect = follower.getBoundingClientRect();
		const morph = chipOrigin && geometry
			? resolveSessionDragMorph(chipOrigin, sessionDragGeometryRelativeToPointer(geometry, {
				x: pointerRect.left,
				y: pointerRect.top,
			}))
			: null;
		const options = SESSION_DRAG_CHIP_ENTER_TRANSITION;
		const animations = morph ? [
			animate(traveller, { transform: [`translate(${morph.x}px, ${morph.y}px)`, "translate(0px, 0px)"] }, options),
			animate(surface, { transform: [`scale(${morph.scaleX}, ${morph.scaleY})`, "scale(1, 1)"] }, options),
			animate(identity, { transform: [`translate(${morph.identityX}px, ${morph.identityY}px)`, "translate(0px, 0px)"] }, options),
			animate(label, { opacity: [0, 1] }, options),
		] : [animate(traveller, { opacity: [0, 1] }, options)];
		const moving = morph ? [traveller, surface, identity, label] : [traveller];
		for (const element of moving) {
			element.style.willChange = element === label || !morph ? "opacity" : "transform";
		}
		let active = true;
		void Promise.all(animations.map((animation) => animation.finished)).then(() => {
			if (active) {
				for (const element of moving) element.style.willChange = "";
			}
		});
		return () => {
			active = false;
			// stop() commits a motion value and queues a render after this cleanup;
			// cancellation removes the effect without restoring a stale transform.
			for (const animation of animations) animation.cancel();
			for (const element of moving) {
				element.style.willChange = "";
				element.style.transform = "";
				element.style.opacity = "";
			}
		};
	}, [chipOrigin, reduceMotion]);

	if (typeof document === "undefined") return null;

	// Unmount synchronously on release/cancel. The fusion/flight owner consumes
	// the outgoing rect; retaining this portal would outlive the pointer gesture.
	return createPortal(
		<motion.div
			aria-hidden
			className="pointer-events-none left-0 top-0 z-[400] w-fit"
			data-session-chip-out={isDraggedOut || undefined}
			data-session-drag-overlay=""
			data-session-dragging=""
			ref={followerRef}
			style={{ x: pointerX, y: pointerY, ...sessionDragChipViewportStyle(true) }}
		>
			<div
				className="pointer-events-none flex w-fit max-w-full -translate-x-1/2 -translate-y-1/2 items-center justify-start"
				data-session-chip-centered=""
			>
				<AgentSessionCohortChip cohort={cohort} elevated isFusionSource />
			</div>
		</motion.div>,
		document.body,
	);
}
