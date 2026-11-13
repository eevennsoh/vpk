/**
 * Pure machine for the fake provider connection: idle → connecting → (timer) idle, with the
 * host marking triggers connected on the way out. No React; the `node:test` table drives it.
 */
import type { TimedTransitionTable } from "@/components/hooks/use-timed-transition";

/** The "Authorizing…" beat before a provider's triggers flip to connected. */
export const PROVIDER_CONNECTION_DELAY_MS = 1200;

export type ProviderConnectionState<T> =
	| { readonly phase: "idle"; readonly attempt: number }
	| {
		readonly phase: "connecting";
		readonly target: T;
		/**
		 * Completes this attempt. Captured when the connect starts, so it writes to the state
		 * the connect began in even if the host has since switched what it shows.
		 */
		readonly onConnected: () => void;
		/** Restarts the timer when a new connect replaces one still in progress. */
		readonly attempt: number;
		/** Whether the host's progress UI is showing; dismissing it does not cancel the connect. */
		readonly shown: boolean;
	};

export type ProviderConnectionEvent<T> =
	| { readonly type: "connect"; readonly target: T; readonly onConnected: () => void }
	| { readonly type: "connected"; readonly attempt: number }
	| { readonly type: "dismiss" };

export const PROVIDER_CONNECTION_INITIAL_STATE: ProviderConnectionState<never> = { phase: "idle", attempt: 0 };

export const PROVIDER_CONNECTION_TIMERS: TimedTransitionTable<"connecting" | "connected"> = {
	connecting: { next: "connected", delayMs: PROVIDER_CONNECTION_DELAY_MS },
};

export function providerConnectionReducer<T>(
	state: ProviderConnectionState<T>,
	event: ProviderConnectionEvent<T>,
): ProviderConnectionState<T> {
	switch (event.type) {
		case "connect":
			// One connection at a time: a new provider takes over the timer.
			return { phase: "connecting", target: event.target, onConnected: event.onConnected, attempt: state.attempt + 1, shown: true };
		case "connected":
			if (state.phase !== "connecting" || state.attempt !== event.attempt) {
				return state;
			}
			return { phase: "idle", attempt: state.attempt };
		case "dismiss":
			if (state.phase !== "connecting" || !state.shown) {
				return state;
			}
			return { ...state, shown: false };
		default: {
			const _exhaustive: never = event;
			void _exhaustive;
			return state;
		}
	}
}
