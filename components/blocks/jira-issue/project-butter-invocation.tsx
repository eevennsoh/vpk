"use client";

import { createContext, use, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { PROJECT_BUTTER_AGENTS } from "./project-butter-agents";
import {
	agentInvocationReducer,
	INITIAL_AGENT_INVOCATION,
	type AgentInvocationPreview,
	type AgentInvocationState,
} from "./project-butter-invocation-model";

const PhaseContext = createContext<AgentInvocationState["phase"] | null>(null);
const SourceContext = createContext<AgentInvocationState["source"]>("footer");
const EnabledContext = createContext(false);
const PreviewContext = createContext<AgentInvocationPreview>(INITIAL_AGENT_INVOCATION.preview);
const AgentsContext = createContext<readonly AgentSelectorAgent[]>(PROJECT_BUTTER_AGENTS);
const ActionsContext = createContext<{
	open: (source: AgentInvocationState["source"]) => void;
	close: () => void;
	preview: (agent: AgentSelectorAgent | null, index: number) => void;
	commit: (agent: AgentSelectorAgent, index: number) => void;
	settle: (sequence: number) => void;
	abort: (sequence: number) => void;
} | null>(null);
export const ButterInlineAgentPickerContext = createContext(false);

export function ProjectButterInvocationProvider({
	agents = PROJECT_BUTTER_AGENTS,
	enabled,
	children,
}: Readonly<{
	agents?: readonly AgentSelectorAgent[];
	enabled: boolean;
	children: ReactNode;
}>) {
	const [state, dispatch] = useReducer(agentInvocationReducer, INITIAL_AGENT_INVOCATION);
	useEffect(() => () => dispatch({ type: "reset" }), [enabled]);
	const actions = useMemo(
		() => ({
			open: (source: AgentInvocationState["source"]) => dispatch({ type: "open", source }),
			close: () => dispatch({ type: "close" }),
			preview: (agent: AgentSelectorAgent | null, index: number) =>
				dispatch({ type: "preview", agent, index }),
			commit: (agent: AgentSelectorAgent, index: number) => dispatch({ type: "commit", agent, index }),
			settle: (sequence: number) => dispatch({ type: "settle", sequence }),
			abort: (sequence: number) => dispatch({ type: "abort", sequence }),
		}),
		[],
	);
	return (
		<PhaseContext value={enabled ? state.phase : "idle"}>
			<EnabledContext value={enabled}>
				<SourceContext value={state.source}>
					<PreviewContext value={state.preview}>
						<AgentsContext value={agents}>
							<ActionsContext value={actions}>{children}</ActionsContext>
						</AgentsContext>
					</PreviewContext>
				</SourceContext>
			</EnabledContext>
		</PhaseContext>
	);
}

export function useProjectButterInvocationPhase() {
	return use(PhaseContext);
}
export function useProjectButterInvocationSource() {
	return use(SourceContext);
}
export function useProjectButterInvocationEnabled() {
	return use(EnabledContext);
}
export function useProjectButterInvocationPreview() {
	return use(PreviewContext);
}
export function useProjectButterInvocationAgents() {
	return use(AgentsContext);
}
export function useProjectButterInvocationActions() {
	return use(ActionsContext);
}
