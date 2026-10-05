import { JIRA_TEAM_EU26_HEADER_AGENT_ASSIGNEES } from "@/components/projects/jira-team-eu26/data/header-agent-assignees";

import type { WallAgentId } from "../lib/finale-wall-layout";

/** One terminal line: dim prefixes and brand-lit markers, as the keynote's terminal story sets them. */
export type WallTerminalLine = readonly { readonly text: string; readonly tone?: "brand" | "dim" | "done" }[];

/** Short takes from the keynote's sessions, for the wall's terminal tiles. */
export const WALL_TERMINAL_SCRIPTS: readonly (readonly WallTerminalLine[])[] = [
	[
		[{ text: "⏺ Session · ", tone: "brand" }, { text: "restored local Claude session" }],
		[{ text: "  ⎿ Worktree · ", tone: "dim" }, { text: ".worktrees/pay-101-adapter" }],
		[{ text: "  ⎿ Conversation · ", tone: "dim" }, { text: "38 messages · MCB" }],
	],
	[
		[{ text: "$ ", tone: "dim" }, { text: "rovodev run --issue TEU-10" }],
		[{ text: "✓ ", tone: "done" }, { text: "Agent session linked to Jira" }],
		[{ text: "✓ ", tone: "done" }, { text: "4 checks passed" }],
	],
	[
		[{ text: "$ ", tone: "dim" }, { text: "git push origin teu-9-pr-previews" }],
		[{ text: "→ ", tone: "brand" }, { text: "Pull request opened · Bitbucket" }],
		[{ text: "✓ ", tone: "done" }, { text: "TEU-9 moved to Done" }],
	],
	[
		[{ text: "⏺ Board · ", tone: "brand" }, { text: "Team ’26 EU keynote" }],
		[{ text: "  ⎿ ", tone: "dim" }, { text: "Context · Collaboration · Confidence" }],
		[{ text: "✓ ", tone: "done" }, { text: "13 of 13 in Done" }],
	],
];

/** What the wall's Rovo composers are being asked, mid-sentence. */
export const WALL_COMPOSER_PROMPTS: readonly string[] = [
	"Summarise everything we shipped at Team ’26",
	"Which agent sessions are still running?",
	"Draft the launch post for Loom PR Previews",
	"Find the PR that closed TEU-10",
];

interface WallAgentCard {
	readonly name: string;
	readonly avatarSrc: string;
	/** The keynote card its session worked on. */
	readonly code: string;
	readonly story: string;
}

const AGENT_WORK: Readonly<Record<WallAgentId, { readonly code: string; readonly story: string }>> = {
	"claude-code": { code: "TEU-2", story: "Code Context" },
	"review-agent": { code: "TEU-10", story: "Jira Agent Sessions" },
	"test-agent": { code: "TEU-9", story: "Loom PR Previews" },
};

/** Each header agent with the keynote card its session closed. */
export function wallAgentCard(id: WallAgentId): WallAgentCard {
	const agent = JIRA_TEAM_EU26_HEADER_AGENT_ASSIGNEES.find((each) => each.id === id) ?? JIRA_TEAM_EU26_HEADER_AGENT_ASSIGNEES[0];
	return { name: agent.name, avatarSrc: agent.avatarSrc, ...AGENT_WORK[id] };
}
