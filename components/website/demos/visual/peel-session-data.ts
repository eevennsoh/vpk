import { AGENT_SESSION_ITEMS, type AgentSessionItem } from "@/components/blocks/agent-session";
import { agentSessionAccentColor } from "@/components/blocks/agent-session/agent-session-transfer-member";

const source = AGENT_SESSION_ITEMS.find((item) => item.agent.brandName === "claude")!;

export const PEEL_CLAUDE_SESSION: AgentSessionItem = {
	...source,
	id: "peel-claude",
	title: "Final readiness observations just appeared from a local Claude session",
	shortTitle: "Final readiness observations",
	state: "running",
	invokedBy: { name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" },
	machineName: "Venn’s MacBook",
	timeLabel: "Just now",
	prStatus: undefined,
	sessionDetails: { ...source.sessionDetails, pullRequestNumber: undefined, pullRequestTitle: undefined },
};

export const PEEL_SESSION_ACCENT = agentSessionAccentColor(PEEL_CLAUDE_SESSION);
export const PEEL_WORK_ITEM = {
	key: "PAY-118",
	summary: "Carry card-artwork metadata into the next wallet epic",
	issueType: "task",
} as const;
