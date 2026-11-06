"use client";

// oxlint-disable react-doctor/prefer-module-scope-static-value -- These values are intentionally colocated with the component/demo contract for readability and token context.

import { type MouseEvent, type ReactElement, type ReactNode } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { useReducedMotion } from "motion/react";
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
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

/** Compact count formatter — 1500 → "1.5K", 12000 → "12K". */
// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function formatCompact(value: number): string {
	if (value >= 10000) return `${Math.round(value / 1000)}K`;
	if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
	return `${value}`;
}

// --- Shell ----------------------------------------------------------------

const OVERLAY_SHADOW = token("elevation.shadow.overlay");
const CARD_HOVER_TRANSITION = {
	type: "spring",
	bounce: 0.16,
	visualDuration: 0.22,
} as const;

export interface AgentCardShellProps {
	/** Invoked on click / Enter / Space. Presence renders a whole-card select button. */
	onSelect?: () => void;
	/** Accessible label for the whole-card select button when interactive. */
	selectLabel?: string;
	/** Keeps the hover visual treatment active while a child popup/menu is open. */
	active?: boolean;
	/** Allows shaped variants to provide their own non-rectangular hover elevation. */
	hoverShadow?: "default" | "none";
	className?: string;
	children: ReactNode;
}

/**
 * Base card shell — a bordered surface with hover elevation and an optional
 * keyboard-operable button contract. Self-contained to this block.
 */
export function AgentCardShell({
	onSelect,
	selectLabel = "Select item",
	active = false,
	hoverShadow = "default",
	className,
	children,
}: Readonly<AgentCardShellProps>) {
	const interactive = Boolean(onSelect);
	const shouldReduceMotion = useReducedMotion();
	const hoverAnimation = hoverShadow === "default" ? ({ boxShadow: OVERLAY_SHADOW } as const) : undefined;
	const restAnimation = hoverShadow === "default" ? ({ boxShadow: "none" } as const) : undefined;
	const tapAnimation = shouldReduceMotion ? undefined : ({ scale: 0.998 } as const);
	const handleSelect = () => onSelect?.();

	const cardMotionProps = {
		className: cn(
			"group/card relative flex w-full flex-col gap-3 rounded-md bg-surface p-4 text-left outline-none after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-md after:border after:border-border after:transition-colors after:duration-fast after:ease-out hover:after:border-transparent has-[[data-slot=agent-card-select]:focus-visible]:after:border-transparent has-[[data-slot=agent-card-select]:focus-visible]:ring-3 has-[[data-slot=agent-card-select]:focus-visible]:ring-ring/50",
			active && "after:border-transparent",
			interactive && "cursor-pointer",
			className,
		),
		style: { willChange: "transform" },
		animate: hoverAnimation ? (active ? hoverAnimation : restAnimation) : undefined,
		transition: CARD_HOVER_TRANSITION,
		whileHover: hoverAnimation,
		whileTap: interactive ? tapAnimation : undefined,
	};

	if (interactive) {
		return (
			<motion.article data-slot="agent-card" {...cardMotionProps}>
				<button
					aria-label={selectLabel}
					className="absolute inset-0 z-0 cursor-pointer rounded-md outline-none"
					data-slot="agent-card-select"
					onClick={handleSelect}
					type="button"
				/>
				<div className="contents [&>*]:pointer-events-none [&>*]:relative [&>*]:z-10 [&_[data-slot=agent-card-scroll]]:pointer-events-auto [&_[role=button]]:pointer-events-auto [&_[role=menuitem]]:pointer-events-auto [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto [&_textarea]:pointer-events-auto">
					{children}
				</div>
			</motion.article>
		);
	}

	return (
		<motion.article data-slot="agent-card" {...cardMotionProps}>
			{children}
		</motion.article>
	);
}

// --- Header / Byline ------------------------------------------------------

export interface AgentCardHeaderProps {
	leading?: ReactNode;
	title: string;
	byline?: ReactNode;
	action?: ReactNode;
}

export function AgentCardHeader({ leading, title, byline, action }: Readonly<AgentCardHeaderProps>) {
	return (
		<div className="flex items-center gap-2" data-slot="agent-card-header">
			{leading ? <span className="inline-flex shrink-0 items-center leading-none">{leading}</span> : null}
			<div className="min-w-0 flex-1">
				<h3 className="truncate text-text" style={{ font: token("font.heading.xsmall") }}>
					{title}
				</h3>
				{byline ?? null}
			</div>
			{action ?? null}
		</div>
	);
}

export interface AgentCardBylineProps {
	publisher: string;
	verified?: boolean;
}

export function AgentCardByline({ publisher, verified = false }: Readonly<AgentCardBylineProps>) {
	return (
		<p className="flex items-center gap-1 text-xs leading-4 text-text-subtle" data-slot="agent-card-byline">
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

export interface AgentCardMoreButtonProps {
	label: string;
	active?: boolean;
	className?: string;
	onClick?: () => void;
}

export function AgentCardMoreButton({ label, active = false, className, onClick }: Readonly<AgentCardMoreButtonProps>) {
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
				className,
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

// --- Description / Footer / Stat / Section --------------------------------

export function AgentCardDescription({
	className,
	children,
}: Readonly<{ className?: string; children: ReactNode }>) {
	return (
		<p className={cn("line-clamp-2 min-h-10 text-sm leading-5 text-text", className)} data-slot="agent-card-description">
			{children}
		</p>
	);
}

export function AgentCardFooter({
	className,
	children,
}: Readonly<{ className?: string; children: ReactNode }>) {
	return (
		<div
			className={cn("flex items-center gap-4 text-xs leading-4 text-text-subtlest", className)}
			data-slot="agent-card-footer"
		>
			{children}
		</div>
	);
}

export interface AgentCardStatProps {
	icon: ReactElement;
	children: ReactNode;
}

export function AgentCardStat({ icon, children }: Readonly<AgentCardStatProps>) {
	return (
		<span className="inline-flex items-center gap-1" data-slot="agent-card-stat">
			<Icon className="size-3 text-icon-subtlest [&_svg]:size-3" render={icon} />
			{children}
		</span>
	);
}

export function AgentCardSection({
	label,
	children,
	className,
	labelClassName,
}: Readonly<{ label: string; children: ReactNode; className?: string; labelClassName?: string }>) {
	return (
		<div className={cn("flex flex-col gap-1", className)} data-slot="agent-card-section">
			<span className={cn("text-xs font-semibold leading-4 text-text-subtlest", labelClassName)}>{label}</span>
			{children}
		</div>
	);
}

// --- Banner ---------------------------------------------------------------

export const BANNER_HEXAGON_PATH =
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

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function getAgentCardBannerCoverColor(avatarSrc: string | undefined): string {
	const category = avatarSrc?.match(/\/avatar-agent(?:-new)?\/([^/]+)\//u)?.[1];
	return (category ? BANNER_COVER_COLORS[category] : undefined) ?? DEFAULT_BANNER_COVER_COLOR;
}

export interface AgentCardBannerProps {
	avatarSrc?: string;
	backgroundColor?: string;
	avatarBadge?: ReactNode;
}

export function AgentCardBanner({ avatarSrc, avatarBadge, backgroundColor }: Readonly<AgentCardBannerProps>) {
	const coverColor = backgroundColor ?? getAgentCardBannerCoverColor(avatarSrc);

	return (
		<div className="relative shrink-0 overflow-hidden bg-surface" data-slot="agent-card-banner">
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

// --- Capabilities ---------------------------------------------------------

export type AgentCardCapabilityIcon =
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

export interface AgentCardCapability {
	icon?: AgentCardCapabilityIcon;
	label: string;
}

export interface AgentCardCapabilitiesProps {
	className?: string;
	iconClassName?: string;
	label?: string;
	labelClassName?: string;
	itemClassName?: string;
	listClassName?: string;
	items: readonly (string | AgentCardCapability)[];
}

function getCapabilityItem(item: string | AgentCardCapability): AgentCardCapability {
	return typeof item === "string" ? { label: item } : item;
}

function getCapabilityIcon(icon: AgentCardCapabilityIcon | undefined): ReactElement {
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

export function AgentCardCapabilities({
	className,
	iconClassName,
	label,
	labelClassName,
	itemClassName,
	listClassName,
	items,
}: Readonly<AgentCardCapabilitiesProps>) {
	return (
		<div className={cn("flex flex-col gap-1", className)} data-slot="agent-card-capabilities">
			{label ? <span className={cn("text-xs font-semibold leading-4 text-text-subtlest", labelClassName)}>{label}</span> : null}
			<TooltipProvider>
				<ul className={cn("flex flex-col gap-1", listClassName)}>
					{items.map((item) => {
						const capability = getCapabilityItem(item);

						return (
							<Tooltip key={capability.label}>
								<TooltipTrigger render={<li className="flex items-center gap-2" />}>
									<Icon
										aria-hidden
										className={cn("size-4 shrink-0 text-icon-subtlest", iconClassName)}
										render={getCapabilityIcon(capability.icon)}
									/>
									<span className={cn("min-w-0 flex-1 truncate text-xs leading-4 text-text-subtlest", itemClassName)}>{capability.label}</span>
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
