"use client";

import { useMemo } from "react";
import { DEMO_AGENT_BROWSER_AGENTS } from "@/app/data/directory";
import type { AgentBrowserAgent } from "@/components/blocks/agent-browser";
import { AGENT_LANYARD_AGENTS } from "@/components/blocks/agent-lanyard/data";
import { AGENT_LANYARD_FIRST_PARTY_AGENTS } from "@/components/blocks/agent-lanyard/first-party-data";
import { BUTTER_PRIMARY_BOARD_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";

/** Agents the work item's comment and reply boxes can @mention: board agents, this item's session agents, then the directory. */
export function useProjectButterMentionAgents(sessions: readonly ProjectButterSessionItem[]): readonly AgentBrowserAgent[] {
	return useMemo(() => [...BUTTER_PRIMARY_BOARD_AGENTS, ...sessions.map((session) => ({ ...session.agent, id: session.agent.id ?? session.id, byline: "Agent on this work item" })), ...[...AGENT_LANYARD_AGENTS, ...AGENT_LANYARD_FIRST_PARTY_AGENTS].map((agent) => ({ ...agent, byline: agent.publisher })), ...DEMO_AGENT_BROWSER_AGENTS].filter((agent, index, all) => all.findIndex((candidate) => candidate.name.toLowerCase() === agent.name.toLowerCase()) === index), [sessions]);
}
