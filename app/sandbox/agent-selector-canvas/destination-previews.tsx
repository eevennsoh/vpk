"use client";

import { useEffect, useRef, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import type { AgentSelectorAgent } from "@/components/blocks/agent-selector";
import { BUTTER_PICKER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agent-catalog";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { RichTextCommandMenuSearchField } from "@/components/ui-custom/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SearchIcon } from "@/components/ui/vpk-icons";
import { FavoriteButton } from "@/components/blocks/agent-selector/components/favorite-button";

type Destination = "cloud" | "local";
type Approach = "remember" | "global" | "row-actions" | "after-select";
const softwareIds = ["jira-coding", "claude-code", "test-agent", "review-agent", "release-agent"];
const software = softwareIds.flatMap((id) => BUTTER_PICKER_AGENTS.filter((agent) => agent.id === id));
const others = BUTTER_PICKER_AGENTS.filter((agent) => !softwareIds.includes(agent.id) && agent.id !== "rovo-cli" && agent.id !== "github-copilot");
const localLabels: Readonly<Record<string, string>> = { "claude-code": "Claude", "test-agent": "Cursor", "review-agent": "Codex" };

function DestinationPreview({ approach }: Readonly<{ approach: Approach }>) {
	const [query, setQuery] = useState("");
	const [expanded, setExpanded] = useState(false);
	const [favorites, setFavorites] = useState<readonly string[]>([]);
	const [destinations, setDestinations] = useState<Readonly<Record<string, Destination>>>({});
	const [globalDestination, setGlobalDestination] = useState<Destination>("cloud");
	const [active, setActive] = useState<AgentSelectorAgent | null>(null);
	const [feedback, setFeedback] = useState("");
	const root = useRef<HTMLDivElement>(null);
	const focusFrame = useRef<number | null>(null);
	const focusAfterRender = (selector: string) => {
		if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
		focusFrame.current = requestAnimationFrame(() => { focusFrame.current = null; root.current?.querySelector<HTMLButtonElement>(selector)?.focus(); });
	};
	useEffect(() => () => { if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); }, []);
	const matches = (agent: AgentSelectorAgent) => agent.name.toLowerCase().includes(query.trim().toLowerCase());
	const favoriteAgents = [...software, ...others].filter((agent) => favorites.includes(agent.id) && matches(agent));
	const softwareAgents = software.filter((agent) => !favorites.includes(agent.id) && matches(agent));
	const otherAgents = others.filter((agent) => !favorites.includes(agent.id) && matches(agent));
	const shownSoftware = query || expanded ? softwareAgents : softwareAgents.slice(0, 3);
	const simulate = (agent: AgentSelectorAgent, action: string) => setFeedback(`${action} · ${agent.name} (preview)`);
	const chooseDestination = (agent: AgentSelectorAgent, destination: Destination) => {
		setDestinations((current) => ({ ...current, [agent.id]: destination }));
		setFeedback(`${agent.name} will use ${destination === "cloud" ? "Cloud" : "Local"}`);
	};
	const execute = (agent: AgentSelectorAgent, destination: Destination) => {
		if (destination === "local" && !localLabels[agent.id]) {
			setFeedback(`${agent.name} is available on Cloud`);
			return;
		}
		simulate(agent, destination === "local" ? "Open locally" : agent.id === "test-agent" ? "Continue session on Cloud" : "Start on Cloud");
	};
	const avatar = (agent: AgentSelectorAgent) => <span aria-hidden className="grid size-6 shrink-0 place-items-center"><AgentAvatarVisual appearance={agent.brandName === "openai-codex" || agent.brandName === "cursor" || agent.brandName === "github-copilot" ? "coding" : undefined} avatarSrc={agent.avatarSrc} brandName={agent.brandName} vpkLogo={agent.vpkLogo} logoName={agent.logoName} fallbackText={agent.name.slice(0, 2).toUpperCase()} label={agent.name} sizePx={24} /></span>;
	const actionButtons = (agent: AgentSelectorAgent) => <div className="flex flex-col gap-1 px-2 pb-2 pl-11">
		{agent.id === "test-agent" ? <Button type="button" variant="ghost" className="h-8 justify-start px-2 text-sm font-normal" onClick={() => simulate(agent, "Continue session on Cloud")}>Continue cloud session</Button> : null}
		<Button type="button" variant="ghost" className="h-8 justify-start px-2 text-sm font-normal" onClick={() => simulate(agent, "Start on Cloud")}>Start new on Cloud</Button>
		{localLabels[agent.id] ? <Button type="button" variant="ghost" className="h-8 justify-start px-2 text-sm font-normal" onClick={() => simulate(agent, "Open locally")}>Open in {localLabels[agent.id]}</Button> : null}
	</div>;
	const row = (agent: AgentSelectorAgent) => {
		const favorite = favorites.includes(agent.id);
		const local = Boolean(localLabels[agent.id]);
		const destination = approach === "global" ? globalDestination : destinations[agent.id] ?? "cloud";
		return <div key={agent.id} className="group/agent rounded-md hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
			<div className="flex min-h-9 items-center gap-1 pl-2 pr-1.5">
				<button data-agent-id={agent.id} type="button" className="flex min-h-9 min-w-0 flex-1 items-center gap-3 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => {
					if (approach === "after-select") { setActive(agent); focusAfterRender("[data-destination-back]"); }
					else if (approach === "row-actions") setFeedback(`Choose Cloud or Local for ${agent.name}`);
					else execute(agent, destination);
				}}>{avatar(agent)}<span className="menu-row-title min-w-0 flex-1 truncate">{agent.name}</span></button>
				{approach === "global" && destination === "local" && !local ? <span className="text-xs text-text-subtlest">Cloud only</span> : null}
				{(approach === "remember" || approach === "global") && agent.id === "test-agent" && destination === "cloud" ? <Button type="button" size="compact" variant="ghost" className="h-6 px-1 text-xs opacity-0 group-hover/agent:opacity-100 group-focus-within/agent:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Start a new Cursor session on Cloud" onClick={() => simulate(agent, "Start new on Cloud")}>New</Button> : null}
				{approach === "remember" ? <button type="button" disabled={!local} aria-label={`Change destination for ${agent.name}, currently ${destination}`} className="rounded-sm px-1 text-xs text-text-subtle focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60" onClick={() => chooseDestination(agent, destination === "cloud" ? "local" : "cloud")}>{destination === "cloud" ? "Cloud" : "Local"}</button> : null}
				{approach === "row-actions" ? <div className="flex gap-1 opacity-0 group-hover/agent:opacity-100 group-focus-within/agent:opacity-100 [@media(hover:none)]:opacity-100"><Button type="button" size="compact" variant="ghost" className="h-6 px-1 text-xs" aria-label={agent.id === "test-agent" ? "Continue Cursor cloud session" : `Run ${agent.name} on Cloud`} onClick={() => execute(agent, "cloud")}>{agent.id === "test-agent" ? "Resume" : "Cloud"}</Button>{agent.id === "test-agent" ? <Button type="button" size="compact" variant="ghost" className="h-6 px-1 text-xs" aria-label="Start a new Cursor session on Cloud" onClick={() => simulate(agent, "Start new on Cloud")}>New</Button> : null}{local ? <Button type="button" size="compact" variant="ghost" className="h-6 px-1 text-xs" aria-label={`Open ${agent.name} locally`} onClick={() => execute(agent, "local")}>Local</Button> : null}</div> : null}
				<FavoriteButton id={agent.id} name={agent.name} favorite={favorite} onToggle={(restoreFocus) => { setFavorites((current) => current.includes(agent.id) ? current.filter((id) => id !== agent.id) : [...current, agent.id]); setActive(null); if (favorite && softwareIds.includes(agent.id)) setExpanded(true); if (restoreFocus) focusAfterRender(`[data-favorite-id="${agent.id}"]`); }} />
			</div>
		</div>;
	};
	const section = (name: string, agents: readonly AgentSelectorAgent[]) => agents.length ? <section aria-label={name}><h3 className="px-2 pt-2 pb-1 text-xs font-semibold text-text-subtlest">{name}</h3>{agents.map(row)}{name === "Software agents" && !query && !expanded && softwareAgents.length > 3 ? <button type="button" className="h-8 px-2 text-xs text-text-subtlest hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setExpanded(true)}>Show more</button> : null}</section> : null;
	return <div ref={root} className="flex h-[26rem] w-80 max-w-full flex-col overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground shadow-2xl">
		{approach === "after-select" && active ? <>
			<div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-2"><Button data-destination-back type="button" size="compact" variant="ghost" onClick={() => { setActive(null); focusAfterRender(`[data-agent-id="${active.id}"]`); }}>Back</Button>{avatar(active)}<span className="truncate text-sm font-medium">{active.name}</span></div>
			<div className="min-h-0 flex-1 overflow-y-auto pt-2"><p className="px-3 pb-2 text-xs font-semibold text-text-subtlest">Choose where to run</p>{actionButtons(active)}</div>
		</> : <>
			<div className="-mx-1 -mt-1 mb-1 shrink-0 overflow-hidden rounded-t-xl"><RichTextCommandMenuSearchField icon={<SearchIcon className="size-4 text-icon-subtle" />} label="Search agents" value={query} onValueChange={setQuery} onClear={() => setQuery("")} /></div>
			{approach === "global" ? <div className="flex shrink-0 items-center gap-1 px-2 pb-1 text-xs text-text-subtle"><span className="mr-auto">Run on</span>{(["cloud", "local"] as const).map((destination) => <Button key={destination} type="button" size="compact" variant={globalDestination === destination ? "secondary" : "ghost"} aria-pressed={globalDestination === destination} onClick={() => { setGlobalDestination(destination); setFeedback(`Default: ${destination === "cloud" ? "Cloud" : "Local"}`); }}>{destination === "cloud" ? "Cloud" : "Local"}</Button>)}</div> : null}
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{section("Favorites", favoriteAgents)}{section("Software agents", shownSoftware)}{section("Other agents", otherAgents)}{!favoriteAgents.length && !shownSoftware.length && !otherAgents.length ? <p className="p-4 text-sm text-text-subtle">No agents found</p> : null}</div>
			<div className="shrink-0 border-t border-border pt-1"><Button type="button" variant="ghost" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal text-text-subtle" onClick={() => setFeedback("Browse agents (preview)")}><Icon aria-hidden className="size-6" render={<AiAgentIcon label="" size="small" />} />Browse agents</Button><Button type="button" variant="ghost" className="h-8 w-full justify-start gap-3 px-2 text-sm font-normal text-text-subtle" onClick={() => setFeedback("Create agent (preview)")}><Icon aria-hidden className="size-6" render={<AddIcon label="" size="small" />} />Create agent</Button></div>
		</>}
		<p role="status" className="sr-only">{feedback}</p>
		{feedback ? <div aria-hidden className="shrink-0 truncate border-t border-border px-2 py-1 text-xs text-text-subtle">{feedback}</div> : null}
	</div>;
}

export function RememberDestinationPreview() { return <DestinationPreview approach="remember" />; }
export function GlobalDestinationPreview() { return <DestinationPreview approach="global" />; }
export function RowActionsPreview() { return <DestinationPreview approach="row-actions" />; }
export { InlineAgentSelectorDemo as InlineActionsPreview } from "@/components/website/demos/blocks/inline-agent-selector-demo";
export function DestinationAfterSelectPreview() { return <DestinationPreview approach="after-select" />; }
