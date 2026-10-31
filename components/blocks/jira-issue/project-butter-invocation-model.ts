import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";

export interface AgentInvocationPreview {
	agent: AgentSelectorAgent | null;
	previousAgent: AgentSelectorAgent | null;
	index: number;
	direction: 1 | -1;
	sequence: number;
}

export interface AgentInvocationState {
	phase: "idle" | "choosing" | "handoff" | "attached";
	preview: AgentInvocationPreview;
}

export const INITIAL_AGENT_INVOCATION: AgentInvocationState = {
	phase: "idle",
	preview: { agent: null, previousAgent: null, index: -1, direction: 1, sequence: 0 },
};

type AgentInvocationAction =
	| { type: "open" }
	| { type: "close" }
	| { type: "reset" }
	| { type: "preview"; agent: AgentSelectorAgent | null; index: number }
	| { type: "commit"; agent: AgentSelectorAgent; index: number }
	| { type: "settle"; sequence: number }
	| { type: "abort"; sequence: number };

function previewAgent(
	current: AgentInvocationPreview,
	agent: AgentSelectorAgent | null,
	index: number,
): AgentInvocationPreview {
	if (current.agent?.id === agent?.id) return current;
	return {
		agent,
		previousAgent: current.agent,
		index,
		direction: !current.agent ? 1 : !agent ? current.direction : index < current.index ? -1 : 1,
		sequence: current.sequence + 1,
	};
}

export function agentInvocationReducer(
	state: AgentInvocationState,
	action: AgentInvocationAction,
): AgentInvocationState {
	switch (action.type) {
		case "open":
			return {
				phase: "choosing",
				preview: { ...INITIAL_AGENT_INVOCATION.preview, sequence: state.preview.sequence + 1 },
			};
		case "close":
			return state.phase === "choosing" ? { ...state, phase: "idle" } : state;
		case "reset":
			return state.phase === "idle" ? state : { ...state, phase: "idle" };
		case "preview": {
			if (state.phase !== "choosing") return state;
			const preview = previewAgent(state.preview, action.agent, action.index);
			return preview === state.preview ? state : { ...state, preview };
		}
		case "commit":
			return { phase: "handoff", preview: previewAgent(state.preview, action.agent, action.index) };
		case "abort":
			return state.phase === "handoff" && state.preview.sequence === action.sequence
				? { ...state, phase: "idle" }
				: state;
		case "settle":
			return state.phase === "handoff" && state.preview.sequence === action.sequence
				? { ...state, phase: "attached" }
				: state;
	}
}
