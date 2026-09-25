import type { CSSProperties } from "react";

/** The secondary badge keeps its original 2px overhang, independent of its outline. */
const GEOMETRY = {
	16: { frameSize: 16, agentSize: 16, humanSize: 16, agentInset: 0, humanInset: 0 },
	20: { frameSize: 20, agentSize: 20, humanSize: 16, agentInset: 0, humanInset: 0 },
	24: { frameSize: 24, agentSize: 24, humanSize: 12, agentInset: 0, humanInset: -2 },
	32: { frameSize: 32, agentSize: 30, humanSize: 16, agentInset: 1, humanInset: -2 },
	40: { frameSize: 40, agentSize: 32, humanSize: 24, agentInset: 0, humanInset: 0 },
	48: { frameSize: 48, agentSize: 40, humanSize: 24, agentInset: 0, humanInset: 0 },
} as const;

export function humanAgentAvatarGeometry(sizePx: number, agentFirst = true) {
	const geometry = GEOMETRY[sizePx as keyof typeof GEOMETRY] ?? GEOMETRY[32];
	return agentFirst ? geometry : {
		...geometry,
		agentSize: geometry.humanSize,
		humanSize: geometry.agentSize,
		agentInset: geometry.humanInset,
		humanInset: geometry.agentInset,
	};
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
			: { left: geometry.humanInset, top: geometry.humanInset },
	};
}
