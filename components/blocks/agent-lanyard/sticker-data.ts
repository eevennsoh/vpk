import { AGENT_LANYARD_AGENTS, type AgentLanyardAgent } from "./data.ts";

const artwork = "/1p/finale-pieces/assets/agent-lanyard";
const custom = (id: string, name: string, publisher: string, description: string, accentColor: string): AgentLanyardAgent => ({
	id, name, publisher, description, accentColor, avatarSrc: `${artwork}/${id}.svg`, action: "chat", verified: true,
});

/** Distinct identities and badge variants in Figma 512:7085, in reading order. */
export const AGENT_LANYARD_STICKER_AGENTS: readonly AgentLanyardAgent[] = [
	custom("bug-report-assistant", "Bug Report Assistant", "Victoria Styles", "Summarises incoming bugs, writes code to fix them and pulls in relevant reviewers", "#94C748"),
	...AGENT_LANYARD_AGENTS.filter((agent) => agent.id === "claude"),
	custom("workflow-builder", "Workflow Builder", "Atlassian", "Understands user requirements and define an effective Jira workflow to best meet them.", "#357DE8"),
	custom("code-reviewer", "Code Reviewer", "Software Engineering", "Ensures written code adheres to standards.", "#94C748"),
	custom("feedback-organiser", "Feedback Organiser", "Mia", "Picks up day to day busy work within your Jira space.", "#C97CF4"),
	custom("work-triage", "Work Triage", "Atlassian", "Autonomously prioritises a team's backlog in Jira.", "#357DE8"),
	...AGENT_LANYARD_AGENTS.filter((agent) => agent.id === "cursor"),
	custom("incident-responder", "Incident Responder", "Site Reliability Engineering", "Autonomously kicks off incident response when critical alerts happen.", "#F5CD47"),
	custom("workflow-builder-flow", "Workflow Builder", "Atlassian", "Understands user requirements and define an effective Jira workflow to best meet them.", "#357DE8"),
	...AGENT_LANYARD_AGENTS.filter((agent) => agent.id === "codex" || agent.id === "copilot"),
	custom("code-reviewer-search", "Code Reviewer", "Software Engineering", "Ensures written code adheres to standards.", "#94C748"),
	custom("service-triager", "Service Triager", "Atlassian", "Manages incoming service requests and routes them to the right agent.", "#F5CD47"),
];

export const DEFAULT_STICKER_AGENT = "bug-report-assistant";
export const STICKER_AGENT_LABELS: Readonly<Record<string, string>> = {
	"workflow-builder": "Workflow Builder · Lightbulb",
	"workflow-builder-flow": "Workflow Builder · Flow",
	"code-reviewer": "Code Reviewer · Gear",
	"code-reviewer-search": "Code Reviewer · Search",
};
