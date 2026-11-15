import { useState } from "react";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";

export interface ContextBarOpenState {
	isCollapsibleEditContextBar: boolean;
	isContextBarOpen: boolean;
	setIsContextBarOpen: (isOpen: boolean) => void;
}

/**
 * Open state of a collapsible "Edit:" context bar. It reopens whenever the
 * host passes a bar with a new `signature`.
 */
export function useContextBarOpenState(chatContextBar: ChatContextBarDescriptor | null | undefined): ContextBarOpenState {
	const isCollapsibleEditContextBar = Boolean(chatContextBar?.collapsible && chatContextBar.variant === "edit");
	const [contextBarOpenState, setContextBarOpenState] = useState({
		isOpen: true,
		signature: chatContextBar?.signature,
	});
	let resolvedContextBarOpenState = contextBarOpenState;
	if (contextBarOpenState.signature !== chatContextBar?.signature) {
		resolvedContextBarOpenState = {
			isOpen: true,
			signature: chatContextBar?.signature,
		};
		setContextBarOpenState(resolvedContextBarOpenState);
	}
	const isContextBarOpen = resolvedContextBarOpenState.isOpen;
	const setIsContextBarOpen = (isOpen: boolean) => {
		setContextBarOpenState((currentState) => ({ ...currentState, isOpen }));
	};

	return { isCollapsibleEditContextBar, isContextBarOpen, setIsContextBarOpen };
}
