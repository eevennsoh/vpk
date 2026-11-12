import type { AgentSessionItem } from "@/components/blocks/agent-session";

// Canvas-only fixtures. No account IDs, service URLs, commands, or live clocks.
export const personalSessions: readonly AgentSessionItem[] = [
	{
		id: "canvas-own-handoff",
		title: "Polish the agent handoff",
		agent: { name: "Cursor", brandName: "cursor" },
		role: "owner",
		host: "cloud",
		state: "needs-input",
		timeLabel: "2m ago",
	},
	{
		id: "canvas-own-menu",
		title: "Tidy the session menu",
		agent: { name: "Claude", brandName: "claude" },
		role: "owner",
		host: "local",
		state: "complete",
		timeLabel: "12m ago",
	},
];

export const teammateSessions: readonly AgentSessionItem[] = [
	{
		id: "canvas-team-navigation",
		title: "Simplify project navigation",
		agent: { name: "Codex", brandName: "openai-codex" },
		invokedBy: { name: "Teammate A" },
		role: "viewer",
		host: "cloud",
		state: "running",
		timeLabel: "1m ago",
	},
	{
		id: "canvas-team-empty",
		title: "Give empty states a little warmth",
		agent: { name: "Claude", brandName: "claude" },
		invokedBy: { name: "Teammate B" },
		role: "viewer",
		host: "local",
		state: "running",
		timeLabel: "3m ago",
	},
	{
		id: "canvas-team-focus",
		title: "Make keyboard focus easier to follow",
		agent: { name: "Cursor", brandName: "cursor" },
		invokedBy: { name: "Teammate C" },
		role: "viewer",
		host: "cloud",
		state: "complete",
		timeLabel: "18m ago",
	},
	{
		id: "canvas-team-copy",
		title: "A clearer welcome to Project Butter",
		agent: { name: "Rovo", vpkLogo: "rovo" },
		invokedBy: { name: "Teammate A" },
		role: "viewer",
		host: "cloud",
		state: "complete",
		timeLabel: "25m ago",
	},
];

export const sessionSamples = {
	mixed: { label: "Two yours, four teammates", items: [...personalSessions, ...teammateSessions] },
	"teammates-only": { label: "Only teammate sessions", items: teammateSessions },
	"yours-only": { label: "Only your sessions", items: personalSessions },
	empty: { label: "No sessions", items: [] },
} as const;

export type SessionSample = keyof typeof sessionSamples;

export function isSessionSample(value: string): value is SessionSample {
	return Object.hasOwn(sessionSamples, value);
}
