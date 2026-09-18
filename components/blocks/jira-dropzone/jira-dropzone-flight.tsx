"use client";

import { useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { arc, motion } from "motion/react";

import { AgentSessionCohortChip } from "@/components/blocks/agent-session/agent-session-cohort-chip";
import { sessionDragChipViewportStyle } from "@/components/blocks/jira-issue/agent-session-drag";

import { toJiraDropzoneCohort } from "./lib/jira-dropzone-cohort";
import { resolveFlightTravelTransition } from "./lib/jira-dropzone-motion";
import { animateSessionChipDrop } from "./lib/session-chip-drop-flight";
import type { FlightProfile, SessionFlight, ViewportPoint } from "./lib/jira-dropzone-types";

export function JiraDropzoneFlight<TKey extends string>({
	flyPath,
	flight,
	kind = "create",
	onLanded,
	profile,
	resolveLandingPoint,
}: Readonly<{
	flyPath: ReturnType<typeof arc>;
	flight: Pick<SessionFlight, "delayMs" | "from" | "members"> & { readonly key: TKey };
	kind?: "create" | "link";
	onLanded: (key: TKey) => void;
	profile: Pick<FlightProfile, "travel" | "durationMs" | "ease">;
	resolveLandingPoint: () => ViewportPoint | null;
}>): ReactElement | null {
	const [landing, setLanding] = useState<ViewportPoint | null | undefined>(undefined);
	const flightRef = useRef<HTMLDivElement>(null);
	const directDrop = profile.travel !== "arc";
	useLayoutEffect(() => {
		if (!directDrop || !flightRef.current) return;
		return animateSessionChipDrop(flightRef.current, {
			delayMs: flight.delayMs,
			durationMs: profile.durationMs,
			from: flight.from,
			onLanded: () => onLanded(flight.key),
			resolveLandingPoint,
		});
	}, [directDrop, flight, onLanded, profile.durationMs, resolveLandingPoint]);

	useLayoutEffect(() => {
		if (directDrop) return;
		let cancelled = false;
		const tryMeasure = (): boolean => {
			const point = resolveLandingPoint();
			if (!point || cancelled) {
				return false;
			}
			setLanding(point);
			return true;
		};
		if (tryMeasure()) {
			return () => {
				cancelled = true;
			};
		}
		const frame = window.requestAnimationFrame(() => {
			if (cancelled) {
				return;
			}
			if (!tryMeasure()) {
				onLanded(flight.key);
				setLanding(null);
			}
		});
		return () => {
			cancelled = true;
			window.cancelAnimationFrame(frame);
		};
	}, [directDrop, flight.key, onLanded, resolveLandingPoint]);

	if (typeof document === "undefined" || (!directDrop && !landing)) {
		return null;
	}

	const transition = resolveFlightTravelTransition(
		profile.travel,
		{
			delay: flight.delayMs / 1000,
			duration: profile.durationMs / 1000,
			ease: profile.ease,
		},
		flyPath,
	);

	const chip = <div className="pointer-events-none flex w-fit max-w-full -translate-x-1/2 -translate-y-1/2 items-center justify-start">
		<AgentSessionCohortChip cohort={toJiraDropzoneCohort(flight.members)} elevated />
	</div>;
	const attributes = {
		"data-jira-dropzone-flight": kind === "create" ? "" : undefined,
		"data-jira-dropzone-flight-members": kind === "create" ? String(flight.members.length) : undefined,
		"data-jira-linking-flight": kind === "link" ? "" : undefined,
		"data-jira-linking-flight-members": kind === "link" ? String(flight.members.length) : undefined,
	};
	return createPortal(directDrop ? (
		<div
			aria-hidden inert ref={flightRef} {...attributes}
			className="pointer-events-none left-0 top-0 z-[400] w-fit"
			style={{ ...sessionDragChipViewportStyle(true), transform: `translate3d(${flight.from.x}px, ${flight.from.y}px, 0)`, transformOrigin: "0 0", opacity: profile.travel === "none" ? 0 : 1 }}
		>
			{chip}
		</div>
	) : (
		<motion.div
			animate={{ opacity: 1, x: landing!.x, y: landing!.y }}
			aria-hidden
			inert
			className="pointer-events-none left-0 top-0 z-[400] w-fit"
			{...attributes}
			initial={{
				opacity: 1,
				x: flight.from.x,
				y: flight.from.y,
			}}
			onAnimationComplete={() => {
				onLanded(flight.key);
			}}
			style={{ ...sessionDragChipViewportStyle(true), transformOrigin: "0 0", willChange: "transform, opacity" }}
			transition={transition}
		>
			{chip}
		</motion.div>
	),
		document.body,
	);
}
