"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { animate, useMotionValue, useTransform } from "motion/react";
import { MountOnFirstUse } from "@/components/projects/shared/components/mount-on-first-use";
import { useMediaQuery } from "@/hooks/use-media-query";

import {
	CARD_GLOW_EFFECT_STYLE,
	CardGlowLayers,
	cardGlowSurfaceStyle,
	type CardGlowCSSProperties,
} from "@/components/visual/card-glow";

import type { JiraIssueAttachTrace } from "./attach-proximity";

const TRACE_REVEAL_TRANSITION = { duration: 0.2, ease: [0.4, 0, 0, 1] } as const; // duration-medium + ease-in-out: gradual colour blending

/**
 * The accent stroke traced along a card's edge as a dragged session approaches.
 *
 * Sibling to {@link JiraIssueAgentLinkFlashOverlay} in `agent-link-flash.tsx`:
 * both are one-shot decorations the card hosts but does not own, and both read
 * the same brand accent, so the colour appears to travel with the session —
 * hover in the column, approach here, flash on release — rather than each
 * surface lighting up on its own.
 *
 * Each card reveals once per drag. After that, distance directly controls its
 * brightness. Retaining an activated decoration until the gesture ends keeps
 * leaving/reentering the sensor from replaying the reveal.
 *
 * Stroke only, no bloom: the grey backdrop behind the card is already the
 * approach's fill feedback, and a second accent wash on top would fight it.
 */
export function JiraIssueAttachTraceOverlay({
	active,
	nearness,
	ref,
	trace,
}: Readonly<{
	/** Host-owned gesture lifetime. Resets the reveal at the next drag. */
	active?: boolean;
	/** 0..1 approach ramp. Zero hides a previously revealed decoration. */
	nearness: number;
	ref?: Ref<HTMLSpanElement>;
	/** Accent and pointer for this card's distance-weighted arc. */
	trace: JiraIssueAttachTrace | null | undefined;
}>) {
	const gestureActive = active ?? Boolean(trace);
	return gestureActive ? (
		<MountOnFirstUse active={Boolean(trace)}>
			<JiraIssueAttachTraceSurface nearness={trace ? nearness : 0} ref={ref} trace={trace} />
		</MountOnFirstUse>
	) : null;
}

function JiraIssueAttachTraceSurface({
	nearness,
	ref,
	trace,
}: Readonly<{
	nearness: number;
	ref?: Ref<HTMLSpanElement>;
	trace: JiraIssueAttachTrace | null | undefined;
}>) {
	const shouldReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const [initialTrace] = useState(trace);
	const currentTrace = trace ?? initialTrace;
	const [phase, setPhase] = useState<"reveal" | "track">(shouldReduceMotion ? "track" : "reveal");
	const reveal = useMotionValue(shouldReduceMotion ? 1 : 0);
	const proximity = useMotionValue(nearness);
	const introOpacity = useTransform(() => reveal.get() * proximity.get());
	const hostRef = useRef<HTMLSpanElement>(null);
	useImperativeHandle(ref, () => hostRef.current!, []);
	useEffect(() => {
		if (phase === "reveal") proximity.set(nearness);
	}, [nearness, phase, proximity]);
	useEffect(() => {
		if (phase === "track") return;
		let cancelled = false;
		// One envelope only: pointer/brightness changes never restart this clock.
		const playback = animate(reveal, 1, shouldReduceMotion ? { duration: 0 } : TRACE_REVEAL_TRANSITION);
		playback.then(() => { if (!cancelled) setPhase("track"); });
		return () => { cancelled = true; playback.stop(); };
	}, [phase, reveal, shouldReduceMotion]);
	useEffect(() => {
		if (phase === "track") return;
		const unsubscribe = introOpacity.on("change", (value) => {
			if (hostRef.current) hostRef.current.style.opacity = value.toString();
		});
		return () => unsubscribe();
	}, [introOpacity, phase]);
	if (!currentTrace) return null;

	const style: CardGlowCSSProperties = {
		...CARD_GLOW_EFFECT_STYLE,
		...cardGlowSurfaceStyle(currentTrace.accent),
		"--card-glow-pointer-x": currentTrace.pointerX.toFixed(3),
		"--card-glow-pointer-y": currentTrace.pointerY.toFixed(3),
		opacity: phase === "track" ? nearness : 0,
		willChange: "opacity",
	};

	return (
		// `-inset-px` lifts the traced ring onto the surface's own 1px border
		// rather than sitting just inside it, so the accent replaces that stroke
		// where the pointer is instead of doubling it. `isolate` keeps the layers'
		// negative z-index from escaping behind the surface.
		<span
			aria-hidden="true"
			className="pointer-events-none absolute -inset-px isolate rounded-[inherit] data-[trace-active=false]:hidden motion-reduce:hidden"
			data-slot="jira-issue-attach-trace"
			data-trace-active={nearness > 0 ? "true" : "false"}
			data-trace-phase={phase}
			data-trace-strength={nearness}
			ref={hostRef}
			style={style}
		>
			<CardGlowLayers baseBorder={false} bloom={false} />
		</span>
	);
}
