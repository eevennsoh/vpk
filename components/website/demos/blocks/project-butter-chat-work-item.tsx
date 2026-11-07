"use client";

import { useMemo, useRef, useState, type ComponentProps } from "react";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { useRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";
import JiraWorkItem, { type JiraWorkItemProps, type ProjectButterChatHost } from "@/components/blocks/jira-work-item";
import { BUTTER_CHAT_AGENT_PROFILES, resolveButterChatAgentId } from "@/components/projects/butter/data/chat-agent-profiles";
import { JgpRovoOverlay } from "@/components/projects/jira-golden-journeys-v1/components/jira-golden-journeys-v1-rovo-overlay";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journeys-v1/hooks/use-jira-golden-journeys-v1-agent-chat-demo";
import ChatPanel, { type ChatComposerPrefillRequest } from "@/components/projects/sidebar-chat/page";
import { useSidebarResize } from "@/components/projects/rovo-core/hooks/use-sidebar-resize";
import { SidebarResizeHandle } from "@/components/ui/sidebar";

/** The demo work item (Project butter's default reference content). */
const DEMO_ISSUE = { key: "VITA-1", summary: "Redesign onboarding flow for new users" } as const;

/** Jira's flush sidebar chat (`chatPanelFlush` in the app shell): no inset or radius, one resizable left divider. */
const FLUSH_CHAT_STYLE = { borderRadius: 0, borderWidth: 0 } as const;

/** The sidebar chat, shown while Ask Rovo (or an opened session) has the sidebar surface. */
function ProjectButterSidebarChat({ chatContextBar, composerPrefillRequest }: Readonly<{ chatContextBar: ComponentProps<typeof ChatPanel>["chatContextBar"]; composerPrefillRequest?: ChatComposerPrefillRequest }>) {
	const { chatSurface, toggleChat } = useRovoChatControls();
	const resize = useSidebarResize({ defaultWidth: 400, minWidth: 320, maxWidth: 720, direction: "rtl" });
	return chatSurface === "sidebar" ? (
		<aside aria-label="Rovo chat" className="relative flex min-h-0 shrink-0 flex-col" data-project-butter-chat style={{ width: resize.sidebarWidth }}>
			<ChatPanel chatContextBar={chatContextBar} composerPrefillRequest={composerPrefillRequest} containerStyle={FLUSH_CHAT_STYLE} onClose={toggleChat} />
			<SidebarResizeHandle
				data-active={resize.isResizing ? "" : undefined}
				onDoubleClick={resize.onResizeHandleDoubleClick}
				onPointerDown={resize.onResizeHandlePointerDown}
				onPointerEnter={resize.onResizeHandlePointerEnter}
				onPointerLeave={resize.onResizeHandlePointerLeave}
				side="left"
			/>
		</aside>
	) : null;
}

/**
 * Hosts the same sidebar chat the Butter board uses: Ask Rovo toggles it, and
 * agent session links open their session there instead of a floating card.
 * A draft typed beside the agent mention is carried into the opened session's
 * composer (keyed-request idiom, like the Butter board), never dropped.
 */
function useProjectButterChatHost(overlayContainerRef: (element: HTMLDivElement | null) => void, chat: ReturnType<typeof useJgpAgentChatDemo>, composerPrefillRequest: ChatComposerPrefillRequest | undefined, prefillComposerText: (text: string) => void): ProjectButterChatHost {
	const { chatContextBar, openAgentChat } = chat;
	const { openChat } = useRovoChatControls();
	return useMemo(() => ({
		overlayContainerRef,
		panel: <ProjectButterSidebarChat chatContextBar={chatContextBar} composerPrefillRequest={composerPrefillRequest} />,
		// The shared opener activates the session on the floating surface; this host docks it in the sidebar.
		onOpenCloudSession: async (session, draft) => {
			const opened = await openAgentChat({
				sessionId: session.id,
				agentId: resolveButterChatAgentId(session.agent, session.id),
				agentName: session.agent.name,
				issueKey: DEMO_ISSUE.key,
				issueSummary: DEMO_ISSUE.summary,
				intro: session.message,
				request: session.prompt,
			});
			if (opened) {
				openChat("sidebar");
				if (draft?.trim()) prefillComposerText(draft);
			}
			return opened;
		},
	}), [chatContextBar, composerPrefillRequest, openAgentChat, openChat, overlayContainerRef, prefillComposerText]);
}

/** Like the Butter board: the floating Rovo button (and its floating chat) render inside the work item dialog. */
function HostedProjectButterWorkItem(props: Readonly<JiraWorkItemProps>) {
	const [overlayContainer, setOverlayContainer] = useState<HTMLDivElement | null>(null);
	const agentChat = useJgpAgentChatDemo();
	const [composerPrefillRequest, setComposerPrefillRequest] = useState<ChatComposerPrefillRequest>();
	const prefillKey = useRef(0);
	const prefillComposerText = useMemo(() => (text: string) => setComposerPrefillRequest({ text, requestKey: prefillKey.current += 1 }), []);
	const chat = useProjectButterChatHost(setOverlayContainer, agentChat, composerPrefillRequest, prefillComposerText);
	return (
		<>
			<JiraWorkItem {...props} projectButterChat={chat} variant="project-butter" />
			{overlayContainer ? <JgpRovoOverlay chatContextBar={agentChat.chatContextBar} composerPrefillRequest={composerPrefillRequest} contained externalThinkingMessageId={agentChat.externalThinkingMessageId} isSwitchingSession={agentChat.isSwitchingSession} portalContainer={overlayContainer} /> : null}
		</>
	);
}

/**
 * The Project butter work item with its Rovo chat: every catalog entry point renders this so
 * the header always offers Ask Rovo and agent sessions open in the docked sidebar chat.
 * Blocks can't import the sidebar chat (projects sit above blocks), so the website layer owns it.
 */
export function ProjectButterChatWorkItem(props: Readonly<JiraWorkItemProps>) {
	return (
		<RovoChatProvider agentProfiles={BUTTER_CHAT_AGENT_PROFILES}>
			<HostedProjectButterWorkItem {...props} />
		</RovoChatProvider>
	);
}
