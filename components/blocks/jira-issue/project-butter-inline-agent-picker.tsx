"use client";

import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ROVO_AGENT_PROFILES } from "@/app/data/directory/agents";
import { AgentLanyard, AgentLanyardFirstParty, AgentLanyardHoverContent, AGENT_LANYARD_AGENTS, AGENT_LANYARD_FIRST_PARTY_AGENTS, type AgentLanyardAgent } from "@/components/blocks/agent-lanyard";
import { InlineAgentSelector, type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { HoverCard, HoverCardTrigger, createHoverCardHandle } from "@/components/ui/hover-card";
import { Icon } from "@/components/ui/icon";
import { BUTTER_PICKER_AGENTS } from "./project-butter-agent-catalog";
import { useProjectButterInvocationActions } from "./project-butter-invocation";

const RECOMMENDED_AGENT_ID = "claude-code";
const DEFAULT_RECOMMENDATION_REASON = "Claude can help with code suggestions and reviews.";
const SOFTWARE_IDS = ["jira-coding", RECOMMENDED_AGENT_ID, "test-agent", "review-agent", "release-agent", "rovo-cli"];
const CLOUD_AGENTS = BUTTER_PICKER_AGENTS.filter((agent) => agent.id !== "github-copilot" && agent.id !== "rovo-cli");
const LANYARD_IDS: Readonly<Record<string, string>> = { [RECOMMENDED_AGENT_ID]: "claude", "test-agent": "cursor", "review-agent": "codex", "release-agent": "copilot" };

function pickerLanyard(agent: AgentSelectorAgent): AgentLanyardAgent {
	const known = AGENT_LANYARD_AGENTS.find((item) => item.id === (LANYARD_IDS[agent.id] ?? agent.id));
	if (known) return known;
	const profile = ROVO_AGENT_PROFILES.find((item) => item.id === agent.id);
	return {
		id: agent.id, name: agent.name, publisher: agent.byline, description: profile?.description ?? agent.byline,
		avatarSrc: agent.avatarSrc ?? "/1p/agent-lanyard/glyph-custom-black.svg", action: "chat", verified: profile?.verified,
	};
}

export function ProjectButterAgentPreviewBoundary({ agents, children, ref }: Readonly<{ agents: readonly AgentSelectorAgent[]; children: ReactNode; ref?: RefObject<HTMLDivElement | null> }>) {
	const invocation = useProjectButterInvocationActions();
	const pointer = useRef<{ x: number; y: number } | null>(null);
	const frame = useRef<number | null>(null);
	useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
	const preview = (root: HTMLElement, target: Element | null) => {
		if (!invocation) return;
		const row = target?.closest<HTMLButtonElement>("button[data-agent-id]");
		if (!row || !root.contains(row)) return;
		const agent = agents.find((candidate) => candidate.id === row.dataset.agentId);
		if (!agent) return;
		const rows = [...root.querySelectorAll<HTMLButtonElement>("button[data-agent-id]")];
		invocation.preview(agent, rows.indexOf(row));
	};
	const schedulePreview = (root: HTMLElement) => {
		if (!invocation || frame.current !== null) return;
		frame.current = requestAnimationFrame(() => {
			frame.current = null;
			if (!root.isConnected || !pointer.current) return;
			preview(root, document.elementFromPoint(pointer.current.x, pointer.current.y));
		});
	};
	return <div ref={ref} className="w-full" onPointerMove={(event) => {
		if (!invocation) return;
		pointer.current = { x: event.clientX, y: event.clientY };
		schedulePreview(event.currentTarget);
	}} onScrollCapture={(event) => { if (pointer.current) schedulePreview(event.currentTarget); }} onFocusCapture={(event) => {
		pointer.current = null;
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		frame.current = null;
		preview(event.currentTarget, event.target);
	}} onPointerLeave={() => {
		pointer.current = null;
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		frame.current = null;
		invocation?.preview(null, -1);
	}}>{children}</div>;
}

export function ProjectButterCloudAgentPicker({ onAssign, onBrowseAgents, status, recommendationReason, issueTriggerRef }: Readonly<{
	onAssign: (agent: AgentSelectorAgent) => void;
	onBrowseAgents?: () => void;
	status?: string;
	/** Prototype explanation of Claude's catalog role; callers may supply their own reason. */
	recommendationReason?: string;
	issueTriggerRef?: RefObject<HTMLElement | null>;
}>) {
	const [handle] = useState(() => createHoverCardHandle<AgentSelectorAgent>());
	const pickerRef = useRef<HTMLDivElement>(null);
	const reason = recommendationReason?.trim() || DEFAULT_RECOMMENDATION_REASON;
	return <ProjectButterAgentPreviewBoundary agents={CLOUD_AGENTS} ref={pickerRef}><InlineAgentSelector
		agents={CLOUD_AGENTS}
		recommendedAgentId={RECOMMENDED_AGENT_ID}
		softwareAgentIds={SOFTWARE_IDS}
		initialSoftwareLimit={3}
		getActions={(agent) => [{ id: "cloud", label: "Start a new session", icon: <Icon render={<CloudIcon label="" />} />, onSelect: () => onAssign(agent) }]}
		onBrowseAgents={onBrowseAgents}
		renderAgentTrigger={(agent, trigger) => <HoverCardTrigger handle={handle} payload={agent} delay={150} closeDelay={150} render={trigger} />}
		status={status}
	/><HoverCard handle={handle}>{({ payload: agent }) => <AgentLanyardHoverContent variant={agent?.id === RECOMMENDED_AGENT_ID ? "recommended" : "agent"} side="right" align="start" sideOffset={({ side }) => {
		const row = [...(pickerRef.current?.querySelectorAll<HTMLButtonElement>("button[data-agent-id]") ?? [])].find((item) => item.dataset.agentId === agent?.id);
		const issue = issueTriggerRef?.current?.closest("[data-butter-agent-surface], article");
		if (!row || !issue) return 8;
		const rowRect = row.getBoundingClientRect();
		const issueRect = issue.getBoundingClientRect();
		if (side === "left") return Math.max(8, rowRect.left - issueRect.left + 8);
		if (side === "right") return Math.max(8, issueRect.right - rowRect.right + 8);
		return 8;
	}} positionerClassName="z-[700]" className="[&_[data-slot=agent-lanyard-surface]]:min-h-0 [&_[data-slot=agent-lanyard-surface]_p]:min-h-0">
		{agent ? (() => {
			const firstParty = AGENT_LANYARD_FIRST_PARTY_AGENTS.find((item) => item.id === agent.id);
			if (firstParty) return <AgentLanyardFirstParty agent={firstParty} perspectiveTilt={false} />;
			const lanyard = pickerLanyard(agent);
			if (agent.id === RECOMMENDED_AGENT_ID) return <AgentLanyard variant="recommended" agent={lanyard} recommendationReason={reason} perspectiveTilt={false} />;
			return <AgentLanyard agent={lanyard} perspectiveTilt={false} footer={null} avatar={LANYARD_IDS[agent.id] ? undefined : <AgentAvatarVisual avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} vpkLogo={agent.vpkLogo} fallbackText={agent.name.slice(0, 2).toUpperCase()} label="" sizePx={48} />} />;
		})() : null}
	</AgentLanyardHoverContent>}</HoverCard></ProjectButterAgentPreviewBoundary>;
}
