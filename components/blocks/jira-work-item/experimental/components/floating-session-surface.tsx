"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useRovoChatControls } from "@/app/contexts";
import { useJiraWorkItem } from "@/components/blocks/jira-work-item/experimental/context-jira-work-item";
import type { AgentSession } from "@/components/blocks/jira-work-item/data/session-state";
import { SESSION_SCRIPTS } from "@/components/blocks/jira-work-item/data/session-scripts";
import { AsxRovoOverlay } from "@/components/projects/jira-golden-journey-v0/components/jira-golden-journey-v0-rovo-overlay";
import { useAsxAgentChatDemo } from "@/components/projects/jira-golden-journey-v0/hooks/use-jira-golden-journey-v0-agent-chat-demo";

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
 * Bridges the block-local session model into the shared Jira Issue floating
 * Rovo chat. Jira Work Item owns the deterministic session lifecycle; the
 * existing Rovo surface owns all visible chat chrome, transcript, and composer.
 */
export interface FloatingSessionSurfaceProps {
	/**
	 * When true, the floating Rovo surface is portaled to `document.body` so it
	 * escapes an inline container's clipping/transform context and positions
	 * against viewport coordinates. Full-screen modal presentations keep the
	 * surface in place (no portal).
	 */
	portalToViewport?: boolean;
}

export function FloatingSessionSurface({ portalToViewport = false }: FloatingSessionSurfaceProps = {}) {
	const { actions, meta } = useJiraWorkItem();
	const { chatSurface } = useRovoChatControls();
	const { chatContextBar, externalThinkingMessageId, openAgentChat } = useAsxAgentChatDemo();
	const openedSessionIdRef = useRef<string | null>(null);
	const previousChatSurfaceRef = useRef(chatSurface);
	const activeSession = meta.activeSession;

	useEffect(() => {
		if (!activeSession || openedSessionIdRef.current === activeSession.id) return;
		openedSessionIdRef.current = activeSession.id;
		openAgentChat({
			agentId: activeSession.agentId,
			agentName: activeSession.agentName,
			issueKey: meta.workItem.code,
			issueSummary: meta.workItem.title,
			intro: getSessionQuestionIntro(activeSession),
			question: getSessionQuestion(activeSession),
			request: activeSession.command,
			result: getSessionResult(activeSession),
		});
	}, [activeSession, meta.workItem.code, meta.workItem.title, openAgentChat]);

	useEffect(() => {
		const previousChatSurface = previousChatSurfaceRef.current;
		previousChatSurfaceRef.current = chatSurface;
		if (previousChatSurface === "floating" && chatSurface === null) {
			openedSessionIdRef.current = null;
			actions.openSession(null);
		}
	}, [actions, chatSurface]);

	const handleInterceptSubmit = useCallback((text: string) => {
		if (!activeSession) return { handled: false };
		const script = SESSION_SCRIPTS[activeSession.scriptId] ?? SESSION_SCRIPTS["general-assist"];
		return {
			handled: true,
			assistantReply: activeSession.status === "waiting"
				? script.resumeMessage
				: "Thanks — I’ll continue with that direction.",
			delayMs: 0,
			onApply: () => actions.replySession(activeSession.id, text),
		};
	}, [actions, activeSession]);

	const surface = (
		<AsxRovoOverlay
			chatContextBar={chatContextBar}
			externalThinkingMessageId={externalThinkingMessageId}
			onInterceptSubmit={handleInterceptSubmit}
			onLauncherClick={actions.openLatestOrCreateGeneralSession}
		/>
	);

	if (typeof document === "undefined") return surface;
	const portalRoot = portalToViewport ? document.body : null;
	return portalRoot ? createPortal(surface, portalRoot) : surface;
}
