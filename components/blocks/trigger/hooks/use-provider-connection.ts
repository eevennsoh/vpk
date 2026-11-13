"use client";

import { useCallback, useReducer } from "react";

import { useTimedTransition } from "@/components/hooks/use-timed-transition";

import {
	PROVIDER_CONNECTION_INITIAL_STATE,
	PROVIDER_CONNECTION_TIMERS,
	providerConnectionReducer,
	type ProviderConnectionState,
} from "./provider-connection-machine";

export interface ProviderConnectionControls<T> {
	/** Starts the fake connect; the caller marks its triggers "connecting" itself. */
	readonly connect: (target: T) => void;
	/** Hides the progress UI; the connect still completes. */
	readonly dismiss: () => void;
	/** The connect in progress while its progress UI is showing. */
	readonly pending: T | null;
}

/**
 * The fake provider connection shared by the trigger dialogs and the Studio config panel:
 * after the delay `onConnected` runs once for the latest target. Unmounting cancels it.
 */
export function useProviderConnection<T>(onConnected: (target: T) => void): ProviderConnectionControls<T> {
	const [state, dispatch] = useReducer(
		providerConnectionReducer<T>,
		PROVIDER_CONNECTION_INITIAL_STATE as ProviderConnectionState<T>,
	);

	useTimedTransition(state.phase === "connecting" ? "connecting" : null, PROVIDER_CONNECTION_TIMERS, {
		onAdvance: () => {
			if (state.phase !== "connecting") {
				return;
			}
			onConnected(state.target);
			dispatch({ type: "connected", attempt: state.attempt });
		},
		// A simulated authorization wait, not motion: it keeps its delay under reduced motion.
		reducedMotion: false,
		restartKey: state.attempt,
	});

	const connect = useCallback((target: T) => dispatch({ type: "connect", target }), []);
	const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);

	return {
		connect,
		dismiss,
		pending: state.phase === "connecting" && state.shown ? state.target : null,
	};
}
