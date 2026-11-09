"use client";

import { useCallback, useEffect, useMemo } from "react";

import { useOptionalRovoChat } from "@/app/contexts";
import {
	PULSE_OPEN_DATASET_KEY,
	toPulseChatContextBar,
} from "@/components/blocks/jira-kanban/experimental/pulse/lib/pulse-chat-context";
import type { PulseScope } from "@/components/blocks/jira-kanban/experimental/pulse/types";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";

export interface UsePulseInsightsChatResult {
	chatContextBar: ChatContextBarDescriptor;
	chatOpen: boolean;
	enabled: boolean;
	ask: (question: string) => boolean;
}

/**
 * Insights chat — hide the viewport FAB, and open the rail-embedded panel.
 *
 * The document flag is set for as long as Pulse is mounted, even on routes
 * that never mount a chat provider, so the Golden Journey overlay can hide
 * its launcher before anyone has asked a question. Asking is a no-op without
 * a provider; the page's article-answer path remains the fallback.
 */
export function usePulseInsightsChat(
	scope: PulseScope | null,
	projectLabel: string,
): UsePulseInsightsChatResult {
	const chat = useOptionalRovoChat();
	const openChat = chat?.openChat;
	const sendPrompt = chat?.sendPrompt;

	useEffect(() => {
		document.documentElement.dataset[PULSE_OPEN_DATASET_KEY] = "true";
		return () => {
			delete document.documentElement.dataset[PULSE_OPEN_DATASET_KEY];
		};
	}, []);

	const chatContextBar = useMemo(
		() => toPulseChatContextBar(scope, projectLabel),
		[projectLabel, scope],
	);

	const ask = useCallback((question: string) => {
		if (openChat === undefined || sendPrompt === undefined) {
			return false;
		}
		openChat("floating");
		void sendPrompt(question);
		return true;
	}, [openChat, sendPrompt]);

	const chatSurface = chat?.chatSurface ?? null;
	const enabled = chat !== null;

	return useMemo(() => ({
		ask,
		chatContextBar,
		chatOpen: chatSurface === "floating",
		enabled,
	}), [ask, chatContextBar, chatSurface, enabled]);
}
