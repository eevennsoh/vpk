"use client";

import { useEffect, useState } from "react";

import type { AgentSessionItem } from "./agent-session-types";

export const AGENT_SESSION_STATE_AVATAR_MOTION = { repeat: 0, repeatDelayMs: 0 } as const;

/** Shared avatar-first lifecycle beat for session rows and attached sessions. */
export function useAgentSessionLifecycleTransition({
	state,
	hasAnimatedIdentity,
	isArriving = false,
	isDeparting = false,
	isStateChanged,
	onArrivalComplete,
	shouldReduceMotion,
}: Readonly<{
	state: AgentSessionItem["state"];
	hasAnimatedIdentity: boolean;
	isArriving?: boolean;
	isDeparting?: boolean;
	isStateChanged?: boolean;
	onArrivalComplete?: () => void;
	shouldReduceMotion: boolean | null;
}>) {
	const [lifecycleState, setLifecycleState] = useState(state);
	const [phase, setPhase] = useState<"arrival" | "avatar" | "status">("arrival");
	const stateChanged = isStateChanged ?? lifecycleState !== state;
	useEffect(() => {
		if (!stateChanged || isDeparting || shouldReduceMotion) {
			setLifecycleState(state);
			setPhase("arrival");
		}
	}, [isDeparting, stateChanged, state, shouldReduceMotion]);
	const shouldPlayArrival = isArriving && !isDeparting && !shouldReduceMotion;
	const shouldPlayDeparture = isDeparting && !shouldReduceMotion;
	const shouldPlayStatusReentry = shouldPlayArrival && stateChanged && phase === "arrival";
	const shouldRotateAvatar = !isDeparting && !shouldReduceMotion && (
		phase === "avatar" || (stateChanged && !isArriving && hasAnimatedIdentity && lifecycleState !== state)
	);
	const shownLifecycleState = shouldPlayStatusReentry || shouldRotateAvatar ? lifecycleState : state;
	const handleArrivalComplete = () => {
		if (shouldPlayArrival && phase === "arrival") {
			const rotateAvatar = stateChanged && hasAnimatedIdentity;
			setPhase(rotateAvatar ? "avatar" : "status");
			if (!rotateAvatar) setLifecycleState(state);
			onArrivalComplete?.();
		}
	};
	const handleAvatarComplete = () => {
		setLifecycleState(state);
		setPhase("status");
	};
	return { handleArrivalComplete, handleAvatarComplete, shouldPlayArrival, shouldPlayDeparture, shouldPlayStatusReentry, shouldRotateAvatar, shownLifecycleState };
}
