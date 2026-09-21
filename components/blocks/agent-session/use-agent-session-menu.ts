"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AgentSessionMoreMenuActions } from "./agent-session-more-menu";
import type {
	AgentSessionItem,
	AgentSessionWorkItemDraft,
} from "./agent-session-types";

/** How long the Terminal row keeps its copied check after the clipboard write. */
export const AGENT_SESSION_COPIED_RESET_MS = 2000;
type AgentSessionOpenMenu = "more" | "continue";

async function copyResumeCommand(command: string): Promise<void> {
	if (typeof navigator === "undefined" || navigator.clipboard?.writeText === undefined) {
		return;
	}

	try {
		await navigator.clipboard.writeText(command);
	} catch {
		// Keep the click successful when clipboard permission is denied.
	}
}

export interface AgentSessionMenuState {
	readonly actions: AgentSessionMoreMenuActions;
	/** Whether the Terminal row is showing the copy confirmation check. */
	readonly copied: boolean;
	readonly isOpen: boolean;
	readonly isContinueOpen: boolean;
	readonly setIsOpen: (open: boolean) => void;
	readonly setIsContinueOpen: (open: boolean) => void;
	readonly toggleContinue: () => void;
}

/**
 * Shared capabilities and exclusive open state for the row's two menus.
 *
 * Which actions exist is a function of where the session runs and which
 * capabilities the host supplied, and both answers are needed in two places —
 * the menus themselves and the row's `pinned` reveal. Keeping that resolution here
 * leaves the card deciding layout instead of policy.
 *
 * An action resolves to `undefined` when its capability is missing or does not
 * apply to this host, which the menu renders as a disabled row: an enabled
 * control backed by an optional call is a lie about what the surface can do.
 */
export function useAgentSessionMenu({
	canResume,
	isCloud,
	item,
	onContinueInAgent,
	onCopyResume,
	onCreateWorkItemFromDraft,
	onDeleteSession,
	onItemHover,
	onLinkWorkItem,
	onMoreMenuOpenChange,
	onRenameSession,
	onToggleVisibility,
	resumeCommand,
}: Readonly<{
	canResume: boolean;
	isCloud: boolean;
	item: AgentSessionItem;
	onContinueInAgent?: (item: AgentSessionItem) => void;
	onCopyResume?: (item: AgentSessionItem) => void;
	onCreateWorkItemFromDraft?: (item: AgentSessionItem, draft: AgentSessionWorkItemDraft) => void;
	onDeleteSession?: (item: AgentSessionItem) => void;
	onItemHover?: (item: AgentSessionItem | null) => void;
	onLinkWorkItem?: (item: AgentSessionItem, workItemKey?: string) => void;
	onMoreMenuOpenChange?: (open: boolean) => void;
	onRenameSession?: (item: AgentSessionItem) => void;
	onToggleVisibility?: (item: AgentSessionItem) => void;
	resumeCommand: string;
}>): AgentSessionMenuState {
	const [copied, setCopied] = useState(false);
	const [openMenu, setOpenMenu] = useState<AgentSessionOpenMenu | null>(null);
	const openMenuRef = useRef<AgentSessionOpenMenu | null>(null);
	const menuOpenChangeRef = useRef(onMoreMenuOpenChange);
	const resetRef = useRef<number | undefined>(undefined);
	const setMenuOpen = useCallback((kind: AgentSessionOpenMenu, open: boolean) => {
		if (!open && openMenuRef.current !== kind) return;
		const nextMenu = open ? kind : null;
		openMenuRef.current = nextMenu;
		setOpenMenu(nextMenu);
		onMoreMenuOpenChange?.(nextMenu !== null);
	}, [onMoreMenuOpenChange]);
	const setIsOpen = useCallback((open: boolean) => setMenuOpen("more", open), [setMenuOpen]);
	const setIsContinueOpen = useCallback((open: boolean) => setMenuOpen("continue", open), [setMenuOpen]);
	const toggleContinue = useCallback(() => setMenuOpen("continue", openMenuRef.current !== "continue"), [setMenuOpen]);

	useEffect(() => {
		menuOpenChangeRef.current = onMoreMenuOpenChange;
	}, [onMoreMenuOpenChange]);

	useEffect(() => () => {
		window.clearTimeout(resetRef.current);
		if (openMenuRef.current !== null) menuOpenChangeRef.current?.(false);
	}, []);

	const handleCopyPrompt = useCallback(() => {
		void copyResumeCommand(resumeCommand).then(() => {
			onCopyResume?.(item);
			setCopied(true);
			window.clearTimeout(resetRef.current);
			resetRef.current = window.setTimeout(() => {
				setCopied(false);
			}, AGENT_SESSION_COPIED_RESET_MS);
		});
	}, [item, onCopyResume, resumeCommand]);

	const actions: AgentSessionMoreMenuActions = {
		onContinueInAgent: onContinueInAgent === undefined || isCloud
			? undefined
			: () => onContinueInAgent(item),
		// Copying writes to the clipboard before any callback runs, so a row the
		// host cannot resume must not offer an enabled control.
		onCopyPrompt: canResume && !isCloud ? handleCopyPrompt : undefined,
		onCreateWorkItem: onCreateWorkItemFromDraft === undefined
			? undefined
			: (draft: AgentSessionWorkItemDraft) => onCreateWorkItemFromDraft(item, draft),
		onDelete: onDeleteSession === undefined || !isCloud
			? undefined
			: () => onDeleteSession(item),
		onDismiss: onToggleVisibility === undefined
			? undefined
			: () => {
				onItemHover?.(null);
				onToggleVisibility(item);
			},
		onLinkWorkItem: onLinkWorkItem === undefined
			? undefined
			: (workItemKey: string) => onLinkWorkItem(item, workItemKey),
		onRename: onRenameSession === undefined || !isCloud
			? undefined
			: () => onRenameSession(item),
	};

	return { actions, copied, isOpen: openMenu === "more", isContinueOpen: openMenu === "continue", setIsOpen, setIsContinueOpen, toggleContinue };
}
