"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";

import { useTimedTransition } from "@/components/hooks/use-timed-transition";
import {
	getPersonalGraphIntroPhaseAt,
	PERSONAL_GRAPH_INTRO_TRANSITIONS,
	type PersonalGraphIntroPhase,
} from "./intro-phase";

interface UsePersonalGraphIntroResult {
	phase: PersonalGraphIntroPhase;
	isReducedMotion: boolean;
}

interface PersonalGraphIntroState {
	readonly phase: PersonalGraphIntroPhase;
	readonly replayKey: number;
}

export function usePersonalGraphIntro(replayKey = 0): UsePersonalGraphIntroResult {
	const prefersReducedMotion = useReducedMotion() ?? false;
	const [intro, setIntro] = useState<PersonalGraphIntroState>({ phase: "title", replayKey });
	let { phase } = intro;

	// A replay starts the timeline over during render, so the stale phase never paints.
	if (intro.replayKey !== replayKey) {
		phase = getPersonalGraphIntroPhaseAt(0, prefersReducedMotion);
		setIntro({ phase, replayKey });
	}

	useTimedTransition(phase, PERSONAL_GRAPH_INTRO_TRANSITIONS, {
		onAdvance: (next) => setIntro((current) => ({ ...current, phase: next })),
		reducedMotion: prefersReducedMotion,
		restartKey: replayKey,
	});

	return { phase, isReducedMotion: prefersReducedMotion };
}
