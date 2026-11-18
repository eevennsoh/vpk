"use client";

import { createContext, type ReactNode } from "react";

import type { BoardCardInsertion } from "../lib/board-agent-session-drag";

/**
 * Hover-armed insertion for one column's card list. Drag insertions stay on
 * the `cardInsertion` prop so a session drop never fights a pointer hover.
 */
export const BoardCardHoverInsertionContext = createContext<BoardCardInsertion | null>(null);

export const BoardCardGapCreateContext = createContext<{
	beforeCardCode?: string;
	createDraft?: ReactNode;
	creating: boolean;
	onStartCreate?: (trigger: HTMLElement, beforeCardCode?: string, returnFocus?: HTMLElement | null) => void;
	onControlLeave: (next: EventTarget | null) => void;
} | null>(null);
