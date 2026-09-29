"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import type { JiraKanbanColumnData } from "@/components/blocks/jira-kanban";

import { JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES } from "../data/keynote-board";
import { FinaleOverlay } from "./components/finale-overlay";
import { selectFinaleFeatures, type FinaleStory } from "./data/finale-stories";
import { useFinaleAudioClock } from "./hooks/use-finale-audio-clock";
import { useFinaleControls } from "./hooks/use-finale-controls";
import { printFinaleColumn, useFinaleCardPrints } from "./hooks/use-finale-prints";
import { captureJiraTeamEu26DoneColumn } from "./lib/capture-done-column";
import { nextFinaleDragOrder } from "./lib/finale-drag-order";
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

	// Record MCB's drag order and print each card shortly after it lands.
	useEffect(() => {
		const codes = doneKey ? doneKey.split("|") : [];
		const next = nextFinaleDragOrder(dragOrderRef.current, codes);
		if (next === dragOrderRef.current) return;
		const known = new Set(dragOrderRef.current);
		// The move that completes the board is about to open the finale: cards it
		// already pre-printed keep that print instead of re-printing on arrival,
		// which would compete with the column print the flash waits on.
		for (const code of next) if (!known.has(code) && !(ready && prints.get(code))) prints.schedule(code);
		dragOrderRef.current = next;
	}, [doneKey, prints, ready]);

	const prepare = useCallback((seek: number, hold: boolean) => {
		const dragOrder = dragOrderRef.current;
		setClosing(false);
		setPreparation({ dragOrder, features: selectFinaleFeatures(dragOrder), seek, hold });
	}, []);

	// Every card must be printed before the GL field can start on exact copies.
	useEffect(() => {
		if (!preparation) return undefined;
		let cancelled = false;
		const controller = new AbortController();
		const open = async () => {
			// Never hold the show for a print: late ones fall back to plain sheets.
			// The "Team 26" title face: resolves at once when the page already uses it.
			// The whole column, which the flash refracts under the card sheets.
			let columnPrint: HTMLCanvasElement | undefined;
			const chrome = printFinaleColumn(controller.signal).then((canvas) => {
				columnPrint = canvas;
			});
			const ready = Promise.all([prints.ensure(preparation.dragOrder), document.fonts.load('400 112px "Atlassian Sans"', "Team 0123456789").catch(() => []), chrome]);
			await Promise.race([ready, new Promise((resolve) => window.setTimeout(resolve, FINALE_PRINT_TIMEOUT_MS))]);
			// Card sheets may arrive late; the column print cannot be missing or mid-drop.
			await chrome;
			if (cancelled) return;
			if (!columnPrint) { setPreparation(null); return; }
			clock.hold(preparation.seek);
			startAfterMountRef.current = preparation.hold ? null : preparation.seek;
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
		};
	}, [clock, preparation, prints]);

	// Child renderer effects initialise before this parent effect. Starting the
	// clock here prevents setup work from skipping the foot of the column sweep.
	useEffect(() => {
		const seek = startAfterMountRef.current;
		if (!scene || seek === null) return;
		startAfterMountRef.current = null;
		void clock.start(seek);
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
		};
		return () => {
			delete target.__jiraTeamEu26Finale;
		};
	}, [clock.time, scrub]);

	const exit = useCallback(() => {
		clock.stop();
		setClosing(true);
		window.setTimeout(() => {
			setScene(null);
			setClosing(false);
		}, EXIT_FADE_MS);
	}, [clock]);

	const replay = useCallback(() => scrub(0, false), [scrub]);
	useFinaleControls(scene !== null && !closing, {
		onExit: exit,
		onTogglePause: clock.togglePause,
		onSeek: clock.seekBy,
		onReplay: replay,
	});

	return scene ? <FinaleOverlay scene={scene} clock={clock} reducedMotion={reducedMotion} closing={closing} /> : null;
}
