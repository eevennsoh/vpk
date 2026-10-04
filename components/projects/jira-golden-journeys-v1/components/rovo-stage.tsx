"use client";

import ChangesIcon from "@atlaskit/icon/core/changes";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRovoChat } from "@/app/contexts";
import {
	JiraSessionDescription,
	JiraSessionLabel,
	JiraSessionLifecycle,
	JiraSessionRowActions,
} from "@/components/blocks/product-sidebar/variants/jira";
import { AnimatedDots } from "@/components/ui-custom/animated-dots";
import { CodeList } from "@/components/ui-custom/code-list";
import {
	ContextBarPill,
	ContextBarTagGroup,
} from "@/components/ui-custom/context-bar";
import { Shimmer } from "@/components/ui-custom/shimmer";
import ChatPanel, {
	type ChatPanelHistoryController,
	type ChatSubmitInterceptOutcome,
} from "@/components/projects/sidebar-chat/page";
import type { ChatHistorySortMode } from "@/components/projects/sidebar-chat/components/chat-history-drawer";
import {
	createAsxQueueSidebarSessionItem,
	createAsxQueueHistoryThreads,
	type AsxQueueSession,
} from "@/components/projects/jira-queue/data/queue-sessions";
import {
	archiveQueueSession,
	dismissQueueSessionFileChanges,
	setQueueSessionPinned,
	sortQueueSessions,
} from "@/components/projects/jira-queue/lib/queue-session-state";
import {
	JGP_CODE_LIST_WIDGET_TYPE,
	JGP_ROVO_COMPLETED_SESSION_PATCH,
	JGP_ROVO_SESSION_SEEDS,
	buildJgpRovoContinuationPlayback,
	parseJgpCodeListWidgetPayload,
} from "@/components/projects/jira-golden-journeys-v1/data/agent-chat-data";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDeterministicAgentAvatarSrc } from "@/lib/agent-avatars";

function ignoreThreadRun(): Promise<void> {
	return Promise.resolve();
}

function CreatePrContextBar({
	onCommitAndPush,
	onCreateDraftPr,
	onCreatePr,
	onDismissFileChanges,
	session,
}: Readonly<{
	onCommitAndPush: () => void;
	onCreateDraftPr: () => void;
	onCreatePr: () => void;
	onDismissFileChanges: () => void;
	session: AsxQueueSession;
}>): React.ReactElement | null {
	const fileChanges = session.fileChanges?.isDismissed ? undefined : session.fileChanges;
	if (!fileChanges) return null;

	return (
		<ContextBarTagGroup
			className="mb-3 w-full"
			items={[
				{
					id: "changes",
					label: `Dismiss changes: +${fileChanges.additions} -${fileChanges.deletions}`,
					icon: <ChangesIcon label="" size="small" />,
					onSelect: onDismissFileChanges,
					content: (
						<ContextBarPill
							aria-label="Dismiss file changes"
							className="px-2"
							icon={<ChangesIcon color="currentColor" label="" size="small" />}
							onClick={onDismissFileChanges}
							title={fileChanges.files.join("\n")}
						>
							Changes:
							<span className="inline-flex items-center gap-0.5">
								<span className="font-mono font-normal text-text-success">+{fileChanges.additions}</span>
								<span className="font-mono font-normal text-text-danger">-{fileChanges.deletions}</span>
							</span>
						</ContextBarPill>
					),
				},
				{
					id: "create-pr",
					label: "Create pull request",
					onSelect: onCreatePr,
					content: (
						<ContextBarPill
							className="gap-2 px-2"
							interactive={false}
						>
							<ButtonGroup aria-label="Create pull request" variant="split">
								<Button onClick={onCreatePr} size="compact" variant="outline">Create PR</Button>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={<Button aria-label="More pull request actions" size="icon-compact" variant="outline" />}
									>
										<ChevronDownIcon label="" size="small" />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="min-w-44" side="top">
										<DropdownMenuGroup>
											<DropdownMenuItem onSelect={onCreateDraftPr}>Create draft PR</DropdownMenuItem>
											<DropdownMenuItem onSelect={onCommitAndPush}>Commit &amp; push</DropdownMenuItem>
										</DropdownMenuGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							</ButtonGroup>
						</ContextBarPill>
					),
				},
			]}
			overflowAriaLabel="Show more session actions"
		/>
	);
}

/**
 * The "Rovo" design pattern for the Jira Golden Journeys v1 gallery.
 *
 * Reuses the `components/projects/sidebar-chat` project verbatim — the same
 * `ChatPanel` (with smart widgets + sidebar smart generation) that the
 * standalone `/sidebar-chat` demo renders — shown as a bounded sidebar panel
 * in the gallery stage when the Rovo card is selected.
 *
 * Layout intent: the sidebar chat is a narrow, full-height panel. The gallery
 * runs this stage with the default `stagePosition="top"` (shared by the board/
 * list/terminal stages), so the panel should FILL the stage height the way the
 * standalone sidebar-chat demo fills its viewport — not float as a short,
 * vertically-centered card. The panel wrapper is `h-full` because `ChatPanel`
 * renders at `height: 100%` (see the sidebar-chat `chatStyles.chatPanel`) and
 * needs a sized parent, so it fills its content box.
 * The vertical clearance is a CONSTANT, dock-independent bottom inset (`pb-6`),
 * with no top inset. This is deliberate: the Gallery dock is a `fixed` overlay
 * (out of normal flow — see `gallery.tsx`), so it must NOT reserve layout space
 * here. If the inset changed with the dock's open state the panel would resize
 * and visibly shift when the dock is dismissed; keeping it constant lets the dock
 * (and its frosted backdrop) float ON TOP of the chat — overlaying the composer
 * while open and revealing it untouched when closed. The small `pb-6` (matching
 * the standalone sidebar-chat demo's inset) keeps the composer off the viewport
 * edge without leaving a large dead gap. There is no top inset — nothing sits
 * above the stage but the 48px Gallery top bar, already a flex sibling outside it
 * — so the panel fills from the top of the stage and reaches the same effective
 * height as the real sidebar chat. On very tall viewports it caps at 800px and
 * `items-center` centers it within the box.
 * Its 400px width and 800px height cap match the standalone sidebar-chat demo;
 * `h-full` lets it shrink on short viewports. `ChatPanel` carries its own
 * raised surface + border + radius, so no extra chrome is needed here.
 *
 * The chat runs on the JGP-wide `RovoChatProvider` (see `../page.tsx`); the
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
		JGP_ROVO_SESSION_SEEDS.map((session) => ({ ...session }))
	));
	const initialSessionId = "jgp-251-persistence-question";
	const [activeHistorySessionId, setActiveHistorySessionId] = useState<string | null>(initialSessionId);
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
		historySessions.map((session) => {
			const item = createAsxQueueSidebarSessionItem(session);
			return [session.id, session.agentId === "cursor" ? {
				...item,
				agentName: "Cursor",
				agentAvatarSrc: getDeterministicAgentAvatarSrc("cursor"),
			} : item];
		}),
	), [historySessions]);
	const pinnedThreadIds = useMemo(() => new Set(
		historySessions.filter((session) => session.isPinned).map((session) => session.id),
	), [historySessions]);
	const activeHistorySession = historySessions.find((session) => session.id === activeHistorySessionId);
	const continuationCounterRef = useRef(0);
	const updateActiveSession = useCallback((patch: Partial<AsxQueueSession>) => {
		if (!activeHistorySessionId) return;
		setHistorySessions((sessions) => sessions.map((session) => (
			session.id === activeHistorySessionId ? { ...session, ...patch } : session
		)));
	}, [activeHistorySessionId]);
	const handleCreatePr = useCallback(() => {
		updateActiveSession({
			pullRequestNumber: 842,
			pullRequestTitle: "JGP-252 Add a Clear focus action",
		});
	}, [updateActiveSession]);
	const handleCreateDraftPr = useCallback(() => {
		updateActiveSession({
			pullRequestNumber: 842,
			pullRequestTitle: "Draft: JGP-252 Add a Clear focus action",
		});
	}, [updateActiveSession]);
	const handleCommitAndPush = useCallback(() => {
		updateActiveSession({ commit: "6f4c2ab" });
	}, [updateActiveSession]);
	const handleInterceptSubmit = useCallback((): ChatSubmitInterceptOutcome => {
		if (activeHistorySession?.status !== "awaiting-input") return { handled: false };

		continuationCounterRef.current += 1;
		const playback = buildJgpRovoContinuationPlayback(`rovo-answer-${continuationCounterRef.current}`);
		const [pendingFrame, ...stagedFrames] = playback.frames;
		return {
			handled: true,
			pendingAssistantParts: pendingFrame?.parts,
			assistantPartStages: stagedFrames.map((frame) => ({
				delayMs: frame.delayMs,
				getAssistantParts: () => frame.parts,
			})),
			onApply: () => updateActiveSession(JGP_ROVO_COMPLETED_SESSION_PATCH),
		};
	}, [activeHistorySession?.status, updateActiveSession]);
	const renderWidget = useCallback((widget: { type: string; data: unknown }): ReactNode => {
		if (widget.type !== JGP_CODE_LIST_WIDGET_TYPE) return undefined;
		const payload = parseJgpCodeListWidgetPayload(widget.data);
		return payload ? <CodeList defaultExpandedIds={[payload.items[0]?.id ?? ""]} items={payload.items} /> : null;
	}, []);
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
						Needs input
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
	const initializedSessionIdRef = useRef<string | null>(null);
	useEffect(() => {
		if (initializedSessionIdRef.current === initialSessionId) return;
		initializedSessionIdRef.current = initialSessionId;
		void handleSelectThread(initialSessionId);
	}, [handleSelectThread, initialSessionId]);
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
				title={session.status === "awaiting-input" ? "Needs input" : session.title}
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
		<div className="flex h-full min-h-0 w-full items-center justify-center pb-6">
			<div className="h-full max-h-[800px] min-h-0 w-[400px]">
				<ChatPanel
					chatHistory={chatHistory}
					hideComposerSourceAndModelControls
					composerContextBar={activeHistorySession ? (
						<CreatePrContextBar
							onCommitAndPush={handleCommitAndPush}
							onCreateDraftPr={handleCreateDraftPr}
							onCreatePr={handleCreatePr}
							onDismissFileChanges={handleDismissFileChanges}
							session={activeHistorySession}
						/>
					) : null}
					interceptClarificationAnswers
					markAnsweredQuestionTraces
					onInterceptSubmit={handleInterceptSubmit}
					onBackToRovo={handleBackToRovo}
					onClose={() => {}}
					renderWidget={renderWidget}
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
