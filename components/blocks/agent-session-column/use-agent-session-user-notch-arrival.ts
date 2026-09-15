"use client";

import { useEffect, useRef, useState } from "react";

import {
	AGENT_SESSION_USER_NOTCH_ARRIVAL_COMPLETE_MS,
	AGENT_SESSION_USER_NOTCH_ARRIVAL_HIDE_MS,
} from "@/components/blocks/agent-session/agent-session-arrival-motion";

/**
 * Drives the collapsed circle-rail's arrival beat: reveal the session's face,
 * hold, then morph that same disc down onto the 4px rest. `arrivalPending` is
 * true from the first arriving paint, before there is a face to sit under, so
 * the rest disc can stay hidden for exactly that frame and be painted (unseen,
 * behind an opaque face) for the rest of the beat — the morph needs its
 * destination already there. `arrivalReveal` stays true through the morph.
 * `arrivalExiting` is the morph itself. A missing face still grows in with the
 * shared scale beat. Reduced motion skips both and leaves the rest disc, which
 * stays in default icon color while unread.
 */
export function useAgentSessionUserNotchArrival({
	hasAvatar,
	isArriving,
	onArrivalComplete,
	shouldReduceMotion,
}: Readonly<{
	hasAvatar: boolean;
	isArriving: boolean;
	onArrivalComplete?: () => void;
	shouldReduceMotion: boolean | null;
}>): {
	arrivalExiting: boolean;
	arrivalPending: boolean;
	arrivalReveal: boolean;
	shouldPlayScaleArrival: boolean;
} {
	const shouldPlayArrival = isArriving && !shouldReduceMotion;
	const shouldRevealAvatar = shouldPlayArrival && hasAvatar;
	const [arrivalExiting, setArrivalExiting] = useState(false);
	const [arrivalPending, setArrivalPending] = useState(shouldRevealAvatar);
	const [arrivalReveal, setArrivalReveal] = useState(false);
	const onArrivalCompleteRef = useRef(onArrivalComplete);

	useEffect(() => {
		onArrivalCompleteRef.current = onArrivalComplete;
	}, [onArrivalComplete]);

	useEffect(() => {
		if (!shouldRevealAvatar) {
			setArrivalExiting(false);
			setArrivalPending(false);
			setArrivalReveal(false);
			return;
		}

		setArrivalPending(true);
		let hideTimer = 0;
		let doneTimer = 0;
		const showFrame = window.requestAnimationFrame(() => {
			setArrivalExiting(false);
			setArrivalReveal(true);
			hideTimer = window.setTimeout(() => {
				setArrivalExiting(true);
			}, AGENT_SESSION_USER_NOTCH_ARRIVAL_HIDE_MS);
			doneTimer = window.setTimeout(() => {
				setArrivalPending(false);
				setArrivalReveal(false);
				setArrivalExiting(false);
				onArrivalCompleteRef.current?.();
			}, AGENT_SESSION_USER_NOTCH_ARRIVAL_COMPLETE_MS);
		});

		return () => {
			window.cancelAnimationFrame(showFrame);
			window.clearTimeout(hideTimer);
			window.clearTimeout(doneTimer);
		};
	}, [shouldRevealAvatar]);

	return {
		arrivalExiting,
		arrivalPending,
		arrivalReveal,
		shouldPlayScaleArrival: shouldPlayArrival && !hasAvatar,
	};
}
