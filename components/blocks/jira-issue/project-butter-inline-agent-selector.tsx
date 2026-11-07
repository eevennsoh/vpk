"use client";

import { Fragment, type ReactNode } from "react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AddIcon from "@atlaskit/icon/core/add";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";

const SOFTWARE_IDS = ["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent", "github-copilot", "rovo-cli"];

export function ProjectButterInlineAgentSelector({ agents, expandedAgentId, expandedContent, expandedId, hasActions, onToggle, onBrowseAgents, onCreateAgent, onQueryChange, query, showMore, onShowMore }: Readonly<{
	agents: readonly AgentSelectorAgent[];
	expandedAgentId?: string;
	expandedContent: ReactNode;
	expandedId: string;
	hasActions: (agent: AgentSelectorAgent) => boolean;
	onToggle: (agent: AgentSelectorAgent, anchor: HTMLElement, focus?: boolean) => void;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	onQueryChange: (query: string) => void;
	query: string;
	showMore: boolean;
	onShowMore: () => void;
}>) {
	const { ref: listRef, showTopScrollMask } = useHasVerticalOverflow<HTMLDivElement>();
	const normalized = query.trim().toLowerCase();
	const visible = agents.filter((agent) => `${agent.name} ${agent.byline}`.toLowerCase().includes(normalized));
	const software = SOFTWARE_IDS.flatMap((id) => visible.filter((agent) => agent.id === id));
	const other = visible.filter((agent) => !SOFTWARE_IDS.includes(agent.id));
	const limited = !normalized && !showMore && software.length > 3;
	const groups = [{ label: "Software agents", agents: limited ? software.slice(0, 3) : software }, { label: "Other agents", agents: other }];

	return (
		<div className="flex h-[26rem] max-h-[min(26rem,var(--available-height,26rem))] min-h-0 flex-col rounded-xl p-1">
			<div className="relative shrink-0 border-b border-border">
				<SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-2 size-4 text-icon-subtle" />
				<Input aria-label="Search agents" className="pl-9" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search agents" type="search" value={query} variant="none" />
			</div>
			<div ref={listRef} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", showTopScrollMask && "scroll-mask-top [--scroll-mask-fade-size:3rem]")}>
				{visible.length === 0 ? <p className="px-2 py-6 text-center text-sm">No agents found.</p> : null}
				{groups.map((group) => group.agents.length ? <section aria-label={group.label} key={group.label}>
					<h2 className="px-2 pt-3 pb-1 text-xs font-semibold text-text-subtlest">{group.label}</h2>
					{group.agents.map((agent) => {
						const expanded = expandedAgentId === agent.id;
						const canExpand = hasActions(agent);
						return <Fragment key={agent.id}>
							<Button aria-controls={canExpand && expanded ? expandedId : undefined} aria-expanded={canExpand ? expanded : undefined} className="h-9 w-full justify-start gap-3 px-2 text-sm font-normal" onClick={(event) => onToggle(agent, event.currentTarget)} onKeyDown={(event) => { if (canExpand && event.key === "ArrowRight") { event.preventDefault(); onToggle(agent, event.currentTarget, true); } }} type="button" variant="ghost">
								<span aria-hidden>{agent.visual ?? <AgentAvatarVisual appearance={agent.brandName === "openai-codex" || agent.brandName === "cursor" || agent.brandName === "github-copilot" ? "coding" : undefined} avatarSrc={agent.avatarSrc} brandName={agent.brandName} fallbackText={agent.name.slice(0, 2).toUpperCase()} label={agent.name} logoName={agent.logoName} sizePx={24} vpkLogo={agent.vpkLogo} />}</span>
								<span className="min-w-0 flex-1 truncate text-left">{agent.name}</span>
								{canExpand ? <Icon aria-hidden render={expanded ? <ChevronDownIcon label="" size="small" /> : <ChevronRightIcon label="" size="small" />} /> : null}
							</Button>
							{expanded ? expandedContent : null}
						</Fragment>;
					})}
					{group.label === "Software agents" && limited ? <Button className="h-8 px-2 text-xs text-text-subtlest" onClick={onShowMore} type="button" variant="ghost">Show more</Button> : null}
				</section> : null)}
			</div>
			<div className="shrink-0 border-t border-border pt-1">
				{onBrowseAgents ? <Button className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal" onClick={onBrowseAgents} type="button" variant="ghost"><Icon aria-hidden render={<AiAgentIcon label="" />} />Browse agents</Button> : null}
				{onCreateAgent ? <Button className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal" onClick={onCreateAgent} type="button" variant="ghost"><Icon aria-hidden render={<AddIcon label="" />} />Create agent</Button> : null}
			</div>
		</div>
	);
}
