"use client";

import { useLayoutEffect, useRef, useState, type ComponentType } from "react";
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
import { agentSessionAccentColor } from "./agent-session-transfer-member";
import type { SessionCohort } from "./session-cohort";
import type { PeelSurfaceProps } from "@/components/visual/peel/peel-surface";

/** The pointer follower and one-shot layout morph own separate transforms. */
export function AgentSessionDragOverlay({
	dragging = true,
	chipOrigin,
	cohort,
	isDraggedOut,
	pointerX,
	pointerY,
	reduceMotion,
	previewEffect,
	peelSurface: PeelSurface,
	stableCapture = false,
}: Readonly<{
	/** Only an opted-in peel preview stays mounted while idle to prepare its pixels. */
	dragging?: boolean;
	/** Source boxes relative to the pointer on the move that published the drag. */
	chipOrigin: SessionDragGeometry | null;
	cohort: SessionCohort<AgentSessionItem>;
	isDraggedOut: boolean;
	pointerX: MotionValue<number>;
	pointerY: MotionValue<number>;
	reduceMotion: boolean;
	previewEffect?: "peel";
	peelSurface?: ComponentType<PeelSurfaceProps> | null;
	/** Collections may begin preparation during a gesture; keep that print free of morph transforms. */
	stableCapture?: boolean;
}>) {
	const followerRef = useRef<HTMLDivElement>(null);
	const [peelReady, setPeelReady] = useState(false);

	useLayoutEffect(() => {
		const follower = followerRef.current;
		if (!dragging || !follower || reduceMotion) return;
		setPeelReady(false);
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
				if (previewEffect === "peel") setPeelReady(true);
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
	}, [dragging, chipOrigin, reduceMotion, previewEffect]);

	if (typeof document === "undefined") return null;

	// Idle preparation has no drag/fusion selectors and is unreachable. Normal
	// previews still unmount on release; only the optional renderer is retained.
	return createPortal(
		<motion.div
			aria-hidden
			inert
			className="pointer-events-none left-0 top-0 z-[400] w-fit"
			data-session-chip-out={isDraggedOut || undefined}
			data-session-drag-overlay={dragging ? "" : undefined}
			data-session-dragging={dragging ? "" : undefined}
			data-session-preview-idle={dragging ? undefined : ""}
			ref={followerRef}
			style={{ x: pointerX, y: pointerY, opacity: dragging ? 1 : 0, ...sessionDragChipViewportStyle(true) }}
		>
			<div
				className="pointer-events-none flex w-fit max-w-full -translate-x-1/2 -translate-y-1/2 items-center justify-start"
				data-session-chip-centered=""
			>
				{previewEffect === "peel" && PeelSurface ? (
					<PeelSurface active={dragging && peelReady} captureChildren={stableCapture ? <AgentSessionCohortChip cohort={cohort} elevated animateIdentity={false} /> : undefined} contentKey={JSON.stringify(cohort.members.map(({ id, agent, invokedBy }) => ({ id, agent, invokedBy })))} flashColor={agentSessionAccentColor(cohort.members[0])} pointerX={pointerX} pointerY={pointerY}>
						<AgentSessionCohortChip cohort={cohort} elevated isFusionSource={dragging} animateIdentity={false} />
					</PeelSurface>
				) : <AgentSessionCohortChip cohort={cohort} elevated isFusionSource />}
			</div>
		</motion.div>,
		document.body,
	);
}
