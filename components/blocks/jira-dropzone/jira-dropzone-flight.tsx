"use client";

import { useLayoutEffect, useMemo, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { arc, motion } from "motion/react";

import { AgentSessionCohortChip } from "@/components/blocks/agent-session/agent-session-cohort-chip";
import { sessionDragChipViewportStyle } from "@/components/blocks/jira-issue/agent-session-drag";

import { toJiraDropzoneCohort } from "./lib/jira-dropzone-cohort";
import { createSessionChipDropKeyframes, resolveFlightTravelTransition } from "./lib/jira-dropzone-motion";
import type { FlightProfile, SessionFlight, ViewportPoint } from "./lib/jira-dropzone-types";

export function JiraDropzoneFlight({
	flyPath,
	flight,
	onLanded,
	profile,
	resolveLandingPoint,
}: Readonly<{
	flyPath: ReturnType<typeof arc>;
	flight: SessionFlight;
	onLanded: (key: SessionFlight["key"]) => void;
	profile: FlightProfile;
	resolveLandingPoint: () => ViewportPoint | null;
}>): ReactElement | null {
	const [landing, setLanding] = useState<ViewportPoint | null | undefined>(undefined);
	const directDrop = useMemo(() => {
		if (!landing || profile.travel !== "linear") return undefined;
		const frames = createSessionChipDropKeyframes(flight.from, landing, "landing");
		return {
			initial: { opacity: 1, transform: frames[0].transform },
			animate: { opacity: frames.map((frame) => frame.opacity), transform: frames.map((frame) => frame.transform) },
			transition: { delay: flight.delayMs / 1000, duration: profile.durationMs / 1000, ease: "linear" as const },
		};
	}, [flight.delayMs, flight.from, landing, profile.durationMs, profile.travel]);

	useLayoutEffect(() => {
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
	}, [flight.key, onLanded, resolveLandingPoint]);

	if (typeof document === "undefined" || landing === undefined || landing === null) {
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

	return createPortal(
		<motion.div
			animate={directDrop ? directDrop.animate : { opacity: 1, x: landing.x, y: landing.y }}
			aria-hidden
			className="pointer-events-none left-0 top-0 z-[400] w-fit"
			data-jira-dropzone-flight=""
			data-jira-dropzone-flight-members={String(flight.members.length)}
			initial={directDrop ? directDrop.initial : {
				opacity: profile.travel === "none" ? 0 : 1,
				x: flight.from.x,
				y: flight.from.y,
			}}
			onAnimationComplete={() => {
				onLanded(flight.key);
			}}
			style={{ ...sessionDragChipViewportStyle(true), transformOrigin: "0 0", willChange: "transform, opacity" }}
			transition={directDrop ? directDrop.transition : transition}
		>
			<div className="pointer-events-none flex w-fit max-w-full -translate-x-1/2 -translate-y-1/2 items-center justify-start">
				<AgentSessionCohortChip
					cohort={toJiraDropzoneCohort(flight.members)}
					elevated
				/>
			</div>
		</motion.div>,
		document.body,
	);
}
