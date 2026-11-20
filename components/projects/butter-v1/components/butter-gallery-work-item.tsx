"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense, useRef, useState, type ComponentProps, type ComponentRef } from "react";

import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { JiraFloatingSuggestions } from "@/components/blocks/jira-suggestion";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { PROJECT_BUTTER_MODAL_SIZE } from "@/components/blocks/jira-work-item/project-butter/presentation";
import { ProjectButterJiraWorkItem } from "@/components/blocks/jira-work-item/project-butter/project-butter-jira-work-item";
import { JgpRovoOverlay } from "@/components/projects/jira-golden-journey-v1/components/jira-golden-journey-v1-rovo-overlay";
import { useJgpAgentChatDemo } from "@/components/projects/jira-golden-journey-v1/hooks/use-jira-golden-journey-v1-agent-chat-demo";
import { MountOnFirstUse } from "@/components/projects/shared/components/mount-on-first-use";
import { cn } from "@/lib/utils";
import { BUTTER_CHAT_AGENT_PROFILES, BUTTER_DIRECTORY_AGENT_PROFILES, resolveButterChatAgentId } from "../data/chat-agent-profiles";
import { BUTTER_DEFAULT_REPORTER } from "../data/current-user";
import { BUTTER_AI_SUGGESTION_GREETING, BUTTER_AI_SUGGESTION_ITEM, BUTTER_AI_SUGGESTION_STARTER_ID } from "../data/gallery-items";
import { workItemChatSnapshot } from "../data/merchant-journey";
import { agentAddedSuggestion } from "../lib/agent-added-suggestion";

const AgentsDirectoryDialog = dynamic(() => import("@/components/blocks/agent-directory").then((module) => module.AgentsDirectoryDialog));

export function ButterGalleryAiSuggestions({ open, onClose, portalContainer }: Readonly<{ open: boolean; onClose: () => void; portalContainer?: HTMLElement }>) {
	return (
		<RovoChatProvider agentProfiles={BUTTER_CHAT_AGENT_PROFILES}>
			<ButterGalleryWorkItem sessionActivityView showAiSuggestions open={open} onClose={onClose} portalContainer={portalContainer} />
		</RovoChatProvider>
	);
}

export function ButterGalleryWorkItem({ compact, galleryOpen, initialSessions, open, onClose, sessionActivityView, showAiSuggestions = false, portalContainer }: Readonly<{ compact?: boolean; galleryOpen?: boolean; initialSessions?: readonly ProjectButterSessionItem[]; open: boolean; onClose: () => void; sessionActivityView?: boolean; showAiSuggestions?: boolean; portalContainer?: HTMLElement }>) {
	const router = useRouter();
	const suggestionPanelRef = useRef<ComponentRef<typeof JiraFloatingSuggestions>>(null);
	const [agentsDirectoryOpen, setAgentsDirectoryOpen] = useState(false);
	const [added, setAdded] = useState<{ session: ProjectButterSessionItem; workItem: { code: string; summary: string } } | null>(null);
	const [wasOpen, setWasOpen] = useState(open);
	if (wasOpen !== open) {
		setWasOpen(open);
		if (!open) setAdded(null);
	}
	const { chatContextBar, externalThinkingMessageId, isSwitchingSession, openAgentChat } = useJgpAgentChatDemo();
	const prefillKey = useRef(0);
	const [composerPrefillRequest, setComposerPrefillRequest] = useState<ComponentProps<typeof JgpRovoOverlay>["composerPrefillRequest"]>();
	return (
		<>
			<span className="sr-only" role="status">{open && added ? `${added.session.agent.name} added` : ""}</span>
			<div className={cn("pointer-events-none absolute inset-x-0 flex items-start justify-center overflow-hidden", portalContainer ? "top-0" : "top-12", galleryOpen ? "bottom-56" : "bottom-0")}>
				<div className={cn("pointer-events-auto flex min-h-0 min-w-0", PROJECT_BUTTER_MODAL_SIZE, "h-full max-h-none")}>
					<ProjectButterJiraWorkItem inlineSessionReplies sessionActivityView={sessionActivityView} cloudAgentSelector compact={compact} currentUser={BUTTER_DEFAULT_REPORTER} defaultAssignee={BUTTER_DEFAULT_REPORTER} defaultReporter={BUTTER_DEFAULT_REPORTER} initialPreset={showAiSuggestions ? "empty" : "filled"} initialSessions={initialSessions} initialSuggestion={showAiSuggestions} showAuditInActivity={showAiSuggestions} suggestionProfile={showAiSuggestions ? "jira-demo" : undefined} workItem={showAiSuggestions ? BUTTER_AI_SUGGESTION_ITEM : undefined} renderSuggestions={showAiSuggestions ? (feed) => <JiraFloatingSuggestions feed={feed} portalContainer={portalContainer} ref={suggestionPanelRef} workItemKey={BUTTER_AI_SUGGESTION_ITEM.code} /> : undefined} onBrowseAgents={() => setAgentsDirectoryOpen(true)} onCreateAgent={() => router.push("/studio")} onAgentAdded={showAiSuggestions ? undefined : (session, workItem) => setAdded({ session, workItem })} onClose={() => { setAdded(null); onClose(); }} onOpenCloudSession={async (session, draft, workItem) => {
						const opened = await openAgentChat({ sessionId: session.id, agentId: resolveButterChatAgentId(session.agent, session.id), agentName: session.agent.name, issueKey: workItem.code, issueSummary: workItem.summary, intro: session.message, request: session.prompt, recordedSession: workItemChatSnapshot(session, workItem.summary) });
						if (opened && draft) setComposerPrefillRequest({ text: draft, append: true, requestKey: ++prefillKey.current });
						return opened;
					}} open={open} shell="gallery" />
				</div>
			</div>
			{open ? <JgpRovoOverlay chatContextBar={chatContextBar} contained={Boolean(portalContainer)} portalContainer={portalContainer} composerPrefillRequest={composerPrefillRequest} externalThinkingMessageId={externalThinkingMessageId} greeting={showAiSuggestions ? { ...BUTTER_AI_SUGGESTION_GREETING, onSuggestionSelect: ({ id }) => id === BUTTER_AI_SUGGESTION_STARTER_ID && suggestionPanelRef.current?.reopen() === true } : undefined} isSwitchingSession={isSwitchingSession} launcher={showAiSuggestions ? "hidden" : "auto"} onComposerPrefillConsumed={(requestKey) => setComposerPrefillRequest((current) => current?.requestKey === requestKey ? undefined : current)} suggestion={added ? agentAddedSuggestion(added.session, async () => {
				const { session, workItem } = added;
				if (await openAgentChat({ sessionId: session.id, agentId: resolveButterChatAgentId(session.agent, session.id), agentName: session.agent.name, issueKey: workItem.code, issueSummary: workItem.summary, intro: session.message, request: session.prompt, recordedSession: workItemChatSnapshot(session, workItem.summary) })) setAdded(null);
			}, () => setAdded(null)) : null} /> : null}
			<MountOnFirstUse active={agentsDirectoryOpen}>
				<Suspense fallback={null}>
					<AgentsDirectoryDialog agents={BUTTER_DIRECTORY_AGENT_PROFILES} variant="standard-v2" onCreateAgent={() => router.push("/studio")} onOpenChange={setAgentsDirectoryOpen} onSelectAgent={() => setAgentsDirectoryOpen(false)} open={agentsDirectoryOpen} />
				</Suspense>
			</MountOnFirstUse>
		</>
	);
}
