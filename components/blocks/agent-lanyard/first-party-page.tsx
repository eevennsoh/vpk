"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

import { AgentLanyardFirstParty } from "./agent-lanyard-first-party";
import { AGENT_LANYARD_CUSTOM_AGENTS, type AgentLanyardFirstPartyAgent } from "./first-party-data";

export default function AgentLanyardFirstPartyPage({
	agents = AGENT_LANYARD_CUSTOM_AGENTS,
}: Readonly<{ agents?: readonly AgentLanyardFirstPartyAgent[] }>) {
	const [perspectiveTilt, setPerspectiveTilt] = useState(true);
	const [animateGrid, setAnimateGrid] = useState(false);
	return (
		<div className="w-full bg-surface p-6" data-slot="agent-lanyard-first-party-demo">
			<div className="mx-auto flex max-w-[1001px] flex-col gap-6">
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
				<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
					{agents.map((agent) => <AgentLanyardFirstParty key={agent.id} agent={agent} className="w-full" perspectiveTilt={perspectiveTilt} animateGrid={animateGrid} />)}
				</div>
			</div>
		</div>
	);
}
