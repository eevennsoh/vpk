"use client";

import { useCallback, useMemo, useState } from "react";
import { useRovoChat } from "@/app/contexts";
import {
	JiraSessionDescription,
	JiraSessionLabel,
	JiraSessionLifecycle,
	JiraSessionRowActions,
} from "@/components/blocks/product-sidebar/variants/jira";
import { AnimatedDots } from "@/components/ui-custom/animated-dots";
import { Shimmer } from "@/components/ui-custom/shimmer";
import ChatPanel, {
	type ChatPanelHistoryController,
} from "@/components/projects/sidebar-chat/page";
import type { ChatHistorySortMode } from "@/components/projects/sidebar-chat/components/chat-history-drawer";
import { QueueSessionContextBar } from "@/components/projects/jira-queue/components/queue-conversation-workspace";
import {
	ASX_QUEUE_SESSION_SEEDS,
	createAsxQueueSidebarSessionItem,
	createAsxQueueHistoryThreads,
	type AsxQueueJiraColumn,
	type AsxQueueSession,
} from "@/components/projects/jira-queue/data/queue-sessions";
import {
	archiveQueueSession,
	dismissQueueSessionFileChanges,
	setQueueSessionJiraColumn,
	setQueueSessionPinned,
	sortQueueSessions,
} from "@/components/projects/jira-queue/lib/queue-session-state";

function ignoreThreadRun(): Promise<void> {
	return Promise.resolve();
}

/**
 * The "Rovo" design pattern for the Jira Golden Journeys v0 gallery.
 *
 * Reuses the `components/projects/sidebar-chat` project verbatim — the same
 * `ChatPanel` (with smart widgets + sidebar smart generation) that the
 * standalone `/sidebar-chat` demo renders — shown as a bounded sidebar panel
 * in the gallery stage when the Rovo card is selected.
 *
 * Layout intent: the sidebar chat is a narrow, bounded panel. The gallery runs
 * this stage with the default `stagePosition="top"` (shared by the board/list/
 * terminal stages), so centering is done here. The pinned dock is treated as a
 * pure overlay — we do NOT reserve its footprint — so the panel is vertically
 * (and horizontally) centered within the full stage height as if the dock were
 * absent, with the dock's backdrop blur floating over the panel's lower edge.
 * Its 400px width and 800px height cap match the standalone sidebar-chat demo;
 * `h-full` lets it shrink on short viewports. `ChatPanel` carries its own
 * raised surface + border + radius (see the sidebar-chat
 * `chatStyles.chatPanel`), so no extra chrome is needed here.
 *
 * The chat runs on the ASX-wide `RovoChatProvider` (see `../page.tsx`); the
 * gallery resets it when the Rovo card is entered so the panel opens at its
 * greeting instead of inheriting the Kanban demo's conversation.
 */
export function RovoStage(): React.ReactElement {
	const {
		activateSession,
		resetAgentToRovo,
		resetChat,
	} = useRovoChat();
	const [historySessions, setHistorySessions] = useState<AsxQueueSession[]>(() => (
		ASX_QUEUE_SESSION_SEEDS.map((session) => ({ ...session }))
	));
	const [activeHistorySessionId, setActiveHistorySessionId] = useState<string | null>(null);
	const [sortMode, setSortMode] = useState<ChatHistorySortMode>("manual");
	const orderedHistorySessions = useMemo(
		() => sortQueueSessions(historySessions, sortMode),
		[historySessions, sortMode],
	);
	const historyThreads = useMemo(
		() => createAsxQueueHistoryThreads(orderedHistorySessions),
		[orderedHistorySessions],
	);
	const historySessionItems = useMemo(() => new Map(
		historySessions.map((session) => [session.id, createAsxQueueSidebarSessionItem(session)]),
	), [historySessions]);
	const pinnedThreadIds = useMemo(() => new Set(
		historySessions.filter((session) => session.isPinned).map((session) => session.id),
	), [historySessions]);
	const activeHistorySession = historySessions.find((session) => session.id === activeHistorySessionId);
	const getThreadPresentation = useCallback<
		NonNullable<ChatPanelHistoryController["getThreadPresentation"]>
	>((thread) => {
		const session = historySessionItems.get(thread.id);
		if (!session) return undefined;

		return {
			description: <JiraSessionDescription session={session} />,
			meta: <JiraSessionLifecycle status={session.status} />,
			title: session.status === "awaiting-input" ? (
				<span className="flex min-w-0 items-baseline">
					<Shimmer as="span" className="min-w-0 truncate" duration={1.4} spread={2}>
						Awaiting user response
					</Shimmer>
					<AnimatedDots />
				</span>
			) : <JiraSessionLabel session={session} />,
		};
	}, [historySessionItems]);

	const handleNewChat = useCallback(() => {
		setActiveHistorySessionId(null);
		resetAgentToRovo({ preserveCurrentThread: true });
		resetChat();
	}, [resetAgentToRovo, resetChat]);
	const handleBackToRovo = useCallback(() => {
		setActiveHistorySessionId(null);
	}, []);
	const handleSelectThread = useCallback(async (threadId: string) => {
		const session = historySessions.find((item) => item.id === threadId);
		const thread = historyThreads.find((item) => item.id === threadId);
		if (!session || !thread) return Promise.resolve();

		const activated = await activateSession({ agentId: session.agentId, threadId: null, messages: thread.messages });
		if (activated) setActiveHistorySessionId(threadId);
	}, [activateSession, historySessions, historyThreads]);
	const handleDeleteThread = useCallback((threadId: string) => {
		setHistorySessions((sessions) => sessions.filter((session) => session.id !== threadId));
		if (activeHistorySessionId === threadId) handleNewChat();
		return Promise.resolve();
	}, [activeHistorySessionId, handleNewChat]);
	const handleTogglePinThread = useCallback((threadId: string) => {
		setHistorySessions((sessions) => {
			const session = sessions.find((item) => item.id === threadId);
			return session
				? setQueueSessionPinned(sessions, threadId, !session.isPinned)
				: [...sessions];
		});
	}, []);
	const handleDismissFileChanges = useCallback(() => {
		if (!activeHistorySessionId) return;
		setHistorySessions((sessions) => (
			dismissQueueSessionFileChanges(sessions, activeHistorySessionId)
		));
	}, [activeHistorySessionId]);
	const handleJiraColumnChange = useCallback((jiraColumn: AsxQueueJiraColumn) => {
		if (!activeHistorySessionId) return;
		setHistorySessions((sessions) => (
			setQueueSessionJiraColumn(sessions, activeHistorySessionId, jiraColumn)
		));
	}, [activeHistorySessionId]);
	const handleArchiveThread = useCallback((threadId: string) => {
		const result = archiveQueueSession(
			historySessions,
			threadId,
			activeHistorySessionId ?? "",
		);
		setHistorySessions(result.sessions);
		if (activeHistorySessionId === threadId) {
			if (result.activeSessionId) void handleSelectThread(result.activeSessionId);
			else handleNewChat();
		}
	}, [activeHistorySessionId, handleNewChat, handleSelectThread, historySessions]);
	const getThreadActions = useCallback<
		NonNullable<ChatPanelHistoryController["getThreadActions"]>
	>((thread) => {
		const session = historySessionItems.get(thread.id);
		if (!session) return null;

		return (
			<JiraSessionRowActions
				isPinned={pinnedThreadIds.has(thread.id)}
				onArchive={() => handleArchiveThread(thread.id)}
				onTogglePin={() => handleTogglePinThread(thread.id)}
				status={session.status}
				title={session.status === "awaiting-input" ? "Awaiting user response" : session.title}
			/>
		);
	}, [
		handleArchiveThread,
		handleTogglePinThread,
		historySessionItems,
		pinnedThreadIds,
	]);
	const chatHistory = useMemo<ChatPanelHistoryController>(() => ({
		activeThreadId: activeHistorySessionId,
		cancelThreadRun: ignoreThreadRun,
		deleteThread: handleDeleteThread,
		getThreadActions,
		getThreadPresentation,
		onNewChat: handleNewChat,
		onSortModeChange: setSortMode,
		pinnedThreadIds,
		selectThread: handleSelectThread,
		sortMode,
		threads: historyThreads,
		threadsLoaded: true,
	}), [
		activeHistorySessionId,
		handleDeleteThread,
		handleNewChat,
		handleSelectThread,
		getThreadActions,
		getThreadPresentation,
		historyThreads,
		pinnedThreadIds,
		sortMode,
	]);

	return (
		<div className="flex h-full min-h-0 w-full items-center justify-center">
			<div className="h-full max-h-[800px] min-h-0 w-[400px]">
				<ChatPanel
					chatHistory={chatHistory}
					composerContextBar={activeHistorySession ? (
						<QueueSessionContextBar
							compact
							onDismissFileChanges={handleDismissFileChanges}
							onJiraColumnChange={handleJiraColumnChange}
							session={activeHistorySession}
						/>
					) : null}
					onBackToRovo={handleBackToRovo}
					onClose={() => {}}
					enableSmartWidgets
					showAwaitingIndicator={activeHistorySession?.status === "awaiting-input"}
					sendPromptOptions={{
						smartGeneration: {
							enabled: true,
							surface: "sidebar",
						},
					}}
				/>
			</div>
		</div>
	);
}
