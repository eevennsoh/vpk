import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { JIRA_CODING_AGENT_GLYPH } from "@/lib/agent-avatar-visuals";

export const BUTTER_PRIMARY_BOARD_AGENTS = [
	{ id: "claude-code", name: "Claude", byline: "Coding agent by Anthropic", brandName: "claude", avatarSrc: "/illustration/agent-lanyard/claude.svg", headerId: "wac-claude" },
	{ id: "test-agent", name: "Cursor", byline: "Coding agent by Cursor", brandName: "cursor", avatarSrc: "/illustration/agent-lanyard/cursor.svg", headerId: "wac-cursor" },
	{ id: "review-agent", name: "Codex", byline: "Coding agent by OpenAI", brandName: "openai-codex", avatarSrc: "/illustration/agent-lanyard/codex.svg", headerId: "wac-codex" },
	{ id: "release-agent", name: "GitHub Copilot", byline: "Coding agent by GitHub", brandName: "github-copilot", avatarSrc: "/illustration/agent-lanyard/copilot.svg", headerId: "wac-copilot" },
	{ id: "figma", name: "Figma", byline: "Design agent by Figma", brandName: "figma", avatarSrc: undefined, headerId: "wac-figma" },
] as const satisfies readonly (AgentSelectorAgent & { headerId: string })[];

const customIds = ["code-reviewer", "release-notes-drafter", "bug-report-assistant"];
export const BUTTER_BOARD_AGENTS: readonly AgentSelectorAgent[] = [
	...BUTTER_PRIMARY_BOARD_AGENTS,
	{ id: "the-council", name: "The Council", byline: "", avatarSrc: "/avatar-agent-new/yellow/feature-flag.svg" },
	{ id: "jira-coding", name: "Jira Coding Agent", byline: "", avatarSrc: JIRA_CODING_AGENT_GLYPH },
	{ id: "rovo-cli", name: "Rovo CLI", byline: "", avatarSrc: "/illustration/project-butter-agents/agent-rovo.svg" },
	...customIds.flatMap((id) => {
		const agent = ROVO_AGENT_SELECTOR_AGENTS.find((candidate) => candidate.id === id);
		return agent ? [agent] : [];
	}),
];

const directoryIds = new Set(ROVO_AGENT_SELECTOR_AGENTS.map((agent) => agent.id));
export const BUTTER_PICKER_AGENTS: readonly AgentSelectorAgent[] = [
	...ROVO_AGENT_SELECTOR_AGENTS,
	...BUTTER_BOARD_AGENTS.filter((agent) => !directoryIds.has(agent.id)),
];
