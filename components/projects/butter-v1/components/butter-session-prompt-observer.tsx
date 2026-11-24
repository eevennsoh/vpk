"use client";

import { useEffect } from "react";
import { useRovoChat } from "@/app/contexts/context-rovo-chat";
import { getMessageText } from "@/lib/rovo-ui-messages";

export function ButterSessionPromptObserver({ activeSessionId, isSwitchingSession, onPrompt }: Readonly<{
	activeSessionId: string | null;
	isSwitchingSession: boolean;
	onPrompt: (sessionId: string, prompt: string) => void;
}>) {
	const { uiMessages } = useRovoChat();
	useEffect(() => {
		if (!activeSessionId || isSwitchingSession) return;
		const firstPrompt = uiMessages.find((message) => message.role === "user");
		if (firstPrompt) onPrompt(activeSessionId, getMessageText(firstPrompt));
	}, [activeSessionId, isSwitchingSession, onPrompt, uiMessages]);
	return null;
}
