"use client";

import { type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from "react";
import Image from "next/image";
import AiModelIcon from "@atlaskit/icon-lab/core/ai-model";
import ArrowUpRightIcon from "@atlaskit/icon/core/arrow-up-right";
import BacklogIcon from "@atlaskit/icon/core/backlog";
import BoardIcon from "@atlaskit/icon/core/board";
import BookWithBookmarkIcon from "@atlaskit/icon/core/book-with-bookmark";
import BranchIcon from "@atlaskit/icon/core/branch";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import ChartBarIcon from "@atlaskit/icon/core/chart-bar";
import ChartBubbleIcon from "@atlaskit/icon/core/chart-bubble";
import ChartPieIcon from "@atlaskit/icon/core/chart-pie";
import ChartTrendUpIcon from "@atlaskit/icon/core/chart-trend-up";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import ClipboardIcon from "@atlaskit/icon/core/clipboard";
import ClockIcon from "@atlaskit/icon/core/clock";
import CommentIcon from "@atlaskit/icon/core/comment";
import CompassIcon from "@atlaskit/icon/core/compass";
import DashboardIcon from "@atlaskit/icon/core/dashboard";
import DataNumberIcon from "@atlaskit/icon/core/data-number";
import DiscoveryIcon from "@atlaskit/icon/core/discovery";
import EditIcon from "@atlaskit/icon/core/edit";
import EpicIcon from "@atlaskit/icon/core/epic";
import EyeOpenIcon from "@atlaskit/icon/core/eye-open";
import FilterIcon from "@atlaskit/icon/core/filter";
import FlagFilledIcon from "@atlaskit/icon/core/flag-filled";
import HighlightIcon from "@atlaskit/icon/core/highlight";
import IncidentIcon from "@atlaskit/icon/core/incident";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";
import LinkIcon from "@atlaskit/icon/core/link";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import ListChecklistIcon from "@atlaskit/icon/core/list-checklist";
import MegaphoneIcon from "@atlaskit/icon/core/megaphone";
import ObjectiveIcon from "@atlaskit/icon/core/objective";
import OnCallIcon from "@atlaskit/icon/core/on-call";
import PageIcon from "@atlaskit/icon/core/page";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import PinIcon from "@atlaskit/icon/core/pin";
import PulseIcon from "@atlaskit/icon/core/pulse";
import QuestionCircleIcon from "@atlaskit/icon/core/question-circle";
import QuotationMarkIcon from "@atlaskit/icon/core/quotation-mark";
import RefreshIcon from "@atlaskit/icon/core/refresh";
import RoadmapIcon from "@atlaskit/icon/core/roadmap";
import ScalesIcon from "@atlaskit/icon/core/scales";
import SearchIcon from "@atlaskit/icon/core/search";
import ShieldIcon from "@atlaskit/icon/core/shield";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import StatusVerifiedIcon from "@atlaskit/icon/core/status-verified";
import SubtasksIcon from "@atlaskit/icon/core/subtasks";
import SupportIcon from "@atlaskit/icon/core/support";
import TargetIcon from "@atlaskit/icon/core/target";
import TaskIcon from "@atlaskit/icon/core/task";
import TextIcon from "@atlaskit/icon/core/text";
import TimelineIcon from "@atlaskit/icon/core/timeline";
import TransitionIcon from "@atlaskit/icon/core/transition";
import TranslateIcon from "@atlaskit/icon/core/translate";
import WarningIcon from "@atlaskit/icon/core/warning";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

function stopPropagation(event: KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>): void {
	event.stopPropagation();
}

/** Compact count formatter — 1500 → "1.5K", 12000 → "12K". */
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function formatCompact(value: number): string {
	if (value >= 10000) return `${Math.round(value / 1000)}K`;
	if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
	return `${value}`;
}

export interface EntityCardHeaderProps {
	/** Leading visual — hexagon avatar, icon tile, app logo, or rich icon. Omit when the visual lives elsewhere (e.g. a `EntityCardBanner`). */
	leading?: ReactNode;
	title: string;
	/** Attribution line under the title (e.g. `EntityCardByline`). */
	byline?: ReactNode;
	/**
	 * Reserves the byline's vertical space even when no `byline` is supplied, so
	 * a card without attribution (e.g. a tool card) keeps the same header height
	 * as one with it (agent/skill/knowledge). The leading visual and title stay
	 * vertically centered — the reserved space is added symmetrically, it does
	 * not shift the content down.
	 */
	reserveByline?: boolean;
	/** Trailing action revealed on hover/focus (e.g. `EntityCardMoreButton`). */
	action?: ReactNode;
	/**
	 * Marks the entity as already added to the agent. With `onAddedChange`, this
	 * drives a switch that persists while added; otherwise it falls back to the
	 * legacy blue added check.
	 */
	added?: boolean;
	/** Immediate add/remove toggle shown as a hover-revealed switch. */
	onAddedChange?: (checked: boolean) => void;
	/** Shows the added check only on hover, in a subtle color. */
	hoverAdded?: boolean;
	/**
	 * Replaces the trailing added-check/status slot with a caller-owned control.
	 * Use for immediate add/remove affordances that need more width than the 24px
	 * checkmark while preserving the header's reserved trailing space.
	 */
	trailingStatus?: ReactNode;
	/**
	 * Marks the card as multi-selectable. When set, the leading visual swaps to a
	 * 16×16 checkbox on card hover and while selected — the directory "select"
	 * affordance. Pair with `selected` + `onSelectedChange`.
	 */
	selectable?: boolean;
	/** Current selection state — drives the checkbox and its persistent reveal. */
	selected?: boolean;
	/** Toggles selection from the leading checkbox. */
	onSelectedChange?: (checked: boolean) => void;
	/** Accessible label for the leading checkbox (e.g. "Select Confluence"). */
	selectLabel?: string;
}

export function EntityCardHeader({
	leading,
	title,
	byline,
	reserveByline = false,
	action,
	added = false,
	onAddedChange,
	hoverAdded = false,
	trailingStatus,
	selectable = false,
	selected = false,
	onSelectedChange,
	selectLabel,
}: Readonly<EntityCardHeaderProps>) {
	const defaultTrailingStatus = onAddedChange ? (
		<EntityCardAddedSwitch
			added={added}
			onAddedChange={onAddedChange}
			title={title}
		/>
	) : undefined;
	const trailingStatusControl = trailingStatus ?? defaultTrailingStatus;
	const hasTrailingStatus = Boolean(trailingStatusControl);

	return (
		<div
			// When `reserveByline` is set on a byline-less header, `min-h-9` (36px)
			// reserves the height a title + byline header occupies (title line +
			// 16px byline), so it lines up with attributed cards. `items-center`
			// keeps the logo + title centered, so the reserved space is added
			// symmetrically and the content does not shift down.
			className={cn("flex items-center gap-2", reserveByline && !byline && "min-h-9")}
			data-slot="card-directory-header"
		>
			{leading ? (
				selectable ? (
					<EntityCardSelectableLeading label={selectLabel} onSelectedChange={onSelectedChange} selected={selected}>
						{leading}
					</EntityCardSelectableLeading>
				) : (
					<span className="inline-flex shrink-0 items-center leading-none">{leading}</span>
				)
			) : null}
			<div className="min-w-0 flex-1">
				<h3 className="truncate text-text" style={{ font: token("font.heading.xsmall") }}>
					{title}
				</h3>
				{byline ?? null}
			</div>
			{action || added || hoverAdded || hasTrailingStatus ? (
				<span
					className={cn(
						"relative h-6 shrink-0 overflow-visible transition-[width] duration-fast ease-out motion-reduce:transition-none",
						hasTrailingStatus
							? action
								? added ? "w-16" : "w-6 group-hover/card:w-16 group-has-[:focus-visible]/card:w-16 group-data-[active=true]/card:w-16"
								: added ? "w-8" : "w-0 group-hover/card:w-8 group-has-[:focus-visible]/card:w-8"
							: added ? "w-[52px]" : hoverAdded ? "w-6 group-hover/card:w-[52px] group-data-[active=true]/card:w-[52px]" : "w-6",
					)}
				>
					{action ? (
						<span
							className={cn(
								"absolute top-0 right-0 z-[1] inline-flex transition-transform duration-fast ease-out motion-reduce:transition-none",
								hasTrailingStatus
									? added ? "-translate-x-10" : "group-hover/card:-translate-x-10 group-has-[:focus-visible]/card:-translate-x-10 group-data-[active=true]/card:-translate-x-10"
									: added ? "-translate-x-7" : hoverAdded ? "group-hover/card:-translate-x-7 group-data-[active=true]/card:-translate-x-7" : "translate-x-0",
							)}
						>
							{action}
						</span>
					) : null}
					<span
						aria-hidden={!hasTrailingStatus && !added ? true : undefined}
						className={cn(
							hasTrailingStatus
								? "pointer-events-auto absolute top-1/2 right-0 inline-flex -translate-y-1/2 items-center"
								: "pointer-events-none absolute top-0 right-0 inline-flex size-6 origin-center items-center justify-center transition-[opacity,transform] duration-fast ease-out motion-reduce:transition-none",
							!hasTrailingStatus && (
								added
									? "scale-100 opacity-100"
									: hoverAdded
										? "scale-75 opacity-0 group-hover/card:scale-100 group-hover/card:opacity-100 group-data-[active=true]/card:scale-100 group-data-[active=true]/card:opacity-100"
										: "scale-75 opacity-0"
							),
						)}
					>
						{trailingStatusControl ?? <EntityCardAddedCheck className={added ? undefined : "text-icon-disabled"} label={added ? "Added" : ""} />}
					</span>
				</span>
			) : null}
		</div>
	);
}

/**
 * Leading visual for a multi-selectable directory card. The entity's icon/logo
 * shows at rest and fades out on card hover (or while selected), revealing a
 * centered 16×16 `Checkbox` that reflects and toggles selection. The icon and
 * checkbox share a fixed 32px box so the swap never shifts layout.
 *
 * The checkbox sits above the shell's whole-card select `<button>`, so its
 * click/keydown is stopped from bubbling — otherwise selection would toggle
 * twice (once from the checkbox, once from the card button beneath it).
 */
function EntityCardSelectableLeading({
	children,
	label = "Select",
	onSelectedChange,
	selected = false,
}: Readonly<{
	children: ReactNode;
	label?: string;
	onSelectedChange?: (checked: boolean) => void;
	selected?: boolean;
}>) {
	return (
		<span className="relative inline-flex size-8 shrink-0 items-center justify-center leading-none">
			<span
				aria-hidden
				className={cn(
					"absolute inset-0 flex items-center justify-center transition-opacity duration-fast ease-out",
					selected ? "opacity-0" : "opacity-100 group-hover/card:opacity-0 group-has-[:focus-visible]/card:opacity-0",
				)}
			>
				{children}
			</span>
			<Checkbox
				aria-label={label}
				checked={selected}
				className={cn(
					"opacity-0 transition-opacity duration-fast ease-out after:inset-0 focus-visible:pointer-events-auto focus-visible:opacity-100",
					selected
						? "pointer-events-auto opacity-100"
						: "pointer-events-none group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100",
				)}
				onCheckedChange={(checked) => onSelectedChange?.(Boolean(checked))}
				onClick={stopPropagation}
				onKeyDown={stopPropagation}
			/>
		</span>
	);
}

export interface EntityCardAddedCheckProps {
	className?: string;
	/** Accessible status label announced for the indicator. */
	label?: string;
}

/**
 * Persistent "added" status indicator — a filled blue success check used in
 * directory cards to show an entity is already on the agent. Colored with the
 * `selected` token (the same #1868DB as `border-border-selected`) so the
 * affordance reads as selection, not the semantic green success state.
 */
export function EntityCardAddedCheck({
	className = "text-icon-selected",
	label = "Added",
}: Readonly<EntityCardAddedCheckProps>) {
	return (
		<Icon
			className={className}
			render={<StatusSuccessIcon label={label} color="currentColor" />}
		/>
	);
}

export interface EntityCardAddedSwitchProps {
	/** Current add/remove state. Added switches stay visible at rest. */
	added: boolean;
	/** Called immediately when the switch changes. */
	onAddedChange: (checked: boolean) => void;
	/** Entity title used to build the accessible Add/Remove label. */
	title: string;
}

export function EntityCardAddedSwitch({
	added,
	onAddedChange,
	title,
}: Readonly<EntityCardAddedSwitchProps>) {
	return (
		<Switch
			aria-label={`${added ? "Remove" : "Add"} ${title}`}
			checked={added}
			className={cn(
				"transition-opacity duration-fast ease-out motion-reduce:transition-none after:inset-0",
				added
					? "pointer-events-auto opacity-100"
					: "pointer-events-none opacity-0 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100 group-data-[active=true]/card:pointer-events-auto group-data-[active=true]/card:opacity-100",
			)}
			onCheckedChange={onAddedChange}
			onClick={stopPropagation}
			onKeyDown={stopPropagation}
			size="sm"
		/>
	);
}

export interface EntityCardBylineProps {
	publisher: string;
	verified?: boolean;
}

export function EntityCardByline({ publisher, verified = false }: Readonly<EntityCardBylineProps>) {
	return (
		<p
			className="flex items-center gap-1 text-xs leading-4 text-text-subtle"
			data-slot="card-directory-byline"
		>
			<span>By</span>
			<span className="truncate text-link">{publisher}</span>
			{verified ? (
				<Icon
					className="text-icon-information"
					render={<StatusVerifiedIcon label="Verified" size="small" color="currentColor" />}
				/>
			) : null}
		</p>
	);
}

export interface EntityCardMoreButtonProps {
	label: string;
	active?: boolean;
	onClick?: () => void;
}

export function EntityCardMoreButton({ label, active = false, onClick }: Readonly<EntityCardMoreButtonProps>) {
	const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		onClick?.();
	};

	return (
		<Button
			aria-label={label}
			aria-pressed={active || undefined}
			className={cn(
				"size-6 shrink-0 cursor-pointer opacity-0 transition-opacity duration-fast ease-out group-hover/card:opacity-100 group-has-[:focus-visible]/card:opacity-100",
				active && "opacity-100",
			)}
			onClick={handleClick}
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			<Icon render={<ShowMoreHorizontalIcon label="" size="small" color="currentColor" />} />
		</Button>
	);
}

export function EntityCardDescription({
	className,
	children,
}: Readonly<{ className?: string; children: ReactNode }>) {
	return (
		<p
			className={cn("line-clamp-2 min-h-10 text-sm leading-5 text-text", className)}
			data-slot="card-directory-description"
		>
			{children}
		</p>
	);
}

export function EntityCardFooter({
	className,
	children,
}: Readonly<{ className?: string; children: ReactNode }>) {
	return (
		<div
			className={cn("flex items-center gap-4 text-xs leading-4 text-text-subtlest", className)}
			data-slot="card-directory-footer"
		>
			{children}
		</div>
	);
}

export interface EntityCardStatProps {
	/** Raw Atlaskit icon element; wrapped in the 12px stat-icon treatment. */
	icon: ReactElement;
	children: ReactNode;
}

export function EntityCardStat({ icon, children }: Readonly<EntityCardStatProps>) {
	return (
		<span className="inline-flex items-center gap-1" data-slot="card-directory-stat">
			<Icon className="size-3 text-icon-subtlest [&_svg]:size-3" render={icon} />
			{children}
		</span>
	);
}

export function EntityCardSection({
	label,
	children,
}: Readonly<{ label: string; children: ReactNode }>) {
	return (
		<div className="flex flex-col gap-1" data-slot="card-directory-section">
			<span className="text-xs font-semibold leading-4 text-text-subtlest">{label}</span>
			{children}
		</div>
	);
}

// Cover-banner styling, mirrored from `AgentProfileCover` in `components/blocks/agent`.
// Kept local so the entity-card module stays self-contained and doesn't pull in the large
// agent module — the same color map is duplicated there and in the agent-profile-card block.
const BANNER_HEXAGON_PATH =
	"M19.01 0.922148C20.24 0.212148 21.76 0.212148 23 0.922148L40 10.6921C41.24 11.4021 42.01 12.7321 42.01 14.1621V33.6721C42.01 35.1021 41.24 36.4221 40 37.1421L23 46.9121C21.77 47.6221 20.25 47.6221 19.01 46.9121L2.01 37.1321C0.77 36.4221 0 35.0921 0 33.6621V14.1621C0 12.7321 0.77 11.4121 2.01 10.6921L19.01 0.922148Z";
const DEFAULT_BANNER_COVER_COLOR = "#1868DB";
const BANNER_COVER_COLORS: Record<string, string> = {
	"dev-agents": "#82B536",
	lime: "#82B536",
	"product-agents": "#BF63F3",
	purple: "#BF63F3",
	"service-agents": "#FFC716",
	yellow: "#FFC716",
	"strategy-agents": "#FCA700",
	orange: "#FCA700",
	"teamwork-agents": DEFAULT_BANNER_COVER_COLOR,
	blue: DEFAULT_BANNER_COVER_COLOR,
};

function getBannerCoverColor(avatarSrc: string | undefined): string {
	const category = avatarSrc?.match(/\/avatar-agent(?:-new)?\/([^/]+)\//u)?.[1];
	return (category ? BANNER_COVER_COLORS[category] : undefined) ?? DEFAULT_BANNER_COVER_COLOR;
}

export interface EntityCardBannerProps {
	avatarSrc?: string;
	/** Override the avatar-category-derived cover color. */
	backgroundColor?: string;
	/** Optional badge overlaid on the foreground avatar. */
	avatarBadge?: ReactNode;
}

/**
 * Full-bleed cover banner — a colored strip with a bleeding avatar and a hexagon-outlined
 * avatar overhanging the bottom edge. The parent card clips the top corners.
 */
export function EntityCardBanner({ avatarSrc, avatarBadge, backgroundColor }: Readonly<EntityCardBannerProps>) {
	const coverColor = backgroundColor ?? getBannerCoverColor(avatarSrc);

	return (
		<div
			className="relative shrink-0 overflow-hidden bg-surface"
			data-slot="card-directory-banner"
		>
			<div className="relative h-12 overflow-hidden" style={{ backgroundColor: coverColor }}>
				{avatarSrc ? (
					<Image
						alt=""
						aria-hidden
						className="absolute top-1/2 left-[88%] h-48 w-[168px] -translate-x-1/2 -translate-y-1/2 opacity-95"
						height={192}
						src={avatarSrc}
						width={168}
					/>
				) : null}
			</div>
			<div aria-hidden className="h-6" />
			{/* The avatar art (`public/avatar-agent/*`) is itself a full-bleed hexagon drawn with
			    the exact `BANNER_HEXAGON_PATH`, so we render it directly (like `AgentProfileCover`)
			    rather than routing it through the Avatar hexagon shape, whose square-derived clip
			    sliced the art and floated its outline. The surface ring is drawn over the art and
			    centered on the hexagon edge — its inner half sits on the avatar, its outer half
			    lifts it off the colored cover. Art and stroke share one viewBox and the same
			    default (meet) scaling so they stay flush. The wrapper recreates the `group/avatar`
			    + `data-size` contract the badge sizes against. */}
			<div aria-hidden className="group/avatar absolute top-6 left-4 h-12 w-[42px]" data-size="xl">
				{avatarSrc ? (
					<Image alt="" aria-hidden className="absolute inset-0 size-full object-contain" height={48} src={avatarSrc} width={42} />
				) : null}
				<svg
					aria-hidden="true"
					className="stroke-surface pointer-events-none absolute inset-0 size-full overflow-visible"
					focusable="false"
					viewBox="0 0 43 48"
				>
					<path d={BANNER_HEXAGON_PATH} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" />
				</svg>
				{avatarBadge}
			</div>
		</div>
	);
}

export type EntityCardCapabilityIcon =
	| "action"
	| "alert"
	| "board"
	| "book"
	| "branch"
	| "brief"
	| "bubble"
	| "calendar"
	| "chartBar"
	| "chartPie"
	| "check"
	| "checklist"
	| "clock"
	| "comment"
	| "compass"
	| "dashboard"
	| "data"
	| "dependency"
	| "discovery"
	| "document"
	| "draft"
	| "epic"
	| "filter"
	| "goal"
	| "handoff"
	| "highlight"
	| "incident"
	| "lightbulb"
	| "list"
	| "megaphone"
	| "milestone"
	| "objective"
	| "onCall"
	| "people"
	| "pulse"
	| "queue"
	| "question"
	| "quote"
	| "refresh"
	| "review"
	| "roadmap"
	| "scales"
	| "search"
	| "shield"
	| "subtasks"
	| "support"
	| "target"
	| "text"
	| "timeline"
	| "translate"
	| "trend"
	| "work";

export interface EntityCardCapability {
	icon?: EntityCardCapabilityIcon;
	label: string;
}

export interface EntityCardCapabilitiesProps {
	/** Optional section label above the list. Omit to render the bare list. */
	label?: string;
	/** Capability lines rendered as a scrollable icon-tile feature list. */
	items: readonly (string | EntityCardCapability)[];
}

function getCapabilityItem(item: string | EntityCardCapability): EntityCardCapability {
	return typeof item === "string" ? { label: item } : item;
}

function getCapabilityIcon(icon: EntityCardCapabilityIcon | undefined): ReactElement {
	switch (icon) {
		case "action":
			return <ArrowUpRightIcon label="" size="small" />;
		case "alert":
			return <WarningIcon label="" size="small" />;
		case "board":
			return <BoardIcon label="" size="small" />;
		case "book":
			return <BookWithBookmarkIcon label="" size="small" />;
		case "branch":
			return <BranchIcon label="" size="small" />;
		case "brief":
			return <ClipboardIcon label="" size="small" />;
		case "bubble":
			return <ChartBubbleIcon label="" size="small" />;
		case "calendar":
			return <CalendarIcon label="" size="small" />;
		case "chartBar":
			return <ChartBarIcon label="" size="small" />;
		case "chartPie":
			return <ChartPieIcon label="" size="small" />;
		case "check":
			return <CheckCircleIcon label="" size="small" />;
		case "checklist":
			return <ListChecklistIcon label="" size="small" />;
		case "clock":
			return <ClockIcon label="" size="small" />;
		case "comment":
			return <CommentIcon label="" size="small" />;
		case "compass":
			return <CompassIcon label="" size="small" />;
		case "dashboard":
			return <DashboardIcon label="" size="small" />;
		case "data":
			return <DataNumberIcon label="" size="small" />;
		case "dependency":
			return <LinkIcon label="" size="small" />;
		case "discovery":
			return <DiscoveryIcon label="" size="small" />;
		case "document":
			return <PageIcon label="" size="small" />;
		case "draft":
			return <EditIcon label="" size="small" />;
		case "epic":
			return <EpicIcon label="" size="small" />;
		case "filter":
			return <FilterIcon label="" size="small" />;
		case "goal":
			return <FlagFilledIcon label="" size="small" />;
		case "handoff":
			return <TransitionIcon label="" size="small" />;
		case "highlight":
			return <HighlightIcon label="" size="small" />;
		case "incident":
			return <IncidentIcon label="" size="small" />;
		case "lightbulb":
			return <LightbulbIcon label="" size="small" />;
		case "list":
			return <ListBulletedIcon label="" size="small" />;
		case "megaphone":
			return <MegaphoneIcon label="" size="small" />;
		case "milestone":
			return <PinIcon label="" size="small" />;
		case "objective":
			return <ObjectiveIcon label="" size="small" />;
		case "onCall":
			return <OnCallIcon label="" size="small" />;
		case "people":
			return <PeopleGroupIcon label="" size="small" />;
		case "pulse":
			return <PulseIcon label="" size="small" />;
		case "queue":
			return <BacklogIcon label="" size="small" />;
		case "question":
			return <QuestionCircleIcon label="" size="small" />;
		case "quote":
			return <QuotationMarkIcon label="" size="small" />;
		case "refresh":
			return <RefreshIcon label="" size="small" />;
		case "review":
			return <EyeOpenIcon label="" size="small" />;
		case "roadmap":
			return <RoadmapIcon label="" size="small" />;
		case "scales":
			return <ScalesIcon label="" size="small" />;
		case "search":
			return <SearchIcon label="" size="small" />;
		case "shield":
			return <ShieldIcon label="" size="small" />;
		case "subtasks":
			return <SubtasksIcon label="" size="small" />;
		case "support":
			return <SupportIcon label="" size="small" />;
		case "target":
			return <TargetIcon label="" size="small" />;
		case "text":
			return <TextIcon label="" size="small" />;
		case "timeline":
			return <TimelineIcon label="" size="small" />;
		case "translate":
			return <TranslateIcon label="" size="small" />;
		case "trend":
			return <ChartTrendUpIcon label="" size="small" />;
		case "work":
			return <TaskIcon label="" size="small" />;
		default:
			return <AiModelIcon label="" size="small" />;
	}
}

/**
 * Feature list — borderless rows (one per capability), each a plain 16px icon
 * beside its label. Scrolling is owned by the enclosing card body, so this list
 * just flows at its natural height.
 */
export function EntityCardCapabilities({ label, items }: Readonly<EntityCardCapabilitiesProps>) {
	return (
		<div className="flex flex-col gap-1" data-slot="card-directory-capabilities">
			{label ? <span className="text-xs font-semibold leading-4 text-text-subtlest">{label}</span> : null}
			<TooltipProvider>
				<ul className="flex flex-col gap-1">
					{items.map((item) => {
						const capability = getCapabilityItem(item);

						return (
							// Labels truncate in the fixed-width card body, so surface the full
							// string on hover. Anchor the tooltip to the side (not top/bottom) so it
							// never sits in the path of the user's vertical cursor travel between rows.
							// Screen readers already get the label from the DOM text.
							<Tooltip key={capability.label}>
								<TooltipTrigger render={<li className="flex items-center gap-2" />}>
									<Icon
										aria-hidden
										className="size-4 shrink-0 text-icon-subtlest"
										render={getCapabilityIcon(capability.icon)}
									/>
									<span className="min-w-0 flex-1 truncate text-xs leading-4 text-text-subtlest">{capability.label}</span>
								</TooltipTrigger>
								<TooltipContent side="right">{capability.label}</TooltipContent>
							</Tooltip>
						);
					})}
				</ul>
			</TooltipProvider>
		</div>
	);
}
