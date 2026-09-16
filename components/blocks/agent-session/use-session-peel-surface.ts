"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { PeelSurfaceProps } from "@/components/visual/peel/peel-surface";

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
