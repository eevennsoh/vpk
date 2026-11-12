import AiChatIcon from "@atlaskit/icon/core/ai-chat";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { getAgentSessionRole } from "@/components/blocks/agent-session/agent-session-types";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import type { RichTextSuggestionMenuItem } from "@/components/ui-custom/rich-text-editor";

type SessionChoice = AgentSessionItem & { prompt?: string; invokedAtMs?: number };

export function matchingAgentSessions<T extends SessionChoice>(agent: Pick<AgentSelectorAgent, "id" | "name">, sessions: readonly T[], { includeCompleted = false }: Readonly<{ includeCompleted?: boolean }> = {}): T[] {
	return sessions.filter((session) => session.host !== "local" && getAgentSessionRole(session) === "owner" && (session.state === "running" || session.state === "needs-input" || (includeCompleted && session.state === "complete")) && (session.agent.id === agent.id || session.agent.name.toLowerCase() === agent.name.toLowerCase())).sort((a, b) => (b.invokedAtMs ?? b.startedAtMs ?? 0) - (a.invokedAtMs ?? a.startedAtMs ?? 0));
}

export function sessionChoiceItems(sessions: readonly SessionChoice[]): RichTextSuggestionMenuItem[] {
	return sessions.map((session) => {
		const timestamp = session.invokedAtMs ?? session.startedAtMs;
		const date = timestamp ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "medium" }).format(timestamp) : session.timeLabel ?? "Time unavailable";
		const prompt = session.prompt?.replace(`@${session.agent.name}`, "").trim();
		const state = session.state === "complete" ? "Completed" : session.state === "needs-input" || session.state === "attention" ? "Needs input" : "Working";
		return { id: session.id, label: prompt || session.title, description: `${state} · ${date} · ${session.invokedBy?.name ?? "Unknown owner"}`, persistentDescription: true, icon: <AiChatIcon label="" size="small" /> };
	});
}
