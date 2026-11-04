import type { AgentConfigFormValue } from "@/components/blocks/agent";

export interface SubagentsBaseAgent {
	id: string;
	avatarSrc?: string;
	config: AgentConfigFormValue;
}

export interface SubagentPrompt {
	id: string;
	triggerName: string;
	condition: string;
	config: AgentConfigFormValue;
	/** Whether the subagent is active. Treated as enabled when omitted. */
	enabled?: boolean;
}

export const DEFAULT_SUBAGENTS_BASE_AGENT: SubagentsBaseAgent = {
	id: "policy-checker",
	avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
	config: {
		name: "Policy Checker",
		description:
			"This agent helps employees quickly find and understand company guidelines, HR policies, and benefits information.",
		summary:
			"This agent helps employees quickly find and understand company guidelines, HR policies, and benefits information.",
		instructions:
			"Review policy questions, decide which specialist subagent should help, and return a clear answer with citations to internal guidance.",
		contextDescription: "",
		triggers: ["Company Handbook", "HR policy question"],
		skills: ["Search policies", "Summarize guidance"],
		tools: ["Confluence", "Workday"],
		subagents: [],
		knowledge: ["Teamwork Graph", "HR handbook"],
		conversationStarters: [
			"Which leave policy in Confluence applies to this request?",
			"Summarize benefits eligibility from Workday for this employee.",
		],
		agentId: "policy-checker",
		action: "draft",
	},
};

export const SUBAGENTS_DEMO_PROMPTS: ReadonlyArray<SubagentPrompt> = [
	{
		id: "policy-source-needed",
		triggerName: "Policy source needed",
		condition:
			"Use this prompt when the answer needs current policy source material or exact handbook references.",
		config: {
			instructions:
				"Search policy knowledge sources, prioritize current official guidance, and return concise source-backed notes to the base agent.",
			contextDescription: "",
			triggers: [],
			skills: ["Search policies"],
			tools: ["Confluence"],
			knowledge: ["HR handbook"],
			conversationStarters: ["Find the source policy in Confluence for this question."],
			action: "draft",
		},
	},
	{
		id: "benefits-question",
		triggerName: "Benefits question",
		condition:
			"Use this prompt when an employee asks about benefits eligibility, coverage, or plan details.",
		config: {
			instructions:
				"Review benefit-related questions, identify eligibility rules, and summarize the answer in plain language for the base agent.",
			contextDescription: "",
			triggers: [],
			skills: ["Summarize guidance"],
			tools: ["Workday"],
			knowledge: ["Benefits handbook"],
			conversationStarters: ["Check benefit eligibility in Workday for this scenario."],
			action: "draft",
		},
	},
];
