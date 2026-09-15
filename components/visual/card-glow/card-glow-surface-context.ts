"use client";

import { createContext, use } from "react";

/**
 * Registers a glow surface with the proximity plane that encloses it.
 *
 * A ref callback rather than a prop so a deeply nested card can join the plane
 * without every layer between them having to forward it. `undefined` means no
 * plane is in scope — the surface is on its own and should fall back to
 * per-surface hover tracking.
 */
export type CardGlowSurfaceRef = (node: HTMLElement | null) => (() => void) | undefined;

const CardGlowSurfaceContext = createContext<CardGlowSurfaceRef | undefined>(undefined);

export { CardGlowSurfaceContext };

/** The enclosing plane's registration callback, or `undefined` when there is none. */
export function useCardGlowSurface(): CardGlowSurfaceRef | undefined {
	return use(CardGlowSurfaceContext);
}
