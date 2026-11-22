import type { CSSProperties } from "react";
import { avatarHexagonPoints } from "../ui/avatar-hexagon.ts";

/** The secondary badge keeps its original 2px overhang, independent of its outline. */
const GEOMETRY = {
	16: { frameSize: 16, agentSize: 16, humanSize: 16, agentInset: 0, humanInset: 0 },
	20: { frameSize: 20, agentSize: 20, humanSize: 16, agentInset: 0, humanInset: 0 },
	24: { frameSize: 24, agentSize: 24, humanSize: 12, agentInset: 0, humanInset: -2 },
	32: { frameSize: 32, agentSize: 30, humanSize: 16, agentInset: 1, humanInset: -2 },
	40: { frameSize: 40, agentSize: 32, humanSize: 24, agentInset: 0, humanInset: 0 },
	48: { frameSize: 48, agentSize: 40, humanSize: 24, agentInset: 0, humanInset: 0 },
} as const;

export function humanAgentAvatarGeometry(sizePx: number, agentFirst = true, badgeSizePx?: number) {
	const base = GEOMETRY[sizePx as keyof typeof GEOMETRY] ?? GEOMETRY[32];
	const geometry = badgeSizePx === undefined ? base : { ...base, humanSize: badgeSizePx, humanInset: -2 };
	return agentFirst ? geometry : {
		...geometry,
		agentSize: geometry.humanSize,
		humanSize: geometry.agentSize,
		agentInset: geometry.humanInset,
		humanInset: geometry.agentInset,
	};
}

export function humanAgentAvatarCutout(
	geometry: ReturnType<typeof humanAgentAvatarGeometry>,
	agentFirst: boolean,
): CSSProperties {
	const backSize = agentFirst ? geometry.agentSize : geometry.humanSize;
	const frontSize = agentFirst ? geometry.humanSize : geometry.agentSize;
	const backInset = agentFirst ? geometry.agentInset : geometry.humanInset;
	const frontInset = agentFirst ? geometry.humanInset : geometry.agentInset;
	const offset = geometry.frameSize - frontInset - frontSize - backInset;
	if (agentFirst) {
		const center = offset + frontSize / 2;
		const radius = frontSize / 2;
		const maskImage = `radial-gradient(circle at ${center}px ${center}px, transparent ${radius + 1.5}px, black ${radius + 2}px)`;
		return { maskImage, WebkitMaskImage: maskImage };
	}
	const gap = 1.5;
	const expanded = frontSize + gap * 2;
	const points = avatarHexagonPoints(0, gap).map(({ xPercent, yPercent, xPixels, yPixels }) => `${offset - gap + xPercent * expanded / 100 + xPixels},${offset - gap + yPercent * expanded / 100 + yPixels}`).join(" L ");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${backSize}" height="${backSize}"><path fill="white" fill-rule="evenodd" d="M 0,0 H ${backSize} V ${backSize} H 0 Z M ${points} Z"/></svg>`;
	const maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
	return { maskImage, WebkitMaskImage: maskImage };
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
