"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";

import {
	AgentLoading,
	type AgentLoadingAgent,
} from "@/components/ui-custom/agent-loading";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const AGENT_COUNTS = [2, 3, 4] as const;
type AgentCount = (typeof AGENT_COUNTS)[number];

const ACTIVE_AGENTS: readonly AgentLoadingAgent[] = [
	{
		id: "cursor",
		name: "Cursor",
		status: "working",
		avatar: { brandName: "cursor" },
	},
	{
		id: "jira-coding-agent",
		name: "Jira Coding agent",
		status: "working",
		avatar: {
			avatarSrc: "/avatar-agent-new/lime/auto-dev.svg",
		},
	},
	{
		id: "rovo",
		name: "Rovo",
		status: "working",
		avatar: { vpkLogo: "rovo" },
	},
	{
		id: "claude",
		name: "Claude",
		status: "working",
		avatar: { brandName: "claude" },
	},
] as const;

function withFinishedStatus(
	agents: readonly AgentLoadingAgent[],
	finished: boolean,
): readonly AgentLoadingAgent[] {
	return agents.map((agent) => ({
		...agent,
		status: finished ? "finished" : agent.status,
	}));
}

function demoAgents(count: AgentCount, finished: boolean): readonly AgentLoadingAgent[] {
	return withFinishedStatus(ACTIVE_AGENTS.slice(0, count), finished);
}

export default function AgentLoadingDemo() {
	const [agents, setAgents] = useState<readonly AgentLoadingAgent[]>(() => ACTIVE_AGENTS.slice(0, 3));
	const [finished, setFinished] = useState(false);
	const [intro, setIntro] = useState<{ agentId: string; avatarSize: 20 | 24; sequence: number; active: boolean } | null>(null);
	const reduceMotion = useReducedMotion();
	const agentCount = agents.length;

	function showAgentIntro(agent: AgentLoadingAgent) {
		setAgents((current) => [agent, ...current.filter((item) => item.id !== agent.id)]);
		setFinished(false);
		setIntro((current) => ({
			agentId: agent.id,
			avatarSize: agent.id === "cursor" || agent.id === "claude" || agent.id === "jira-coding-agent" ? 20 : 24,
			sequence: (current?.sequence ?? 0) + 1,
			active: !reduceMotion,
		}));
	}

	return (
		<div className="flex flex-col items-start gap-4" onAnimationEnd={(event) => {
			if (event.animationName === "agent-loading-intro-front") {
				setIntro((current) => current ? { ...current, active: false } : null);
			}
		}}>
			<AgentLoading
				key={intro ? `intro-${intro.sequence}` : `preset-${agentCount}`}
				agents={withFinishedStatus(agents, finished)}
				intro={intro?.active ? intro : undefined}
				label={finished ? "Completed" : "Needs input…"}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<ToggleGroup
					aria-label="Number of agents"
					onValueChange={(value) => {
						const next = Number(value.at(0));
						if (next === 2 || next === 3 || next === 4) {
							setAgents(ACTIVE_AGENTS.slice(0, next));
							setIntro(null);
						}
					}}
					size="sm"
					value={[String(agentCount)]}
					variant="outline"
				>
					{AGENT_COUNTS.map((count) => (
						<ToggleGroupItem
							aria-label={`${count} agents`}
							key={count}
							value={String(count)}
						>
							{count} agents
						</ToggleGroupItem>
					))}
				</ToggleGroup>
				<Button onClick={() => setFinished((current) => !current)} size="compact" variant="outline">
					{finished ? "Resume agents" : "Finish all agents"}
				</Button>
			</div>
			<div aria-label="Add or replay an agent" className="flex flex-wrap items-center gap-2" role="group">
				{ACTIVE_AGENTS.map((agent) => (
					<Button key={agent.id} onClick={() => showAgentIntro(agent)} size="compact" variant="outline">
						{agents.some((item) => item.id === agent.id) ? "Replay" : "Add"} {agent.name}
					</Button>
				))}
			</div>
		</div>
	);
}

export function AgentLoadingDemoFinished() {
	return <AgentLoading agents={demoAgents(3, true)} label="Completed" />;
}

export function AgentLoadingDemoSmall() {
	return <AgentLoading agents={demoAgents(3, false)} label="Needs input…" size="small" />;
}

export function AgentLoadingDemoVertical() {
	return <AgentLoading agents={demoAgents(3, false)} label="Needs input…" variant="vertical" />;
}
