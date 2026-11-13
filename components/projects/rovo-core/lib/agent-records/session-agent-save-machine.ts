/**
 * Pure machine for the Studio session-agent save indicator. No React and no clock: the
 * provider's debounced write reports back with `persisted`, carrying the time.
 */
import type { StudioSessionAgentSaveStatus } from "./session-agent-registry";

/** A state the indicator shows as is. A visible pending write reads as "saving". */
export type SessionAgentShownSaveState =
	| { readonly phase: "idle" }
	| { readonly phase: "pending"; readonly silent: false }
	| { readonly phase: "saved"; readonly at: number }
	| { readonly phase: "error" };

export type SessionAgentSaveState =
	| SessionAgentShownSaveState
	/** A write with nothing worth announcing (a blank agent, a rehydrate): the indicator keeps showing `showing`. */
	| { readonly phase: "pending"; readonly silent: true; readonly showing: SessionAgentShownSaveState };

export type SessionAgentSaveEvent =
	/** Session agents changed and a debounced write is queued. */
	| { readonly type: "changed"; readonly silent: boolean }
	/** The queued write ran. */
	| { readonly type: "persisted"; readonly ok: boolean; readonly at: number };

export const SESSION_AGENT_SAVE_INITIAL_STATE: SessionAgentSaveState = { phase: "idle" };
const VISIBLE_PENDING: SessionAgentShownSaveState = { phase: "pending", silent: false };

/** Transition table. Returns the identical object when nothing changes. */
export function sessionAgentSaveReducer(
	state: SessionAgentSaveState,
	event: SessionAgentSaveEvent,
): SessionAgentSaveState {
	switch (event.type) {
		case "changed":
			if (state.phase === "pending" && state.silent === event.silent) {
				return state;
			}
			if (!event.silent) {
				return VISIBLE_PENDING;
			}
			// A silent change never hides a visible write that is still pending: that write's
			// result (Saved or the error) still shows when it lands.
			if (state.phase === "pending") {
				return state;
			}
			return { phase: "pending", silent: true, showing: state };
		case "persisted":
			if (state.phase !== "pending") {
				return state;
			}
			if (state.silent) {
				return state.showing;
			}
			return event.ok ? { phase: "saved", at: event.at } : { phase: "error" };
		default: {
			const _exhaustive: never = event;
			void _exhaustive;
			return state;
		}
	}
}

function shown(state: SessionAgentSaveState): SessionAgentShownSaveState {
	return state.phase === "pending" && state.silent ? state.showing : state;
}

export function selectSessionAgentSaveStatus(state: SessionAgentSaveState): StudioSessionAgentSaveStatus {
	const visible = shown(state);
	return visible.phase === "pending" ? "saving" : visible.phase;
}

/** When the shown save landed; only a saved state has one. */
export function selectSessionAgentSavedAt(state: SessionAgentSaveState): number | null {
	const visible = shown(state);
	return visible.phase === "saved" ? visible.at : null;
}
