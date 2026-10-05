"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";

import { JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES } from "../data/keynote-board";
import { FinaleOverlay } from "./components/finale-overlay";
import { selectFinaleFeatures, type FinaleStory } from "./data/finale-stories";
import { useFinaleAudioClock } from "./hooks/use-finale-audio-clock";
import { useFinaleControls } from "./hooks/use-finale-controls";
import { printFinaleColumn, useFinaleCardPrints } from "./hooks/use-finale-prints";
import { captureJiraTeamEu26DoneColumn, queryJiraTeamEu26DoneColumn, waitForFinaleColumnCapture } from "./lib/capture-done-column";
import { finaleArrivals, finaleSmallConfettiDue, nextFinaleDragOrder } from "./lib/finale-drag-order";
import type { FinaleConfettiColumn } from "./lib/finale-confetti";
import { createFinaleConfetti, type FinaleConfettiShow } from "./lib/play-finale-confetti";
import { FINALE_DONE_COLUMN_TITLE, isJiraTeamEu26FinaleReady, parseFinaleSearch } from "./lib/finale-trigger";
import type { FinaleSceneInput } from "./scenes/scene-board-to-bento";

/** Idle pre-print of every keynote card starts once the board has settled in. */
const FINALE_PREWARM_DELAY_MS = 1500;
const EXIT_FADE_MS = 260;
/**
 * Longest the finale waits for card prints before it starts anyway (a bulk
 * move prints all 13 at once, and the first print also embeds the fonts).
 * Any print that lands later still replaces its stand-in mid-flight.
 */
const FINALE_PRINT_TIMEOUT_MS = 8000;

interface FinalePreparation {
	readonly dragOrder: readonly string[];
	readonly features: readonly FinaleStory[];
	readonly seek: number;
	readonly hold: boolean;
}

/** Where the confetti lands: the Done column's bounds, round its own bottom corners. */
function confettiColumnOf(column: HTMLElement): FinaleConfettiColumn {
	const { x, y, width, height } = column.getBoundingClientRect();
	return { x, y, width, height, radius: Number.parseFloat(getComputedStyle(column).borderBottomLeftRadius) || 0 };
}

function doneCodesOf(columns: readonly JiraKanbanColumnData[]): readonly string[] {
	return columns.find((column) => column.title === FINALE_DONE_COLUMN_TITLE)?.cards.map((card) => card.code) ?? [];
}

/**
 * Closing-keynote finale for the Team ’26 EU board. When the last keynote
 * announcement lands in Done, the board immediately hands every
 * card — in the order MCB dragged them — into the field-to-bento finale.
 */
interface JiraTeamEu26EndFinaleProps {
	readonly boardColumns: readonly JiraKanbanColumnData[];
	/**
	 * Bump to replay the finale when every keynote card is already in Done (the
	 * board no longer changes, so the "all Done" transition cannot fire again).
	 */
	readonly replayRequest?: number;
}

export function JiraTeamEu26EndFinale({ boardColumns, replayRequest = 0 }: Readonly<JiraTeamEu26EndFinaleProps>) {
	const clock = useFinaleAudioClock();
	const prints = useFinaleCardPrints();
	const reducedMotion = useReducedMotion() ?? false;
	const [preparation, setPreparation] = useState<FinalePreparation | null>(null);
	const [scene, setScene] = useState<FinaleSceneInput | null>(null);
	const [closing, setClosing] = useState(false);
	const startAfterMountRef = useRef<number | null>(null);
	const confetti = useMemo(() => createFinaleConfetti(), []);
	/** A burst the mounted finale has yet to ignite from. */
	const confettiShowRef = useRef<FinaleConfettiShow | null>(null);
	const ready = isJiraTeamEu26FinaleReady(boardColumns, JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES);
	const wasReadyRef = useRef(ready);
	const doneCodes = doneCodesOf(boardColumns);
	const doneKey = doneCodes.join("|");
	const dragOrderRef = useRef<readonly string[]>(doneCodes);

	// Print every keynote card ahead of time, so the finale never waits on prints.
	useEffect(() => {
		const timer = window.setTimeout(() => prints.prewarm(JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES), FINALE_PREWARM_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [prints]);

	// Boot the confetti renderer (worker, GL context, shaders) while the board is idle.
	useEffect(() => {
		if (reducedMotion) return undefined;
		const timer = window.setTimeout(() => confetti.prewarm(), FINALE_PREWARM_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, [confetti, reducedMotion]);
	useEffect(() => () => confetti.dispose(), [confetti]);

	// Record MCB's drag order and print each card shortly after it lands.
	useEffect(() => {
		const codes = doneKey ? doneKey.split("|") : [];
		const next = nextFinaleDragOrder(dragOrderRef.current, codes);
		if (next === dragOrderRef.current) return;
		const arrived = finaleArrivals(dragOrderRef.current, next);
		// Completion preparation owns any missing prints. Arrival timers must
		// not compete with the column image that the shader needs first.
		for (const code of arrived) if (!ready) prints.schedule(code);
		dragOrderRef.current = next;
		// One card or a bulk drag alike, short of completing the board: on the
		// drop itself, landing on any burst still flying. A small burst never
		// gathers on the column, so it need not wait for the drop to settle.
		if (!finaleSmallConfettiDue(arrived, ready) || reducedMotion) return;
		const column = queryJiraTeamEu26DoneColumn();
		if (column) confetti.play(confettiColumnOf(column), "small");
	}, [confetti, doneKey, prints, ready, reducedMotion]);

	const prepare = useCallback((seek: number, hold: boolean) => {
		const dragOrder = dragOrderRef.current;
		setClosing(false);
		setPreparation({ dragOrder, features: selectFinaleFeatures(dragOrder), seek, hold });
	}, []);

	// Every card must be printed before the GL field can start on exact copies.
	useEffect(() => {
		if (!preparation) return undefined;
		let cancelled = false;
		let show: FinaleConfettiShow | null = null;
		const controller = new AbortController();
		const open = async () => {
			// Celebrate as soon as the real card drop has settled. Image preparation
			// runs alongside the burst so it cannot delay that first visible response.
			// Exact rehearsal frames and reduced motion retain their existing path.
			const hasConfetti = !reducedMotion && preparation.seek === 0 && !preparation.hold;
			const celebration = hasConfetti
				? waitForFinaleColumnCapture(controller.signal).then((column) => {
					if (!column || cancelled) return;
					show = confetti.play(confettiColumnOf(column));
				})
				: Promise.resolve();
			// Never hold the show for a print: late ones fall back to plain sheets.
			// The "Team 26" title face: resolves at once when the page already uses it.
			// The whole column, which the flash refracts under the card sheets.
			let columnPrint: HTMLCanvasElement | undefined;
			const chrome = printFinaleColumn(controller.signal).then((canvas) => {
				columnPrint = canvas;
			});
			// Give the mandatory column image priority over optional late card sheets.
			const sheets = hasConfetti ? chrome.then(() => prints.ensure(preparation.dragOrder)) : prints.ensure(preparation.dragOrder);
			const ready = Promise.all([sheets, document.fonts.load('400 112px "Atlassian Sans"', "Team 0123456789").catch(() => []), chrome]);
			await celebration;
			// Under confetti the finale mounts as soon as the column print exists:
			// held on frame 0 it is invisible over the board, so its setup runs while
			// the pieces fly, and late card sheets replace their stand-ins mid-flight.
			if (!show) await Promise.race([ready, new Promise((resolve) => window.setTimeout(resolve, FINALE_PRINT_TIMEOUT_MS))]);
			// Card sheets may arrive late; the column print cannot be missing or mid-drop.
			await chrome;
			if (cancelled) return;
			if (!columnPrint) { setPreparation(null); return; }
			clock.hold(preparation.seek);
			startAfterMountRef.current = preparation.hold ? null : preparation.seek;
			// The mounted finale now owns the burst, and ignites from its ember.
			confettiShowRef.current = show;
			show = null;
			setScene({
				snapshot: captureJiraTeamEu26DoneColumn(),
				dragOrder: preparation.dragOrder,
				features: preparation.features,
				cardPrint: prints.get,
				columnPrint,
			});
			setPreparation(null);
		};
		void open();
		return () => {
			cancelled = true;
			controller.abort();
			show?.cancel();
		};
	}, [clock, confetti, preparation, prints, reducedMotion]);

	// Child renderer effects initialise before this parent effect. Starting the
	// clock here prevents setup work from skipping the foot of the column sweep.
	useEffect(() => {
		const seek = startAfterMountRef.current;
		if (!scene || seek === null) return undefined;
		startAfterMountRef.current = null;
		const show = confettiShowRef.current;
		if (!show) {
			void clock.start(seek);
			return undefined;
		}
		// The finale's dialog has just entered the top layer: keep the burst over
		// it, and ignite the unchanged flash from the ember once every piece is in.
		show.raise();
		void show.gathered.then(() => {
			if (confettiShowRef.current !== show) return;
			confettiShowRef.current = null;
			void clock.start(seek);
			show.release();
		});
		return () => {
			if (confettiShowRef.current !== show) return;
			confettiShowRef.current = null;
			show.cancel();
		};
	}, [clock, scene]);

	// Fire on the transition into "all Done" — never on load with a retained board.
	useEffect(() => {
		const wasReady = wasReadyRef.current;
		wasReadyRef.current = ready;
		if (!ready || wasReady) return undefined;
		prepare(0, false);
		return () => setPreparation(null);
	}, [prepare, ready]);

	// Replay on request once the board is already complete (after Esc).
	const replayRef = useRef(replayRequest);
	useEffect(() => {
		if (replayRequest === replayRef.current) return;
		replayRef.current = replayRequest;
		if (ready && !scene && !preparation) prepare(0, false);
	}, [preparation, prepare, ready, replayRequest, scene]);

	// Rehearsal: `?finale[=seconds][&hold]` arms the finale for the next click.
	useEffect(() => {
		const request = parseFinaleSearch(window.location.search);
		if (!request.autostart) return undefined;
		const arm = (event: PointerEvent) => {
			if (event.button !== 0) return;
			prepare(request.seek, request.hold);
		};
		window.addEventListener("pointerdown", arm, { once: true });
		return () => window.removeEventListener("pointerdown", arm);
	}, [prepare]);

	// Seek an open finale in place; otherwise prepare a fresh one.
	const scrub = useCallback((time: number, hold: boolean) => {
		if (!scene) {
			prepare(time, hold);
			return;
		}
		if (hold) clock.hold(time);
		else void clock.start(time);
	}, [clock, prepare, scene]);

	// Dev-only rehearsal hook: scrub the finale over the live board from the console.
	useEffect(() => {
		if (process.env.NODE_ENV === "production") return undefined;
		const target = window as typeof window & { __jiraTeamEu26Finale?: unknown };
		target.__jiraTeamEu26Finale = {
			time: clock.time,
			hold: (time: number) => scrub(time, true),
			play: (time = 0) => scrub(time, false),
			/** Freeze the running confetti on an exact second (`null` resumes). */
			holdConfetti: (time: number | null) => confetti.hold(time),
		};
		return () => {
			delete target.__jiraTeamEu26Finale;
		};
	}, [clock.time, confetti, scrub]);

	const exit = useCallback(() => {
		clock.stop();
		// An exit before ignition must not let the burst start the clock mid-fade.
		confettiShowRef.current?.cancel();
		confettiShowRef.current = null;
		setClosing(true);
		window.setTimeout(() => {
			setScene(null);
			setClosing(false);
		}, EXIT_FADE_MS);
	}, [clock]);

	const replay = useCallback(() => {
		clock.stop();
		setScene(null);
		prepare(0, false);
	}, [clock, prepare]);
	useFinaleControls(scene !== null && !closing, {
		onExit: exit,
		onTogglePause: clock.togglePause,
		onSeek: clock.seekBy,
		onReplay: replay,
	});

	return scene ? <FinaleOverlay scene={scene} clock={clock} reducedMotion={reducedMotion} closing={closing} /> : null;
}
