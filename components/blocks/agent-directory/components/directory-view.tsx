"use client";

import { useId, useState, type ReactNode } from "react";
import DataVisualizationMetricIcon from "@atlaskit/icon-lab/core/data-visualization-metric";
import FilterIcon from "@atlaskit/icon/core/filter";
import GridIcon from "@atlaskit/icon/core/grid";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import QuestionCircleIcon from "@atlaskit/icon/core/question-circle";
import RovoChatIcon from "@atlaskit/icon/core/rovo-chat";
import SearchIcon from "@atlaskit/icon/core/search";
import TaskIcon from "@atlaskit/icon/core/task";
import TeamsIcon from "@atlaskit/icon/core/teams";

import type { AgentBrowserAgent } from "@/components/blocks/agent-browser";
import type { AgentTemplatesAgent, AgentTemplatesCategoryId } from "@/components/blocks/agent-templates";
import { AgentLanyard, AGENT_LANYARD_COLLECTIONS } from "@/components/blocks/agent-lanyard";
import { AgentLanyardActions } from "@/components/blocks/agent-lanyard/components/agent-lanyard-actions";
import { AgentLanyardFirstPartyAvatar } from "@/components/blocks/agent-lanyard/agent-lanyard-first-party-avatar";
import { AgentLanyardMenu } from "@/components/blocks/agent-lanyard/agent-lanyard-menu";
import { customFirstPartyBadge } from "@/components/blocks/agent-lanyard/first-party-badges";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
	DEFAULT_DIRECTORY_FILTERS,
	DIRECTORY_APP_OPTIONS,
	DIRECTORY_CATEGORIES,
	DIRECTORY_GRID_CLASS_NAME,
	DIRECTORY_OWNER_OPTIONS,
	DIRECTORY_SORT_OPTIONS,
	DIRECTORY_TABS,
	filterDirectoryAgents,
	getCodingLanyard,
	getDirectoryCollection,
	getDirectoryPublisher,
	getDirectoryRecommendations,
	getFirstPartyLanyard,
	isDirectoryAgentOwned,
	toDirectoryLanyard,
	toDirectoryTemplate,
	type DirectoryCategory,
	type DirectoryFilters,
	type DirectoryTab,
} from "../data/directory-view-data";

export interface AgentDirectoryViewProps {
	agents: readonly AgentBrowserAgent[];
	templateAgents: readonly AgentTemplatesAgent[];
	ownedAgentIds?: readonly string[];
	initialTemplateCategory?: AgentTemplatesCategoryId | null;
	onSelectAgent?: (agent: AgentBrowserAgent) => void;
	onSelectTemplateAgent?: (agent: AgentTemplatesAgent) => void;
	onCreateAgent?: () => void;
}

interface DirectoryAgentActions {
	onSelectAgent?: (agent: AgentBrowserAgent) => void;
	onToggleStar: (agent: AgentBrowserAgent) => void;
	isStarred: (agent: AgentBrowserAgent) => boolean;
}

function DirectorySection({
	title, description, children, action,
}: Readonly<{ title: string; description?: string; children: ReactNode; action?: ReactNode }>) {
	return (
		<section className="flex min-w-0 flex-col gap-4">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 space-y-1">
					<Heading as="h2" size="small">{title}</Heading>
					{description ? <p className="text-sm text-text-subtle">{description}</p> : null}
				</div>
				{action}
			</div>
			{children}
		</section>
	);
}

function DirectoryCardAvatar({ agent }: Readonly<{ agent: AgentBrowserAgent }>) {
	const known = getFirstPartyLanyard(agent);
	if (known) return <AgentLanyardFirstPartyAvatar badge={known.badge} backgroundColor={known.accentColor} />;
	if (agent.avatarSrc || agent.brandName || agent.logoName) {
		return (
			<span className="absolute top-6.5 left-1/2 z-10 -translate-x-1/2">
				<AgentAvatarVisual avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} sizePx={48} animate={false} label="" />
			</span>
		);
	}
	const collection = getDirectoryCollection(agent);
	return <AgentLanyardFirstPartyAvatar badge={customFirstPartyBadge(collection)} backgroundColor={AGENT_LANYARD_COLLECTIONS[collection].color} />;
}

function DirectoryAgentCard({
	agent, onSelectAgent, onToggleStar, isStarred,
}: Readonly<{ agent: AgentBrowserAgent } & DirectoryAgentActions>) {
	const lanyard = toDirectoryLanyard(agent);
	return (
		<div className="relative min-w-0">
			<AgentLanyard
				agent={lanyard}
				className="w-full"
				onSelect={onSelectAgent ? () => onSelectAgent(agent) : undefined}
				avatar={getCodingLanyard(agent) ? undefined : <DirectoryCardAvatar agent={agent} />}
				footer={
					<div className="relative z-20 w-full">
						<AgentLanyardActions
							agent={lanyard}
							onAction={onSelectAgent ? () => onSelectAgent(agent) : undefined}
							starred={isStarred(agent)}
							menuPositionerClassName="z-[520]"
							menuActions={{
								onViewProfile: onSelectAgent ? () => onSelectAgent(agent) : undefined,
								onToggleStar: () => onToggleStar(agent),
							}}
						/>
					</div>
				}
			/>
		</div>
	);
}

function DirectoryHero({
	agent, onSelectAgent, onToggleStar, isStarred,
}: Readonly<{ agent: AgentBrowserAgent } & DirectoryAgentActions>) {
	const lanyard = toDirectoryLanyard(agent);
	return (
		<article aria-label={`${agent.name} recommendation`} className="flex h-54 min-w-0 gap-6 overflow-clip rounded-xl bg-bg-neutral p-8 max-sm:h-auto max-sm:min-h-54 max-sm:gap-4 max-sm:px-5">
			<div className="flex min-w-0 flex-1 flex-col justify-between">
				<p className="line-clamp-4 text-base leading-6 text-text max-sm:line-clamp-none">{agent.description || agent.name}</p>
				<div className="flex items-center gap-1">
					<Button size="compact" variant="outline" disabled={!onSelectAgent} onClick={onSelectAgent ? () => onSelectAgent(agent) : undefined} aria-label={`Chat with ${agent.name}`}>
						<Icon render={<RovoChatIcon label="" size="small" />} />Chat
					</Button>
					<AgentLanyardMenu agent={lanyard} starred={isStarred(agent)} positionerClassName="z-[520]" actions={{ onViewProfile: onSelectAgent ? () => onSelectAgent(agent) : undefined, onToggleStar: () => onToggleStar(agent) }} />
				</div>
			</div>
			<div className="relative h-46 w-53 shrink-0 self-start [clip-path:inset(-16px_-16px_0_-16px)] max-sm:w-40">
				<AgentLanyard agent={lanyard} className="w-full" showDescription={false} onSelect={onSelectAgent ? () => onSelectAgent(agent) : undefined} footer={<span />} avatar={getCodingLanyard(agent) ? undefined : <DirectoryCardAvatar agent={agent} />} />
			</div>
		</article>
	);
}

function DirectoryTemplateCard({
	agent, onSelectAgent,
}: Readonly<{ agent: AgentTemplatesAgent; onSelectAgent?: (agent: AgentTemplatesAgent) => void }>) {
	return (
		<div className="relative min-w-0">
			<AgentLanyard variant="template" template={toDirectoryTemplate(agent)} className="w-full" onSelect={onSelectAgent ? () => onSelectAgent(agent) : undefined} />
		</div>
	);
}

function DirectoryCompactAgent({ agent, onSelectAgent }: Readonly<{
	agent: AgentBrowserAgent; onSelectAgent?: (agent: AgentBrowserAgent) => void;
}>) {
	const content = (
		<>
			<AgentAvatarVisual avatarSrc={agent.avatarSrc} brandName={agent.brandName} logoName={agent.logoName} fallbackText={agent.name.slice(0, 1)} sizePx={32} animate={false} label="" />
			<span className="flex min-w-0 flex-1 flex-col text-left">
				<span className="truncate text-sm font-medium text-text">{agent.name}</span>
				<span className="truncate text-xs text-text-subtle">{getDirectoryPublisher(agent)}</span>
			</span>
		</>
	);
	const className = "flex h-18 min-w-0 items-center gap-4 rounded-lg border border-border bg-surface px-5";
	return onSelectAgent ? (
		<button type="button" className={cn(className, "cursor-pointer hover:bg-surface-hovered focus-visible:ring-3 focus-visible:ring-ring/50 outline-none")} onClick={() => onSelectAgent(agent)}>{content}</button>
	) : <div className={cn(className)}>{content}</div>;
}

function DirectoryAgentGrid({ agents, list = false, ...actions }: Readonly<{
	agents: readonly AgentBrowserAgent[]; list?: boolean;
} & DirectoryAgentActions>) {
	return (
		<div className={cn("-m-1 p-1", list ? "flex flex-col gap-3" : DIRECTORY_GRID_CLASS_NAME)}>
			{agents.map((agent) => list
				? <DirectoryCompactAgent key={agent.id} agent={agent} onSelectAgent={actions.onSelectAgent} />
				: <DirectoryAgentCard key={agent.id} agent={agent} {...actions} />)}
		</div>
	);
}

const CATEGORY_ICONS = {
	data: DataVisualizationMetricIcon,
	team: TeamsIcon,
	work: TaskIcon,
	service: QuestionCircleIcon,
};

function DirectoryCategories({ onSelect }: Readonly<{ onSelect: (category: DirectoryCategory) => void }>) {
	return (
		<DirectorySection title="Browse by category" description="Agents for every use case">
			<div className={cn(DIRECTORY_GRID_CLASS_NAME, "-m-1 p-1")}>
				{DIRECTORY_CATEGORIES.map((category) => {
					const CategoryIcon = CATEGORY_ICONS[category.id];
					return (
						<button key={category.id} type="button" onClick={() => onSelect(category.id)} className="flex h-42 cursor-pointer flex-col items-start justify-center gap-4 rounded-xl border border-border bg-surface p-6 text-left text-text outline-none hover:bg-surface-hovered focus-visible:ring-3 focus-visible:ring-ring/50">
							<span className="flex size-10 items-center justify-center rounded-md bg-bg-neutral text-icon"><Icon render={<CategoryIcon label="" />} /></span>
							<span className="text-base font-medium">{category.label}</span>
						</button>
					);
				})}
			</div>
		</DirectorySection>
	);
}

function DirectoryFilterSelect<Value extends string>({
	label, value, options, onChange,
}: Readonly<{ label: string; value: Value; options: readonly { value: Value; label: string }[]; onChange: (value: Value) => void }>) {
	const id = useId();
	return (
		<div className="space-y-1.5">
			<label htmlFor={id} className="text-xs font-medium text-text-subtle">{label}</label>
			<Select value={value} items={options} onValueChange={(next) => { if (next !== null) onChange(next); }}>
				<SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
				<SelectContent positionerClassName="z-[540]">{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
			</Select>
		</div>
	);
}

function DirectoryFiltersPopover({ filters, onChange }: Readonly<{
	filters: Readonly<DirectoryFilters>; onChange: (filters: DirectoryFilters) => void;
}>) {
	const [open, setOpen] = useState(false);
	const activeCount = Object.entries(filters).filter(([key, value]) => key === "sort" ? value !== "relevance" : value !== "all").length;
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger render={<Button variant="outline"><Icon render={<FilterIcon label="" />} />Filter{activeCount > 0 ? ` (${activeCount})` : ""}</Button>} />
			<PopoverContent align="end" positionerClassName="z-[530]" className="w-69 gap-4 p-4" aria-label="Filter agents">
				<DirectoryFilterSelect label="Sort by" value={filters.sort} options={DIRECTORY_SORT_OPTIONS} onChange={(sort) => onChange({ ...filters, sort })} />
				<DirectoryFilterSelect label="Owner" value={filters.owner} options={DIRECTORY_OWNER_OPTIONS} onChange={(owner) => onChange({ ...filters, owner })} />
				<DirectoryFilterSelect label="Works with" value={filters.app} options={DIRECTORY_APP_OPTIONS} onChange={(app) => onChange({ ...filters, app })} />
				<DirectoryFilterSelect label="Use case" value={filters.category} options={[{ value: "all", label: "All use cases" }, ...DIRECTORY_CATEGORIES.map((category) => ({ value: category.id, label: category.label }))]} onChange={(category) => onChange({ ...filters, category })} />
				<Button variant="ghost" onClick={() => onChange({ ...DEFAULT_DIRECTORY_FILTERS })}>Clear filters</Button>
			</PopoverContent>
		</Popover>
	);
}

function DirectoryEmpty({ onClear, onCreateAgent }: Readonly<{ onClear: () => void; onCreateAgent?: () => void }>) {
	return (
		<div className="flex flex-col items-center gap-3 rounded-xl bg-surface-sunken px-6 py-12 text-center">
			<Heading as="h3" size="small">No agents found</Heading>
			<p className="text-sm text-text-subtle">Try a different search or clear your filters.</p>
			<div className="flex gap-2"><Button variant="outline" onClick={onClear}>Clear search and filters</Button>{onCreateAgent ? <Button onClick={onCreateAgent}>Create agent</Button> : null}</div>
		</div>
	);
}

function DirectoryViewMode({ list, onChange }: Readonly<{ list: boolean; onChange: (list: boolean) => void }>) {
	return (
		<div className="flex gap-1" aria-label="Agent view">
			<Button variant="ghost" size="icon" aria-label="Grid view" aria-pressed={!list} onClick={() => onChange(false)}><Icon render={<GridIcon label="" />} /></Button>
			<Button variant="ghost" size="icon" aria-label="List view" aria-pressed={list} onClick={() => onChange(true)}><Icon render={<ListBulletedIcon label="" />} /></Button>
		</div>
	);
}

function DirectoryRecommendations({ agents, templateAgents, onSelectTemplateAgent, onCategorySelect, ...actions }: Readonly<{
	agents: readonly AgentBrowserAgent[];
	templateAgents: readonly AgentTemplatesAgent[];
	onSelectTemplateAgent?: (agent: AgentTemplatesAgent) => void;
	onCategorySelect: (category: DirectoryCategory) => void;
} & DirectoryAgentActions>) {
	const { featured, coding, recommended, popular } = getDirectoryRecommendations(agents);
	return (
		<>
			{featured.length > 0 ? (
				<DirectorySection title="Our top recommendations for you" description="Based on your role, usage, team and more">
					<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] gap-4">{featured.map((agent) => <DirectoryHero key={agent.id} agent={agent} {...actions} />)}</div>
				</DirectorySection>
			) : null}
			{coding.length > 0 ? <DirectorySection title="Coding agents" description="Automate your code workflow with these frontier AI partners"><DirectoryAgentGrid agents={coding} {...actions} /></DirectorySection> : null}
			<DirectoryCategories onSelect={onCategorySelect} />
			{recommended.length > 0 ? <DirectorySection title="Recommended for Jira" description="Your closest collaborators love these agents"><DirectoryAgentGrid agents={recommended} {...actions} /></DirectorySection> : null}
			{popular.length > 0 ? <DirectorySection title="Popular with your team" description="Your closest collaborators love these agents"><div className={cn(DIRECTORY_GRID_CLASS_NAME, "-m-1 p-1")}>{popular.map((agent) => <DirectoryCompactAgent key={agent.id} agent={agent} onSelectAgent={actions.onSelectAgent} />)}</div></DirectorySection> : null}
			{templateAgents.length > 0 ? <DirectorySection title="Templates" description="Can’t find what you’re looking for? Remix a template"><div className={cn(DIRECTORY_GRID_CLASS_NAME, "-m-1 p-1")}>{templateAgents.slice(0, 4).map((agent) => <DirectoryTemplateCard key={agent.id} agent={agent} onSelectAgent={onSelectTemplateAgent} />)}</div></DirectorySection> : null}
		</>
	);
}

export function AgentDirectoryView({
	agents, templateAgents, ownedAgentIds = [], initialTemplateCategory = null, onSelectAgent, onSelectTemplateAgent, onCreateAgent,
}: Readonly<AgentDirectoryViewProps>) {
	const [tab, setTab] = useState<DirectoryTab>(initialTemplateCategory ? "templates" : "recommended");
	const [templateCategory, setTemplateCategory] = useState(initialTemplateCategory);
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<DirectoryFilters>({ ...DEFAULT_DIRECTORY_FILTERS });
	const [list, setList] = useState(false);
	const [starOverrides, setStarOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());
	const isStarred = (agent: AgentBrowserAgent) => starOverrides.get(agent.id) ?? agent.favorite ?? false;
	const onToggleStar = (agent: AgentBrowserAgent) => {
		setStarOverrides((previous) => new Map(previous).set(agent.id, !(previous.get(agent.id) ?? agent.favorite ?? false)));
	};
	const actions = { onSelectAgent, onToggleStar, isStarred };
	const hasSearch = query.trim().length > 0;
	const hasFilters = filters.owner !== "all" || filters.app !== "all" || filters.category !== "all" || filters.sort !== "relevance";
	const visibleAgents = filterDirectoryAgents(agents, query, filters, ownedAgentIds);
	const visibleTemplates = filterDirectoryAgents(templateAgents, query, filters, ownedAgentIds).filter((agent) =>
		!templateCategory || hasSearch || tab !== "templates" || agent.categoryId === templateCategory,
	);
	const ownedAgents = visibleAgents.filter((agent) => ownedAgentIds.includes(agent.id) || isDirectoryAgentOwned(agent));
	const starredAgents = visibleAgents.filter(isStarred);
	const tabAgents = tab === "verified" ? visibleAgents.filter((agent) => agent.verified) : visibleAgents;
	const clearSearch = () => { setQuery(""); setFilters({ ...DEFAULT_DIRECTORY_FILTERS }); };
	const empty = <DirectoryEmpty onClear={clearSearch} onCreateAgent={onCreateAgent} />;
	let content: ReactNode;
	if (hasSearch || (tab === "recommended" && hasFilters)) {
		content = visibleAgents.length + visibleTemplates.length > 0 ? (
			<>
				<DirectorySection title={`${visibleAgents.length} ${visibleAgents.length === 1 ? "agent" : "agents"}`} action={<DirectoryViewMode list={list} onChange={setList} />}>
					{visibleAgents.length > 0 ? <DirectoryAgentGrid agents={visibleAgents} list={list} {...actions} /> : <p className="text-sm text-text-subtle">No matching agents. Browse matching templates below.</p>}
				</DirectorySection>
				{visibleTemplates.length > 0 ? <DirectorySection title="Templates"><div className={cn(DIRECTORY_GRID_CLASS_NAME, "-m-1 p-1")}>{visibleTemplates.map((agent) => <DirectoryTemplateCard key={agent.id} agent={agent} onSelectAgent={onSelectTemplateAgent} />)}</div></DirectorySection> : null}
			</>
		) : empty;
	} else if (tab === "recommended") {
		content = agents.length + templateAgents.length > 0 ? <DirectoryRecommendations agents={visibleAgents} templateAgents={visibleTemplates} onSelectTemplateAgent={onSelectTemplateAgent} onCategorySelect={(category) => { setFilters((previous) => ({ ...previous, category })); setTab("all-agents"); }} {...actions} /> : empty;
	} else if (tab === "templates") {
		content = <DirectorySection title="Templates" description="Start with a template and make it your own">{visibleTemplates.length > 0 ? <div className={cn(DIRECTORY_GRID_CLASS_NAME, "-m-1 p-1")}>{visibleTemplates.map((agent) => <DirectoryTemplateCard key={agent.id} agent={agent} onSelectAgent={onSelectTemplateAgent} />)}</div> : empty}</DirectorySection>;
	} else if (tab === "your-agents") {
		content = ownedAgents.length + starredAgents.length > 0 ? <>{ownedAgents.length > 0 ? <DirectorySection title="Owned by you"><DirectoryAgentGrid agents={ownedAgents} {...actions} /></DirectorySection> : null}{starredAgents.length > 0 ? <DirectorySection title="Starred by you"><DirectoryAgentGrid agents={starredAgents} {...actions} /></DirectorySection> : null}</> : empty;
	} else {
		content = <DirectorySection title={tab === "verified" ? "Verified by your administrators" : `${tabAgents.length} ${tabAgents.length === 1 ? "agent" : "agents"}`} description={tab === "verified" ? "Agents reviewed and verified by your organization" : undefined} action={tab === "all-agents" ? <DirectoryViewMode list={list} onChange={setList} /> : undefined}>{tabAgents.length > 0 ? <DirectoryAgentGrid agents={tabAgents} list={list} {...actions} /> : empty}</DirectorySection>;
	}
	return (
		<Tabs value={tab} onValueChange={(value) => { const next = DIRECTORY_TABS.find((candidate) => candidate.id === value); if (next) { setTab(next.id); setQuery(""); setTemplateCategory(null); } }} className="min-w-0 gap-10" data-slot="agent-directory-view">
			<div className="flex flex-wrap items-center justify-between gap-4 py-1">
				<div className="-m-1 max-w-full overflow-x-auto p-1">
					<TabsList aria-label="Browse agents">{DIRECTORY_TABS.map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<InputGroup className="w-38">
						<InputGroupAddon><Icon render={<SearchIcon label="" />} /></InputGroupAddon>
						<InputGroupInput type="search" aria-label="Search agents" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
					</InputGroup>
					<DirectoryFiltersPopover filters={filters} onChange={setFilters} />
					{onCreateAgent ? <Button variant="outline" onClick={onCreateAgent}>Create agent</Button> : null}
				</div>
			</div>
			{DIRECTORY_TABS.map((item) => <TabsContent key={item.id} value={item.id} keepMounted={false} className="flex min-w-0 flex-col gap-15">{item.id === tab ? content : null}</TabsContent>)}
		</Tabs>
	);
}
