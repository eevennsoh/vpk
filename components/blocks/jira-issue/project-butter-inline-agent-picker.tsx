"use client";

import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import { useEffect, useRef, type ReactNode } from "react";
import { InlineAgentSelector, type AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { Icon } from "@/components/ui/icon";
import { BUTTER_PICKER_AGENTS } from "./project-butter-agent-catalog";
import { useProjectButterInvocationActions } from "./project-butter-invocation";

const SOFTWARE_IDS = ["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent", "rovo-cli"];
const CLOUD_AGENTS = BUTTER_PICKER_AGENTS.filter((agent) => agent.id !== "github-copilot" && agent.id !== "rovo-cli");

export function ProjectButterAgentPreviewBoundary({ agents, children }: Readonly<{ agents: readonly AgentSelectorAgent[]; children: ReactNode }>) {
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
	return <div className="w-full" onPointerMove={(event) => {
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

export function ProjectButterCloudAgentPicker({ onAssign, onBrowseAgents, status }: Readonly<{
	onAssign: (agent: AgentSelectorAgent) => void;
	onBrowseAgents?: () => void;
	status?: string;
}>) {
	return <ProjectButterAgentPreviewBoundary agents={CLOUD_AGENTS}><InlineAgentSelector
		agents={CLOUD_AGENTS}
		recommendedAgentId="the-council"
		softwareAgentIds={SOFTWARE_IDS}
		initialSoftwareLimit={3}
		getActions={(agent) => [{ id: "cloud", label: "Start a new session", icon: <Icon render={<CloudIcon label="" />} />, onSelect: () => onAssign(agent) }]}
		onBrowseAgents={onBrowseAgents}
		status={status}
	/></ProjectButterAgentPreviewBoundary>;
}
