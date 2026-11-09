"use client";

import { useMemo } from "react";
import CrossIcon from "@atlaskit/icon/core/cross";

import {
	AgentBrowserDialog,
	type AgentBrowserAgent,
	type AgentBrowserTemplateBuildOptions,
	type AgentBrowserTemplateBuildResult,
	type AgentBrowserVariant,
	type AgentBrowserSidebarGroup,
} from "@/components/blocks/agent-browser";
import type { AgentTemplateAgent, AgentTemplateCategoryId } from "@/components/blocks/agent-template";
import {
	DEMO_AGENT_TEMPLATES,
	DEMO_AGENT_TEMPLATES_SESSION,
} from "@/components/blocks/agent-template/data/demo-template-agents";
import { DEFAULT_AGENTS_DIRECTORY_SIDEBAR_GROUPS } from "@/components/blocks/agent-directory/data/sidebar-groups";
import { AgentDirectoryView } from "@/components/blocks/agent-directory/components/directory-view";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type AgentsDirectoryAgent = AgentBrowserAgent;
export type AgentsDirectoryTemplateAgent = AgentTemplateAgent;
export type AgentsDirectorySidebarGroup = AgentBrowserSidebarGroup;
export type AgentsDirectoryVariant = AgentBrowserVariant | "standard-v1" | "standard-v2";
export type AgentsDirectoryTemplateBuildOptions = AgentBrowserTemplateBuildOptions;
export type AgentsDirectoryTemplateBuildResult = AgentBrowserTemplateBuildResult;

export interface AgentsDirectoryDialogProps {
	agents: readonly AgentsDirectoryAgent[];
	onCreateAgent?: () => void;
	onSelectAgent?: (agent: AgentsDirectoryAgent) => void;
	onSelectTemplateAgent?: (agent: AgentsDirectoryTemplateAgent) => void;
	onBuildTemplateAgent?: (
		agent: AgentsDirectoryTemplateAgent,
		options: AgentsDirectoryTemplateBuildOptions
	) => AgentsDirectoryTemplateBuildResult | null;
	onOpenBuiltTemplateAgentConfig?: (profileId: string) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sessionAgents?: readonly AgentsDirectoryAgent[];
	sessionTemplateAgents?: readonly AgentsDirectoryTemplateAgent[];
	sidebarGroups?: readonly AgentsDirectorySidebarGroup[];
	templateAgents?: readonly AgentsDirectoryTemplateAgent[];
	/** Template category selected when the directory first opens (e.g. open straight onto "Planning"). */
	initialTemplateCategory?: AgentTemplateCategoryId | null;
	title?: string;
	variant?: AgentsDirectoryVariant;
}

const EMPTY_AGENTS_DIRECTORY_AGENTS: readonly AgentsDirectoryAgent[] = [];

function mergeDirectoryAgents({
	agents,
	sessionAgents,
	variant,
}: {
	agents: readonly AgentsDirectoryAgent[];
	sessionAgents: readonly AgentsDirectoryAgent[];
	variant: AgentsDirectoryVariant;
}): readonly AgentsDirectoryAgent[] {
	const byId = new Map<string, AgentsDirectoryAgent>();

	for (const agent of agents) {
		byId.set(agent.id, agent);
	}

	for (const sessionAgent of sessionAgents) {
		const existingAgent = byId.get(sessionAgent.id);
		const normalizedSessionAgent = variant === "experimental"
			? { ...sessionAgent, favorite: true }
			: sessionAgent;
		byId.set(sessionAgent.id, {
			...(existingAgent ?? {}),
			...normalizedSessionAgent,
			attributionKind: normalizedSessionAgent.attributionKind ?? existingAgent?.attributionKind,
			rating: normalizedSessionAgent.rating ?? existingAgent?.rating,
			feedbackCount: normalizedSessionAgent.feedbackCount ?? existingAgent?.feedbackCount,
			chatCount: normalizedSessionAgent.chatCount ?? existingAgent?.chatCount,
			verified: normalizedSessionAgent.verified ?? existingAgent?.verified,
		});
	}

	return [...byId.values()];
}

export function AgentsDirectoryDialog({
	agents,
	onCreateAgent,
	onSelectAgent,
	onSelectTemplateAgent,
	onBuildTemplateAgent,
	onOpenBuiltTemplateAgentConfig,
	open,
	onOpenChange,
	sessionAgents = EMPTY_AGENTS_DIRECTORY_AGENTS,
	sessionTemplateAgents = DEMO_AGENT_TEMPLATES_SESSION,
	sidebarGroups = DEFAULT_AGENTS_DIRECTORY_SIDEBAR_GROUPS,
	templateAgents = DEMO_AGENT_TEMPLATES,
	initialTemplateCategory = null,
	title,
	variant = "default",
}: Readonly<AgentsDirectoryDialogProps>) {
	const directoryAgents = useMemo(
		() => mergeDirectoryAgents({ agents, sessionAgents, variant }),
		[agents, sessionAgents, variant],
	);
	const directoryTemplateAgents = useMemo(
		() => [...templateAgents, ...sessionTemplateAgents],
		[sessionTemplateAgents, templateAgents],
	);

	if (variant === "standard-v2") {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="grid h-[min(800px,calc(100svh-2rem))] max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[1120px]" showCloseButton={false}>
					<div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4">
						<DialogTitle>{title ?? "Agents"}</DialogTitle>
						<DialogClose render={<Button variant="ghost" size="icon" />}>
							<CrossIcon label="" />
							<span className="sr-only">Close</span>
						</DialogClose>
					</div>
					<div className="min-h-0 overflow-y-auto px-6 pb-8">
						<AgentDirectoryView agents={directoryAgents} templateAgents={directoryTemplateAgents} ownedAgentIds={sessionAgents.map((agent) => agent.id)} initialTemplateCategory={initialTemplateCategory} onCreateAgent={onCreateAgent} onSelectAgent={onSelectAgent} onSelectTemplateAgent={onSelectTemplateAgent} />
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<AgentBrowserDialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			primaryActionLabel="New agent"
			onPrimaryAction={onCreateAgent}
			agents={directoryAgents}
			onSelectAgent={onSelectAgent}
			onSelectTemplateAgent={onSelectTemplateAgent}
			onBuildTemplateAgent={onBuildTemplateAgent}
			onOpenBuiltTemplateAgentConfig={onOpenBuiltTemplateAgentConfig}
			sidebarGroups={sidebarGroups}
			templateAgents={directoryTemplateAgents}
			initialTemplateCategory={initialTemplateCategory}
			variant={variant === "standard-v1" ? "default" : variant}
		/>
	);
}
