/**
 * Pure state machine for the JGP Terminal stage demo (dual-pane tmux: Jira CLI × Claude Code).
 *
 * No React imports here — this module only defines shared types and pure reducer/selector
 * logic. Story data (fixtures + `TERMINAL_DEMO_BEATS`) lives in `../data/terminal-demo-script`,
 * which imports its types *from* this module. To avoid a lib↔data import cycle, this module
 * never imports from `../data/*` — beats are always passed in explicitly (see
 * `createTerminalDemoReducer` and `foldBeats`).
 */

export interface TerminalSpan {
	text: string;
	tone?: "dim" | "accent" | "success" | "warning" | "error" | "bold" | "brand";
}

export type TerminalLine = readonly TerminalSpan[];

export type TerminalBoardStatus = "backlog" | "needs-input" | "working" | "done";

export interface TerminalWorkItem {
	key: string;
	title: string;
	status: TerminalBoardStatus;
	/** One-line current activity, e.g. "Bisecting flaky retries in checkout spec". */
	summary: string;
	/** Static age string ("now", "3m", "2d") — no clocks. */
	age: string;
	pr?: { number: number; state: "open" | "merged" };
}

export type TerminalBoardEvent =
	| { type: "add-item"; item: TerminalWorkItem }
	| { type: "move-item"; key: string; to: TerminalBoardStatus }
	| { type: "set-summary"; key: string; summary: string; age?: string }
	| { type: "set-pr"; key: string; number: number; state: "open" | "merged" };

export type TerminalBeatStep =
	| { kind: "split" }
	| { kind: "type"; pane: "left" | "right"; text: string }
	| { kind: "paste"; pane: "left" | "right"; text: string }
	| { kind: "submit"; pane: "left" | "right" }
	| { kind: "output"; pane: "left" | "right"; lines: readonly TerminalLine[] }
	| { kind: "set-working"; pane: "left" | "right"; working: boolean }
	| { kind: "show-dashboard" }
	| { kind: "board"; events: readonly TerminalBoardEvent[] }
	| { kind: "pause"; ms: number };

export interface TerminalBeat {
	id: string;
	trigger: "key" | "click";
	/** Forward-looking status-bar hint shown once this beat settles (e.g. "→ next: …"). */
	hint: string;
	steps: readonly TerminalBeatStep[];
}

export interface TerminalPaneState {
	transcript: TerminalLine[];
	promptDraft: string;
	working: boolean;
}

export interface TerminalDemoState {
	split: boolean;
	dashboardVisible: boolean;
	beatIndex: number;
	stepIndex: number;
	settled: boolean;
	finished: boolean;
	left: TerminalPaneState;
	right: TerminalPaneState;
	items: TerminalWorkItem[];
}

export type TerminalDemoAction =
	| { type: "begin-beat" }
	| { type: "commit-step" }
	| { type: "finish-beat" }
	| { type: "step-back" }
	| { type: "restart" };

export function createInitialTerminalDemoState(): TerminalDemoState {
	return {
		split: false,
		dashboardVisible: false,
		beatIndex: -1,
		stepIndex: 0,
		settled: true,
		finished: false,
		left: { transcript: [], promptDraft: "", working: false },
		right: { transcript: [], promptDraft: "", working: false },
		items: [],
	};
}

export function applyBoardEvent(
	items: readonly TerminalWorkItem[],
	event: TerminalBoardEvent,
): TerminalWorkItem[] {
	switch (event.type) {
		case "add-item":
			return [...items, event.item];
		case "move-item":
			return items.map((item) => (item.key === event.key ? { ...item, status: event.to } : item));
		case "set-summary":
			return items.map((item) => {
				if (item.key !== event.key) return item;
				return {
					...item,
					summary: event.summary,
					...(event.age !== undefined ? { age: event.age } : {}),
				};
			});
		case "set-pr":
			return items.map((item) =>
				item.key === event.key ? { ...item, pr: { number: event.number, state: event.state } } : item,
			);
		default:
			return [...items];
	}
}

export function getVisibleOutputLines(
	step: TerminalBeatStep | null,
	pane: "left" | "right",
	revealCount: number,
): readonly TerminalLine[] {
	if (step?.kind !== "output" || step.pane !== pane) return [];
	return step.lines.slice(0, Math.max(0, revealCount));
}

/** Formats a submitted prompt draft into its transcript line. Documented convention:
 * the right pane (Claude Code) echoes prompts with a `> ` shell-style prefix; the left
 * pane only echoes the initial Jira shell command verbatim. Both use tone "bold" so
 * submitted commands read distinctly from tool output. */
function formatSubmittedLine(pane: "left" | "right", text: string): TerminalLine {
	return pane === "right" ? [{ text: `> ${text}`, tone: "bold" }] : [{ text, tone: "bold" }];
}

function updatePane(
	state: TerminalDemoState,
	pane: "left" | "right",
	update: (current: TerminalPaneState) => TerminalPaneState,
): TerminalDemoState {
	return { ...state, [pane]: update(state[pane]) };
}

export function applyStep(state: TerminalDemoState, step: TerminalBeatStep): TerminalDemoState {
	switch (step.kind) {
		case "split":
			return { ...state, split: true };
		case "show-dashboard":
			return { ...state, dashboardVisible: true };
		case "type":
		case "paste":
			return updatePane(state, step.pane, (pane) => ({ ...pane, promptDraft: step.text }));
		case "submit":
			return updatePane(state, step.pane, (pane) => ({
				...pane,
				transcript: [...pane.transcript, formatSubmittedLine(step.pane, pane.promptDraft)],
				promptDraft: "",
			}));
		case "output":
			return updatePane(state, step.pane, (pane) => ({
				...pane,
				transcript: [...pane.transcript, ...step.lines],
			}));
		case "set-working":
			return updatePane(state, step.pane, (pane) => ({ ...pane, working: step.working }));
		case "board":
			return { ...state, items: step.events.reduce(applyBoardEvent, state.items as TerminalWorkItem[]) };
		case "pause":
			return state;
		default:
			return state;
	}
}

/**
 * Builds a reducer bound to a beat script. Kept as a factory (rather than a single
 * reducer bound to `TERMINAL_DEMO_BEATS`) so this module never has to import beats from
 * `../data/terminal-demo-script` — the UI worker calls
 * `createTerminalDemoReducer(TERMINAL_DEMO_BEATS)` once and reuses the returned function.
 */
export function createTerminalDemoReducer(
	beats: readonly TerminalBeat[],
): (state: TerminalDemoState, action: TerminalDemoAction) => TerminalDemoState {
	return function terminalDemoReducer(state: TerminalDemoState, action: TerminalDemoAction): TerminalDemoState {
		switch (action.type) {
			case "begin-beat": {
				if (!state.settled) return state;
				const nextBeatIndex = state.beatIndex + 1;
				if (nextBeatIndex >= beats.length) return state;
				return { ...state, beatIndex: nextBeatIndex, stepIndex: 0, settled: false };
			}
			case "commit-step": {
				if (state.settled) return state;
				const beat = beats[state.beatIndex];
				const step = beat?.steps[state.stepIndex];
				if (!beat || !step) return state;

				const applied = applyStep(state, step);
				const nextStepIndex = state.stepIndex + 1;
				const settled = nextStepIndex >= beat.steps.length;
				const finished = settled && state.beatIndex === beats.length - 1;
				return { ...applied, stepIndex: nextStepIndex, settled, finished };
			}
			case "finish-beat": {
				if (state.settled) return state;
				const beat = beats[state.beatIndex];
				if (!beat) return state;

				let next = state;
				for (let index = state.stepIndex; index < beat.steps.length; index += 1) {
					next = applyStep(next, beat.steps[index]);
				}
				return {
					...next,
					stepIndex: beat.steps.length,
					settled: true,
					finished: state.beatIndex === beats.length - 1,
				};
			}
			case "step-back": {
				// Instant rollback to the previous beat's fully-settled state. Whether the
				// current beat is mid-animation or settled, `beatIndex` points at it, so the
				// previous completed beat is `beatIndex - 1`; re-folding from scratch to there
				// is the simplest correct rollback (discards any in-flight progress).
				const targetIndex = state.beatIndex - 1;
				if (targetIndex < 0) return createInitialTerminalDemoState();
				return foldBeats(beats, targetIndex);
			}
			case "restart":
				return createInitialTerminalDemoState();
			default:
				return state;
		}
	};
}

/** Folds beats `0..throughIndex` (inclusive) into a fully-settled state, starting fresh.
 * Used by tests to prove fast-forward / reduced-motion end states match step-by-step play,
 * and kept generic so back-stepping (re-fold to an earlier index) stays cheap to add later. */
export function foldBeats(beats: readonly TerminalBeat[], throughIndex: number): TerminalDemoState {
	const reducer = createTerminalDemoReducer(beats);
	let state = createInitialTerminalDemoState();
	for (let index = 0; index <= throughIndex; index += 1) {
		state = reducer(state, { type: "begin-beat" });
		state = reducer(state, { type: "finish-beat" });
	}
	return state;
}

export function getBoardSections(items: readonly TerminalWorkItem[]): {
	needsInput: TerminalWorkItem[];
	working: TerminalWorkItem[];
	backlog: TerminalWorkItem[];
	done: TerminalWorkItem[];
} {
	return {
		needsInput: items.filter((item) => item.status === "needs-input"),
		working: items.filter((item) => item.status === "working"),
		backlog: items.filter((item) => item.status === "backlog"),
		done: items.filter((item) => item.status === "done"),
	};
}

export function getBoardCounts(items: readonly TerminalWorkItem[]): {
	awaiting: number;
	working: number;
	completed: number;
} {
	const sections = getBoardSections(items);
	return {
		awaiting: sections.needsInput.length,
		working: sections.working.length,
		completed: sections.done.length,
	};
}

/** Display order of the dashboard sections (attention-first). Single source of truth
 * shared by the Jira pane (render order) and the controller (keyboard row navigation),
 * so the highlighted row and the rendered row list can never drift apart. */
export const TERMINAL_SECTION_ORDER = [
	{ key: "needsInput", label: "Needs input" },
	{ key: "working", label: "Working" },
	{ key: "backlog", label: "Backlog" },
	{ key: "done", label: "Done" },
] as const;

/** Flattened item keys in on-screen row order — drives up/down keyboard navigation. */
export function getOrderedItemKeys(items: readonly TerminalWorkItem[]): string[] {
	const sections = getBoardSections(items);
	const keys: string[] = [];
	for (const { key } of TERMINAL_SECTION_ORDER) {
		for (const item of sections[key]) keys.push(item.key);
	}
	return keys;
}
