"use client";

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import AddIcon from "@atlaskit/icon/core/add";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";
import PinIcon from "@atlaskit/icon/core/pin";
import VideoStopOverlayIcon from "@atlaskit/icon/core/video-stop-overlay";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { useMemo, useState, type ReactElement, type ReactNode } from "react";

import { ROVO_AGENT_SELECTOR_AGENTS } from "@/app/data/directory/agents";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Icon } from "@/components/ui/icon";
import type { AtlassianLogoName } from "@/components/ui/logo";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { IconTile } from "@/components/ui/icon-tile";
import { Spinner } from "@/components/ui/spinner";
import { CheckIcon, SearchIcon } from "@/components/ui/vpk-icons";
import { RichTextCommandMenuSearchField } from "@/components/ui-custom/rich-text-editor";
import { cn } from "@/lib/utils";

export interface AgentSelectorAgent {
	id: string;
	name: string;
	byline: string;
	/** Optional directory visual that replaces the default agent avatar treatment. */
	visual?: ReactElement;
	avatarSrc?: string;
	/** When set, renders the ADS brand logo instead of an `avatarSrc` image. */
	logoName?: AtlassianLogoName;
	/** When set, renders the upstream `@atlassian/logo-third-party` mark (3P brands). */
	brandName?: ThirdPartyLogoName;
	/** When set, renders a VPK product mark through the shared agent avatar. */
	vpkLogo?: "rovo";
}

export interface AgentSelectorAction {
	id: string;
	icon: ReactNode;
	label: string;
	onSelect?: () => void;
}

export interface AgentSelectorProps {
	agents?: readonly AgentSelectorAgent[];
	availableLabel?: string;
	browseIcon?: ReactNode;
	browseAgentsLabel?: string;
	className?: string;
	createAgentLabel?: string;
	defaultQuery?: string;
	defaultPinnedAgentIds?: readonly string[];
	emptyMessage?: string;
	heading?: string;
	listLabel?: string;
	moreItemsLabel?: string;
	onAgentToggle?: (agentId: string) => void;
	onBrowseAgents?: () => void;
	onCreateAgent?: () => void;
	onPinnedAgentIdsChange?: (agentIds: readonly string[]) => void;
	onQueryChange?: (query: string) => void;
	query?: string;
	searchPlaceholder?: string;
	/**
	 * Search field treatment.
	 *
	 * - `"boxed"` (default) — the bordered `CommandInput` used across directory
	 *   and toolbar surfaces.
	 * - `"palette"` — the borderless 44px editor-palette search bar shared with
	 *   the "/" and "@" command menus and the work-item metadata pickers, so a
	 *   selector opened from those surfaces reads as one family.
	 */
	searchVariant?: "boxed" | "palette";
	pinnedAgentIds?: readonly string[];
	pinnedItemsLabel?: string;
	pinningEnabled?: boolean;
	selectionMode?: "multiple" | "single";
	selectedAgentActions?: readonly AgentSelectorAction[];
	selectedActionsLabel?: string;
	selectedAgentIds?: readonly string[];
	/**
	 * Agents whose row opens a follow-up menu instead of changing selection.
	 * Submenu rows use action semantics and never expose a checkbox state.
	 */
	submenuAgentIds?: readonly string[];
	/**
	 * Agents that are already committed elsewhere and must not be re-selected.
	 * Disabled rows get `aria-disabled`, a subtle trailing marker, and their
	 * toggle is a no-op. Generic + domain-neutral; absent = no disabled rows.
	 */
	disabledAgentIds?: readonly string[];
	/**
	 * Opt-in (Jira kanban) treatment: agents currently running on the item.
	 * These render in a dedicated section pinned to the top of the list (above
	 * Pinned/More) instead of showing a selection tick, and are excluded from the
	 * pinned/available groups. Absent/empty = feature off, list behaves as before.
	 */
	inProgressAgentIds?: readonly string[];
	/** Heading for the in-progress section. */
	inProgressLabel?: string;
	/**
	 * Opt-in: in single-select mode, render the selection tick on the currently
	 * selected row (single-select normally shows no tick and relies on top-of-list
	 * ordering alone). Multiple-select mode always shows ticks regardless.
	 */
	showSelectedTickInSingleSelect?: boolean;
	/**
	 * Called when the trailing stop control on an in-progress row is activated.
	 * Cancels that agent's run. Clicking the row body still fires `onAgentToggle`
	 * (the kanban opens the agent's chat from there).
	 */
	onStopAgent?: (agentId: string) => void;
}

// Keep the hover/focus reveal in lockstep with GreetingPromptRow so agent rows
// use the same label lift and byline reveal rhythm without importing chat CSS.
// Dynamic (function) variants: `custom` is whether the flip should be instant —
// true for the selected row promoted to the top and under reduced motion. The
// transition MUST live inside the variant: a variant's own transition overrides
// the component's `transition` prop, so a prop-level override is silently
// ignored and the copy would still animate during the promotion.
const agentLabelVariants: Variants = {
	idle: (instant: boolean) => ({
		transform: "translateY(8px)",
		transition: instant ? { duration: 0 } : { type: "spring", bounce: 0, visualDuration: 0.18 },
	}),
	active: (instant: boolean) => ({
		transform: "translateY(0px)",
		transition: instant ? { duration: 0 } : { type: "spring", bounce: 0.12, visualDuration: 0.24 },
	}),
};

const agentDescriptionVariants: Variants = {
	idle: (instant: boolean) => ({
		opacity: 0,
		transform: "translateY(4px)",
		transition: instant ? { duration: 0 } : { duration: 0.1, ease: [0.4, 0, 1, 1] },
	}),
	active: (instant: boolean) => ({
		opacity: 1,
		transform: "translateY(0px)",
		transition: instant ? { duration: 0 } : { delay: 0.02, duration: 0.16, ease: [0, 0.4, 0, 1] },
	}),
};

const EMPTY_SELECTED_AGENT_IDS: readonly string[] = [];
const EMPTY_PINNED_AGENT_IDS: readonly string[] = [];
const EMPTY_IN_PROGRESS_AGENT_IDS: readonly string[] = [];
const EMPTY_DISABLED_AGENT_IDS: readonly string[] = [];
const EMPTY_SUBMENU_AGENT_IDS: readonly string[] = [];
const EMPTY_SELECTED_AGENT_ACTIONS: readonly AgentSelectorAction[] = [];
const ACTION_BUTTON_CLASS = "h-8 min-h-8 w-full justify-start gap-3 pl-2 pr-3 py-0 text-left text-sm font-normal";
const ACTION_ICON_CLASS = "grid size-6 shrink-0 place-items-center text-icon-subtle";
const ACTION_LABEL_CLASS = "text-text-subtle";
// The trailing `auto` column reserves a lane for CommandItem's check icon,
// rendered only in multiple-select (non-in-progress) rows. Without it the check
// becomes a third child in a 2-column grid and wraps to a second grid row, which
// knocks the copy ~4px above center. But that lane must exist ONLY when the check
// renders: grid `gap` is reserved between grid lines even when a cell is empty,
// so an unused `auto` column still adds a 12px gap that inflates the trailing gap
// (e.g. the stop control's 6px padding + 4px `mr-1` = 10px would become 22px).
// So we add the third column only when `showCheckIcon` is true.
const AGENT_ROW_BASE_CLASS =
	"grid h-11 w-full items-center gap-3 rounded-[12px] py-0 pr-1.5 pl-2 text-left";
const AGENT_ROW_CHECK_COLS = "grid-cols-[24px_minmax(0,1fr)_auto]";
const AGENT_ROW_PLAIN_COLS = "grid-cols-[24px_minmax(0,1fr)]";
const AGENT_COPY_CLASS =
	"flex min-h-[34px] min-w-0 flex-col justify-start overflow-hidden";
// Title + byline share the editor palette's reusable type treatment
// (`menu-row-title` / `menu-row-byline` in app/globals.css): explicit 14px/20px
// and 12px/16px line-heights + truncation + subtle/subtlest color. `text-left`
// keeps the alignment the row expects.
const AGENT_LABEL_CLASS = "menu-row-title text-left";
const AGENT_DESCRIPTION_CLASS = "menu-row-byline text-left";

function matchesAgent(agent: AgentSelectorAgent, query: string): boolean {
	const searchableText = `${agent.name} ${agent.byline}`.toLowerCase();
	return searchableText.includes(query);
}

function filterAgentsByQuery(
	agents: readonly AgentSelectorAgent[],
	normalizedQuery: string,
): AgentSelectorAgent[] {
	return normalizedQuery
		? agents.filter((agent) => matchesAgent(agent, normalizedQuery))
		: [...agents];
}

function AgentSelectorLogo({ agent }: Readonly<{ agent: AgentSelectorAgent }>): ReactElement {
	if (agent.visual) {
		return agent.visual;
	}

	return (
		<AgentAvatarVisual
			avatarClassName="shrink-0"
			avatarSrc={agent.avatarSrc}
			brandName={agent.brandName}
			vpkLogo={agent.vpkLogo}
			fallbackText={agent.name.slice(0, 2).toUpperCase()}
			label={agent.name}
			logoName={agent.logoName}
			sizePx={24}
		/>
	);
}

function AgentSelectorItem({
	agent,
	isChecked,
	isDisabled,
	isInProgress,
	isPinned,
	isSubmenuTrigger,
	onStop,
	onTogglePinned,
	onToggle,
	pinningEnabled,
	showSelectedTickInSingleSelect,
	supportsMultipleSelection,
}: Readonly<{
	agent: AgentSelectorAgent;
	isChecked: boolean;
	isDisabled: boolean;
	/** In-progress rows swap the pin/check affordance for a stop-on-hover control. */
	isInProgress: boolean;
	isPinned: boolean;
	/** Opens a follow-up menu instead of toggling selection. */
	isSubmenuTrigger: boolean;
	onStop?: (agentId: string) => void;
	onTogglePinned: (agentId: string) => void;
	onToggle?: (agentId: string) => void;
	pinningEnabled: boolean;
	/** Opt-in single-select tick on the selected row. */
	showSelectedTickInSingleSelect: boolean;
	supportsMultipleSelection: boolean;
}>): ReactElement {
	// Mirror the editor-palette suggestion row: the byline stays hidden until the
	// row is hovered or focused, then animates in. We drive Motion from explicit
	// interaction state (rather than `whileHover`) so the reveal is deterministic
	// and matches the editor-palette `isInteractionActive` pattern exactly.
	const [isInteractionActive, setIsInteractionActive] = useState(false);
	const prefersReducedMotion = useReducedMotion();
	// In-progress rows never pin/check; they reveal a stop control on hover/focus.
	// The check lane is suppressed even in multiple-select mode. Unlike the pin
	// reveal (React-state width/opacity), the stop reveal is driven purely by CSS
	// group-hover/focus-visible so the control's hit area appears in the same frame
	// the pointer reaches the row — see the in-progress block below.
	// Multiple-select rows use CommandItem's built-in check lane. Single-select
	// opt-in uses a custom subtle check tile instead (rendered in the trailing
	// region below). In-progress rows never show any tick.
	const showCheckIcon = supportsMultipleSelection && !isInProgress && !isSubmenuTrigger;
	const showSingleSelectTick =
		!isInProgress
		&& !isSubmenuTrigger
		&& !supportsMultipleSelection
		&& showSelectedTickInSingleSelect
		&& isChecked;
	// Pinned is only the space/user pin set. Assignment, selection, and used
	// sessions must never fill the pin. Unpinned rows reveal an outline pin on
	// hover/focus as the pin-this-agent affordance. Tick-mode selected rows still
	// suppress that hover pin so promotion cannot flash one.
	const showPinButton =
		!isInProgress && pinningEnabled && (isPinned || (isInteractionActive && !showSingleSelectTick));
	const pinFilled = isPinned;
	// The selected row floats to the top of the list on selection. If it were
	// hovered when clicked, its "active" (byline-visible) copy state would ride
	// the reorder up to the top and only then animate back to idle — a visible
	// byline flash/jump at the new position. So suppress the byline reveal for the
	// checked row entirely, and make its copy flip instant (0-duration) so the
	// active→idle change on becoming checked never animates during the promotion.
	// Unchecked rows keep the smooth hover reveal. Reduced motion flips instantly
	// everywhere so the byline snaps rather than slides/fades.
	const revealByline = isInteractionActive && !isChecked;
	const copyInstant = isChecked || prefersReducedMotion;
	return (
		<CommandItem
			aria-checked={showCheckIcon ? isChecked : undefined}
			aria-disabled={isDisabled || undefined}
			aria-haspopup={isSubmenuTrigger ? "menu" : undefined}
			className={cn(
				AGENT_ROW_BASE_CLASS,
				showCheckIcon ? AGENT_ROW_CHECK_COLS : AGENT_ROW_PLAIN_COLS,
			)}
			data-checked={showCheckIcon && isChecked ? true : undefined}
			keywords={[agent.name, agent.byline]}
			onBlur={() => setIsInteractionActive(false)}
			onFocus={() => setIsInteractionActive(true)}
			onMouseEnter={() => setIsInteractionActive(true)}
			onMouseLeave={() => setIsInteractionActive(false)}
			onPointerDown={(event) => {
				// Submenu rows activate on pointer down so preventDefault keeps
				// focus in the host popover while the selector unmounts.
				if (isDisabled || !isSubmenuTrigger) {
					return;
				}
				if (event.target instanceof Element && event.target.closest("[data-slot=button]")) {
					return;
				}
				event.preventDefault();
				onToggle?.(agent.id);
			}}
			onSelect={() => {
				if (isDisabled) {
					return;
				}
				onToggle?.(agent.id);
			}}
			showCheckIcon={showCheckIcon}
			value={agent.id}
		>
			<AgentSelectorLogo agent={agent} />
			<div className="flex min-w-0 items-center">
				<motion.span
					animate={revealByline ? "active" : "idle"}
					className={cn(AGENT_COPY_CLASS, "flex-1")}
					custom={copyInstant}
					initial={false}
				>
					<motion.span
						className={AGENT_LABEL_CLASS}
						custom={copyInstant}
						style={{ willChange: "transform" }}
						variants={agentLabelVariants}
					>
						{agent.name}
					</motion.span>
					<motion.span
						className={AGENT_DESCRIPTION_CLASS}
						custom={copyInstant}
						style={{ willChange: "transform, opacity" }}
						variants={agentDescriptionVariants}
					>
						{agent.byline}
					</motion.span>
				</motion.span>
				{isDisabled ? (
					<span className="ml-2 shrink-0 text-xs font-medium text-text-subtlest">Working</span>
				) : null}
				{isInProgress ? (
					// The rainbow spinner marks a running agent at rest; hovering/focusing
					// the row crossfades it to a red stop control. The 24px slot is fixed
					// (no width collapse) so the spinner is always visible. `mr-1` adds the
					// 4px that makes the trailing gap (6px row padding + 4px) equal the
					// 10px top/bottom gap of the 24px chip inside the 44px row.
					<span className="relative ml-2 mr-1 grid size-6 shrink-0 place-items-center">
						<span className="pointer-events-none col-start-1 row-start-1 transition-opacity duration-fast ease-out-practical group-hover/command-item:opacity-0 group-has-[[data-slot=button]:focus-visible]/command-item:opacity-0 motion-reduce:transition-none">
							<Spinner label={`${agent.name} running`} size="sm" variant="rainbow" />
						</span>
						<Button
							aria-label={`Stop ${agent.name}`}
							className={cn(
								"col-start-1 row-start-1 size-6 text-icon-danger",
								// At rest the button is invisible and non-interactive so it never
								// intercepts pointer/tap over the spinner (incl. touch/no-hover
								// devices); hover/focus turns both back on in the same frame.
								"opacity-0 pointer-events-none transition-opacity duration-fast ease-out-practical motion-reduce:transition-none",
								"group-hover/command-item:opacity-100 group-hover/command-item:pointer-events-auto",
								"focus-visible:opacity-100 focus-visible:pointer-events-auto",
							)}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onStop?.(agent.id);
							}}
							size="icon"
							type="button"
							variant="ghost"
						>
							<Icon aria-hidden render={<VideoStopOverlayIcon label="" size="small" />} />
						</Button>
					</span>
				) : pinningEnabled ? (
					<span
						className="shrink-0 overflow-hidden"
						style={{
							marginLeft: showPinButton ? 8 : 0,
							// 4px right gap (only when shown) so the total trailing gap
							// (6px row padding + 4px) equals the 10px top/bottom gap of the
							// 24px chip inside the 44px row. When the single-select check
							// follows the pin, the pin is no longer the trailing element:
							// drop this to 0 so the check's own `ml-1` (4px) alone defines
							// the pin↔check gap, instead of stacking to 8px.
							marginRight: showPinButton ? (showSingleSelectTick ? 0 : 4) : 0,
							opacity: showPinButton ? 1 : 0,
							width: showPinButton ? 24 : 0,
						}}
					>
						<Button
							aria-hidden={!showPinButton}
							aria-label={`${isPinned ? "Unpin" : "Pin"} ${agent.name}`}
							aria-pressed={isPinned}
							className="size-6 text-icon-subtle aria-pressed:border-transparent! aria-pressed:bg-transparent! aria-pressed:text-icon-subtle! aria-pressed:[&_svg]:text-icon-subtle!"
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onTogglePinned(agent.id);
							}}
							onFocus={() => setIsInteractionActive(true)}
							size="icon"
							tabIndex={showPinButton ? 0 : -1}
							type="button"
							variant="ghost"
						>
							<Icon
								aria-hidden
								render={pinFilled ? <PinFilledIcon label="" size="small" /> : <PinIcon label="" size="small" />}
							/>
						</Button>
					</span>
				) : null}
				{showSingleSelectTick ? (
					// Single-select selected marker: the VPK check glyph in the subtle icon
					// color, in a 24px transparent icon tile so it aligns with
					// the pin/stop slot. `mr-1` mirrors the in-progress spinner's trailing
					// margin so the 24px chip sits 10px from the row's right edge (6px row
					// padding + 4px), matching its 10px top/bottom inset. `ml-1` keeps the
					// pin↔check gap at 4px (the pin drops its own right margin to 0 when
					// this tick follows).
					<IconTile
						aria-hidden
						className="ml-1 mr-1 text-icon-subtle"
						icon={<CheckIcon size="small" />}
						iconSize="small"
						label=""
						size="small"
						variant="transparent"
					/>
				) : null}
			</div>
		</CommandItem>
	);
}

interface AgentSelectorGroupProps {
	agents: readonly AgentSelectorAgent[];
	disabledAgentIdSet: ReadonlySet<string>;
	heading?: string;
	/** Renders every row in this group with the in-progress stop-on-hover treatment. */
	isInProgressGroup?: boolean;
	onAgentToggle?: (agentId: string) => void;
	onStopAgent?: (agentId: string) => void;
	onTogglePinned: (agentId: string) => void;
	pinnedAgentIdSet: ReadonlySet<string>;
	pinningEnabled: boolean;
	selectedAgentIdSet: ReadonlySet<string>;
	showSelectedTickInSingleSelect: boolean;
	submenuAgentIdSet: ReadonlySet<string>;
	supportsMultipleSelection: boolean;
}

function AgentSelectorGroup({
	agents,
	disabledAgentIdSet,
	heading,
	isInProgressGroup = false,
	onAgentToggle,
	onStopAgent,
	onTogglePinned,
	pinnedAgentIdSet,
	pinningEnabled,
	selectedAgentIdSet,
	showSelectedTickInSingleSelect,
	submenuAgentIdSet,
	supportsMultipleSelection,
}: Readonly<AgentSelectorGroupProps>): ReactElement | null {
	return agents.length > 0 ? (
		<CommandGroup
			className="!px-0 !py-1.5 **:[[cmdk-group-heading]]:font-semibold"
			heading={heading}
		>
			{agents.map((agent) => (
				<AgentSelectorItem
					agent={agent}
					isChecked={selectedAgentIdSet.has(agent.id)}
					isDisabled={disabledAgentIdSet.has(agent.id)}
					isInProgress={isInProgressGroup}
					isPinned={pinnedAgentIdSet.has(agent.id)}
					isSubmenuTrigger={submenuAgentIdSet.has(agent.id)}
					key={agent.id}
					onStop={onStopAgent}
					onToggle={onAgentToggle}
					onTogglePinned={onTogglePinned}
					pinningEnabled={pinningEnabled}
					showSelectedTickInSingleSelect={showSelectedTickInSingleSelect}
					supportsMultipleSelection={supportsMultipleSelection}
				/>
			))}
		</CommandGroup>
	) : null;
}

export function AgentSelector({
	agents = ROVO_AGENT_SELECTOR_AGENTS,
	availableLabel = "agents",
	browseIcon = <Icon className="size-4" render={<AiAgentIcon label="" />} />,
	browseAgentsLabel = "Browse agents",
	className,
	createAgentLabel = "Create agent",
	defaultQuery = "",
	defaultPinnedAgentIds = EMPTY_PINNED_AGENT_IDS,
	emptyMessage = "No agents found.",
	heading,
	listLabel = "Agents",
	moreItemsLabel = "More agents",
	onAgentToggle,
	onBrowseAgents,
	onCreateAgent,
	onPinnedAgentIdsChange,
	onQueryChange,
	query,
	searchPlaceholder = "Search agents",
	searchVariant = "boxed",
	pinnedAgentIds,
	pinnedItemsLabel = "Pinned",
	pinningEnabled = true,
	selectionMode = "multiple",
	selectedAgentActions,
	selectedActionsLabel = "Selected agent actions",
	selectedAgentIds,
	submenuAgentIds,
	disabledAgentIds,
	inProgressAgentIds,
	inProgressLabel = "In progress",
	onStopAgent,
	showSelectedTickInSingleSelect = false,
}: Readonly<AgentSelectorProps>): ReactElement {
	const [internalQuery, setInternalQuery] = useState(defaultQuery);
	const [internalPinnedAgentIds, setInternalPinnedAgentIds] = useState<readonly string[]>(defaultPinnedAgentIds);
	const selectedIds = selectedAgentIds ?? EMPTY_SELECTED_AGENT_IDS;
	const disabledIds = disabledAgentIds ?? EMPTY_DISABLED_AGENT_IDS;
	const submenuIds = submenuAgentIds ?? EMPTY_SUBMENU_AGENT_IDS;
	const selectedActions = selectedAgentActions ?? EMPTY_SELECTED_AGENT_ACTIONS;
	const resolvedQuery = query ?? internalQuery;
	const normalizedQuery = resolvedQuery.trim().toLowerCase();
	const resolvedPinnedAgentIds = pinnedAgentIds ?? internalPinnedAgentIds;
	const inProgressIds = inProgressAgentIds ?? EMPTY_IN_PROGRESS_AGENT_IDS;
	const selectedAgentIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
	const disabledAgentIdSet = useMemo(() => new Set(disabledIds), [disabledIds]);
	const submenuAgentIdSet = useMemo(() => new Set(submenuIds), [submenuIds]);
	const pinnedAgentIdSet = useMemo(() => new Set(resolvedPinnedAgentIds), [resolvedPinnedAgentIds]);
	const inProgressAgentIdSet = useMemo(() => new Set(inProgressIds), [inProgressIds]);
	const listOverflow = useHasVerticalOverflow<HTMLDivElement>();
	const visibleAgents = useMemo(() => {
		const agentById = new Map(agents.map((agent) => [agent.id, agent]));
		const selectedAgents = selectedIds
			.map((agentId) => agentById.get(agentId))
			.filter((agent): agent is AgentSelectorAgent => Boolean(agent));
		const unselectedAgents = agents.filter((agent) => !selectedAgentIdSet.has(agent.id));

		const ordered = [
			...filterAgentsByQuery(selectedAgents, normalizedQuery),
			...filterAgentsByQuery(unselectedAgents, normalizedQuery),
		];

		// De-duplicate by id so each agent renders once with a unique React key.
		// Duplicates can arise from repeated ids in `selectedIds` or from a
		// caller passing an `agents` list that already contains the same id twice.
		const seen = new Set<string>();
		return ordered.filter((agent) => {
			if (seen.has(agent.id)) {
				return false;
			}
			seen.add(agent.id);
			return true;
		});
	}, [agents, normalizedQuery, selectedAgentIdSet, selectedIds]);
	// In-progress agents own the top section and are removed from pinned/more so
	// each agent appears exactly once. When the feature is off the set is empty
	// and these filters are no-ops.
	const inProgressAgents = useMemo(
		() => visibleAgents.filter((agent) => inProgressAgentIdSet.has(agent.id)),
		[inProgressAgentIdSet, visibleAgents],
	);
	const pinnedAgents = useMemo(
		() =>
			visibleAgents.filter(
				(agent) => pinnedAgentIdSet.has(agent.id) && !inProgressAgentIdSet.has(agent.id),
			),
		[inProgressAgentIdSet, pinnedAgentIdSet, visibleAgents],
	);
	const moreAgents = useMemo(
		() =>
			visibleAgents.filter(
				(agent) => !pinnedAgentIdSet.has(agent.id) && !inProgressAgentIdSet.has(agent.id),
			),
		[inProgressAgentIdSet, pinnedAgentIdSet, visibleAgents],
	);
	const hasPinnedAgents = agents.some(
		(agent) => pinnedAgentIdSet.has(agent.id) && !inProgressAgentIdSet.has(agent.id),
	);

	function handleQueryChange(nextQuery: string) {
		if (query === undefined) {
			setInternalQuery(nextQuery);
		}
		onQueryChange?.(nextQuery);
	}

	function handleTogglePinned(agentId: string) {
		const nextPinnedAgentIds = pinnedAgentIdSet.has(agentId)
			? resolvedPinnedAgentIds.filter((id) => id !== agentId)
			: [...resolvedPinnedAgentIds, agentId];
		if (pinnedAgentIds === undefined) {
			setInternalPinnedAgentIds(nextPinnedAgentIds);
		}
		onPinnedAgentIdsChange?.(nextPinnedAgentIds);
	}

	const hasFooterActions = Boolean(onBrowseAgents || onCreateAgent);
	const hasSelectedAgentActions = selectedActions.length > 0;
	const supportsMultipleSelection = selectionMode === "multiple";

	return (
		<Command className={cn("h-[26rem] max-h-[min(26rem,var(--available-height,26rem))] min-h-0 min-w-80 flex-1 rounded-xl p-1", className)} shouldFilter={false}>
			{hasSelectedAgentActions ? (
				<div aria-label={selectedActionsLabel} className="flex shrink-0 flex-col border-b border-border pb-2" role="group">
					{selectedActions.map((action) => (
						<Button
							className={ACTION_BUTTON_CLASS}
							key={action.id}
							onClick={action.onSelect}
							type="button"
							variant="ghost"
						>
							<span className={ACTION_ICON_CLASS}>
								{action.icon}
							</span>
							<span className={ACTION_LABEL_CLASS}>{action.label}</span>
						</Button>
					))}
				</div>
			) : null}
			<div className={cn("shrink-0", hasSelectedAgentActions && "pt-4")}>
				{heading ? (
					<p className="mb-2 px-2 text-xs font-semibold leading-4 text-text-subtlest">{heading}</p>
				) : null}
				{searchVariant === "palette" ? (
					// Bleed past the Command root's p-1 so the 44px palette bar spans the
					// popup edge-to-edge, exactly like the "/" menu and metadata pickers.
					// `hostOwnsKeyNavigation` hands Arrow/Enter back to the cmdk root,
					// which owns row highlighting and activation for this list.
					<div className="-mx-1 -mt-1 mb-1 overflow-hidden rounded-t-xl">
						<RichTextCommandMenuSearchField
							autoFocus
							hostOwnsKeyNavigation
							icon={<SearchIcon className="size-4 text-icon-subtle" />}
							label={searchPlaceholder}
							onClear={() => handleQueryChange("")}
							onValueChange={handleQueryChange}
							value={resolvedQuery}
						/>
					</div>
				) : (
					<CommandInput
						aria-label={searchPlaceholder}
						inputGroupClassName="has-[[data-slot=input-group-control]:focus-visible]:border-input has-[[data-slot=input-group-control]:focus-visible]:ring-0 [&>[data-align=inline-start]]:pl-3 has-[>[data-align=inline-start]]:[&>input]:pl-3"
						onValueChange={handleQueryChange}
						placeholder={searchPlaceholder}
						value={resolvedQuery}
						wrapperClassName="p-0"
					/>
				)}
			</div>
			<CommandList
				aria-label={listLabel}
				className={cn(
					"min-h-0 max-h-none flex-1 p-0",
					// Fade the list under the sticky search header once it has scrolled,
					// matching the editor-palette command menus. `scroll-mask-top` keeps
					// the scrollbar gutter opaque so only the content column fades; the
					// fade size is raised from the 24px default to the palette's 48px so
					// a selector opened next to a "/" menu fades identically.
					listOverflow.showTopScrollMask
						&& "scroll-mask-top overscroll-contain [--scroll-mask-fade-size:3rem]",
				)}
				ref={listOverflow.ref}
			>
				{visibleAgents.length === 0 ? <CommandEmpty>{emptyMessage}</CommandEmpty> : null}
				<AgentSelectorGroup
					agents={inProgressAgents}
					disabledAgentIdSet={disabledAgentIdSet}
					heading={inProgressLabel}
					isInProgressGroup
					onAgentToggle={onAgentToggle}
					onStopAgent={onStopAgent}
					onTogglePinned={handleTogglePinned}
					pinnedAgentIdSet={pinnedAgentIdSet}
					pinningEnabled={pinningEnabled}
					selectedAgentIdSet={selectedAgentIdSet}
					showSelectedTickInSingleSelect={false}
					submenuAgentIdSet={submenuAgentIdSet}
					supportsMultipleSelection={supportsMultipleSelection}
				/>
				<AgentSelectorGroup
					agents={pinnedAgents}
					disabledAgentIdSet={disabledAgentIdSet}
					heading={pinnedItemsLabel}
					onAgentToggle={onAgentToggle}
					onTogglePinned={handleTogglePinned}
					pinnedAgentIdSet={pinnedAgentIdSet}
					pinningEnabled={pinningEnabled}
					selectedAgentIdSet={selectedAgentIdSet}
					showSelectedTickInSingleSelect={showSelectedTickInSingleSelect}
					submenuAgentIdSet={submenuAgentIdSet}
					supportsMultipleSelection={supportsMultipleSelection}
				/>
				<AgentSelectorGroup
					agents={moreAgents}
					disabledAgentIdSet={disabledAgentIdSet}
					heading={hasPinnedAgents || inProgressAgents.length > 0 ? moreItemsLabel : undefined}
					onAgentToggle={onAgentToggle}
					onTogglePinned={handleTogglePinned}
					pinnedAgentIdSet={pinnedAgentIdSet}
					pinningEnabled={pinningEnabled}
					selectedAgentIdSet={selectedAgentIdSet}
					showSelectedTickInSingleSelect={showSelectedTickInSingleSelect}
					submenuAgentIdSet={submenuAgentIdSet}
					supportsMultipleSelection={supportsMultipleSelection}
				/>
			</CommandList>
			{hasFooterActions ? (
				<div className="sticky bottom-0 z-10 flex shrink-0 flex-col border-t border-border bg-popover p-0 pt-1">
					{onBrowseAgents ? (
						<Button
							className={ACTION_BUTTON_CLASS}
							onClick={onBrowseAgents}
							type="button"
							variant="ghost"
						>
							<span className={ACTION_ICON_CLASS}>
								{browseIcon}
							</span>
							<span className={ACTION_LABEL_CLASS}>{browseAgentsLabel}</span>
						</Button>
					) : null}
					{onCreateAgent ? (
						<Button
							className={ACTION_BUTTON_CLASS}
							onClick={onCreateAgent}
							type="button"
							variant="ghost"
						>
							<span className={ACTION_ICON_CLASS}>
								<Icon className="size-4" render={<AddIcon label="" />} />
							</span>
							<span className={ACTION_LABEL_CLASS}>{createAgentLabel}</span>
						</Button>
					) : null}
				</div>
			) : null}
			<span className="sr-only">{agents.length} {availableLabel} available</span>
		</Command>
	);
}
