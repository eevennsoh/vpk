"use client";

import { useEffect } from "react";
import { useReducedMotion } from "motion/react";

import { useTerminalDemo } from "../hooks/use-terminal-demo";
import { TerminalStage } from "./terminal-stage";

const FIRST_POST_REVIEW_BEAT = 7;

// Post-review Terminal screens preserve the preceding screen's settled history,
// then run exactly one destination beat through the presenter's existing
// line-by-line reveal. The first screen has no terminal predecessor to animate
// from, and reduced-motion users start directly at the stable destination.
export function TerminalBeatScreen({ beat }: Readonly<{ beat: number }>): React.ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const initialSettledBeat = shouldReduceMotion || beat === FIRST_POST_REVIEW_BEAT ? beat : beat - 1;
	const controller = useTerminalDemo(true, { initialSettledBeat, keyboard: false });
	const { state, advance } = controller;

	useEffect(() => {
		const settledBeat = state.beatIndex + 1;
		if (state.settled && settledBeat < beat) advance();
	}, [advance, beat, state.beatIndex, state.settled]);

	return <TerminalStage controller={controller} />;
}
