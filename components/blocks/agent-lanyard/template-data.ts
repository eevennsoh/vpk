import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";

export interface AgentLanyardTemplate {
	id: string;
	name: string;
	description: string;
	iconSrc: string;
	sources: readonly TwgToolSource[];
}

const APPS = {
	confluence: { id: "confluence", label: "Confluence", provider: "confluence" },
	goals: { id: "goals", label: "Goals", provider: "goals" },
	projects: { id: "projects", label: "Projects", provider: "projects" },
	bitbucket: { id: "bitbucket", label: "Bitbucket", provider: "bitbucket" },
	jira: { id: "jira", label: "Jira", provider: "jira" },
	loom: { id: "loom", label: "Loom", provider: "loom" },
} as const satisfies Record<string, TwgToolSource>;

export const AGENT_LANYARD_TEMPLATES: readonly AgentLanyardTemplate[] = [
	{ id: "decision-director", name: "Decision Director", description: "Gathers needs and goals and aligns team on the best course of actions.", iconSrc: "/illustration/agent-lanyard-template/decision.svg", sources: [APPS.confluence, APPS.goals] },
	{ id: "weekly-summary", name: "Weekly summary", description: "Summarises your work for that week and shares with stakeholders", iconSrc: "/illustration/agent-lanyard-template/bullet-list-bounded.svg", sources: [APPS.projects, APPS.confluence, APPS.jira] },
	{ id: "pipeline-planner", name: "Pipeline planner", description: "Guides you through pipeline set up and automatically maintains the pipeline checks", iconSrc: "/illustration/agent-lanyard-template/documents.svg", sources: [APPS.bitbucket, APPS.confluence, APPS.jira] },
	{ id: "script-writer", name: "Script writer", description: "Generates draft scripts for any important videos you need to record.", iconSrc: "/illustration/agent-lanyard-template/edit-page.svg", sources: [APPS.confluence, APPS.loom] },
];
