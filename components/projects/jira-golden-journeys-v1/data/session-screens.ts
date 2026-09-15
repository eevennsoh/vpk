/**
 * Screen sets for the two Jira Golden Journeys v1 gallery cards.
 *
 * Each session card ("Carl's local session", "Sarah's global session") walks through an ordered
 * set of screens, navigated left/right from the gallery top bar — see
 * `SessionScreenControls` in `../components/session-stage.tsx` and the
 * `useScreenNavigator` hook. Mirrors the terminal demo's beat stepping, but over
 * a static screen list.
 *
 * A screen renders one of four ways (see `SessionStage`):
 *   - `design` set → a named golden-path design pattern rendered from a
 *     dedicated stage component (e.g. "kanban" → `KanbanStage`, the real Jira
 *     Kanban board). Use for a full designed screen that is not the terminal.
 *   - `liveBeat` set → part of a contiguous run of screens driven by the LIVE
 *     Terminal presenter (`useTerminalDemo`). `liveBeat` is the 1-indexed beat
 *     this screen settles at, with `0` meaning the initial, un-split terminal
 *     (before any beat). Stepping the card forward/back plays the real terminal
 *     animation (split, typing, output reveal, board staggering) between beats
 *     rather than jumping between frozen snapshots.
 *   - `terminalBeat` set → the Terminal demo frozen at that 1-indexed beat
 *     (beat 1 = the first beat). Static snapshot, not the live presenter demo.
 *     Use for a screen that is NOT contiguous with the live run.
 *   - otherwise → a placeholder big title. Swap in real golden-path designs by
 *     replacing the title/description, pointing a screen at `design` /
 *     `liveBeat` / `terminalBeat`, or extending `SessionStage` to render richer
 *     content per screen id (the original pattern stages under `../components/`
 *     are kept as building blocks).
 */
/** Named golden-path design patterns a screen can render (see `SessionStage`). */
export type SessionScreenDesign = "for-you" | "jira-kanban" | "kanban" | "rovo";

export type SessionScreenScenario =
	| "local-review"
	| "local-completed"
	| "global-assignment"
	| "blocked-question"
	| "human-review";

export interface SessionScreen {
	id: string;
	title: string;
	description?: string;
	/**
	 * Render a named design pattern from its dedicated stage component instead of
	 * the terminal / placeholder (e.g. "kanban" → `KanbanStage`).
	 */
	design?: SessionScreenDesign;
	/** Route-owned deterministic state rendered by an existing design stage. */
	scenario?: SessionScreenScenario;
	/**
	 * The section this screen belongs to (e.g. "Terminal"). Consecutive screens
	 * sharing a section are counted together — the gallery top bar shows
	 * `<section> · <position-in-section> of <count-in-section>` — so as more
	 * sections are added later, the counter resets per section instead of running
	 * across the whole card. Screens without a section fall back to a plain count.
	 */
	section?: string;
	/**
	 * Drive this screen with the LIVE Terminal presenter, settled at this
	 * 1-indexed beat (`0` = the initial, un-split terminal). Screens carrying
	 * `liveBeat` must form a contiguous run in ascending order so the shared
	 * presenter can animate forward/back between them.
	 */
	liveBeat?: number;
	/** Render the Terminal demo frozen at this 1-indexed beat instead of the placeholder title. */
	terminalBeat?: number;
}

// Carl's Local story starts with a live Terminal run through implementation,
// pauses for Jira review, then resumes through deterministic Terminal snapshots
// before returning to the completed board. `terminalBeat` remains 1-indexed.
export const LOCAL_SESSION_SCREENS: readonly SessionScreen[] = [
	{ id: "local-0", section: "Terminal", title: "Claude", liveBeat: 0 },
	{ id: "local-1", section: "Terminal", title: "Open Teamwork Graph", liveBeat: 1 },
	{ id: "local-2", section: "Terminal", title: "Run twg start-work", liveBeat: 2 },
	{ id: "local-3", section: "Terminal", title: "Browse available work", liveBeat: 3 },
	{ id: "local-4", section: "Terminal", title: "Understand JGP-247", liveBeat: 4 },
	{ id: "local-5", section: "Terminal", title: "Start JGP-247", liveBeat: 5 },
	{ id: "local-6", section: "Terminal", title: "Implement with visible tools", liveBeat: 6 },
	{
		id: "local-7",
		section: "Kanban",
		title: "Review Claude's changes",
		design: "kanban",
		scenario: "local-review",
	},
	{ id: "local-8", section: "Terminal", title: "Review feedback handed off", terminalBeat: 7 },
	{ id: "local-9", section: "Terminal", title: "Apply Carl's feedback", terminalBeat: 8 },
	{ id: "local-10", section: "Terminal", title: "Push follow-up commit", terminalBeat: 9 },
	{ id: "local-11", section: "Terminal", title: "Merge PR #247", terminalBeat: 10 },
	{
		id: "local-12",
		section: "Kanban",
		title: "JGP-247 is Done",
		design: "kanban",
		scenario: "local-completed",
	},
];

export const GLOBAL_SESSION_SCREENS: readonly SessionScreen[] = [
	{
		id: "global-1",
		section: "Kanban",
		title: "Delegate five tasks to Cursor",
		design: "kanban",
		scenario: "global-assignment",
	},
	{
		id: "global-2",
		section: "Rovo",
		title: "Unblock Cursor and review its changes",
		design: "rovo",
		scenario: "blocked-question",
	},
	{
		id: "global-3",
		section: "For you",
		title: "Five tasks ready for review",
		design: "for-you",
		scenario: "human-review",
	},
	{
		id: "global-4",
		section: "Kanban & List",
		title: "Kanban",
		design: "jira-kanban",
	},
];
