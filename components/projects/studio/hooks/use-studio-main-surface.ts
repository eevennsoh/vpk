"use client";

import { useCallback, useRef, useState } from "react";

import {
	STUDIO_MAIN_SURFACE_INITIAL_STATE,
	studioMainSurfaceReducer,
	type StudioMainSurfaceEvent,
	type StudioMainSurfaceState,
} from "@/components/projects/studio/lib/studio-main-surface-machine";

/**
 * Holds the Studio main-surface machine. Each event reduces the state the previous one
 * produced, even before React re-renders, so back-to-back events in one handler compose and
 * the URL restore compares against the agent that is open right now.
 */
export function useStudioMainSurface() {
	const [state, setState] = useState<StudioMainSurfaceState>(STUDIO_MAIN_SURFACE_INITIAL_STATE);
	const stateRef = useRef(state);
	const dispatch = useCallback((event: StudioMainSurfaceEvent) => {
		const next = studioMainSurfaceReducer(stateRef.current, event);
		if (next !== stateRef.current) {
			stateRef.current = next;
			setState(next);
		}
	}, []);

	return { dispatch, state } as const;
}
