"use client";

import { useEffect } from "react";

import { useTerminalDemo } from "../hooks/use-terminal-demo";
import { TerminalStage } from "./terminal-stage";

// ---------------------------------------------------------------------------
// A run of Local session screens (0,1,2) backed by ONE live Terminal presenter.
//
// Unlike `TerminalBeatScreen` — which freezes a single beat into a static
// snapshot — this reuses the real `useTerminalDemo` animation. The session
// card's left/right navigator owns the arrow keys (see `page.tsx`), so the demo
// runs with its own keyboard handling turned off and is driven purely by the
// `targetBeat` the active screen asks for: stepping the card forward plays the
// real split / typing / output / board animation between beats, stepping back
// rolls it back, and card Reset rewinds to the start.
//
// `targetBeat` is 1-indexed (beat 1 = the first beat); `0` is the initial,
// un-split terminal before anything has run.
// ---------------------------------------------------------------------------

export function TerminalLiveScreen({
	targetBeat,
}: Readonly<{ targetBeat: number }>): React.ReactElement {
	// Keyboard off: the gallery card owns ←/→ and drives the demo below.
	const controller = useTerminalDemo(true, { keyboard: false });
	const { state, advance, stepBack } = controller;

	// The demo only settles between beats; `beatIndex` is -1 before anything has
	// run, so the settled beat number is `beatIndex + 1` (0 = initial state).
	const settledBeat = state.beatIndex + 1;
	const isSettled = state.settled || state.finished;

	// Reconcile the live demo to the screen the card is asking for, ONE beat per
	// settle so each step animates. Advancing while settled replays the real beat
	// animation; stepping back is the presenter's instant rollback. The effect
	// re-runs whenever the demo settles again, walking toward `targetBeat`.
	useEffect(() => {
		if (!isSettled) return;
		if (settledBeat < targetBeat) {
			advance();
		} else if (settledBeat > targetBeat) {
			stepBack();
		}
	}, [isSettled, settledBeat, targetBeat, advance, stepBack]);

	return <TerminalStage controller={controller} />;
}
