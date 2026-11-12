"use client";

import { useEffect, useRef, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import ScreenIcon from "@atlaskit/icon/core/screen";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { RichTextCommandMenuSearchField } from "@/components/ui-custom/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { CheckIcon, SearchIcon } from "@/components/ui/vpk-icons";
import { FavoriteButton } from "@/components/blocks/agent-selector/components/favorite-button";

const softwareIds = ["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent"];
const softwareAgents = softwareIds.flatMap((id) => BUTTER_PICKER_AGENTS.filter((agent) => agent.id === id));
const otherAgents = BUTTER_PICKER_AGENTS.filter((agent) => !softwareIds.includes(agent.id) && agent.id !== "rovo-cli" && agent.id !== "github-copilot");
const submenuLabels: Readonly<Record<string, string>> = { "claude-code": "Open in Claude", "test-agent": "Open in Cursor", "review-agent": "Open in Codex", "release-agent": "Open in VS Code" };

export function FavoritesPreview() {
	const [favorites, setFavorites] = useState<readonly string[]>([]);
	const [query, setQuery] = useState("");
	const [expanded, setExpanded] = useState(false);
	const [selected, setSelected] = useState<string | null>(null);
	const [submenu, setSubmenu] = useState<{ agent: AgentSelectorAgent; anchor: HTMLElement } | null>(null);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const focusFrame = useRef<number | null>(null);
	const root = useRef<HTMLDivElement>(null);
	const submenuContent = useRef<HTMLDivElement>(null);
	const cancelClose = () => { if (closeTimer.current !== null) clearTimeout(closeTimer.current); closeTimer.current = null; };
	const closeLater = () => { cancelClose(); closeTimer.current = setTimeout(() => setSubmenu(null), 180); };
	const openMenu = (agent: AgentSelectorAgent, anchor: HTMLElement) => {
		cancelClose();
		setSubmenu({ agent, anchor });
		if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
		focusFrame.current = requestAnimationFrame(() => { focusFrame.current = null; submenuContent.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(); });
	};
	useEffect(() => () => { if (closeTimer.current !== null) clearTimeout(closeTimer.current); if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); }, []);
	const matching = (agent: AgentSelectorAgent) => agent.name.toLowerCase().includes(query.trim().toLowerCase());
	const availableSoftware = softwareAgents.filter((agent) => !favorites.includes(agent.id) && matching(agent));
	const availableOther = otherAgents.filter((agent) => !favorites.includes(agent.id) && matching(agent));
	const favoriteAgents = [...softwareAgents, ...otherAgents].filter((agent) => favorites.includes(agent.id) && matching(agent));
	const shownSoftware = query || expanded ? availableSoftware : availableSoftware.slice(0, 3);
	const toggleFavorite = (agentId: string, restoreFocus: boolean) => {
		if (favorites.includes(agentId) && softwareIds.includes(agentId)) setExpanded(true);
		setFavorites((current) => current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]);
		setSubmenu(null);
		if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
		if (restoreFocus) focusFrame.current = requestAnimationFrame(() => { focusFrame.current = null; root.current?.querySelector<HTMLButtonElement>(`[data-favorite-id="${agentId}"]`)?.focus(); });
	};
	const renderRow = (agent: AgentSelectorAgent) => {
		const favorite = favorites.includes(agent.id);
		const hasSubmenu = Boolean(submenuLabels[agent.id]);
		const hasTrailingIcon = hasSubmenu || selected === agent.id;
		return (
			<div key={agent.id} className="group/agent relative flex h-9 items-center rounded-md hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered" onPointerEnter={(event) => {
				cancelClose();
				if (hasSubmenu) setSubmenu({ agent, anchor: event.currentTarget });
				else setSubmenu(null);
			}} onPointerLeave={closeLater}>
				<button type="button" aria-haspopup={hasSubmenu ? "menu" : undefined} aria-expanded={hasSubmenu ? submenu?.agent.id === agent.id : undefined} aria-pressed={hasSubmenu ? undefined : selected === agent.id} className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-md pl-2 pr-14 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={(event) => { if (hasSubmenu) openMenu(agent, event.currentTarget.parentElement ?? event.currentTarget); else setSelected(agent.id); }} onKeyDown={(event) => { if (hasSubmenu && event.key === "ArrowRight") { event.preventDefault(); openMenu(agent, event.currentTarget.parentElement ?? event.currentTarget); } }}>
					<span aria-hidden className="grid size-6 shrink-0 place-items-center"><AgentAvatarVisual appearance={agent.brandName === "openai-codex" || agent.brandName === "cursor" || agent.brandName === "github-copilot" ? "coding" : undefined} avatarSrc={agent.avatarSrc} brandName={agent.brandName} vpkLogo={agent.vpkLogo} logoName={agent.logoName} fallbackText={agent.name.slice(0, 2).toUpperCase()} label={agent.name} sizePx={24} /></span>
					<span className="menu-row-title min-w-0 flex-1 text-left">{agent.name}</span>
				</button>
				<FavoriteButton id={agent.id} name={agent.name} favorite={favorite} className={hasTrailingIcon ? "absolute right-7" : "absolute right-1.5"} onToggle={(restoreFocus) => toggleFavorite(agent.id, restoreFocus)} />
				{hasSubmenu ? <Icon aria-hidden className="pointer-events-none absolute right-1.5 text-icon-subtle" render={<ChevronRightIcon label="" size="small" />} /> : null}
				{!hasSubmenu && selected === agent.id ? <CheckIcon aria-hidden className="pointer-events-none absolute right-1.5 text-icon-subtle" size="small" /> : null}
			</div>
		);
	};
	return (
		<div ref={root} className="flex h-[26rem] w-80 max-w-full flex-col overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground shadow-2xl">
			<div className="-mx-1 -mt-1 mb-1 shrink-0 overflow-hidden rounded-t-xl"><RichTextCommandMenuSearchField icon={<SearchIcon className="size-4 text-icon-subtle" />} label="Search agents" value={query} onValueChange={(value) => { setQuery(value); setSubmenu(null); }} onClear={() => setQuery("")} /></div>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
				{favoriteAgents.length ? <section aria-label="Favorites"><h3 className="px-2 pt-2 pb-1 text-xs font-semibold text-text-subtlest">Favorites</h3>{favoriteAgents.map(renderRow)}</section> : null}
				{shownSoftware.length ? <section aria-label="Software agents"><h3 className="px-2 pt-2 pb-1 text-xs font-semibold text-text-subtlest">Software agents</h3>{shownSoftware.map(renderRow)}{!query && !expanded && availableSoftware.length > 3 ? <button type="button" className="h-8 px-2 text-xs text-text-subtlest hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setExpanded(true)}>Show more</button> : null}</section> : null}
				{availableOther.length ? <section aria-label="Other agents"><h3 className="px-2 pt-2 pb-1 text-xs font-semibold text-text-subtlest">Other agents</h3>{availableOther.map(renderRow)}</section> : null}
				{!favoriteAgents.length && !shownSoftware.length && !availableOther.length ? <p className="p-4 text-sm text-text-subtle">No agents found</p> : null}
			</div>
			<div className="shrink-0 border-t border-border pt-1"><Button type="button" variant="ghost" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal text-text-subtle"><Icon aria-hidden className="size-6" render={<AiAgentIcon label="" size="small" />} />Browse agents</Button><Button type="button" variant="ghost" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal text-text-subtle"><Icon aria-hidden className="size-6" render={<AddIcon label="" size="small" />} />Create agent</Button></div>
			<Popover open={submenu !== null} onOpenChange={(open) => { if (!open) setSubmenu(null); }}>
				{submenu ? <PopoverContent ref={submenuContent} anchor={submenu.anchor} aria-label={`Run ${submenu.agent.name} on`} role="menu" initialFocus={false} finalFocus={false} side="right" align="start" sideOffset={0} className="w-70 gap-0 p-1" onPointerEnter={cancelClose} onPointerLeave={closeLater} onKeyDown={(event) => {
					if (event.key === "Escape" || event.key === "ArrowLeft") { event.preventDefault(); event.stopPropagation(); setSubmenu(null); submenu.anchor.querySelector<HTMLButtonElement>("button")?.focus(); }
					else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]; const index = items.findIndex((item) => item === document.activeElement); items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus(); }
				}}>
					{submenu.agent.id === "test-agent" ? <><div className="px-2 pt-2 pb-1 text-xs font-medium text-text-subtle">Run on cloud</div><Button role="menuitem" variant="ghost" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal"><Icon aria-hidden render={<AiChatIcon label="" size="small" />} />Continue with last session</Button><Button role="menuitem" variant="ghost" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal"><Icon aria-hidden render={<AddIcon label="" size="small" />} />Start a new session</Button><hr className="my-1 border-0 border-t border-border" /></> : <Button role="menuitem" variant="ghost" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal"><Icon aria-hidden render={<CloudIcon label="" size="small" />} />Run on cloud</Button>}
					<Button role="menuitem" variant="ghost" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal" aria-disabled={submenu.agent.id === "release-agent" ? true : undefined}><Icon aria-hidden render={<ScreenIcon label="" size="small" />} />{submenuLabels[submenu.agent.id]}</Button>
				</PopoverContent> : null}
			</Popover>
		</div>
	);
}
