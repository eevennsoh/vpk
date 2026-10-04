"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import type { useRovoChat } from "@/app/contexts/context-rovo-chat";

type RovoChatControls = Pick<ReturnType<typeof useRovoChat>,
	"chatSurface" | "isOpen" | "openChat" | "closeChat" | "toggleChat" | "selectAgent" | "applyLocalTurn"
>;

const RovoChatControlsContext = createContext<RovoChatControls | null>(null);

/** Workspace chrome and launchers do not subscribe to streamed message data. */
export function RovoChatControlsProvider({ value, children }: Readonly<{
	value: RovoChatControls;
	children: ReactNode;
}>) {
	const { chatSurface, isOpen, openChat, closeChat, toggleChat, selectAgent, applyLocalTurn } = value;
	const controls = useMemo(() => ({
		chatSurface, isOpen, openChat, closeChat, toggleChat, selectAgent, applyLocalTurn,
	}), [chatSurface, isOpen, openChat, closeChat, toggleChat, selectAgent, applyLocalTurn]);
	return <RovoChatControlsContext value={controls}>{children}</RovoChatControlsContext>;
}

export function useOptionalRovoChatControls() {
	return use(RovoChatControlsContext);
}

export function useRovoChatControls() {
	const controls = useOptionalRovoChatControls();
	if (controls === null) throw new Error("useRovoChatControls must be used within a RovoChatProvider");
	return controls;
}
