export interface AgentLanyardAgent {
	id: string;
	name: string;
	publisher: string;
	description: string;
	/** Complete hexagonal badge artwork, including its brand background. */
	avatarSrc: string;
	action: "chat" | "connect";
	verified?: boolean;
	/** Decorative grid wave color, independent of the card's semantic colors. */
	accentColor?: string;
}

export const AGENT_LANYARD_AGENTS: readonly AgentLanyardAgent[] = [
	{
		id: "claude",
		name: "Claude",
		publisher: "Anthropic",
		description: "Collaborate on code with an AI that gives smart suggestions and reviews.",
		avatarSrc: "/3p/agent-lanyard/claude.svg",
		action: "chat",
		verified: true,
		accentColor: "#E77455",
	},
	{
		id: "cursor",
		name: "Cursor",
		publisher: "Cursor",
		description: "Connect Cursor to delegate your Jira work items to Cloud Agents",
		avatarSrc: "/3p/agent-lanyard/cursor.svg",
		action: "chat",
		verified: true,
		accentColor: "#101214",
	},
	{
		id: "codex",
		name: "Codex",
		publisher: "OpenAI",
		description: "Turn Jira work items into working code in minutes",
		avatarSrc: "/3p/agent-lanyard/codex.svg",
		action: "connect",
		verified: true,
		accentColor: "#8270DB",
	},
	{
		id: "copilot",
		name: "Github Copilot",
		publisher: "Github",
		description: "Assign Jira issues to GitHub Copilot cloud agent, get draft pull requests",
		avatarSrc: "/3p/agent-lanyard/copilot.svg",
		action: "connect",
		verified: true,
		accentColor: "#101214",
	},
];
