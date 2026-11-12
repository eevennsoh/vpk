"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.
// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import Image from "next/image";
import { type KeyboardEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, cubicBezier, motion, useReducedMotion } from "motion/react";
import AlignTextLeftIcon from "@atlaskit/icon/core/align-text-left";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CrossIcon from "@atlaskit/icon/core/cross";
import SearchIcon from "@atlaskit/icon/core/search";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import {
	AGENT_TEMPLATE_CATEGORIES,
	type AgentTemplateAgent,
	type AgentTemplateCategory,
	type AgentTemplateCategoryId,
} from "@/components/blocks/agent-template";
import { AgentCard as ExperimentalDirectoryCard } from "@/components/blocks/agent-card";
import { TemplateBuildFlow } from "@/components/blocks/agent-browser/components/template-build-flow";
import { TWGAgentCard, DEFAULT_TWG_AGENT_CARD_SUGGESTIONS } from "@/components/blocks/twg-agent-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AtlassianLogo, type AtlassianLogoName } from "@/components/ui/logo";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarNavItem } from "@/components/ui-custom/sidebar-nav-item";
import { Tile } from "@/components/ui/tile";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	EntityCardAgentCard,
	EntityCardAgentExpandedCard,
	type EntityCardCapability,
} from "@/components/ui-custom/entity-card";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export interface AgentBrowserAgent {
	id: string;
	name: string;
	byline: string;
	attributionKind?: "company" | "team" | "person";
	avatarSrc?: string;
	/** When set, renders the ADS brand logo instead of an `avatarSrc` image. */
	logoName?: AtlassianLogoName;
	/** When set, renders the upstream `@atlassian/logo-third-party` mark (3P brands). */
	brandName?: ThirdPartyLogoName;
	description?: string;
	favorite?: boolean;
	rating?: number;
	feedbackCount?: number;
	chatCount?: number;
	verified?: boolean;
}

export interface AgentBrowserSidebarGroup {
	title: string;
	agentIds?: readonly string[];
	items?: readonly AgentBrowserSidebarItem[];
	showAll?: boolean;
}

export interface AgentBrowserSidebarItem {
	id: string;
	label: string;
	avatarSrc?: string;
	/** When set, renders the ADS brand logo instead of an `avatarSrc` image. */
	logoName?: AtlassianLogoName;
	/** When set, renders the upstream `@atlassian/logo-third-party` mark (3P brands). */
	brandName?: ThirdPartyLogoName;
}

export interface AgentBrowserCategory {
	id: string;
	label: string;
}

export type AgentBrowserVariant = "default" | "experimental";

export interface AgentBrowserTemplateBuildOptions {
	appIds: readonly string[];
	connectApps: boolean;
}

export interface AgentBrowserTemplateBuildResult {
	profileId: string;
	onCancel?: () => void;
}

export interface AgentBrowserProps {
	agents: readonly AgentBrowserAgent[];
	categories?: readonly AgentBrowserCategory[];
	templateCategories?: readonly AgentTemplateCategory[];
	templateAgents?: readonly AgentTemplateAgent[];
	sidebarGroups?: readonly AgentBrowserSidebarGroup[];
	/** Template category selected when the browser first mounts (e.g. open straight onto "Planning"). */
	initialTemplateCategory?: AgentTemplateCategoryId | null;
	onSelectAgent?: (agent: AgentBrowserAgent) => void;
	onSelectTemplateAgent?: (agent: AgentTemplateAgent) => void;
	onBuildTemplateAgent?: (
		agent: AgentTemplateAgent,
		options: AgentBrowserTemplateBuildOptions
	) => AgentBrowserTemplateBuildResult | null;
	onOpenBuiltTemplateAgentConfig?: (profileId: string) => void;
	variant?: AgentBrowserVariant;
}

export interface AgentBrowserDialogProps extends AgentBrowserProps {
	onPrimaryAction?: () => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	primaryActionLabel?: string;
	title?: string;
}

const DEFAULT_CATEGORIES: readonly AgentBrowserCategory[] = [
	{ id: "all", label: "All" },
	{ id: "favorite-agents", label: "Favourite agents" },
	{ id: "my-agents", label: "My agents" },
] as const;
const DEFAULT_TEMPLATE_CATEGORIES = AGENT_TEMPLATE_CATEGORIES;
const EMPTY_TEMPLATE_AGENTS: readonly AgentTemplateAgent[] = [];
const EMPTY_TEMPLATE_CAPABILITIES: readonly EntityCardCapability[] = [];
const AGENT_BROWSER_TEMPLATE_MAX_VISIBLE_AGENTS = 8;
const AGENT_BROWSER_TEMPLATE_TAB_EXIT_TRANSITION = {
	duration: 0.13,
	ease: cubicBezier(0.6, 0.01, 0.8, 0.6),
};
const AGENT_BROWSER_TEMPLATE_TITLE_ENTER_TRANSITION = {
	duration: 0.3,
	ease: cubicBezier(0, 0.4, 0, 1),
};
const AGENT_BROWSER_TEMPLATE_CARD_ENTER_TRANSITION = {
	type: "spring",
	bounce: 0,
	visualDuration: 0.4,
} as const;
const AGENT_BROWSER_TEMPLATE_CARD_STAGGER = 0.05;
const AGENT_BROWSER_TEMPLATE_TITLE_SWAP_OFFSET = 12;
const AGENT_BROWSER_TEMPLATE_DECK_SWAP_OFFSET = 24;
const AGENT_BROWSER_TEMPLATE_CARD_ENTER_OFFSET = 16;
const AGENT_BROWSER_TEMPLATE_CARD_SCROLL_OFFSET = 376;
const AGENT_BROWSER_TEMPLATE_SCROLL_EDGE_THRESHOLD = 2;
const AGENT_BROWSER_TEMPLATE_CAROUSEL_CONTROL_TRANSITION = {
	type: "spring",
	bounce: 0,
	visualDuration: 0.2,
} as const;
const NOOP_TEMPLATE_MORE_ACTIONS = () => undefined;
// Presentation-only: the persistent Teamwork Graph card in the Templates carousel
// shows 2 suggested agents (and the matching stat number) instead of the block's
// default 3. Scoped here so the standalone block/preview/demo keep their full set.
const TWG_TEMPLATE_CARD_SUGGESTIONS = DEFAULT_TWG_AGENT_CARD_SUGGESTIONS.slice(0, 2);

type AgentBrowserTemplateMotionDirection = 1 | -1;
type AgentBrowserTemplateMotionCustom = {
	direction: AgentBrowserTemplateMotionDirection;
	shouldReduceMotion: boolean;
};

const STANDARD_AGENT_BROWSER_TEMPLATE_TITLE_VARIANTS = {
	enter: ({ direction, shouldReduceMotion }: AgentBrowserTemplateMotionCustom) => ({
		opacity: 0,
		transform: shouldReduceMotion ? "translateY(0px)" : `translateY(${AGENT_BROWSER_TEMPLATE_TITLE_SWAP_OFFSET * direction}px)`,
	}),
	center: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: AGENT_BROWSER_TEMPLATE_TITLE_ENTER_TRANSITION,
	},
	exit: ({ direction, shouldReduceMotion }: AgentBrowserTemplateMotionCustom) => ({
		opacity: 0,
		transform: shouldReduceMotion ? "translateY(0px)" : `translateY(${-AGENT_BROWSER_TEMPLATE_TITLE_SWAP_OFFSET * direction}px)`,
		transition: AGENT_BROWSER_TEMPLATE_TAB_EXIT_TRANSITION,
	}),
} as const;

const AGENT_BROWSER_TEMPLATE_GRID_VARIANTS = {
	enter: ({ direction, shouldReduceMotion }: AgentBrowserTemplateMotionCustom) => ({
		opacity: 0,
		transform: shouldReduceMotion ? "translateX(0px)" : `translateX(${AGENT_BROWSER_TEMPLATE_DECK_SWAP_OFFSET * direction}px)`,
	}),
	center: {
		opacity: 1,
		transform: "translateX(0px)",
		transition: AGENT_BROWSER_TEMPLATE_TITLE_ENTER_TRANSITION,
	},
	exit: ({ direction, shouldReduceMotion }: AgentBrowserTemplateMotionCustom) => ({
		opacity: 0,
		transform: shouldReduceMotion ? "translateX(0px)" : `translateX(${-AGENT_BROWSER_TEMPLATE_DECK_SWAP_OFFSET * direction}px)`,
		transition: AGENT_BROWSER_TEMPLATE_TAB_EXIT_TRANSITION,
	}),
} as const;

const STANDARD_AGENT_BROWSER_TEMPLATE_GRID_VARIANTS = {
	enter: ({ direction, shouldReduceMotion }: AgentBrowserTemplateMotionCustom) => ({
		opacity: 0,
		transform: shouldReduceMotion ? "translateY(0px)" : `translateY(${AGENT_BROWSER_TEMPLATE_DECK_SWAP_OFFSET * direction}px)`,
	}),
	center: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: AGENT_BROWSER_TEMPLATE_TITLE_ENTER_TRANSITION,
	},
	exit: ({ direction, shouldReduceMotion }: AgentBrowserTemplateMotionCustom) => ({
		opacity: 0,
		transform: shouldReduceMotion ? "translateY(0px)" : `translateY(${-AGENT_BROWSER_TEMPLATE_DECK_SWAP_OFFSET * direction}px)`,
		transition: AGENT_BROWSER_TEMPLATE_TAB_EXIT_TRANSITION,
	}),
} as const;

function derivePublisher(byline: string): string {
	const match = /\bby\s+(.+)$/i.exec(byline);
	return (match?.[1] ?? byline).trim();
}

function filterAgents(
	agents: readonly AgentBrowserAgent[],
	query: string,
	activeCategory: string,
): readonly AgentBrowserAgent[] {
	const normalized = query.trim().toLowerCase();
	return agents.filter((agent) => {
		if (activeCategory === "favorite-agents" && !agent.favorite) return false;
		if (!normalized) return true;

		const haystack = `${agent.name} ${agent.byline} ${agent.description ?? ""}`.toLowerCase();
		return haystack.includes(normalized);
	});
}

function filterTemplateAgents(
	agents: readonly AgentTemplateAgent[],
	query: string,
	activeCategory: AgentTemplateCategoryId | null,
): readonly AgentTemplateAgent[] {
	const normalized = query.trim().toLowerCase();
	const categoryAgents = activeCategory
		? agents.filter((agent) => agent.categoryId === activeCategory)
		: agents;
	const visibleAgents = categoryAgents.length > 0 ? categoryAgents : agents;

	return visibleAgents.filter((agent) => {
		if (!normalized) return true;

		const haystack = [
			agent.name,
			agent.byline,
			agent.publisher,
			agent.description,
			agent.sources?.map((source) => source.label).join(" "),
			agent.skills?.map((skill) => skill.label).join(" "),
		].filter(Boolean).join(" ").toLowerCase();

		return haystack.includes(normalized);
	}).slice(0, AGENT_BROWSER_TEMPLATE_MAX_VISIBLE_AGENTS);
}

function matchesAgentQuery(agent: AgentBrowserAgent, query: string): boolean {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return true;

	const haystack = `${agent.name} ${agent.byline} ${agent.description ?? ""}`.toLowerCase();
	return haystack.includes(normalized);
}

function deriveAgentCategory(agent: AgentBrowserAgent): string {
	const [prefix] = agent.byline.split(/\s+by\s+/i);
	const label = prefix.trim();
	return label.length > 0 && label !== agent.byline ? label : "General";
}

function createOptionId(label: string): string {
	return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface ExperimentalFilterOption {
	id: string;
	label: string;
	avatarSrc?: string;
	/** When set, renders the ADS brand logo instead of an `avatarSrc` image. */
	logoName?: AtlassianLogoName;
	/** When set, renders the upstream `@atlassian/logo-third-party` mark (3P brands). */
	brandName?: ThirdPartyLogoName;
}

const TEAM_PROJECT_AVATARS: readonly string[] = [
	"/avatar-project/compass.svg",
	"/avatar-project/code.svg",
	"/avatar-project/service-bell.svg",
	"/avatar-project/graph.svg",
	"/avatar-project/rocket.svg",
	"/avatar-project/lightning.svg",
	"/avatar-project/megaphone.svg",
	"/avatar-project/shield.svg",
];

function pickTeamProjectAvatar(label: string): string {
	let hash = 0;
	for (let index = 0; index < label.length; index += 1) {
		hash = (hash * 31 + label.charCodeAt(index)) | 0;
	}
	return TEAM_PROJECT_AVATARS[Math.abs(hash) % TEAM_PROJECT_AVATARS.length];
}

function getAttributionOptions(
	agents: readonly AgentBrowserAgent[],
	kind: "team" | "company",
): readonly ExperimentalFilterOption[] {
	const order: string[] = [];
	const byId = new Map<string, { label: string; agents: AgentBrowserAgent[] }>();

	for (const agent of agents) {
		if (agent.attributionKind !== kind) continue;

		const label = derivePublisher(agent.byline);
		const id = createOptionId(label);
		if (!label) continue;

		const existing = byId.get(id);
		if (existing) {
			existing.agents.push(agent);
		} else {
			order.push(id);
			byId.set(id, { label, agents: [agent] });
		}
	}

	return order.map((id) => {
		const { label, agents: members } = byId.get(id)!;

		if (kind === "team") {
			return { id, label, avatarSrc: pickTeamProjectAvatar(label) };
		}

		const logoName = members.find((member) => member.logoName)?.logoName;
		if (logoName) {
			return { id, label, logoName };
		}

		const brandName = members.find((member) => member.brandName)?.brandName;
		if (brandName) {
			return { id, label, brandName };
		}

		const brandAvatar = members.find((member) => member.avatarSrc)?.avatarSrc;
		return { id, label, avatarSrc: brandAvatar };
	});
}

function getUniqueOptions(labels: readonly string[]): readonly ExperimentalFilterOption[] {
	const seen = new Set<string>();
	const options: ExperimentalFilterOption[] = [];

	for (const label of labels) {
		const trimmed = label.trim();
		const id = createOptionId(trimmed);
		if (!trimmed || seen.has(id)) continue;

		seen.add(id);
		options.push({ id, label: trimmed });
	}

	return options;
}

function selectedOptionLabels(
	options: readonly ExperimentalFilterOption[],
	selectedValues: readonly string[],
): ReadonlySet<string> {
	const selected = new Set(selectedValues);
	return new Set(options.filter((option) => selected.has(option.id)).map((option) => option.label));
}

function toggleSelectedValue(values: readonly string[], value: string): readonly string[] {
	return values.includes(value)
		? values.filter((current) => current !== value)
		: [...values, value];
}

function getTemplateCategoryIndex(
	categories: readonly AgentTemplateCategory[],
	categoryId: AgentTemplateCategoryId,
): number {
	const categoryIndex = categories.findIndex((category) => category.id === categoryId);
	return categoryIndex >= 0 ? categoryIndex : 0;
}

function deriveTemplatePublisher(agent: AgentTemplateAgent): string {
	return agent.publisher ?? derivePublisher(agent.byline);
}

function pickAgentsByIds(
	all: readonly AgentBrowserAgent[],
	ids: readonly string[] = [],
): readonly AgentBrowserAgent[] {
	return ids
		.map((id) => all.find((agent) => agent.id === id))
		.filter((agent): agent is AgentBrowserAgent => Boolean(agent));
}

function getSidebarGroupItems(
	all: readonly AgentBrowserAgent[],
	group: AgentBrowserSidebarGroup,
): readonly AgentBrowserSidebarItem[] {
	if (group.items) return group.items;
	return pickAgentsByIds(all, group.agentIds).map((agent) => ({
		id: agent.id,
		label: agent.name,
		avatarSrc: agent.avatarSrc,
		logoName: agent.logoName,
		brandName: agent.brandName,
	}));
}

export function AgentBrowserDialog({
	onPrimaryAction,
	open,
	onOpenChange,
	primaryActionLabel,
	title = "Browse agents",
	variant = "default",
	...browserProps
}: Readonly<AgentBrowserDialogProps>) {
	// The experimental browser locks to the Templates view's natural single-card-row
	// height: the expanded template card hugs its own content (a deterministic 515px,
	// uniform across every category — see ExperimentalTemplateMode), and the dialog is
	// pinned to that height so the Agents grid scrolls inside the exact same box.
	// Switching tabs never changes the dialog height, and the card is never stretched
	// into dead space. Measured natural height (h-auto) at a tall viewport:
	//   72 (header) + 96 (search + category-chip rows + gaps) + 32 (card row pt-2 +
	//   pb-6) + 515 (card) + 12 (carousel mt-2) = 727.
	// Re-measure and re-pin if the expanded card layout changes. min() clamps to the
	// viewport on short screens; the dialog's overflow-hidden + the card's internal
	// overflow-y-auto then scroll rather than clip.
	const isExperimental = variant === "experimental";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"grid max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[1200px]",
					isExperimental
						? "h-[min(727px,calc(100svh-2rem))]"
						: "h-[min(800px,calc(100svh-2rem))]",
				)}
				showCloseButton={false}
			>
				<div className="flex items-center justify-between px-6 pt-6 pb-4">
					<DialogTitle className="text-base font-medium leading-5 text-text">
						{title}
					</DialogTitle>
					<div className="flex items-center gap-2">
						{primaryActionLabel ? (
							<Button onClick={onPrimaryAction} type="button">
								{primaryActionLabel}
							</Button>
						) : null}
						<DialogClose render={<Button variant="ghost" size="icon" />}>
							<CrossIcon label="" />
							<span className="sr-only">Close</span>
						</DialogClose>
					</div>
				</div>
				<div className="min-h-0 overflow-hidden">
					<AgentBrowser {...browserProps} variant={variant} />
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function AgentBrowser(props: Readonly<AgentBrowserProps>) {
	return props.variant === "experimental"
		? <ExperimentalAgentBrowser {...props} />
		: <DefaultAgentBrowser {...props} />;
}

function DefaultAgentBrowser({
	agents,
	categories = DEFAULT_CATEGORIES,
	templateCategories = DEFAULT_TEMPLATE_CATEGORIES,
	templateAgents = EMPTY_TEMPLATE_AGENTS,
	sidebarGroups = [],
	initialTemplateCategory = null,
	onSelectAgent,
	onSelectTemplateAgent,
}: Readonly<AgentBrowserProps>) {
	const initialCategory = categories[0]?.id ?? "all";
	const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
	const [activeTemplateCategory, setActiveTemplateCategory] = useState<AgentTemplateCategoryId | null>(initialTemplateCategory);
	const [templateMotionDirection, setTemplateMotionDirection] = useState<AgentBrowserTemplateMotionDirection>(1);
	const [query, setQuery] = useState("");
	const shouldReduceMotion = useReducedMotion() ?? false;
	const contentOverflow = useHasVerticalOverflow<HTMLDivElement>();
	const visibleTemplateCategories = templateAgents.length > 0 ? templateCategories : [];
	const activeTemplateCategoryOption = activeTemplateCategory
		? visibleTemplateCategories.find((category) => category.id === activeTemplateCategory) ?? null
		: null;
	const templateMotionCustom = {
		direction: templateMotionDirection,
		shouldReduceMotion,
	};

	const filtered = useMemo(() => filterAgents(agents, query, activeCategory), [agents, query, activeCategory]);
	const filteredTemplates = useMemo(
		() => filterTemplateAgents(templateAgents, query, activeTemplateCategory),
		[activeTemplateCategory, query, templateAgents],
	);

	const handleSelectCategory = (category: string) => {
		setActiveTemplateCategory(null);
		setActiveCategory(category);
	};

	const handleSelectTemplateCategory = (categoryId: AgentTemplateCategoryId) => {
		if (categoryId === activeTemplateCategory) return;

		setTemplateMotionDirection(
			activeTemplateCategory && getTemplateCategoryIndex(visibleTemplateCategories, categoryId) < getTemplateCategoryIndex(visibleTemplateCategories, activeTemplateCategory)
				? -1
				: 1,
		);
		setActiveTemplateCategory(categoryId);
	};

	return (
		<div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
			<DirectorySidebar
				categories={categories}
				activeCategory={activeCategory}
				onSelectCategory={handleSelectCategory}
				activeTemplateCategory={activeTemplateCategory}
				onSelectTemplateCategory={handleSelectTemplateCategory}
				templateCategories={visibleTemplateCategories}
				sidebarGroups={sidebarGroups}
				agents={agents}
				onSelectAgent={onSelectAgent}
			/>

			<div
				ref={contentOverflow.ref}
				className={cn(
					// overflow-y-auto forces overflow-x to compute to auto, so this scroll
					// viewport clips anything painted outside its content box. pt-1 gives the
					// search input's focus ring (ring-3) room at the top; pb-8 gives the card
					// hover shadow (elevation.shadow.overlay = 0 8px 12px, ~20px reach) room at
					// the bottom so it is not clipped. px-6 already clears the ~12px side reach.
					"flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-6 pt-1 pb-8 md:pl-4",
					contentOverflow.showTopScrollMask && "scroll-mask-top overscroll-contain",
				)}
			>
				{activeTemplateCategoryOption ? null : (
					<InputGroup>
						<InputGroupAddon>
							<SearchIcon label="" />
						</InputGroupAddon>
						<InputGroupInput
							type="search"
							aria-label="Search agents"
							placeholder="Search agents"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</InputGroup>
				)}

				<div className="flex items-center justify-between">
					<AnimatePresence custom={templateMotionCustom} initial={false} mode="wait">
						{activeTemplateCategoryOption ? (
							<motion.div
								animate="center"
								className="min-h-14 overflow-hidden text-text"
								custom={templateMotionCustom}
								exit="exit"
								initial="enter"
								key={`template-title-${activeTemplateCategoryOption.id}`}
								style={{ font: token("font.heading.medium"), willChange: "transform, opacity" }}
								variants={STANDARD_AGENT_BROWSER_TEMPLATE_TITLE_VARIANTS}
							>
								<TemplateCategoryTitle category={activeTemplateCategoryOption} />
							</motion.div>
						) : null}
					</AnimatePresence>
					{activeTemplateCategoryOption ? null : (
						<Button variant="outline">
							Sort by popularity
							<Icon render={<ChevronDownIcon label="" size="small" color="currentColor" />} />
						</Button>
					)}
					{activeTemplateCategoryOption ? null : (
						<p className="text-sm leading-5 text-text-subtle">
							Showing {filtered.length.toLocaleString("en-US")} results
						</p>
					)}
				</div>

				<AnimatePresence custom={templateMotionCustom} initial={false} mode="wait">
					{activeTemplateCategoryOption ? (
						filteredTemplates.length === 0 ? (
							<motion.p
								animate="center"
								className="text-sm text-text-subtlest"
								custom={templateMotionCustom}
								exit="exit"
								initial="enter"
								key={`template-empty-${activeTemplateCategoryOption.id}`}
								style={{ willChange: "transform, opacity" }}
								variants={STANDARD_AGENT_BROWSER_TEMPLATE_GRID_VARIANTS}
							>
								No templates match &ldquo;{query}&rdquo;.
							</motion.p>
						) : (
							<motion.section
								animate="center"
								aria-label="Agent templates"
								custom={templateMotionCustom}
								exit="exit"
								initial="enter"
								key={`templates-${activeTemplateCategoryOption.id}`}
								style={{ willChange: "transform, opacity" }}
								variants={STANDARD_AGENT_BROWSER_TEMPLATE_GRID_VARIANTS}
							>
								<AgentTemplateSection
									agents={filteredTemplates}
									motionCustom={templateMotionCustom}
									onSelectAgent={onSelectTemplateAgent}
								/>
							</motion.section>
						)
					) : null}
				</AnimatePresence>
				{activeTemplateCategoryOption ? null : filtered.length === 0 ? (
					<p className="text-sm text-text-subtlest" key={`agents-empty-${activeCategory}`}>
						No agents match &ldquo;{query}&rdquo;.
					</p>
				) : (
					<AgentSection agents={filtered} key={`agents-${activeCategory}`} onSelectAgent={onSelectAgent} />
				)}
			</div>
		</div>
	);
}

function ExperimentalAgentBrowser({
	agents,
	templateCategories = DEFAULT_TEMPLATE_CATEGORIES,
	templateAgents = EMPTY_TEMPLATE_AGENTS,
	initialTemplateCategory = null,
	onSelectAgent,
	onSelectTemplateAgent,
	onBuildTemplateAgent,
	onOpenBuiltTemplateAgentConfig,
}: Readonly<AgentBrowserProps>) {
	const [query, setQuery] = useState("");
	const [selectedMyAgents, setSelectedMyAgents] = useState<readonly string[]>([]);
	const [selectedTeams, setSelectedTeams] = useState<readonly string[]>([]);
	const [selectedCompanies, setSelectedCompanies] = useState<readonly string[]>([]);
	const [selectedCategories, setSelectedCategories] = useState<readonly string[]>([]);
	const [templateModeActive, setTemplateModeActive] = useState(Boolean(initialTemplateCategory));
	const [activeTemplateCategory, setActiveTemplateCategory] = useState<AgentTemplateCategoryId | null>(initialTemplateCategory);
	const [templateMotionDirection, setTemplateMotionDirection] = useState<AgentBrowserTemplateMotionDirection>(1);
	const shouldReduceMotion = useReducedMotion() ?? false;
	const contentOverflow = useHasVerticalOverflow<HTMLDivElement>();

	const teamOptions = useMemo(() => getAttributionOptions(agents, "team"), [agents]);
	const companyOptions = useMemo(() => getAttributionOptions(agents, "company"), [agents]);
	const categoryOptions = useMemo(
		() => getUniqueOptions(agents.map((agent) => deriveAgentCategory(agent))),
		[agents],
	);
	const visibleTemplateCategories = useMemo(
		() => templateCategories
			.filter((category) => templateAgents.some((agent) => agent.categoryId === category.id)),
		[templateAgents, templateCategories],
	);
	const activeTemplateCategoryOption = templateModeActive
		? visibleTemplateCategories.find((category) => category.id === activeTemplateCategory) ?? visibleTemplateCategories[0] ?? null
		: null;
	const templateMotionCustom = {
		direction: templateMotionDirection,
		shouldReduceMotion,
	};
	const searchInputLabel = activeTemplateCategoryOption ? "Search templates" : "Search agents";

	const selectedTeamLabels = useMemo(
		() => selectedOptionLabels(teamOptions, selectedTeams),
		[selectedTeams, teamOptions],
	);
	const selectedCompanyLabels = useMemo(
		() => selectedOptionLabels(companyOptions, selectedCompanies),
		[companyOptions, selectedCompanies],
	);
	const selectedCategoryLabels = useMemo(
		() => selectedOptionLabels(categoryOptions, selectedCategories),
		[categoryOptions, selectedCategories],
	);

	const queryMatchedAgents = useMemo(
		() => agents.filter((agent) => matchesAgentQuery(agent, query)),
		[agents, query],
	);
	const matchesSelectedCategories = useMemo(
		() => (agent: AgentBrowserAgent) =>
			selectedCategoryLabels.size === 0 || selectedCategoryLabels.has(deriveAgentCategory(agent)),
		[selectedCategoryLabels],
	);

	const myAgents = useMemo(
		() => queryMatchedAgents.filter((agent) => agent.favorite && matchesSelectedCategories(agent)),
		[matchesSelectedCategories, queryMatchedAgents],
	);
	const teamAgents = useMemo(
		() => queryMatchedAgents.filter((agent) =>
			agent.attributionKind === "team"
			&& matchesSelectedCategories(agent)
			&& (selectedTeamLabels.size === 0 || selectedTeamLabels.has(derivePublisher(agent.byline))),
		),
		[matchesSelectedCategories, queryMatchedAgents, selectedTeamLabels],
	);
	const companyAgents = useMemo(
		() => queryMatchedAgents.filter((agent) =>
			agent.attributionKind === "company"
			&& matchesSelectedCategories(agent)
			&& (selectedCompanyLabels.size === 0 || selectedCompanyLabels.has(derivePublisher(agent.byline))),
		),
		[matchesSelectedCategories, queryMatchedAgents, selectedCompanyLabels],
	);
	const visibleTemplates = useMemo(
		() => activeTemplateCategoryOption
			? filterTemplateAgents(templateAgents, query, activeTemplateCategoryOption.id)
			: EMPTY_TEMPLATE_AGENTS,
		[activeTemplateCategoryOption, query, templateAgents],
	);

	const hasMyAgentFilter = selectedMyAgents.length > 0;
	const hasAgentGroupFilter = selectedTeams.length > 0 || selectedCompanies.length > 0;
	const showMyAgents = myAgents.length > 0 && (!hasAgentGroupFilter || hasMyAgentFilter);
	const showTeamAgents = teamAgents.length > 0 && !hasMyAgentFilter && (selectedTeams.length > 0 || !hasAgentGroupFilter);
	const showCompanyAgents = companyAgents.length > 0 && !hasMyAgentFilter && (selectedCompanies.length > 0 || !hasAgentGroupFilter);
	const resultCount = [
		showMyAgents ? myAgents.length : 0,
		showTeamAgents ? teamAgents.length : 0,
		showCompanyAgents ? companyAgents.length : 0,
	].reduce((total, count) => total + count, 0);
	const hasActiveFilters = [
		query.trim(),
		...selectedMyAgents,
		...selectedTeams,
		...selectedCompanies,
		...selectedCategories,
	].some(Boolean) || templateModeActive;

	function resetFilters() {
		setQuery("");
		setSelectedMyAgents([]);
		setSelectedTeams([]);
		setSelectedCompanies([]);
		setSelectedCategories([]);
		setTemplateModeActive(false);
		setActiveTemplateCategory(null);
	}

	const activeFacet = selectedMyAgents.length > 0
		? "myAgents"
		: selectedTeams.length > 0
			? "teams"
			: selectedCompanies.length > 0
				? "companies"
				: selectedCategories.length > 0
					? "categories"
					: null;
	const showFacet = (facet: string) => activeFacet === null || activeFacet === facet;

	function handleEnterTemplateMode() {
		const defaultCategory = visibleTemplateCategories[0];
		if (!defaultCategory) return;

		setQuery("");
		setSelectedMyAgents([]);
		setSelectedTeams([]);
		setSelectedCompanies([]);
		setSelectedCategories([]);
		setTemplateMotionDirection(1);
		setActiveTemplateCategory(defaultCategory.id);
		setTemplateModeActive(true);
	}

	function handleToggleMode(groupValue: readonly string[]) {
		const next = groupValue[0];
		// Single-select: ignore deselect (empty) so a mode is always active.
		if (next === "templates") {
			if (!templateModeActive) handleEnterTemplateMode();
		} else if (next === "agents" && templateModeActive) {
			resetFilters();
		}
	}

	function handleSelectTemplateCategory(categoryId: AgentTemplateCategoryId) {
		if (!activeTemplateCategoryOption || categoryId === activeTemplateCategoryOption.id) return;

		setTemplateMotionDirection(
			getTemplateCategoryIndex(visibleTemplateCategories, categoryId) < getTemplateCategoryIndex(visibleTemplateCategories, activeTemplateCategoryOption.id)
				? -1
				: 1,
		);
		setActiveTemplateCategory(categoryId);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Pinned controls: the search + mode toggle and the active filter/category
			    row stay put so the user can always search and refine; only the results
			    below scroll. px-6 clears the card side reach, pt-1 the search focus ring,
			    pb-4 spaces the controls from the results (matching the old gap-4 rhythm so
			    the experimental dialog height lock still fits — see AgentBrowserDialog). */}
			<div className="flex shrink-0 items-center gap-3 px-6 pt-1 pb-4">
				<InputGroup className="flex-1">
					<InputGroupAddon>
						<SearchIcon label="" />
					</InputGroupAddon>
					<InputGroupInput
						aria-label={searchInputLabel}
						placeholder={searchInputLabel}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
				{visibleTemplateCategories.length > 0 ? (
					<ToggleGroup
						aria-label="Browse agents or templates"
						className="shrink-0"
						onValueChange={handleToggleMode}
						value={[templateModeActive ? "templates" : "agents"]}
						variant="outline"
					>
						<ToggleGroupItem value="agents">Agents</ToggleGroupItem>
						<ToggleGroupItem value="templates">Templates</ToggleGroupItem>
					</ToggleGroup>
				) : null}
			</div>

			<div className="flex shrink-0 flex-col gap-3 px-6 pb-2 lg:flex-row lg:items-center lg:justify-between">
				{templateModeActive && activeTemplateCategoryOption ? (
					<>
						<div
							aria-label="Template categories"
							className="relative -my-1 flex min-w-0 flex-wrap items-center gap-2 overflow-x-auto overflow-y-visible overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
							role="group"
						>
							{visibleTemplateCategories.map((category) => (
								<ExperimentalTemplateCategoryButton
									active={activeTemplateCategoryOption.id === category.id}
									category={category}
									key={category.id}
									onClick={() => handleSelectTemplateCategory(category.id)}
								/>
							))}
							<Button type="button" variant="ghost" onClick={resetFilters}>
								Reset
							</Button>
						</div>
						<p className="text-sm leading-5 text-text-subtle">
							Showing {visibleTemplates.length.toLocaleString("en-US")} {visibleTemplates.length === 1 ? "template" : "templates"}
						</p>
					</>
				) : (
					<>
						<div className="flex flex-wrap items-center gap-2">
							{showFacet("myAgents") ? (
								<Button
									aria-pressed={selectedMyAgents.length > 0 ? true : undefined}
									onClick={() => setSelectedMyAgents((current) => toggleSelectedValue(current, "my-agents"))}
									type="button"
									variant="outline"
								>
									Filter by my agents
								</Button>
							) : null}
							{showFacet("teams") ? (
								<ExperimentalFilterDropdown
									label="Teams"
									activeLabel="Filter by teams"
									options={teamOptions}
									selectedValues={selectedTeams}
									onToggle={(value) => setSelectedTeams((current) => toggleSelectedValue(current, value))}
								/>
							) : null}
							{showFacet("companies") ? (
								<ExperimentalFilterDropdown
									label="Companies"
									activeLabel="Filter by companies"
									options={companyOptions}
									selectedValues={selectedCompanies}
									onToggle={(value) => setSelectedCompanies((current) => toggleSelectedValue(current, value))}
								/>
							) : null}
							{showFacet("categories") ? (
								<ExperimentalFilterDropdown
									label="Categories"
									activeLabel="Filter by categories"
									options={categoryOptions}
									selectedValues={selectedCategories}
									onToggle={(value) => setSelectedCategories((current) => toggleSelectedValue(current, value))}
								/>
							) : null}
							{hasActiveFilters ? (
								<Button type="button" variant="ghost" onClick={resetFilters}>
									Reset
								</Button>
							) : null}
						</div>
						<p className="text-sm leading-5 text-text-subtle">
							Showing {resultCount.toLocaleString("en-US")} results
						</p>
					</>
				)}
			</div>

			{/* Scroll region begins after the filters: only the results scroll, with the
			    top fade mask sitting just below the pinned filter bar. Agents mode adds
			    pb-6 for the last row's bottom gap + hover shadow; Templates mode owns its
			    bottom spacing inside the carousel (see ExperimentalTemplateMode). */}
			<div
				ref={contentOverflow.ref}
				className={cn(
					"flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2",
					templateModeActive ? null : "pb-6",
					contentOverflow.showTopScrollMask ? "scroll-mask-top overscroll-contain" : null,
				)}
			>
				{templateModeActive && activeTemplateCategoryOption ? (
					<ExperimentalTemplateMode
						activeCategory={activeTemplateCategoryOption}
						motionCustom={templateMotionCustom}
						onBuildAgent={onBuildTemplateAgent}
						onOpenBuiltAgentConfig={onOpenBuiltTemplateAgentConfig}
						onSelectAgent={onSelectTemplateAgent}
						templates={visibleTemplates}
					/>
				) : resultCount === 0 ? (
					<p className="text-sm text-text-subtlest">
						No agents match &ldquo;{query}&rdquo;.
					</p>
				) : (
					<div className="flex flex-col gap-6">
						{showMyAgents ? (
							<ExperimentalAgentSection heading="My agents" agents={myAgents} onSelectAgent={onSelectAgent} />
						) : null}
						{showTeamAgents ? (
							<ExperimentalAgentSection heading="By teams" agents={teamAgents} onSelectAgent={onSelectAgent} />
						) : null}
						{showCompanyAgents ? (
							<ExperimentalAgentSection heading="By companies" agents={companyAgents} onSelectAgent={onSelectAgent} />
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}

function ExperimentalFilterDropdown({
	activeLabel,
	label,
	options,
	selectedValues,
	onToggle,
}: Readonly<{
	activeLabel: string;
	label: string;
	options: readonly ExperimentalFilterOption[];
	selectedValues: readonly string[];
	onToggle: (value: string) => void;
}>) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const visibleOptions = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return normalized
			? options.filter((option) => option.label.toLowerCase().includes(normalized))
			: options;
	}, [options, query]);
	const selectedCount = selectedValues.length;
	const triggerLabel = selectedCount > 0 ? activeLabel : label;

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			setQuery("");
		}
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				render={
					<Button
						aria-expanded={open}
						aria-pressed={selectedCount > 0 ? true : undefined}
						className="gap-2"
						type="button"
						variant="outline"
					/>
				}
			>
				<span>{triggerLabel}</span>
				{selectedCount > 0 ? <Badge>{selectedCount}</Badge> : null}
				<Icon
					render={<ChevronDownIcon label="" size="small" color="currentColor" />}
					className={cn(
						"transition-transform duration-fast",
						selectedCount > 0 || open
							? "[&_svg]:text-icon-selected"
							: "[&_svg]:text-icon-subtle",
						open ? "rotate-180" : null,
					)}
				/>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 gap-2 p-2 pb-0">
				<InputGroup className="pl-[7px]">
					<InputGroupAddon className="w-4 p-0">
						<SearchIcon label="" />
					</InputGroupAddon>
					<InputGroupInput
						aria-label={`Search ${label}`}
						className="px-2"
						placeholder="Search options"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
				<div className="max-h-64 overflow-y-auto">
					{visibleOptions.length === 0 ? (
						<p className="px-2 py-3 text-sm text-text-subtlest">
							No options found.
						</p>
					) : (
						<ul className="flex flex-col gap-px pb-2">
							{visibleOptions.map((option) => (
								<li key={option.id}>
									<label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm leading-5 text-text hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed">
										<Checkbox
											checked={selectedValues.includes(option.id)}
											onCheckedChange={(checked) => {
												if (checked === true || checked === false) {
													onToggle(option.id);
												}
											}}
										/>
										<ExperimentalFilterOptionAvatar option={option} />
										<span className="min-w-0 flex-1 truncate">{option.label}</span>
									</label>
								</li>
							))}
						</ul>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function ExperimentalFilterOptionAvatar({ option }: Readonly<{ option: ExperimentalFilterOption }>) {
	if (option.logoName) {
		return (
			<Tile label={option.label} variant="transparent" size="small" hasBorder className="shrink-0">
				<AtlassianLogo name={option.logoName} label={option.label} size="xsmall" themeAware />
			</Tile>
		);
	}

	if (option.brandName) {
		return <LogoThirdParty className="shrink-0" label={option.label} name={option.brandName} size="small" />;
	}

	if (option.avatarSrc?.startsWith("/avatar-project/")) {
		return (
			<Avatar size="sm" shape="square" className="shrink-0 size-5">
				<AvatarImage alt="" src={option.avatarSrc} />
				<AvatarFallback>{option.label.slice(0, 2).toUpperCase()}</AvatarFallback>
			</Avatar>
		);
	}

	if (option.avatarSrc) {
		return (
			<Avatar size="sm" shape="hexagon" className="shrink-0">
				<AvatarImage alt="" src={option.avatarSrc} className="object-contain" />
				<AvatarFallback>{option.label.slice(0, 2).toUpperCase()}</AvatarFallback>
			</Avatar>
		);
	}

	return null;
}

function ExperimentalAgentSection({
	agents,
	heading,
	onSelectAgent,
}: Readonly<{
	agents: readonly AgentBrowserAgent[];
	heading: string;
	onSelectAgent?: (agent: AgentBrowserAgent) => void;
}>) {
	return (
		<section aria-label={heading} className="flex flex-col gap-2">
			<h2 className="px-1.5 text-xs font-semibold leading-4 text-text-subtlest">
				{heading}
			</h2>
			<ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{agents.map((agent) => (
					<li key={agent.id}>
						<ExperimentalProfileCard agent={agent} onSelectAgent={onSelectAgent} />
					</li>
				))}
			</ul>
		</section>
	);
}

function ExperimentalTemplateMode({
	activeCategory,
	motionCustom,
	onBuildAgent,
	onOpenBuiltAgentConfig,
	onSelectAgent,
	templates,
}: Readonly<{
	activeCategory: AgentTemplateCategory;
	motionCustom: AgentBrowserTemplateMotionCustom;
	onBuildAgent?: (
		agent: AgentTemplateAgent,
		options: AgentBrowserTemplateBuildOptions
	) => AgentBrowserTemplateBuildResult | null;
	onOpenBuiltAgentConfig?: (profileId: string) => void;
	onSelectAgent?: (agent: AgentTemplateAgent) => void;
	templates: readonly AgentTemplateAgent[];
}>) {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [scrollControls, setScrollControls] = useState({ canScrollLeft: false, canScrollRight: false });
	const [activeSetupAgentIds, setActiveSetupAgentIds] = useState<ReadonlySet<string>>(() => new Set());

	const updateScrollControls = useCallback(() => {
		const scrollElement = scrollRef.current;
		if (!scrollElement) {
			setScrollControls((currentControls) => (
				currentControls.canScrollLeft || currentControls.canScrollRight
					? { canScrollLeft: false, canScrollRight: false }
					: currentControls
			));
			return;
		}

		const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
		const canScrollLeft = scrollElement.scrollLeft > AGENT_BROWSER_TEMPLATE_SCROLL_EDGE_THRESHOLD;
		const canScrollRight = scrollElement.scrollLeft < maxScrollLeft - AGENT_BROWSER_TEMPLATE_SCROLL_EDGE_THRESHOLD;

		setScrollControls((currentControls) => (
			currentControls.canScrollLeft === canScrollLeft && currentControls.canScrollRight === canScrollRight
				? currentControls
				: { canScrollLeft, canScrollRight }
		));
	}, []);

	const setCarouselRef = useCallback((scrollElement: HTMLDivElement | null) => {
		scrollRef.current = scrollElement;
		if (scrollElement) {
			window.requestAnimationFrame(updateScrollControls);
		}
	}, [updateScrollControls]);

	useEffect(() => {
		const scrollElement = scrollRef.current;
		if (!scrollElement) return;

		const animationFrameId = window.requestAnimationFrame(updateScrollControls);
		const resizeObserver = new ResizeObserver(updateScrollControls);
		resizeObserver.observe(scrollElement);

		return () => {
			window.cancelAnimationFrame(animationFrameId);
			resizeObserver.disconnect();
		};
	}, [templates.length, updateScrollControls]);

	useEffect(() => {
		const scrollElement = scrollRef.current;
		if (!scrollElement) return;

		scrollElement.scrollTo({ left: 0 });
		window.requestAnimationFrame(updateScrollControls);
	}, [activeCategory.id, templates.length, updateScrollControls]);

	useEffect(() => {
		if (activeSetupAgentIds.size === 0) {
			return;
		}

		const visibleTemplateIds = new Set(templates.map((agent) => agent.id));
		setActiveSetupAgentIds((currentAgentIds) => {
			const nextAgentIds = new Set<string>();
			for (const agentId of currentAgentIds) {
				if (visibleTemplateIds.has(agentId)) {
					nextAgentIds.add(agentId);
				}
			}

			return nextAgentIds.size === currentAgentIds.size ? currentAgentIds : nextAgentIds;
		});
	}, [activeSetupAgentIds.size, templates]);

	function handleScrollBy(direction: -1 | 1) {
		const scrollElement = scrollRef.current;
		if (!scrollElement) return;

		const previousScrollLeft = scrollElement.scrollLeft;
		scrollElement.scrollBy({
			left: AGENT_BROWSER_TEMPLATE_CARD_SCROLL_OFFSET * direction,
			behavior: "smooth",
		});
		window.setTimeout(() => {
			if (scrollElement.scrollLeft !== previousScrollLeft) return;
			scrollElement.scrollBy({
				left: AGENT_BROWSER_TEMPLATE_CARD_SCROLL_OFFSET * direction,
			});
			updateScrollControls();
		}, 150);
	}

	function handleOpenBuiltAgent(agent: AgentTemplateAgent, profileId: string) {
		if (onOpenBuiltAgentConfig) {
			onOpenBuiltAgentConfig(profileId);
			return;
		}

		onSelectAgent?.(agent);
	}

	function handleOpenSetupAgent(agentId: string) {
		setActiveSetupAgentIds((currentAgentIds) => {
			if (currentAgentIds.has(agentId)) {
				return currentAgentIds;
			}

			const nextAgentIds = new Set(currentAgentIds);
			nextAgentIds.add(agentId);
			return nextAgentIds;
		});
	}

	function handleCancelSetupAgent(agentId: string) {
		setActiveSetupAgentIds((currentAgentIds) => {
			if (!currentAgentIds.has(agentId)) {
				return currentAgentIds;
			}

			const nextAgentIds = new Set(currentAgentIds);
			nextAgentIds.delete(agentId);
			return nextAgentIds;
		});
	}

	return (
		<div className="mt-2 flex flex-col gap-2">
			{/* The template row is content-height: the expanded AgentCard hugs its own
			    content, and that natural height decides the row. The dialog is locked to
			    this same height (see AgentBrowserDialog) so the Agents grid scrolls inside
			    the exact same box — both tabs match without stretching the card into dead
			    space. pb-6 keeps the ticket hover shadow off the carousel's vertical clip
			    edge. */}
			<section aria-label="Agent templates" className="relative -mx-6 overflow-x-clip overflow-y-visible">
				<div
					className="overflow-x-auto overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					data-agent-templates-carousel
					onScroll={updateScrollControls}
					ref={setCarouselRef}
				>
					{/* Static track: owns the row's width/padding so the persistent card
					    and the animated deck share one horizontal-scroll context. items-start
					    keeps each card at its natural content height; the TWG card self-stretches
					    to match the tallest card so the row reads as one uniform height. */}
					<div className="flex w-max items-start gap-4 px-6 pt-2 pb-6">
						{/* Persistent across category tabs: lives outside AnimatePresence,
						    so switching tabs never re-keys or re-animates it. It scrolls
						    with the row like any other card. */}
						<div className="shrink-0 self-stretch">
							<TWGAgentCard className="h-full" suggestedAgents={TWG_TEMPLATE_CARD_SUGGESTIONS} />
						</div>

						<AnimatePresence custom={motionCustom} initial={false} mode="wait">
							<motion.div
								animate="center"
								className="flex items-start gap-4"
								custom={motionCustom}
								exit="exit"
								initial="enter"
								key={`experimental-templates-${activeCategory.id}`}
								style={{ willChange: "transform, opacity" }}
								variants={AGENT_BROWSER_TEMPLATE_GRID_VARIANTS}
							>
								{templates.map((agent, index) => (
									activeSetupAgentIds.has(agent.id) ? (
										<div className="w-90 shrink-0" key={agent.id}>
											<TemplateBuildFlow
												agent={agent}
												onCancel={() => handleCancelSetupAgent(agent.id)}
												onBuildAgent={onBuildAgent}
												onOpenBuiltAgent={handleOpenBuiltAgent}
											/>
										</div>
									) : (
										<motion.div
											animate={{ opacity: 1, transform: "translateX(0px)" }}
											className="w-90 shrink-0 [will-change:transform,opacity]"
											initial={{
												opacity: 0,
												transform: motionCustom.shouldReduceMotion ? "translateX(0px)" : `translateX(${motionCustom.direction * AGENT_BROWSER_TEMPLATE_CARD_ENTER_OFFSET}px)`,
											}}
											key={agent.id}
											transition={{
												...AGENT_BROWSER_TEMPLATE_CARD_ENTER_TRANSITION,
												delay: motionCustom.shouldReduceMotion ? 0 : index * AGENT_BROWSER_TEMPLATE_CARD_STAGGER,
											}}
										>
											<ExperimentalTemplateCard
												agent={agent}
												onSelectAgent={() => handleOpenSetupAgent(agent.id)}
											/>
										</motion.div>
									)
								))}
							</motion.div>
						</AnimatePresence>
					</div>
				</div>
				<AnimatePresence initial={false}>
					{scrollControls.canScrollLeft ? (
						<ExperimentalTemplateCarouselControl
							direction="previous"
							key="previous"
							onClick={() => handleScrollBy(-1)}
						/>
					) : null}
					{scrollControls.canScrollRight ? (
						<ExperimentalTemplateCarouselControl
							direction="next"
							key="next"
							onClick={() => handleScrollBy(1)}
						/>
					) : null}
				</AnimatePresence>
			</section>
		</div>
	);
}

function ExperimentalTemplateCategoryButton({
	active,
	category,
	onClick,
}: Readonly<{
	active: boolean;
	category: AgentTemplateCategory;
	onClick: () => void;
}>) {
	return (
		<Button
			aria-pressed={active}
			className={cn(
				"shrink-0",
				active ? "border-border-selected bg-bg-selected text-text-selected" : null,
			)}
			onClick={onClick}
			type="button"
			variant="outline"
		>
			<span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center">
				<Image
					alt=""
					className={cn("size-5 object-contain", category.iconClassName)}
					height={20}
					src={category.iconSrc}
					width={20}
				/>
			</span>
			<span className="whitespace-nowrap">{category.label}</span>
		</Button>
	);
}

function ExperimentalTemplateCarouselControl({
	direction,
	onClick,
}: Readonly<{
	direction: "previous" | "next";
	onClick: () => void;
}>) {
	const isPrevious = direction === "previous";
	const hiddenTransform = `translateY(-50%) translateX(${isPrevious ? "-8px" : "8px"}) scale(0.96)`;

	return (
		<motion.div
			animate={{ opacity: 1, transform: "translateY(-50%) translateX(0px) scale(1)" }}
			className={cn(
				"absolute top-1/2 z-10",
				isPrevious ? "left-3" : "right-3",
			)}
			exit={{ opacity: 0, transform: hiddenTransform }}
			initial={{ opacity: 0, transform: hiddenTransform }}
			transition={AGENT_BROWSER_TEMPLATE_CAROUSEL_CONTROL_TRANSITION}
		>
			<Button
				aria-label={isPrevious ? "Show previous agent templates" : "Show next agent templates"}
				className="border-0 bg-surface-overlay text-icon-subtle opacity-100 hover:bg-surface-overlay-hovered active:bg-surface-overlay-pressed focus-visible:border-0"
				onClick={onClick}
				size="icon"
				style={{ boxShadow: token("elevation.shadow.overlay") }}
				type="button"
				variant="ghost"
			>
				<Icon
					className="pointer-events-none [&_*]:pointer-events-none"
					render={isPrevious ? <ChevronLeftIcon label="" color="currentColor" /> : <ChevronRightIcon label="" color="currentColor" />}
				/>
			</Button>
		</motion.div>
	);
}

function ExperimentalTemplateCard({
	agent,
	onSelectAgent,
}: Readonly<{
	agent: AgentTemplateAgent;
	onSelectAgent?: (agent: AgentTemplateAgent) => void;
}>) {
	return (
		<ExperimentalDirectoryCard
			attributionKind={agent.attributionKind}
			avatarSrc={agent.avatarSrc}
			capabilities={agent.capabilities ?? EMPTY_TEMPLATE_CAPABILITIES}
			className="w-full"
			collaboratorOverflow={agent.collaboratorOverflow}
			collaborators={agent.collaborators}
			description={agent.description}
			name={agent.name}
			onSelect={onSelectAgent ? () => onSelectAgent(agent) : undefined}
			publisher={deriveTemplatePublisher(agent)}
			publisherBrandName={agent.publisherBrandName}
			skills={agent.skills}
			sources={agent.sources}
			stats={agent.stats}
			variant="expanded"
			verified={agent.verified}
		/>
	);
}

interface DirectorySidebarProps {
	categories: readonly AgentBrowserCategory[];
	activeCategory: string;
	onSelectCategory: (category: string) => void;
	activeTemplateCategory: AgentTemplateCategoryId | null;
	onSelectTemplateCategory: (category: AgentTemplateCategoryId) => void;
	templateCategories: readonly AgentTemplateCategory[];
	sidebarGroups: readonly AgentBrowserSidebarGroup[];
	agents: readonly AgentBrowserAgent[];
	onSelectAgent?: (agent: AgentBrowserAgent) => void;
}

function DirectorySidebar({
	categories,
	activeCategory,
	onSelectCategory,
	activeTemplateCategory,
	onSelectTemplateCategory,
	templateCategories,
	sidebarGroups,
	agents,
	onSelectAgent,
}: Readonly<DirectorySidebarProps>) {
	const sidebarOverflow = useHasVerticalOverflow<HTMLElement>();

	return (
		<nav
			aria-label="Agent categories"
			className={cn(
				"hidden min-h-0 w-[280px] shrink-0 flex-col gap-4 overflow-y-auto pl-6 md:flex",
				sidebarOverflow.showTopScrollMask && "scroll-mask-top overscroll-contain",
			)}
			ref={sidebarOverflow.ref}
		>
			<ul className="flex w-64 flex-col">
				{categories.map((category) => (
					<SidebarPrimaryItem
						key={category.id}
						label={category.label}
						active={!activeTemplateCategory && activeCategory === category.id}
						onClick={() => onSelectCategory(category.id)}
					/>
				))}
			</ul>
			<SidebarTemplateGroup
				activeCategory={activeTemplateCategory}
				categories={templateCategories}
				onSelectCategory={onSelectTemplateCategory}
			/>
			{sidebarGroups.map((group) => (
				<SidebarGroup
					key={group.title}
					title={group.title}
					items={getSidebarGroupItems(agents, group)}
					agents={agents}
					onSelectAgent={onSelectAgent}
					showAll={group.showAll}
				/>
			))}
		</nav>
	);
}

function SidebarTemplateGroup({
	activeCategory,
	categories,
	onSelectCategory,
}: Readonly<{
	activeCategory: AgentTemplateCategoryId | null;
	categories: readonly AgentTemplateCategory[];
	onSelectCategory: (category: AgentTemplateCategoryId) => void;
}>) {
	if (categories.length === 0) return null;

	return (
		<div className="flex w-64 flex-col gap-1.5">
			<p style={{ font: token("font.heading.xxsmall") }} className="px-1.5 text-text-subtlest">
				Agent templates
			</p>
			<ul className="flex flex-col">
				{categories.map((category) => (
					<li key={category.id}>
						<SidebarNavItem
							isSelected={activeCategory === category.id}
							label={category.label}
							leading={<SidebarTemplateIcon category={category} />}
							leadingSize="medium"
							onClick={() => onSelectCategory(category.id)}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}

interface SidebarPrimaryItemProps {
	label: string;
	active: boolean;
	onClick: () => void;
}

function SidebarPrimaryItem({ label, active, onClick }: Readonly<SidebarPrimaryItemProps>) {
	return (
		<li>
			<SidebarNavItem label={label} isSelected={active} onClick={onClick} />
		</li>
	);
}

interface SidebarGroupProps {
	title: string;
	items: readonly AgentBrowserSidebarItem[];
	agents: readonly AgentBrowserAgent[];
	onSelectAgent?: (agent: AgentBrowserAgent) => void;
	showAll?: boolean;
}

function SidebarGroup({ title, items, agents, onSelectAgent, showAll = false }: Readonly<SidebarGroupProps>) {
	if (items.length === 0) return null;
	return (
		<div className="flex w-64 flex-col gap-1.5">
			<p style={{ font: token("font.heading.xxsmall") }} className="px-1.5 text-text-subtlest">
				{title}
			</p>
			<ul className="flex flex-col">
				{items.map((item) => {
					const agent = agents.find((candidate) => candidate.id === item.id);
					return (
						<li key={item.id}>
							<SidebarNavItem
								label={item.label}
								leading={<SidebarItemAvatar item={item} />}
								leadingSize="medium"
								onClick={agent ? () => onSelectAgent?.(agent) : undefined}
							/>
						</li>
					);
				})}
				{showAll ? (
					<li>
						<SidebarNavItem
							label="Show all"
							leading={<AlignTextLeftIcon label="" size="small" />}
							leadingSize="medium"
						/>
					</li>
				) : null}
			</ul>
		</div>
	);
}

function SidebarItemAvatar({ item }: Readonly<{ item: AgentBrowserSidebarItem }>) {
	if (item.brandName) {
		return <LogoThirdParty className="shrink-0" label={item.label} name={item.brandName} size="small" />;
	}

	if (item.logoName) {
		// The 3p logos carry their own rounded-square tile inside the SVG; the
		// Atlassian brand mark is transparent, so wrap it in a bordered Tile to
		// match the company rows.
		return (
			<Tile label={item.label} variant="transparent" size="small" hasBorder className="shrink-0">
				<AtlassianLogo name={item.logoName} label={item.label} size="xsmall" themeAware />
			</Tile>
		);
	}

	if (item.avatarSrc?.startsWith("/avatar-project/")) {
		return (
			<Avatar size="sm" shape="square" className="shrink-0 size-5">
				<AvatarImage alt="" src={item.avatarSrc} />
				<AvatarFallback>{item.label.slice(0, 2).toUpperCase()}</AvatarFallback>
			</Avatar>
		);
	}

	return (
		<Avatar size="sm" shape="hexagon" className="shrink-0">
			{item.avatarSrc ? <AvatarImage alt="" src={item.avatarSrc} className="object-contain" /> : null}
			<AvatarFallback>{item.label.slice(0, 2).toUpperCase()}</AvatarFallback>
		</Avatar>
	);
}

function SidebarTemplateIcon({ category }: Readonly<{ category: AgentTemplateCategory }>) {
	return (
		<span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
			<Image
				alt=""
				className={cn("size-6 object-contain", category.iconClassName)}
				height={24}
				src={category.iconSrc}
				width={24}
			/>
		</span>
	);
}

function TemplateCategoryTitle({ category }: Readonly<{ category: AgentTemplateCategory }>) {
	return (
		<>
			<span className="block">{category.titleLines[0]}</span>
			<span className="block text-text-subtlest">{category.titleLines[1]}</span>
		</>
	);
}

interface AgentSectionProps {
	agents: readonly AgentBrowserAgent[];
	onSelectAgent?: (agent: AgentBrowserAgent) => void;
}

function AgentSection({ agents, onSelectAgent }: Readonly<AgentSectionProps>) {
	return (
		<section aria-label="Agents">
			<ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
				{agents.map((agent) => {
					const publisher = derivePublisher(agent.byline);
					return (
						<li key={agent.id}>
							<AgentCard
								agent={agent}
								onSelectAgent={onSelectAgent}
								publisher={publisher}
							/>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

interface AgentTemplateSectionProps {
	agents: readonly AgentTemplateAgent[];
	motionCustom: AgentBrowserTemplateMotionCustom;
	onSelectAgent?: (agent: AgentTemplateAgent) => void;
}

function AgentTemplateSection({
	agents,
	motionCustom,
	onSelectAgent,
}: Readonly<AgentTemplateSectionProps>) {
	return (
		<ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
			{agents.map((agent, index) => (
				<motion.li
					animate={{ opacity: 1, transform: "translateY(0px)" }}
					className="h-[400px] [will-change:transform,opacity]"
					initial={{
						opacity: 0,
						transform: motionCustom.shouldReduceMotion ? "translateY(0px)" : `translateY(${motionCustom.direction * AGENT_BROWSER_TEMPLATE_CARD_ENTER_OFFSET}px)`,
					}}
					key={agent.id}
					transition={{
						...AGENT_BROWSER_TEMPLATE_CARD_ENTER_TRANSITION,
						delay: motionCustom.shouldReduceMotion ? 0 : index * AGENT_BROWSER_TEMPLATE_CARD_STAGGER,
					}}
				>
					<AgentTemplateCard
						agent={agent}
						onSelectAgent={onSelectAgent}
					/>
				</motion.li>
			))}
		</ul>
	);
}

function AgentTemplateCard({
	agent,
	onSelectAgent,
}: Readonly<{
	agent: AgentTemplateAgent;
	onSelectAgent?: (agent: AgentTemplateAgent) => void;
}>) {
	return (
		<EntityCardAgentExpandedCard
			attributionKind={agent.attributionKind}
			avatarSrc={agent.avatarSrc}
			capabilities={agent.capabilities ?? EMPTY_TEMPLATE_CAPABILITIES}
			className="h-full w-full"
			collaboratorOverflow={agent.collaboratorOverflow}
			collaborators={agent.collaborators}
			description={agent.description}
			name={agent.name}
			onMoreActions={NOOP_TEMPLATE_MORE_ACTIONS}
			onSelect={onSelectAgent ? () => onSelectAgent(agent) : undefined}
			publisher={deriveTemplatePublisher(agent)}
			publisherBrandName={agent.publisherBrandName}
			skills={agent.skills}
			sources={agent.sources}
			stats={agent.stats}
			verified={agent.verified}
		/>
	);
}

interface AgentCardProps {
	agent: AgentBrowserAgent;
	onSelectAgent?: (agent: AgentBrowserAgent) => void;
	publisher: string;
}

function AgentCard({ agent, onSelectAgent, publisher }: Readonly<AgentCardProps>) {
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const selectAgent = onSelectAgent ? () => onSelectAgent(agent) : undefined;

	return (
		<EntityCardAgentCard
			active={moreMenuOpen}
			avatarSrc={agent.avatarSrc}
			brandName={agent.brandName}
			chatCount={agent.chatCount}
			className="hover:border-transparent"
			description={agent.description}
			feedbackCount={agent.feedbackCount}
			logoName={agent.logoName}
			moreAction={
				<DirectoryCardMoreMenu
					label={`More actions for ${agent.name}`}
					onLearnMore={selectAgent}
					onOpenChange={setMoreMenuOpen}
					open={moreMenuOpen}
				/>
			}
			name={agent.name}
			onSelect={selectAgent}
			publisher={publisher}
			rating={agent.rating}
			verified={agent.verified}
		/>
	);
}

// Experimental built-agent card — a plain elevation-surface profile card with a
// 1px border that fades on hover and an entity-style lock-up (hexagon avatar,
// name, "By <publisher>" byline). The ⋯ more menu uses the default ghost trigger,
// revealed on hover/focus.
function ExperimentalProfileCard({
	agent,
	onSelectAgent,
}: Readonly<{
	agent: AgentBrowserAgent;
	onSelectAgent?: (agent: AgentBrowserAgent) => void;
}>) {
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const selectAgent = onSelectAgent ? () => onSelectAgent(agent) : undefined;

	return (
			<ExperimentalDirectoryCard
				active={moreMenuOpen}
				attributionKind={agent.attributionKind}
				avatarSrc={agent.avatarSrc}
				chatCount={agent.chatCount}
				description={agent.description}
				feedbackCount={agent.feedbackCount}
				brandName={agent.brandName}
				logoName={agent.logoName}
				moreAction={
					<DirectoryCardMoreMenu
						label={`More actions for ${agent.name}`}
					onLearnMore={selectAgent}
					onOpenChange={setMoreMenuOpen}
					open={moreMenuOpen}
				/>
			}
			name={agent.name}
			onSelect={selectAgent}
			publisher={derivePublisher(agent.byline)}
			rating={agent.rating}
			variant="experimental-profile"
			verified={agent.verified}
		/>
	);
}

interface DirectoryCardMoreMenuProps {
	label: string;
	onLearnMore?: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

function DirectoryCardMoreMenu({
	label,
	onLearnMore,
	onOpenChange,
	open,
}: Readonly<DirectoryCardMoreMenuProps>) {
	function stopPropagation(event: KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>): void {
		event.stopPropagation();
	}

	return (
		<DropdownMenu open={open} onOpenChange={onOpenChange}>
			<DropdownMenuTrigger
				render={
					<Button
						aria-label={label}
						aria-pressed={open || undefined}
						className={cn(
							"size-6 shrink-0 cursor-pointer opacity-0 transition-opacity duration-fast ease-out group-hover/card:opacity-100 group-has-[:focus-visible]/card:opacity-100",
							open && "opacity-100",
						)}
						onClick={stopPropagation}
						onKeyDown={stopPropagation}
						size="icon-compact"
						type="button"
						variant="ghost"
					>
						<Icon render={<ShowMoreHorizontalIcon label="" size="small" color="currentColor" />} />
					</Button>
				}
			/>
			<DropdownMenuContent align="end" onClick={stopPropagation} sideOffset={6}>
				<DropdownMenuItem
					onClick={stopPropagation}
					onSelect={(event) => {
						event.stopPropagation();
						onLearnMore?.();
					}}
				>
					Learn more
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
