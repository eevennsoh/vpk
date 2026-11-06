"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	AgentDirectoryView,
	AgentsDirectoryDialog,
	type AgentsDirectoryAgent,
	type AgentsDirectoryTemplateAgent,
	type AgentsDirectoryVariant,
} from "@/components/blocks/agent-directory";
import { DEMO_AGENT_BROWSER_AGENTS } from "@/app/data/directory/agents";
import { AGENT_LANYARD_AGENTS, AGENT_LANYARD_FIRST_PARTY_AGENTS, AGENT_LANYARD_TEMPLATES } from "@/components/blocks/agent-lanyard";

const REFERENCE_AGENTS: readonly AgentsDirectoryAgent[] = [
	...AGENT_LANYARD_FIRST_PARTY_AGENTS.filter((agent) => agent.id === "jira-coding").map((agent) => ({ ...agent, byline: agent.publisher })),
	{ id: "team-rituals-fiend", name: "Team Rituals Fiend", byline: "Zack Bishop", description: "Effortlessly runs rituals like standups, retros and demos for your team", verified: true },
	...AGENT_LANYARD_AGENTS.map((agent) => ({ ...agent, byline: agent.publisher })),
	{ id: "bug-report-assistant", name: "Bug Report Assistant", byline: "Victoria Styles", description: "Summarises incoming bugs, writes code to fix them and pulls in relevant reviewers", verified: true },
	{ id: "workflow-builder", name: "Workflow Builder", byline: "Atlassian", description: "Understands user requirements and define an effective Jira workflow to best meet them.", verified: true },
	{ id: "code-reviewer", name: "Code Reviewer", byline: "Software Engineering", description: "Ensures written code adheres to standards.", verified: true },
	{ id: "service-triager", name: "Service Triager", byline: "Atlassian", description: "Manages incoming service requests and routes them to the right agent.", verified: true },
	{ id: "feedback-organiser", name: "Feedback Organiser", byline: "Mia", description: "Picks up day to day busy work within your Jira space.", verified: true },
	{ id: "triager", name: "Triager", byline: "Atlassian", description: "Autonomously prioritises a team's backlog in Jira.", verified: true },
	{ id: "incident-responder", name: "Incident Responder", byline: "Site Reliability Engineering", description: "Autonomously kicks off incident response when critical alerts happen.", verified: true },
	{ id: "backlog-trivia", name: "Backlog Trivia", byline: "Andrew Reynolds", description: "A fun agent for teams to review their backlog together.", verified: true },
	...DEMO_AGENT_BROWSER_AGENTS.filter((agent) => !["github-copilot", "code-reviewer", "bug-report-assistant"].includes(agent.id)),
];

const REFERENCE_TEMPLATES: readonly AgentsDirectoryTemplateAgent[] = AGENT_LANYARD_TEMPLATES.map((template) => ({
	...template,
	byline: "Template",
	avatarSrc: template.iconSrc,
}));

const DEMO_SESSION_AGENTS: readonly AgentsDirectoryAgent[] = [
	{
		id: "workflow-synthesizer",
		name: "Workflow Synthesizer",
		byline: "Workflow design by Revenue Operations",
		attributionKind: "team",
		avatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
		description: "Turns scattered requests into durable operating workflows.",
		rating: 4.7,
		feedbackCount: 428,
		chatCount: 8400,
		verified: true,
	},
	{
		id: "research-brief-writer",
		name: "Research Brief Writer",
		byline: "Research synthesis by Alex Kim",
		attributionKind: "person",
		avatarSrc: "/avatar-agent-new/blue/pitch-perfector.svg",
		description: "Condenses long research inputs into crisp team-ready briefs.",
		rating: 4.5,
		feedbackCount: 214,
		chatCount: 3600,
		verified: false,
	},
];

export default function AgentsDirectoryPage() {
	const [open, setOpen] = useState(false);
	const [variant, setVariant] = useState<AgentsDirectoryVariant>("standard-v2");
	const [feedback, setFeedback] = useState("");

	function openDirectory(nextVariant: AgentsDirectoryVariant) {
		setVariant(nextVariant);
		setOpen(true);
	}

	function handleSelectAgent() {
		setOpen(false);
	}

	return (
		<div className="min-h-screen bg-surface p-6">
			<div className="mx-auto max-w-[1056px] space-y-6">
				<div className="flex flex-wrap gap-2">
					<Button onClick={() => openDirectory("standard-v1")} variant="outline">Open standard directory v1</Button>
					<Button onClick={() => openDirectory("standard-v2")} variant="outline">Open standard directory v2</Button>
					<Button onClick={() => openDirectory("experimental")} variant="outline">Open experimental directory</Button>
				</div>
				<h1 className="text-2xl font-semibold text-text">Agents for every team</h1>
				<AgentDirectoryView
					agents={[...REFERENCE_AGENTS, ...DEMO_SESSION_AGENTS]}
					ownedAgentIds={DEMO_SESSION_AGENTS.map((agent) => agent.id)}
					templateAgents={REFERENCE_TEMPLATES}
					onSelectAgent={(agent) => setFeedback(`Selected ${agent.name}`)}
					onSelectTemplateAgent={(agent) => setFeedback(`Selected ${agent.name} template`)}
					onCreateAgent={() => setFeedback("Create agent selected")}
				/>
				<p role="status" className="text-sm text-text-subtle">{feedback}</p>
			</div>
			<AgentsDirectoryDialog
				open={open}
				onOpenChange={setOpen}
				agents={variant === "standard-v2" ? REFERENCE_AGENTS : DEMO_AGENT_BROWSER_AGENTS}
				templateAgents={variant === "standard-v2" ? REFERENCE_TEMPLATES : undefined}
				sessionAgents={DEMO_SESSION_AGENTS}
				onCreateAgent={() => { setOpen(false); setFeedback("Create agent selected"); }}
				onSelectAgent={handleSelectAgent}
				onSelectTemplateAgent={handleSelectAgent}
				variant={variant}
			/>
		</div>
	);
}

export function AgentsDirectoryStandardV1Page() {
	const [open, setOpen] = useState(false);

	return <AgentsDirectoryPageShell open={open} onOpenChange={setOpen} variant="standard-v1" />;
}

export function AgentsDirectoryExperimentalPage() {
	const [open, setOpen] = useState(false);

	return (
		<AgentsDirectoryPageShell
			open={open}
			onOpenChange={setOpen}
			variant="experimental"
		/>
	);
}

function AgentsDirectoryPageShell({
	open,
	onOpenChange,
	variant,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	variant?: AgentsDirectoryVariant;
}>) {
	function handleSelectAgent() {
		onOpenChange(false);
	}

	return (
		<div className="flex h-full min-h-screen items-center justify-center p-4">
			<Button onClick={() => onOpenChange(true)}>
				{variant === "experimental" ? "Open experimental directory" : "Open standard directory v1"}
			</Button>
			<AgentsDirectoryDialog
				open={open}
				onOpenChange={onOpenChange}
				agents={DEMO_AGENT_BROWSER_AGENTS}
				sessionAgents={DEMO_SESSION_AGENTS}
				onSelectAgent={handleSelectAgent}
				onSelectTemplateAgent={handleSelectAgent}
				variant={variant}
			/>
		</div>
	);
}
