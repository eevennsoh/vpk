import type { CSSProperties } from "react";

/** The human's 2px separation ring owns the resting overhang. */
const GEOMETRY = {
	16: { frameSize: 16, agentSize: 16, humanSize: 16, agentInset: 0, humanInset: 0 },
	20: { frameSize: 20, agentSize: 20, humanSize: 16, agentInset: 0, humanInset: 0 },
	24: { frameSize: 24, agentSize: 24, humanSize: 12, agentInset: 0, humanInset: 0 },
	32: { frameSize: 32, agentSize: 30, humanSize: 16, agentInset: 1, humanInset: 0 },
	40: { frameSize: 40, agentSize: 32, humanSize: 24, agentInset: 0, humanInset: 0 },
	48: { frameSize: 48, agentSize: 40, humanSize: 24, agentInset: 0, humanInset: 0 },
} as const;

export function humanAgentAvatarGeometry(sizePx: number) {
	return GEOMETRY[sizePx as keyof typeof GEOMETRY] ?? GEOMETRY[32];
}

export function humanAgentAvatarPositions(
	geometry: ReturnType<typeof humanAgentAvatarGeometry>,
	agentFirst: boolean,
): { agent: CSSProperties; human: CSSProperties } {
	return {
		agent: agentFirst
			? { left: geometry.agentInset, top: geometry.agentInset }
			: { right: geometry.agentInset, bottom: geometry.agentInset },
		human: agentFirst
			? { right: geometry.humanInset, bottom: geometry.humanInset }
			: { left: 0, top: 0 },
	};
}
