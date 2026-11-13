"use client";

import { useCallback, useReducer } from "react";

import type { StudioScreenAssistantRegion } from "@/components/projects/rovo-core/lib/screen-assistant";
import { reduceScreenAssistantRegion } from "@/components/projects/sidebar-chat/lib/sidebar-chat-state";

export interface ScreenAssistantRegionControls {
	readonly painting: boolean;
	readonly region: StudioScreenAssistantRegion | null;
	readonly setPainting: (painting: boolean) => void;
	readonly setRegion: (region: StudioScreenAssistantRegion | null) => void;
}

/**
 * The painted screen-assistant region and whether it is being painted. Both clear together
 * during render as soon as the assistant is not `enabled`, so a stale region never paints.
 */
export function useScreenAssistantRegion(enabled: boolean): ScreenAssistantRegionControls {
	const [{ painting, region }, dispatch] = useReducer(reduceScreenAssistantRegion, { painting: false, region: null });
	const setPainting = useCallback((nextPainting: boolean) => {
		dispatch({ type: "set-painting", painting: nextPainting });
	}, []);
	const setRegion = useCallback((nextRegion: StudioScreenAssistantRegion | null) => {
		dispatch({ type: "set-region", region: nextRegion });
	}, []);
	if (!enabled && (painting || region !== null)) {
		dispatch({ type: "reset" });
	}
	return { painting, region, setPainting, setRegion };
}
