"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

import { useRovoChatControls } from "@/app/contexts";
import { useJiraWorkItem } from "@/components/blocks/jira-work-item/experimental-v3/context-jira-work-item";
import type { AgentSession } from "@/components/blocks/jira-work-item/data/session-state";
import { SESSION_SCRIPTS } from "@/components/blocks/jira-work-item/data/session-scripts";
import { AsxRovoOverlay } from "@/components/projects/jira-golden-journey-v0/components/jira-golden-journey-v0-rovo-overlay";
import { useAsxAgentChatDemo } from "@/components/projects/jira-golden-journey-v0/hooks/use-jira-golden-journey-v0-agent-chat-demo";
import type { ChatSubmitInterceptOutcome } from "@/components/projects/sidebar-chat/page";

export type SessionReplyInterceptor = (
	session: AgentSession,
	text: string,
) => ChatSubmitInterceptOutcome;

function getSessionQuestion(session: AgentSession) {
	if (session.status !== "waiting") return undefined;
	return SESSION_SCRIPTS[session.scriptId]?.waitingQuestion;
}

function getSessionQuestionIntro(session: AgentSession): string | undefined {
	const script = SESSION_SCRIPTS[session.scriptId];
	if (!script?.waitingQuestion) return undefined;
	const progressMessages = session.messages
		.filter((message) => message.role === "agent" && message.content !== script.waitingPrompt)
		.map((message) => message.content);
	return progressMessages.length > 0 ? progressMessages.join("\n\n") : script.runningPreview;
}

function getSessionResult(session: AgentSession): string {
	const agentMessages = session.messages
		.filter((message) => message.role === "agent")
		.map((message) => message.content);
	return agentMessages.length > 0 ? agentMessages.join("\n\n") : session.previewText;
}

/**
 * Demo chat playback for agent sessions. Improve-description keeps its own
 * confirmation flow; Claude Code Build stays mid-implementation (consult done,
 * implement/verify unfinished) so Activity can own checklist/PR progress while
 * the side chat never settles on a verified/PR-ready completion.
 */
function getSessionPlaybackVariant(
	session: AgentSession,
): "claude-code-build" | "jira-description-improvement" | "ci-fix" | "static-result" | undefined {
	if (session.scriptId === "shop-4821-improve-description") {
		return session.status === "completed" ? "static-result" : "jira-description-improvement";
	}
	// Selected Fix agent (Codex by default) — same CI-repair CoT for every picker id.
	if (session.scriptId === "shop-4821-ci-fix" && session.status === "running") {
		return "ci-fix";
	}
	if (session.agentId !== "claude-code" || session.status !== "running") {
		return undefined;
	}
	const completedCount = session.progressChecklist?.filter((item) => item.completed).length ?? 0;
	// Build chapter range: consult checked (1) through verify (3). Plan is 0;
	// Review+ is 4+.
	return completedCount >= 1 && completedCount <= 3 ? "claude-code-build" : undefined;
}

/**
 * Bridges the block-local session model into the shared Jira Issue Rovo chat.
 * Jira Work Item owns the deterministic session lifecycle; the
 * existing Rovo surface owns all visible chat chrome, transcript, and composer.
 * Activity "Add to chat" pills target the sticky activity composer instead.
 */
export function FloatingSessionSurface({
	composerToolsAfterAdd,
	onSessionReply,
}: Readonly<{
	composerToolsAfterAdd?: ReactNode;
	onSessionReply?: SessionReplyInterceptor;
}>) {
	const { actions, meta } = useJiraWorkItem();
	const { chatSurface } = useRovoChatControls();
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useAsxAgentChatDemo();
	const openedSessionStateRef = useRef<string | null>(null);
	const previousChatSurfaceRef = useRef(chatSurface);
	const activeSession = meta.activeSession;

	useEffect(() => {
		if (!activeSession) return;
		const sessionStateKey = `${activeSession.id}:${activeSession.status}`;
		if (openedSessionStateRef.current === sessionStateKey) return;
		openedSessionStateRef.current = sessionStateKey;
		openAgentChat({
			agentId: activeSession.agentId,
			agentName: activeSession.agentName,
			issueKey: meta.workItem.code,
			issueSummary: meta.workItem.title,
			intro: getSessionQuestionIntro(activeSession),
			playbackVariant: getSessionPlaybackVariant(activeSession),
			question: getSessionQuestion(activeSession),
			request: activeSession.command,
			result: getSessionResult(activeSession),
		});
	}, [activeSession, meta.workItem.code, meta.workItem.title, openAgentChat]);

	useEffect(() => {
		const previousChatSurface = previousChatSurfaceRef.current;
		previousChatSurfaceRef.current = chatSurface;
		if (previousChatSurface === "floating" && chatSurface === null) {
			openedSessionStateRef.current = null;
			actions.openSession(null);
		}
	}, [actions, chatSurface]);

	const handleInterceptSubmit = useCallback((text: string) => {
		if (!activeSession) return { handled: false };
		const intercepted = onSessionReply?.(activeSession, text);
		if (intercepted?.handled) {
			const interceptedOnApply = intercepted.onApply;
			const interceptedOnApplyAfterResponse = intercepted.onApplyAfterResponse;
			const preserveCompletedSessionTranscript = () => {
				if (activeSession.scriptId === "shop-4821-improve-description") {
					openedSessionStateRef.current = `${activeSession.id}:completed`;
				}
			};
			return {
				...intercepted,
				onApply: interceptedOnApply
					? async () => {
						preserveCompletedSessionTranscript();
						await interceptedOnApply();
					}
					: undefined,
				onApplyAfterResponse: interceptedOnApplyAfterResponse
					? async () => {
						preserveCompletedSessionTranscript();
						await interceptedOnApplyAfterResponse();
					}
					: undefined,
			};
		}
		const script = SESSION_SCRIPTS[activeSession.scriptId] ?? SESSION_SCRIPTS["general-assist"];
		return {
			handled: true,
			assistantReply: activeSession.status === "waiting"
				? script.resumeMessage
				: "Thanks — I’ll continue with that direction.",
			delayMs: 0,
			onApply: () => actions.replySession(activeSession.id, text),
		};
	}, [actions, activeSession, onSessionReply]);

	return (
		<div className="relative h-full min-h-0 [&_[data-rovo-chat-placement=embedded]]:border-l-0">
			<AsxRovoOverlay
				chatContextBar={chatContextBar}
				composerToolsAfterAdd={composerToolsAfterAdd}
				externalThinkingMessageId={externalThinkingMessageId}
				launcher="hidden"
				onInterceptSubmit={handleInterceptSubmit}
				placement="embedded"
			/>
		</div>
	);
}
