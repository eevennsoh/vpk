"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { FINALE_REST_TIME } from "../data/finale-cues";
import { FINALE_STORIES } from "../data/finale-stories";
import type { FinaleClock } from "../hooks/use-finale-audio-clock";
import { currentFinaleStageFit, type FinaleStageFit as StageFit } from "../lib/finale-stage-fit";
import { SceneBoardToBento, type FinaleSceneInput } from "../scenes/scene-board-to-bento";
import { FinaleFrameContext, createFinaleFrameRegistry } from "../hooks/use-finale-frame";

/**
 * The live window's fit, correct from the very first render: the GL layers
 * size and project to it on mount, so a stand-in stage size (corrected a
 * frame later) would draw the resting cards misregistered for a frame or two.
 */
function useStageFit(): StageFit {
	const [fit, setFit] = useState<StageFit>(currentFinaleStageFit);
	useEffect(() => {
		const update = () => {
			const next = currentFinaleStageFit();
			setFit((previous) => (next.width === previous.width && next.height === previous.height ? previous : next));
		};
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);
	return fit;
}

interface FinaleOverlayProps {
	readonly scene: FinaleSceneInput;
	readonly clock: FinaleClock;
	readonly reducedMotion: boolean;
	readonly closing: boolean;
}

/**
 * Full-screen stage for the closing finale. One rAF loop reads the music clock
 * and fans it out to every scene. Cards live in viewport space (GL and DOM
 * share one pixel grid); the bento slots are Figma's 1920×1080 stage
 * letterboxed into the display.
 */
export function FinaleOverlay({ scene, clock, reducedMotion, closing }: Readonly<FinaleOverlayProps>) {
	const registry = useMemo(() => createFinaleFrameRegistry(), []);
	const fit = useStageFit();
	const viewport = useMemo(() => ({ width: fit.width, height: fit.height }), [fit.width, fit.height]);
	const rootRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		let frame = 0;
		let last = Number.NaN;
		const tick = () => {
			// The bento is the rest frame; with motion on, the wall after it glides on until Esc.
			const time = reducedMotion ? FINALE_REST_TIME : clock.time();
			if (time !== last) {
				registry.emit(time);
				last = time;
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [clock, reducedMotion, registry]);

	// Dev-only: render an exact frame synchronously (scrubbing, or a hidden tab
	// where requestAnimationFrame never fires).
	useEffect(() => {
		if (process.env.NODE_ENV === "production") return undefined;
		const target = window as typeof window & { __jiraTeamEu26FinaleFrame?: (time: number) => void };
		target.__jiraTeamEu26FinaleFrame = (time) => registry.emit(time);
		return () => {
			delete target.__jiraTeamEu26FinaleFrame;
		};
	}, [registry]);

	// A modal dialog lives in the top layer (above the board's own popovers and
	// toolbars) and makes the product UI underneath natively inert.
	useEffect(() => {
		const dialog = rootRef.current;
		if (!dialog) return undefined;
		if (!dialog.open) dialog.showModal();
		dialog.focus({ preventScroll: true });
		return () => dialog.close();
	}, []);

	// Mounted only after a client-side trigger; the guard keeps any server render safe.
	if (typeof document === "undefined") return null;

	const summary = `Team ’26 Europe keynote recap. All ${FINALE_STORIES.length} work items are done. Featured: ${scene.features.map((story) => story.lines.join(" ")).join(", ")}.`;

	return createPortal(
		<FinaleFrameContext value={registry}>
			<dialog
				ref={rootRef}
				aria-label="Team ’26 Europe keynote recap"
				tabIndex={-1}
				// Esc is routed through the presenter controls so it can fade out.
				onCancel={(event) => event.preventDefault()}
				className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0 outline-none select-none backdrop:bg-transparent motion-reduce:transition-none"
				style={{
					cursor: "none",
					opacity: closing ? 0 : 1,
					transition: `opacity ${closing ? 250 : reducedMotion ? 300 : 0}ms cubic-bezier(0.6, 0, 0.8, 0.6)`,
				}}
				data-jira-team-eu26-end-finale=""
			>
				<p className="sr-only" aria-live="polite">{summary}</p>
				<SceneBoardToBento {...scene} fit={fit} viewport={viewport} reducedMotion={reducedMotion} />
			</dialog>
		</FinaleFrameContext>,
		document.body,
	);
}
