"use client";

import { useEffect, useId, useState, useSyncExternalStore, type ComponentType } from "react";
import type { PeelSurfaceProps } from "@/components/visual/peel/peel-surface";
import { createSessionPeelPreparation } from "./session-peel-preparation";

const preparation = createSessionPeelPreparation();

/** The retained canvas parks on demand and remains inert between gestures. */
export function useSessionPeelPreparation(enabled: boolean) {
	const id = useId();
	const prepared = useSyncExternalStore(preparation.subscribe, () => enabled && preparation.isPrepared(id), () => false);
	useEffect(() => () => preparation.release(id), [id, enabled]);
	return { prepared, prepare: () => { if (enabled) preparation.prepare(id); } };
}

/** Load the optional renderer before dragging, without loading it for normal rows. */
export function useSessionPeelSurface(enabled: boolean) {
	const [surface, setSurface] = useState<ComponentType<PeelSurfaceProps> | null>(null);
	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;
		void import("@/components/visual/peel/peel-surface").then((module) => {
			if (!cancelled) setSurface(() => module.PeelSurface);
		}).catch(() => {
			// Keep the canonical drag preview when the optional chunk cannot load.
		});
		return () => { cancelled = true; };
	}, [enabled]);
	return surface;
}
