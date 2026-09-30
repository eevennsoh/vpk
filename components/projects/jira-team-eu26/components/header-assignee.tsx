"use client";

import type { HeaderAssigneeRenderContext } from "@/components/blocks/jira-kanban/experimental/experimental-board-header";
import { AGENT_LANYARD_AGENTS, AGENT_LANYARD_FIRST_PARTY_AGENTS, type AgentLanyardAgent } from "@/components/blocks/agent-lanyard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useHeaderLanyardHandle } from "./header-lanyards";

const CLAUDE = AGENT_LANYARD_AGENTS.find((agent) => agent.id === "claude")!;
const CURSOR = AGENT_LANYARD_AGENTS.find((agent) => agent.id === "cursor")!;
const JIRA_CODING = AGENT_LANYARD_FIRST_PARTY_AGENTS.find((agent) => agent.id === "jira-coding")!;
const FIGMA: AgentLanyardAgent = {
	id: "figma",
	name: "Figma",
	publisher: "Figma",
	description: "Collaborate on checkout designs with the Figma agent.",
	avatarSrc: "/3p/figma/32.svg",
	action: "chat",
};
const HEADER_AGENTS = new Map([
	["claude-code", CLAUDE],
	["review-agent", JIRA_CODING],
	["test-agent", CURSOR],
	...AGENT_LANYARD_AGENTS.map((agent) => [`wac-${agent.id}`, agent] as const),
	["wac-figma", FIGMA],
]);

export function renderEu26HeaderAssignee(context: HeaderAssigneeRenderContext) {
	return <Eu26HeaderAssignee {...context} />;
}

function Eu26HeaderAssignee({ assignee, muted, selected, onToggle, surfaceLabel }: Readonly<HeaderAssigneeRenderContext>) {
	const handle = useHeaderLanyardHandle();
	const agent = HEADER_AGENTS.get(assignee.id);
	const isJiraCoding = agent === JIRA_CODING;
	const trigger = (
		<button
			aria-label={agent ? `Preview ${assignee.name}` : `Filter ${surfaceLabel} by ${assignee.name}`}
			aria-pressed={agent ? undefined : selected}
			className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
			onClick={agent ? undefined : onToggle}
			type="button"
		>
			<Avatar
				label={assignee.name}
				shape={agent ? "hexagon" : "circle"}
				size="sm"
				className={cn(
					!agent ? "ring-2 ring-background" : null,
					selected && !agent ? "ring-2! ring-border-selected!" : null,
					muted && !agent ? "opacity-(--opacity-disabled)" : null,
				)}
			>
				{isJiraCoding ? (
					<span className="flex size-full items-center justify-center" style={{ backgroundColor: JIRA_CODING.accentColor }}>
						<AvatarImage alt="" src={assignee.avatarSrc} className="size-4.5 object-contain" />
					</span>
				) : <AvatarImage alt="" src={assignee.avatarSrc} />}
				<AvatarFallback>{assignee.name.slice(0, 1)}</AvatarFallback>
			</Avatar>
		</button>
	);

	return agent ? (
		<HoverCardTrigger handle={handle} payload={agent} delay={150} closeDelay={150} render={trigger} />
	) : (
		<Tooltip>
			<TooltipTrigger render={trigger} />
			<TooltipContent side="bottom">{assignee.name}</TooltipContent>
		</Tooltip>
	);
}
