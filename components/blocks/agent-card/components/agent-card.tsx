"use client";

/* eslint-disable @next/next/no-img-element -- These component primitives render arbitrary preview/avatar/image payloads where Next Image sizing/loading would change the public API. */

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { type CSSProperties, type MouseEvent, type ReactElement, type ReactNode, type UIEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import ClockIcon from "@atlaskit/icon/core/clock";
import LockLockedIcon from "@atlaskit/icon/core/lock-locked";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import StarUnstarredIcon from "@atlaskit/icon/core/star-unstarred";
import StatusVerifiedIcon from "@atlaskit/icon/core/status-verified";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";

import { Avatar, AvatarCompanyBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage, AvatarProjectBadge } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AtlassianLogo, type AtlassianLogoName } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { Separator } from "@/components/ui/separator";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { SkillTag, SkillTagGroup, type SkillTagColor } from "@/components/ui-custom/skill-tag";
import { TWGAppstack, type TwgToolSource } from "@/components/ui-custom/twg-appstack";
import { getSkillIcon } from "@/lib/skill-icons";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	AgentCardBanner,
	AgentCardByline,
	AgentCardCapabilities,
	AgentCardDescription,
	AgentCardFooter,
	AgentCardHeader,
	AgentCardMoreButton,
	AgentCardSection,
	AgentCardShell,
	AgentCardStat,
	type AgentCardCapability,
	BANNER_HEXAGON_PATH,
	formatCompact,
	getAgentCardBannerCoverColor,
} from "./agent-card-parts";
import {
	AGENT_CARD_SCROLL_MASK_STYLE,
	EXPANDED_TICKET_BOTTOM_STYLE,
	EXPANDED_TICKET_SHADOW_CLASS_NAME,
	EXPANDED_TICKET_SHADOW_STYLE,
	EXPANDED_TICKET_TEAR_LINE_STYLE,
	EXPANDED_TICKET_TOP_STYLE,
	EXPANDED_TICKET_WRAPPER_CLASS_NAME,
	STAMP_PERFORATION_BOTTOM_MASK_STYLE,
	STAMP_PERFORATION_TOP_MASK_STYLE,
} from "./agent-card-ticket-style";

/** A skill tag shown in the agent card's "Skills" section. */
export interface AgentCardSkill {
	label: string;
	color?: SkillTagColor;
	icon?: ReactNode;
}

const MAX_VISIBLE_COLLABORATORS = 4;
const SKILLS_MAX_ROWS = 2;
const SKILLS_GROUP_CLASS_NAME = "h-11 content-start overflow-clip [overflow-clip-margin:3px]";
const PROJECT_BADGE_AVATAR_SRCS = [
	"/avatar-project/apple.svg",
	"/avatar-project/bank.svg",
	"/avatar-project/battery.svg",
	"/avatar-project/boat.svg",
	"/avatar-project/book.svg",
	"/avatar-project/canvas.svg",
	"/avatar-project/cat.svg",
	"/avatar-project/celebration.svg",
	"/avatar-project/cloud.svg",
	"/avatar-project/code.svg",
	"/avatar-project/compass.svg",
	"/avatar-project/connie-blog.svg",
	"/avatar-project/gears.svg",
	"/avatar-project/government.svg",
	"/avatar-project/graduation.svg",
	"/avatar-project/graph.svg",
	"/avatar-project/group.svg",
	"/avatar-project/hr-badge.svg",
	"/avatar-project/id.svg",
	"/avatar-project/it.svg",
	"/avatar-project/launch-ship.svg",
	"/avatar-project/life-ring.svg",
	"/avatar-project/light-bulb.svg",
	"/avatar-project/lightning.svg",
	"/avatar-project/loom-record.svg",
	"/avatar-project/loom-video.svg",
	"/avatar-project/magnifying-glass.svg",
	"/avatar-project/mail.svg",
	"/avatar-project/map.svg",
	"/avatar-project/megaphone.svg",
	"/avatar-project/palm-tree.svg",
	"/avatar-project/paper-airplane.svg",
	"/avatar-project/pencil.svg",
	"/avatar-project/phone.svg",
	"/avatar-project/pin.svg",
	"/avatar-project/plant.svg",
	"/avatar-project/rocket.svg",
	"/avatar-project/science.svg",
	"/avatar-project/service-bell.svg",
	"/avatar-project/shield.svg",
	"/avatar-project/shopping-cart.svg",
	"/avatar-project/star.svg",
	"/avatar-project/stopwatch.svg",
	"/avatar-project/store-bag.svg",
	"/avatar-project/storefront.svg",
	"/avatar-project/sun.svg",
	"/avatar-project/support-wrench.svg",
	"/avatar-project/tracking.svg",
	"/avatar-project/unicorn.svg",
	"/avatar-project/video.svg",
] as const;
const EXPERIMENTAL_COVER_TEXT_COLOR = "#CFE1FD";
const EXPERIMENTAL_COVER_TEXT_COLORS: Record<string, string> = {
	"dev-agents": "#37471F",
	"product-agents": "#48245D",
	"service-agents": "#533F04",
	"strategy-agents": "#693200",
	"teamwork-agents": EXPERIMENTAL_COVER_TEXT_COLOR,
};
const EXPERIMENTAL_DETAIL_BACKGROUND_COLOR = "var(--ds-background-accent-blue-subtlest)";
const EXPERIMENTAL_DETAIL_BACKGROUND_COLORS: Record<string, string> = {
	"dev-agents": "var(--ds-background-accent-lime-subtlest)",
	"product-agents": "var(--ds-background-accent-purple-subtlest)",
	"service-agents": "var(--ds-background-accent-yellow-subtlest)",
	"strategy-agents": "var(--ds-background-accent-orange-subtlest)",
	"teamwork-agents": EXPERIMENTAL_DETAIL_BACKGROUND_COLOR,
};
const EXPERIMENTAL_DETAIL_TEXT_COLOR = "var(--ds-text-accent-blue-bolder)";
const EXPERIMENTAL_DETAIL_TEXT_COLORS: Record<string, string> = {
	"dev-agents": "var(--ds-text-accent-lime-bolder)",
	"product-agents": "var(--ds-text-accent-purple-bolder)",
	"service-agents": "var(--ds-text-accent-yellow-bolder)",
	"strategy-agents": "var(--ds-text-accent-orange-bolder)",
	"teamwork-agents": EXPERIMENTAL_DETAIL_TEXT_COLOR,
};
const EXPERIMENTAL_COVER_TEXT_CLASS_NAME = "text-[var(--agent-card-cover-text-color)]";
const EXPERIMENTAL_DETAIL_TEXT_CLASS_NAME = "text-[var(--agent-card-detail-text-color)]";
const EXPERIMENTAL_VERIFIED_ICON_CLASS_NAME = "text-white";

function isRemixStat(stat: { label: string }): boolean {
	return stat.label.trim().toLowerCase() === "remix";
}

function isLastUpdateStat(stat: { label: string }): boolean {
	return stat.label.trim().toLowerCase() === "last update";
}

function getAgentCardStatIcon(stat: { label: string }, index: number): ReactElement {
	if (isLastUpdateStat(stat)) {
		return <ClockIcon label="" size="small" spacing="none" color="currentColor" />;
	}

	if (isRemixStat(stat)) {
		return <PeopleGroupIcon label="" size="small" spacing="none" color="currentColor" />;
	}

	return index === 0
		? <PeopleGroupIcon label="" size="small" spacing="none" color="currentColor" />
		: <ThumbsUpIcon label="" size="small" spacing="none" color="currentColor" />;
}

function formatAgentCardStatText(stat: { value: string; label: string }): string {
	return isLastUpdateStat(stat) ? stat.value : `${stat.value} ${stat.label.toLowerCase()}`;
}

function getAgentAvatarCategory(avatarSrc: string | undefined): string | undefined {
	return avatarSrc?.match(/\/avatar-agent\/([^/]+)\//u)?.[1];
}

function getExperimentalCoverTextColor(avatarSrc: string | undefined): string {
	const category = getAgentAvatarCategory(avatarSrc);
	return (category ? EXPERIMENTAL_COVER_TEXT_COLORS[category] : undefined) ?? EXPERIMENTAL_COVER_TEXT_COLOR;
}

function getExperimentalDetailBackgroundColor(avatarSrc: string | undefined): string {
	const category = getAgentAvatarCategory(avatarSrc);
	return (category ? EXPERIMENTAL_DETAIL_BACKGROUND_COLORS[category] : undefined) ?? EXPERIMENTAL_DETAIL_BACKGROUND_COLOR;
}

function getExperimentalDetailTextColor(avatarSrc: string | undefined): string {
	const category = getAgentAvatarCategory(avatarSrc);
	return (category ? EXPERIMENTAL_DETAIL_TEXT_COLORS[category] : undefined) ?? EXPERIMENTAL_DETAIL_TEXT_COLOR;
}

function getUnmaskedAgentAvatarSrc(avatarSrc: string | undefined): string | undefined {
	return avatarSrc?.replace("/avatar-agent/", "/avatar-agent-unmasked/");
}

function getProjectBadgeAvatarSrc(seed: string) {
	let hash = 0;

	for (let index = 0; index < seed.length; index += 1) {
		hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
	}

	return PROJECT_BADGE_AVATAR_SRCS[hash % PROJECT_BADGE_AVATAR_SRCS.length];
}

function AgentCardTicketSeam() {
	return (
		<div
			aria-hidden
			className="agent-card-ticket-seam pointer-events-none relative h-0"
			data-slot="agent-card-ticket-seam"
			style={{ zIndex: 30 }}
		>
			<span
				className="pointer-events-none absolute top-0 right-2 left-2 h-px bg-border"
				data-slot="agent-card-ticket-tear-line"
				style={EXPANDED_TICKET_TEAR_LINE_STYLE}
			/>
		</div>
	);
}

/**
 * Agent card layout:
 * - `"expanded"` (default): cover banner, byline, inline template stats,
 *   sources, skills, and a stacked template-detail body.
 * - `"experimental"` / `"experimental-template"`: compact banner-first treatment
 *   with inline metrics, app stack, skill stack, and feature list in a raised body panel.
 * - `"experimental-profile"`: built-agent profile card on a plain elevation surface
 *   (1px border that fades on hover) with an entity-style lock-up — hexagon avatar,
 *   name, "By <publisher>" byline — description, and a social-proof footer. No cover
 *   color, corner illustration, or template-building detail sections.
 * - `"template"`: a flat card — icon + name header, description, "Works with"
 *   sources, and "Skills" tags. No banner, capabilities, or footer.
 */
export type AgentCardVariant = "expanded" | "experimental" | "experimental-template" | "experimental-profile" | "template";

export interface AgentCardProps {
	name: string;
	/** Layout variant. Defaults to `"expanded"`. */
	variant?: AgentCardVariant;
	avatarSrc?: string;
	insetLogo?: boolean;
	logoName?: AtlassianLogoName;
	/** When set, renders the upstream `@atlassian/logo-third-party` borderless glyph inside the hexagon avatar. */
	brandName?: ThirdPartyLogoName;
	/** Flat icon shown by the `"template"` variant header (when there is no banner). */
	iconSrc?: string;
	publisher: string;
	attributionKind?: "company" | "team" | "person";
	publisherLogoSrc?: string;
	/** 3P publisher brand id — renders the upstream package mark on the company badge. */
	publisherBrandName?: ThirdPartyLogoName;
	description?: string;
	/** Capabilities feature list — rendered by the `"expanded"` and experimental template variants. */
	capabilities?: readonly (AgentCardCapability | string)[];
	capabilitiesLabel?: string;
	sources?: ReadonlyArray<TwgToolSource>;
	skills?: ReadonlyArray<AgentCardSkill>;
	stats?: ReadonlyArray<{ value: string; label: string }>;
	collaborators?: ReadonlyArray<{ src: string; name: string }>;
	collaboratorOverflow?: number;
	coverBackgroundColor?: string;
	verified?: boolean;
	rating?: number;
	feedbackCount?: number;
	chatCount?: number;
	onSelect?: () => void;
	onMoreActions?: () => void;
	/**
	 * Custom node rendered in place of the built-in more button (e.g. a dropdown
	 * menu). Takes precedence over `onMoreActions` when provided.
	 */
	moreAction?: ReactNode;
	/** Keeps the hover/elevation treatment active (e.g. while a more-menu is open). */
	active?: boolean;
	className?: string;
}

/**
 * Agent card — a bordered, hover-elevating surface. The default `"expanded"` variant
 * shows a cover banner, attribution byline, inline template stats, "Works with"
 * sources, "Skills" tags, and a scrollable capabilities feature list. The
 * experimental template variant renders a banner-first card with inline metrics
 * and stacked body sections, while the
 * experimental profile variant is a plain-surface entity-style profile card
 * (hexagon avatar, byline, description, social-proof footer). The `"template"`
 * variant renders a flat card (icon + name, description, "Works with", "Skills").
 * Self-contained block; passing onSelect makes the whole card selectable.
 */
export function AgentCard({
	name,
	variant = "expanded",
	avatarSrc,
	insetLogo = false,
	logoName,
	brandName,
	iconSrc,
	publisher,
	attributionKind,
	publisherLogoSrc,
	publisherBrandName,
	description,
	capabilities = [],
	capabilitiesLabel,
	sources = [],
	skills = [],
	stats = [],
	collaborators = [],
	collaboratorOverflow,
	coverBackgroundColor,
	verified = false,
	rating,
	feedbackCount,
	chatCount,
	onSelect,
	onMoreActions,
	moreAction,
	active = false,
	className,
}: Readonly<AgentCardProps>) {
	const displayStats = stats.filter((stat) => !isRemixStat(stat));
	const showStats = displayStats.length > 0;
	const showRating = !showStats && typeof rating === "number";
	const showChats = !showStats && typeof chatCount === "number";
	const showCollaborators = collaborators.length > 0;
	const [bodyScrolled, setBodyScrolled] = useState(false);
	const ticketRef = useRef<HTMLDivElement | null>(null);
	const ticketHeaderRef = useRef<HTMLDivElement | null>(null);
	const visibleCollaborators = collaborators.slice(0, MAX_VISIBLE_COLLABORATORS);
	const hiddenCollaboratorCount =
		Math.max(collaborators.length - MAX_VISIBLE_COLLABORATORS, 0) + (collaboratorOverflow ?? 0);
	const showHiddenCollaboratorCount =
		visibleCollaborators.length === MAX_VISIBLE_COLLABORATORS && hiddenCollaboratorCount > 0;
	const expandedStats = stats.slice(0, 2);
	const showExpandedInlineStats = expandedStats.length > 0 || showRating || showChats;
	const handleUseTemplateClick = (event: MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation();
		onSelect?.();
	};
	const handleBodyScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
		const nextBodyScrolled = event.currentTarget.scrollTop > 0;
		setBodyScrolled((currentBodyScrolled) => (
			currentBodyScrolled === nextBodyScrolled ? currentBodyScrolled : nextBodyScrolled
		));
	}, []);
	// The scroll body sits above the shell's select-overlay button (so it can own
	// wheel/drag scroll), which means clicks on it no longer fall through to that
	// button. Forward plain clicks to onSelect so whole-card selection still works;
	// clicks that originate on a genuinely interactive control are ignored here.
	const handleBodyClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (event.defaultPrevented) return;
			if ((event.target as HTMLElement).closest("a,button,[role=button],[role=menuitem],input,select,textarea")) {
				return;
			}
			onSelect?.();
		},
		[onSelect],
	);
	useEffect(() => {
		if (variant !== "expanded") return undefined;

		const ticket = ticketRef.current;
		const header = ticketHeaderRef.current;

		if (!ticket || !header) return undefined;

		const updateSeamOffset = () => {
			ticket.style.setProperty("--agent-card-ticket-seam-y", `${header.offsetHeight}px`);
		};

		updateSeamOffset();

		if (typeof ResizeObserver === "undefined") return undefined;

		const resizeObserver = new ResizeObserver(updateSeamOffset);
		resizeObserver.observe(header);

		return () => resizeObserver.disconnect();
	}, [variant]);
	const projectBadgeAvatarSrc = getProjectBadgeAvatarSrc(`${publisher}:${name}`);
	const renderAvatarBadge = () => {
		if (attributionKind === "company") {
			return (
				<AvatarCompanyBadge>
					{publisherBrandName ? (
						<LogoThirdParty label="" name={publisherBrandName} size="xsmall" />
					) : publisherLogoSrc ? (
						<img alt="" aria-hidden src={publisherLogoSrc} />
					) : (
						<AtlassianLogo
							iconColor="#FFFFFF"
							label=""
							name="atlassian"
							shouldUseNewLogoDesign
							size="xxsmall"
							textColor="#FFFFFF"
							themeAware={false}
						/>
					)}
				</AvatarCompanyBadge>
			);
		}

		if (attributionKind === "team") {
			return (
				<AvatarProjectBadge>
					<img alt="" aria-hidden src={publisherLogoSrc ?? projectBadgeAvatarSrc} />
				</AvatarProjectBadge>
			);
		}

		return null;
	};
	const avatarBadge = renderAvatarBadge();

	if (variant === "template") {
		return (
			<AgentCardShell active={active} className={className} onSelect={onSelect} selectLabel={`Select ${name}`}>
				<AgentCardHeader
					action={
						onMoreActions ? (
							<AgentCardMoreButton label={`More actions for ${name}`} onClick={onMoreActions} />
						) : null
					}
					leading={
						iconSrc ? (
							<Image alt="" aria-hidden className="size-8 object-contain" height={32} src={iconSrc} width={32} />
						) : undefined
					}
					title={name}
				/>

				<AgentCardDescription>
					{description ?? `Learn how ${name} can help your team work faster.`}
				</AgentCardDescription>

				{showCollaborators ? (
					<AgentCardSection label="Trusted by teammates">
						<AvatarGroup className="items-center" label="Collaborators">
							{visibleCollaborators.map((person) => (
								<Avatar key={person.src} size="sm">
									<AvatarImage alt={person.name} src={person.src} />
									<AvatarFallback>{person.name.slice(0, 2)}</AvatarFallback>
								</Avatar>
							))}
							{showHiddenCollaboratorCount ? (
								<AvatarGroupCount>+{hiddenCollaboratorCount}</AvatarGroupCount>
							) : null}
						</AvatarGroup>
					</AgentCardSection>
				) : null}

				{sources.length > 0 ? (
					<AgentCardSection label="Works with">
						<TWGAppstack animated={false} className="justify-start" iconSize="small" maxVisible={6} sources={sources} />
					</AgentCardSection>
				) : null}

				{skills.length > 0 ? (
					<AgentCardSection label="Skills">
						<SkillTagGroup maxRows={SKILLS_MAX_ROWS}>
							{skills.map((skill) => (
								<SkillTag color={skill.color ?? "default"} icon={skill.icon ?? getSkillIcon(skill.label)} key={skill.label}>
									{skill.label}
								</SkillTag>
							))}
						</SkillTagGroup>
					</AgentCardSection>
				) : null}
			</AgentCardShell>
		);
	}

	if (variant === "experimental-profile") {
		const isPersonal = publisher === "You";
		const visibleStats = displayStats.slice(0, 2);
		const showInlineStats = visibleStats.length > 0 || showRating || showChats || isPersonal;

		return (
			<AgentCardShell
				active={active}
				className={cn(
					"rounded-[16px] after:rounded-[16px] [&_[data-slot=agent-card-select]]:rounded-[16px]",
					className,
				)}
				onSelect={onSelect}
				selectLabel={`Select ${name}`}
			>
				<AgentCardHeader
					action={
						moreAction ?? (onMoreActions ? (
							<AgentCardMoreButton label={`More actions for ${name}`} onClick={onMoreActions} />
						) : null)
					}
					byline={<AgentCardByline publisher={publisher} verified={verified} />}
						leading={
							<AgentAvatarVisual
								avatarSrc={avatarSrc}
								brandName={brandName}
								fallbackText={name.slice(0, 2)}
								inset={insetLogo}
								label={name}
								logoName={logoName}
								sizePx={32}
							>
								{avatarBadge}
							</AgentAvatarVisual>
						}
					title={name}
				/>

				<AgentCardDescription>
					{description ?? `Learn how ${name} can help your team work faster.`}
				</AgentCardDescription>

				{showInlineStats ? (
					<AgentCardFooter>
						{visibleStats.length > 0 ? (
							visibleStats.map((stat, index) => (
								<AgentCardStat
									icon={getAgentCardStatIcon(stat, index)}
									key={stat.label}
								>
									{formatAgentCardStatText(stat)}
								</AgentCardStat>
							))
						) : (
							<>
								{showRating ? (
									<AgentCardStat icon={<StarUnstarredIcon label="" size="small" spacing="none" color="currentColor" />}>
										{rating.toFixed(1)}
										{typeof feedbackCount === "number" ? ` (${formatCompact(feedbackCount)} feedback)` : null}
									</AgentCardStat>
								) : null}
								{showChats ? (
									<AgentCardStat icon={<AiChatIcon label="" size="small" spacing="none" color="currentColor" />}>
										{formatCompact(chatCount)} chats
									</AgentCardStat>
								) : null}
								{isPersonal ? (
									<AgentCardStat icon={<LockLockedIcon label="" size="small" spacing="none" color="currentColor" />}>
										Private to you
									</AgentCardStat>
								) : null}
							</>
						)}
					</AgentCardFooter>
				) : null}
			</AgentCardShell>
		);
	}

	if (variant === "experimental" || variant === "experimental-template") {
		const isExperimentalTemplate = variant === "experimental-template";
		const coverColor = coverBackgroundColor ?? getAgentCardBannerCoverColor(avatarSrc);
		const coverStyle = {
			"--agent-card-cover-color": coverColor,
			"--agent-card-detail-color": getExperimentalDetailBackgroundColor(avatarSrc),
			"--agent-card-detail-text-color": getExperimentalDetailTextColor(avatarSrc),
			"--agent-card-cover-text-color": getExperimentalCoverTextColor(avatarSrc),
		} as CSSProperties & {
			"--agent-card-cover-color": string;
			"--agent-card-detail-color": string;
			"--agent-card-detail-text-color": string;
			"--agent-card-cover-text-color": string;
		};
		// Template covers surface template-specific metadata (Remix + Last update);
		// other experimental covers use the non-remix stats (e.g. users / reactions).
		const coverStats = isExperimentalTemplate ? stats : displayStats;
		const visibleStats = coverStats.slice(0, 2);
		const showInlineStats = visibleStats.length > 0 || showRating || showChats;
		const showExperimentalCollaborators = showCollaborators;
		// Cover keeps the inline stats + "Use template" CTA; collaborators move to the
		// "Trusted by teammates" detail section below.
		const showCoverActionRow = showInlineStats || showExperimentalCollaborators;
		const unmaskedAvatarSrc = getUnmaskedAgentAvatarSrc(avatarSrc);
		const hasMoreAction = Boolean(moreAction) || Boolean(onMoreActions);

		return (
			<AgentCardShell
				active={active}
				className={cn(
					"gap-0 overflow-clip rounded-[16px] bg-transparent p-0 after:rounded-[16px] after:border-0 [&_[data-slot=agent-card-select]]:rounded-[16px]",
					className,
				)}
				onSelect={onSelect}
				selectLabel={`Select ${name}`}
			>
				<div className="relative flex min-h-0 flex-auto flex-col overflow-visible" style={coverStyle}>
					<div
						className={cn(
							"relative z-10 flex shrink-0 flex-col rounded-t-[16px] bg-[var(--agent-card-cover-color)] px-4 text-text-inverse",
							isExperimentalTemplate ? "gap-2 pt-3 pb-4" : "gap-3 pt-4 pb-4",
						)}
						style={isExperimentalTemplate ? undefined : STAMP_PERFORATION_BOTTOM_MASK_STYLE}
					>
						{avatarSrc ? (
							<div
								aria-hidden
								className={cn(
									"pointer-events-none absolute top-1 left-[102%] z-0 h-40 w-[218px] -translate-x-1/2 -translate-y-1/2",
									// On hover the cover illustration clears out of the way so the
									// more button underneath is revealed. Hover-driven only, so it
									// never fires at first paint. Only when there is a button to reveal.
									hasMoreAction
										&& "transition-[opacity,transform] duration-medium ease-out group-hover/card:-translate-y-[64%] group-hover/card:opacity-0 group-focus-within/card:-translate-y-[64%] group-focus-within/card:opacity-0",
								)}
								style={{ willChange: "transform, opacity" }}
							>
								<Image
									alt=""
									aria-hidden
									className="size-full object-contain opacity-95"
									height={160}
									src={unmaskedAvatarSrc ?? avatarSrc}
									width={218}
								/>
							</div>
						) : null}
						<div className="relative z-[1] flex items-center gap-3">
							<div aria-hidden className="group/avatar relative h-10 w-[35px] shrink-0" data-size="lg">
								{avatarSrc ? (
									<Image alt="" aria-hidden className="absolute inset-0 size-full object-contain" height={40} src={avatarSrc} width={35} />
								) : null}
								<svg
									aria-hidden="true"
									className={cn("pointer-events-none absolute inset-0 size-full overflow-visible stroke-current", EXPERIMENTAL_COVER_TEXT_CLASS_NAME)}
									focusable="false"
									viewBox="0 0 43 48"
								>
									<path d={BANNER_HEXAGON_PATH} fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke" />
								</svg>
								{renderAvatarBadge()}
							</div>
							<div className="min-w-0 flex-1">
								<h3 className={cn("truncate", EXPERIMENTAL_COVER_TEXT_CLASS_NAME)} style={{ font: token("font.heading.xsmall") }}>
									{name}
								</h3>
								<p className="flex items-center gap-1 text-xs leading-4">
									<span className={EXPERIMENTAL_COVER_TEXT_CLASS_NAME}>By</span>
									<span className={cn("truncate", EXPERIMENTAL_COVER_TEXT_CLASS_NAME)}>{publisher}</span>
									{verified ? (
										<Icon
											className={EXPERIMENTAL_VERIFIED_ICON_CLASS_NAME}
											render={<StatusVerifiedIcon label="Verified" size="small" color="currentColor" />}
										/>
									) : null}
								</p>
							</div>
							{moreAction ?? (onMoreActions ? (
								<AgentCardMoreButton
									className={cn(
										EXPERIMENTAL_COVER_TEXT_CLASS_NAME,
										"[&_svg]:text-current hover:bg-white/20 active:bg-white/30",
									)}
									label={`More actions for ${name}`}
									onClick={onMoreActions}
								/>
							) : null)}
						</div>
						<div className={cn("relative z-[1] flex flex-col", isExperimentalTemplate ? "gap-2" : "gap-3")}>
							<AgentCardDescription
								className={cn(
									// Reserve the clamped line count so covers stay equal height
									// regardless of how many lines each description actually fills.
									isExperimentalTemplate ? "line-clamp-2 min-h-10" : "line-clamp-3 min-h-15",
									EXPERIMENTAL_COVER_TEXT_CLASS_NAME,
								)}
							>
								{description ?? `Learn how ${name} can help your team work faster.`}
							</AgentCardDescription>

							{showCoverActionRow ? (
								<>
									{showInlineStats ? (
										<div className="flex min-h-6 items-center justify-between gap-3">
											<AgentCardFooter className={cn("min-h-6 min-w-0 flex-1 items-center gap-4 [&_[data-slot=icon]]:text-current", EXPERIMENTAL_COVER_TEXT_CLASS_NAME)}>
												{visibleStats.length > 0 ? (
													visibleStats.map((stat, index) => (
														<AgentCardStat
															icon={getAgentCardStatIcon(stat, index)}
															key={stat.label}
														>
															{formatAgentCardStatText(stat)}
														</AgentCardStat>
													))
												) : (
													<>
														{showRating ? (
															<AgentCardStat
																icon={<StarUnstarredIcon label="" size="small" spacing="none" color="currentColor" />}
															>
																{rating.toFixed(1)}
																{typeof feedbackCount === "number" ? ` (${formatCompact(feedbackCount)} feedback)` : null}
															</AgentCardStat>
														) : null}
														{showChats ? (
															<AgentCardStat
																icon={<AiChatIcon label="" size="small" spacing="none" color="currentColor" />}
															>
																{formatCompact(chatCount)} chats
															</AgentCardStat>
														) : null}
													</>
												)}
											</AgentCardFooter>
										</div>
									) : null}
									<Button
										className={cn(
											"mt-2 w-full border-current bg-transparent hover:bg-white/20 active:bg-white/30",
											EXPERIMENTAL_COVER_TEXT_CLASS_NAME,
										)}
										onClick={handleUseTemplateClick}
										type="button"
										variant="outline"
									>
										Use template
									</Button>
								</>
							) : null}
						</div>
					</div>

					<div
						className="relative z-10 flex min-h-0 flex-auto flex-col rounded-b-[16px] bg-[var(--agent-card-detail-color)]"
						style={isExperimentalTemplate ? undefined : STAMP_PERFORATION_TOP_MASK_STYLE}
					>
						<div
							className="pointer-events-auto relative z-10 flex min-h-0 flex-auto flex-col gap-3 overflow-y-auto px-4 pt-4 pb-4 text-text [scrollbar-gutter:stable]"
							data-slot="agent-card-scroll"
							onClick={onSelect ? handleBodyClick : undefined}
							onScroll={handleBodyScroll}
							style={bodyScrolled ? AGENT_CARD_SCROLL_MASK_STYLE : undefined}
						>
							{showExperimentalCollaborators ? (
								<AgentCardSection label="Trusted by teammates" labelClassName={EXPERIMENTAL_DETAIL_TEXT_CLASS_NAME}>
									<AvatarGroup className="items-center *:data-[slot=avatar]:ring-[var(--agent-card-detail-color)]" label="Collaborators">
										{visibleCollaborators.map((person) => (
											<Avatar key={person.src} size="sm">
												<AvatarImage alt={person.name} src={person.src} />
												<AvatarFallback>{person.name.slice(0, 2)}</AvatarFallback>
											</Avatar>
										))}
										{showHiddenCollaboratorCount ? (
											<AvatarGroupCount className="ring-[var(--agent-card-detail-color)]">+{hiddenCollaboratorCount}</AvatarGroupCount>
										) : null}
									</AvatarGroup>
								</AgentCardSection>
							) : null}

							{sources.length > 0 ? (
								<AgentCardSection label="Works with" labelClassName={EXPERIMENTAL_DETAIL_TEXT_CLASS_NAME}>
									<TWGAppstack animated={false} className="justify-start" iconSize="small" maxVisible={7} sources={sources} />
								</AgentCardSection>
							) : null}

							{skills.length > 0 ? (
								<AgentCardSection label="Skills" labelClassName={EXPERIMENTAL_DETAIL_TEXT_CLASS_NAME}>
									<SkillTagGroup className={SKILLS_GROUP_CLASS_NAME} maxRows={SKILLS_MAX_ROWS}>
										{skills.map((skill) => (
											<SkillTag
												color={skill.color ?? "default"}
												icon={skill.icon ?? getSkillIcon(skill.label)}
												key={skill.label}
											>
												{skill.label}
											</SkillTag>
										))}
									</SkillTagGroup>
								</AgentCardSection>
							) : null}

							{capabilities.length > 0 ? (
								<>
									<div className={cn("py-1.5", EXPERIMENTAL_DETAIL_TEXT_CLASS_NAME)}>
										<Separator className="bg-current opacity-30" />
									</div>
									<AgentCardCapabilities
										iconClassName={EXPERIMENTAL_DETAIL_TEXT_CLASS_NAME}
										items={capabilities}
										itemClassName={EXPERIMENTAL_DETAIL_TEXT_CLASS_NAME}
										listClassName="gap-2"
									/>
								</>
							) : null}
						</div>
					</div>
				</div>
			</AgentCardShell>
		);
	}

	return (
		<AgentCardShell
			active={active}
			className={cn(
				"gap-0 overflow-visible rounded-[16px] bg-transparent p-0 after:rounded-[16px] after:border-0 [&_[data-slot=agent-card-select]]:rounded-[16px]",
				className,
			)}
			hoverShadow="none"
			onSelect={onSelect}
			selectLabel={`Select ${name}`}
		>
			<div className={EXPANDED_TICKET_WRAPPER_CLASS_NAME} data-slot="agent-card-ticket" ref={ticketRef}>
				<div
					aria-hidden
					className={cn(EXPANDED_TICKET_SHADOW_CLASS_NAME, active && "opacity-100")}
					data-slot="agent-card-ticket-shadow"
				>
					<div
						className="size-full rounded-[16px] bg-surface"
						data-slot="agent-card-ticket-shadow-shape"
						style={EXPANDED_TICKET_SHADOW_STYLE}
					/>
				</div>
				<div className="relative z-10 shrink-0" ref={ticketHeaderRef}>
					<div
						className="relative z-10 overflow-hidden rounded-t-[16px] border-x border-t border-border bg-surface [&_[data-slot=agent-card-banner]>div:first-child]:mb-[-1px] [&_[data-slot=agent-card-banner]>div:first-child]:h-[49px]"
						data-slot="agent-card-sticky-header"
						style={EXPANDED_TICKET_TOP_STYLE}
					>
						<AgentCardBanner avatarBadge={avatarBadge} avatarSrc={avatarSrc} backgroundColor={coverBackgroundColor} />
						<div className="px-4 pt-3 pb-4">
							<AgentCardHeader
								action={
									onMoreActions ? (
										<AgentCardMoreButton label={`More actions for ${name}`} onClick={onMoreActions} />
									) : null
								}
								byline={<AgentCardByline publisher={publisher} verified={verified} />}
								title={name}
							/>
							<AgentCardDescription className="mt-1">
								{description ?? `Learn how ${name} can help your team work faster.`}
							</AgentCardDescription>
							{showExpandedInlineStats ? (
								<AgentCardFooter className="mt-4">
									{expandedStats.length > 0 ? (
										expandedStats.map((stat, index) => (
											<AgentCardStat
												icon={getAgentCardStatIcon(stat, index)}
												key={stat.label}
											>
												{formatAgentCardStatText(stat)}
											</AgentCardStat>
										))
									) : (
										<>
											{showRating ? (
												<AgentCardStat
													icon={<StarUnstarredIcon label="" size="small" spacing="none" color="currentColor" />}
												>
													{rating.toFixed(1)}
													{typeof feedbackCount === "number" ? ` (${formatCompact(feedbackCount)} feedback)` : null}
												</AgentCardStat>
											) : null}
											{showChats ? (
												<AgentCardStat
													icon={<AiChatIcon label="" size="small" spacing="none" color="currentColor" />}
												>
													{formatCompact(chatCount)} chats
												</AgentCardStat>
											) : null}
										</>
									)}
								</AgentCardFooter>
							) : null}
						</div>
					</div>
				</div>

				<AgentCardTicketSeam />

				<div className="relative z-10 flex min-h-0 flex-auto flex-col">
					{/* Raise the ticket body above the absolute z-0 select-overlay button. The
					    inner div owns wheel/drag scrolling; plain clicks are forwarded to onSelect
					    (see handleBodyClick), while interactive descendants keep their behavior. */}
					<div
						className="pointer-events-auto relative z-10 flex min-h-0 flex-auto flex-col overflow-hidden rounded-b-[16px] border-x border-b border-border bg-surface"
						data-slot="agent-card-scroll"
						onClick={onSelect ? handleBodyClick : undefined}
						style={EXPANDED_TICKET_BOTTOM_STYLE}
					>
						<div
							className="relative z-10 flex min-h-0 flex-auto flex-col gap-3 overflow-y-auto px-4 pt-4 pb-4 text-text [scrollbar-gutter:stable]"
							onScroll={handleBodyScroll}
							style={bodyScrolled ? AGENT_CARD_SCROLL_MASK_STYLE : undefined}
						>
							{sources.length > 0 ? (
								<AgentCardSection label="Works with">
									<TWGAppstack animated={false} className="justify-start" iconSize="small" maxVisible={7} sources={sources} />
								</AgentCardSection>
							) : null}

							{skills.length > 0 ? (
								<AgentCardSection label="Skills">
									<SkillTagGroup className={SKILLS_GROUP_CLASS_NAME} maxRows={SKILLS_MAX_ROWS}>
										{skills.map((skill) => (
											<SkillTag color={skill.color ?? "default"} icon={skill.icon ?? getSkillIcon(skill.label)} key={skill.label}>
												{skill.label}
											</SkillTag>
										))}
									</SkillTagGroup>
								</AgentCardSection>
							) : null}

							{capabilities.length > 0 ? (
								<>
									<div className="py-1.5">
										<Separator />
									</div>
									<AgentCardCapabilities
										items={capabilities}
										label={capabilitiesLabel}
										listClassName="gap-2"
									/>
								</>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</AgentCardShell>
	);
}
