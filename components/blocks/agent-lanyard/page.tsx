"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { AgentLanyard, AGENT_LANYARD_AGENTS, type AgentLanyardAgent } from "./index";

export default function AgentLanyardPage() {
	const [perspectiveTilt, setPerspectiveTilt] = useState(true);
	const [animateGrid, setAnimateGrid] = useState(true);
	const [feedback, setFeedback] = useState("");
	const [agents, setAgents] = useState<readonly AgentLanyardAgent[]>(AGENT_LANYARD_AGENTS);
	const [starredIds, setStarredIds] = useState<readonly string[]>([]);
	const [profileAgent, setProfileAgent] = useState<AgentLanyardAgent | null>(null);

	function toggleStar(agent: AgentLanyardAgent) {
		setStarredIds((current) => current.includes(agent.id)
			? current.filter((id) => id !== agent.id)
			: [...current, agent.id]);
		setFeedback(`${starredIds.includes(agent.id) ? "Unstarred" : "Starred"} ${agent.name}`);
	}

	async function copyLink(agent: AgentLanyardAgent) {
		const url = new URL("/preview/blocks/agent-lanyard", window.location.origin);
		url.hash = `agent-lanyard-${agent.id}`;
		try {
			await navigator.clipboard.writeText(url.href);
			setFeedback(`Copied link to ${agent.name}`);
		} catch {
			setFeedback(`Could not copy the link to ${agent.name}. Please try again.`);
		}
	}

	function duplicate(agent: AgentLanyardAgent) {
		const copy = { ...agent, id: crypto.randomUUID(), name: `${agent.name} (copy)` };
		setAgents((current) => [...current, copy]);
		setFeedback(`Duplicated ${agent.name}`);
	}

	return (
		<div className="w-full bg-surface p-6" data-slot="agent-lanyard-demo">
			<div className="mx-auto flex max-w-[1056px] flex-col gap-6">
				<div className="flex flex-wrap items-center gap-6">
					<div className="flex items-center gap-2 text-sm text-text">
						<Switch checked={perspectiveTilt} onCheckedChange={setPerspectiveTilt} label="Perspective tilt" />
						Perspective tilt
					</div>
					<div className="flex items-center gap-2 text-sm text-text">
						<Switch checked={animateGrid} onCheckedChange={setAnimateGrid} label="Backdrop grid animation" />
						Backdrop grid animation
					</div>
				</div>
				<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
					{agents.map((agent) => (
						<div key={agent.id} id={`agent-lanyard-${agent.id}`}>
							<AgentLanyard
								agent={agent} className="w-full"
								perspectiveTilt={perspectiveTilt} animateGrid={animateGrid}
								onAction={(selected) => setFeedback(`Selected: ${selected.action === "chat" ? "Chat with" : "Connect"} ${selected.name}`)}
								starred={starredIds.includes(agent.id)}
								menuActions={{ onViewProfile: setProfileAgent, onToggleStar: toggleStar, onCopyLink: copyLink, onDuplicate: duplicate }}
							/>
						</div>
					))}
				</div>
				<p role="status" className="min-h-5 text-sm text-text-subtle">{feedback}</p>
			</div>
			<Dialog open={profileAgent !== null} onOpenChange={(open) => { if (!open) setProfileAgent(null); }}>
				{profileAgent ? (
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{profileAgent.name}</DialogTitle>
							<DialogDescription>{profileAgent.description}</DialogDescription>
						</DialogHeader>
						<p className="text-sm text-text-subtle">{profileAgent.publisher}</p>
					</DialogContent>
				) : null}
			</Dialog>
		</div>
	);
}
