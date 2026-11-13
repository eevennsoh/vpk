"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import type { AgentSelectorAgent } from "./agent-selector";
import { FavoriteButton } from "./favorite-button";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { RichTextCommandMenuSearchField } from "@/components/ui-custom/rich-text-editor";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";
import { Button } from "@/components/ui/button";
import { dropdownStyles, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { SearchIcon } from "@/components/ui/vpk-icons";
import { cn } from "@/lib/utils";

export interface InlineAgentAction {
	id: string;
	label: string;
	icon: ReactNode;
	onSelect: () => void;
	focusFirstActionAfterSelect?: boolean;
}

export type InlineAgentSelectorProps = {
	agents: readonly AgentSelectorAgent[];
	softwareAgentIds: readonly string[];
	getActions: (agent: AgentSelectorAgent) => readonly InlineAgentAction[];
	renderAdditionalActions?: (agent: AgentSelectorAgent) => ReactNode;
	renderAgentAction?: (agent: AgentSelectorAgent) => ReactNode;
	renderAgentFeedback?: (agent: AgentSelectorAgent, avatar: ReactElement) => ReactNode;
	renderAgentTrigger?: (agent: AgentSelectorAgent, trigger: ReactElement) => ReactNode;
	onActiveAgentChange?: (agent: AgentSelectorAgent | null) => void;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	initialSoftwareLimit?: number;
	showSearch?: boolean;
	showFavorites?: boolean;
	showHeadings?: boolean;
	recentAgentId?: string | null;
	recommendedAgentId?: string;
	softwareHeading?: string;
	disabledLabel?: string;
	compact?: boolean;
	className?: string;
	status?: string;
} & (
	| { favoriteAgentIds: readonly string[]; onFavoriteAgentIdsChange: (ids: readonly string[]) => void }
	| { favoriteAgentIds?: undefined; onFavoriteAgentIdsChange?: (ids: readonly string[]) => void }
);

function groupInlineAgents({ agents, softwareAgentIds, favorites, showFavorites, recentAgentId, recommendedAgentId, query, expanded, initialSoftwareLimit }: Readonly<{
	agents: readonly AgentSelectorAgent[];
	softwareAgentIds: readonly string[];
	favorites: readonly string[];
	showFavorites: boolean;
	recentAgentId?: string | null;
	recommendedAgentId?: string;
	query: string;
	expanded: boolean;
	initialSoftwareLimit: number;
}>) {
	const software = softwareAgentIds.flatMap((id) => agents.filter((agent) => agent.id === id));
	const others = agents.filter((agent) => !softwareAgentIds.includes(agent.id));
	const matches = (agent: AgentSelectorAgent) => `${agent.name} ${agent.byline}`.toLowerCase().includes(query.trim().toLowerCase());
	const recommendedAgent = agents.find((agent) => agent.id === recommendedAgentId && matches(agent));
	const recentAgent = recentAgentId ? software.find((agent) => agent.id === recentAgentId && agent.id !== recommendedAgent?.id && matches(agent)) : undefined;
	const favoriteAgents = [...software, ...others].filter((agent) => agent.id !== recommendedAgent?.id && showFavorites && favorites.includes(agent.id) && matches(agent));
	const softwareAgents = software.filter((agent) => agent.id !== recommendedAgent?.id && agent.id !== recentAgent?.id && (!showFavorites || !favorites.includes(agent.id)) && matches(agent));
	const otherAgents = others.filter((agent) => agent.id !== recommendedAgent?.id && (!showFavorites || !favorites.includes(agent.id)) && matches(agent));
	const shownSoftware = query || expanded ? softwareAgents : softwareAgents.slice(0, initialSoftwareLimit);
	return { recommendedAgent, recentAgent, favoriteAgents, softwareAgents, otherAgents, shownSoftware };
}

export function InlineAgentSelector({ agents, softwareAgentIds, getActions, renderAdditionalActions, renderAgentAction, renderAgentFeedback, renderAgentTrigger, onActiveAgentChange, onBrowseAgents, onCreateAgent, initialSoftwareLimit = 3, showSearch = true, showFavorites = true, showHeadings = true, recentAgentId, recommendedAgentId, softwareHeading = "Software agents", disabledLabel, compact = false, className, status, favoriteAgentIds, onFavoriteAgentIdsChange }: Readonly<InlineAgentSelectorProps>) {
	const [query, setQuery] = useState("");
	const [expanded, setExpanded] = useState(false);
	const [internalFavorites, setInternalFavorites] = useState<readonly string[]>([]);
	const favorites = favoriteAgentIds ?? internalFavorites;
	const [activeId, setActiveId] = useState<string | null>(null);
	const root = useRef<HTMLDivElement>(null);
	const { ref: listRef, showTopScrollMask } = useHasVerticalOverflow<HTMLDivElement>();
	const listMaskStyle = { ...buildScrollMaskStyle({ fadeTop: showTopScrollMask, fadeBottom: false, fadeSize: "3rem" }), "--scroll-mask-top-fade-size": "3rem" };
	const focusFrame = useRef<number | null>(null);
	useEffect(() => () => { if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); }, []);
	const { recommendedAgent, recentAgent, favoriteAgents, softwareAgents, otherAgents, shownSoftware } = groupInlineAgents({ agents, softwareAgentIds, favorites, showFavorites, recentAgentId, recommendedAgentId, query, expanded, initialSoftwareLimit });
	const row = (agent: AgentSelectorAgent) => {
		const favorite = favorites.includes(agent.id);
		const actions = getActions(agent);
		const additionalActions = renderAdditionalActions?.(agent);
		const hasChoices = actions.length > 1 || Boolean(additionalActions);
		const showInline = hasChoices && activeId === agent.id;
		const disabled = actions.length === 0 && !additionalActions;
		const avatar = <AgentAvatarVisual appearance={agent.brandName === "openai-codex" || agent.brandName === "cursor" || agent.brandName === "github-copilot" ? "coding" : undefined} avatarSrc={agent.avatarSrc} brandName={agent.brandName} vpkLogo={agent.vpkLogo} logoName={agent.logoName} fallbackText={agent.name.slice(0, 2).toUpperCase()} label={agent.name} sizePx={24} />;
		const trigger = <button data-agent-id={agent.id} type="button" disabled={disabled} className={cn("relative flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-lg text-left outline-none before:absolute before:inset-x-0 before:-inset-y-1.5 focus-visible:ring-2 focus-visible:ring-ring", !disabledLabel && "disabled:opacity-50")} aria-expanded={hasChoices ? showInline : undefined} onClick={() => {
					if (hasChoices) { setActiveId(showInline ? null : agent.id); onActiveAgentChange?.(showInline ? null : agent); }
					else { setActiveId(null); onActiveAgentChange?.(null); actions[0]?.onSelect(); }
				}}>
					{renderAgentFeedback?.(agent, avatar) ?? <>
						<span aria-hidden className="grid size-6 shrink-0 place-items-center">{avatar}</span>
						<span className="menu-row-title min-w-0 flex-1 truncate">{agent.name}{agent.id === recommendedAgentId ? <span className="text-text-subtlest"> (Recommended)</span> : null}</span>
					</>}
					{disabled && disabledLabel ? <span className="shrink-0 text-xs text-text-subtlest">{disabledLabel}</span> : null}
				</button>;
		return <div key={agent.id} data-menu-row="" className="group/agent rounded-lg hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
			<div className="flex items-center gap-1 py-1.5 pl-2 pr-1.5">
				{renderAgentTrigger?.(agent, trigger) ?? trigger}
				{renderAgentAction?.(agent)}
				{showFavorites ? <FavoriteButton id={agent.id} name={agent.name} favorite={favorite} onToggle={(restoreFocus) => {
					const nextFavorites = favorite ? favorites.filter((id) => id !== agent.id) : [...favorites, agent.id];
					if (favoriteAgentIds === undefined) setInternalFavorites(nextFavorites);
					onFavoriteAgentIdsChange?.(nextFavorites);
					setActiveId(null);
					onActiveAgentChange?.(null);
					if (favorite && softwareAgentIds.includes(agent.id)) setExpanded(true);
					if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
					if (restoreFocus) focusFrame.current = requestAnimationFrame(() => { focusFrame.current = null; [...(root.current?.querySelectorAll<HTMLButtonElement>("[data-favorite-id]") ?? [])].find((button) => button.dataset.favoriteId === agent.id)?.focus(); });
				}} /> : null}
			</div>
			{showInline ? <div className="flex min-w-0 flex-col px-1.5 pb-1.5">{actions.map((action) => <Button key={action.id} type="button" variant="ghost" className="h-8 min-w-0 justify-start gap-3 border-0 px-0.5 text-sm font-normal" onClick={(event) => {
				const container = event.currentTarget.parentElement;
				action.onSelect();
				if (action.focusFirstActionAfterSelect) {
					if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
					focusFrame.current = requestAnimationFrame(() => { focusFrame.current = null; if (container?.isConnected) container.querySelector<HTMLButtonElement>("button")?.focus(); });
				}
			}}><span aria-hidden className="grid size-6 shrink-0 place-items-center">{action.icon}</span><span className="min-w-0 truncate">{action.label}</span></Button>)}{additionalActions}</div> : null}
		</div>;
	};
	const section = (name: string, items: readonly AgentSelectorAgent[], showMore = false, separateFirst = false) => items.length ? <section aria-label={name} data-menu-group="">{showHeadings ? <h3 data-menu-heading="" className="rich-text-command-menu-heading">{name}</h3> : null}{items.flatMap((agent, index) => separateFirst && index === 0 && items.length > 1 ? [row(agent), <DropdownMenuSeparator key="recent-separator" />] : [row(agent)])}{showMore && !query && !expanded && softwareAgents.length > initialSoftwareLimit ? <button type="button" className="h-8 px-2 text-xs text-text-subtlest hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={(event) => {
		const revealedIds = new Set(softwareAgents.slice(initialSoftwareLimit).map((agent) => agent.id));
		setExpanded(true);
		if (event.detail !== 0) return;
		if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
		focusFrame.current = requestAnimationFrame(() => {
			focusFrame.current = null;
			const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>("[data-agent-id]:not(:disabled)") ?? [])];
			(buttons.find((button) => revealedIds.has(button.dataset.agentId ?? "")) ?? buttons[0])?.focus();
		});
	}}>Show more</button> : null}</section> : null;
	return <div ref={root} data-overlay-surface={compact ? undefined : ""} className={cn("menu-row-spacing flex w-80 max-w-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground", dropdownStyles.padding, compact ? "h-auto" : cn("h-[26rem] max-h-[var(--available-height,26rem)]", dropdownStyles.surface), className)}>
		{showSearch ? <div className="-mx-(--menu-inset) -mt-(--menu-inset) shrink-0 overflow-hidden rounded-t-lg"><RichTextCommandMenuSearchField icon={<SearchIcon className="size-4 text-icon-subtle" />} label="Search agents" value={query} onValueChange={setQuery} onClear={() => setQuery("")} /></div> : null}
		<div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={listMaskStyle}>{recommendedAgent ? row(recommendedAgent) : null}{section("Favorites", favoriteAgents)}{section(softwareHeading, recentAgent ? [recentAgent, ...shownSoftware] : shownSoftware, !recentAgent, Boolean(recentAgent))}{section("Other agents", otherAgents)}{!recommendedAgent && !recentAgent && !favoriteAgents.length && !shownSoftware.length && !otherAgents.length ? <p className="p-4 text-sm text-text-subtle">No agents found</p> : null}</div>
		{onBrowseAgents || onCreateAgent ? <div className="-mx-(--menu-inset) shrink-0 px-(--menu-inset)"><DropdownMenuSeparator className="mt-0" />{onBrowseAgents ? <Button type="button" variant="ghost" className="h-8 w-full justify-start gap-3 border-0 px-2 text-sm font-normal text-text-subtle" onClick={onBrowseAgents}><Icon aria-hidden className="size-6" render={<AiAgentIcon label="" />} />Browse agents</Button> : null}{onCreateAgent ? <Button type="button" variant="ghost" className="h-8 w-full justify-start gap-3 border-0 px-2 text-sm font-normal text-text-subtle" onClick={onCreateAgent}><Icon aria-hidden className="size-6" render={<AddIcon label="" />} />Create agent</Button> : null}</div> : null}
		<p role="status" className="sr-only">{status}</p>
	</div>;
}
