"use client";

/* eslint-disable @next/next/no-img-element -- These component primitives render arbitrary preview/avatar/image payloads where Next Image sizing/loading would change the public API. */

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { type CSSProperties, type MouseEvent, type ReactNode, type UIEvent, useCallback, useState } from "react";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import StarUnstarredIcon from "@atlaskit/icon/core/star-unstarred";

import { Avatar, AvatarCompanyBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage, AvatarProjectBadge } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AtlassianLogo } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { Separator } from "@/components/ui/separator";
import { SkillTag, SkillTagGroup, type SkillTagColor } from "@/components/ui-custom/skill-tag";
import { TWGAppstack, type TwgToolSource } from "@/components/ui-custom/twg-appstack";
import { cn } from "@/lib/utils";

import {
	EntityCardBanner,
	EntityCardByline,
	EntityCardCapabilities,
	EntityCardDescription,
	EntityCardFooter,
	EntityCardHeader,
	EntityCardMoreButton,
	EntityCardSection,
	EntityCardStat,
	type EntityCardCapability,
	formatCompact,
} from "./parts";

/** A skill tag shown in the expanded agent card's "Skills" section. */
export interface EntityCardSkillTag {
	label: string;
	color?: SkillTagColor;
	icon?: ReactNode;
}

const MAX_VISIBLE_COLLABORATORS = 4;
const ENTITY_CARD_SKILLS_MAX_ROWS = 2;
const ENTITY_CARD_SKILLS_GROUP_CLASS_NAME = "h-11 content-start overflow-clip [overflow-clip-margin:3px]";
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
const ENTITY_CARD_SCROLL_MASK_IMAGE = [
	"linear-gradient(to bottom, transparent 0, black var(--scroll-mask-fade-size), black 100%)",
	"linear-gradient(black, black)",
].join(", ");
const ENTITY_CARD_SCROLL_MASK_STYLE = {
	"--scroll-mask-fade-size": "var(--ds-space-200)",
	"--scroll-mask-scrollbar-width": "10px",
	maskImage: ENTITY_CARD_SCROLL_MASK_IMAGE,
	WebkitMaskImage: ENTITY_CARD_SCROLL_MASK_IMAGE,
	maskPosition: "0 0, 100% 0",
	WebkitMaskPosition: "0 0, 100% 0",
	maskRepeat: "no-repeat, no-repeat",
	WebkitMaskRepeat: "no-repeat, no-repeat",
	maskSize: "calc(100% - var(--scroll-mask-scrollbar-width)) 100%, var(--scroll-mask-scrollbar-width) 100%",
	WebkitMaskSize: "calc(100% - var(--scroll-mask-scrollbar-width)) 100%, var(--scroll-mask-scrollbar-width) 100%",
} satisfies CSSProperties & {
	"--scroll-mask-fade-size": string;
	"--scroll-mask-scrollbar-width": string;
};

function getProjectBadgeAvatarSrc(seed: string) {
	let hash = 0;

	for (let index = 0; index < seed.length; index += 1) {
		hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
	}

	return PROJECT_BADGE_AVATAR_SRCS[hash % PROJECT_BADGE_AVATAR_SRCS.length];
}

export interface EntityCardAgentExpandedProps {
	name: string;
	avatarSrc?: string;
	publisher: string;
	attributionKind?: "company" | "team" | "person";
	publisherLogoSrc?: string;
	/** 3P publisher brand id — renders the upstream package mark on the company badge. */
	publisherBrandName?: ThirdPartyLogoName;
	description?: string;
	capabilities: readonly (EntityCardCapability | string)[];
	capabilitiesLabel?: string;
	sources?: ReadonlyArray<TwgToolSource>;
	skills?: ReadonlyArray<EntityCardSkillTag>;
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
	className?: string;
}

export function EntityCardAgentExpanded({
	name,
	avatarSrc,
	publisher,
	attributionKind,
	publisherLogoSrc,
	publisherBrandName,
	description,
	capabilities,
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
	className,
}: Readonly<EntityCardAgentExpandedProps>) {
	const showStats = stats.length > 0;
	const showRating = !showStats && typeof rating === "number";
	const showChats = !showStats && typeof chatCount === "number";
	const showCollaborators = collaborators.length > 0;
	const showFooter = showStats || showRating || showChats || showCollaborators;
	const [bodyScrolled, setBodyScrolled] = useState(false);
	const visibleCollaborators = collaborators.slice(0, MAX_VISIBLE_COLLABORATORS);
	const hiddenCollaboratorCount =
		Math.max(collaborators.length - MAX_VISIBLE_COLLABORATORS, 0) + (collaboratorOverflow ?? 0);
	const showHiddenCollaboratorCount =
		visibleCollaborators.length === MAX_VISIBLE_COLLABORATORS && hiddenCollaboratorCount > 0;
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
	// clicks that originate on a genuinely interactive control (menus, the footer
	// button, links) are ignored here so they keep their own behavior.
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
	const projectBadgeAvatarSrc = getProjectBadgeAvatarSrc(`${publisher}:${name}`);
	const avatarBadge = (() => {
		if (attributionKind === "company") {
			return (
				<AvatarCompanyBadge>
					{publisherBrandName ? (
						<LogoThirdParty label="" name={publisherBrandName} size="xsmall" />
					) : publisherLogoSrc ? (
						<img alt="" aria-hidden height={16} src={publisherLogoSrc} width={16} />
					) : (
						<AtlassianLogo
							appearance="inverse"
							label=""
							name="atlassian"
							size="xxsmall"
							themeAware={false}
						/>
					)}
				</AvatarCompanyBadge>
			);
		}

		if (attributionKind === "team") {
			return (
				<AvatarProjectBadge>
					<img alt="" aria-hidden height={16} src={publisherLogoSrc ?? projectBadgeAvatarSrc} width={16} />
				</AvatarProjectBadge>
			);
		}

		return null;
	})();

	return (
		<div data-slot="entity-card-agent-expanded" className={cn("contents", className)}>
			<div className="shrink-0 bg-surface" data-slot="card-directory-sticky-header">
				<EntityCardBanner avatarBadge={avatarBadge} avatarSrc={avatarSrc} backgroundColor={coverBackgroundColor} />
				<div className="px-4 pt-3">
					<EntityCardHeader
						action={
							onMoreActions ? (
								<EntityCardMoreButton label={`More actions for ${name}`} onClick={onMoreActions} />
							) : null
						}
						byline={<EntityCardByline publisher={publisher} verified={verified} />}
						title={name}
					/>
					<EntityCardDescription className="mt-1">
						{description ?? `Learn how ${name} can help your team work faster.`}
					</EntityCardDescription>
				</div>
			</div>

			{/* Raise the scroll body above the absolute `z-0` select-overlay button and
			    give it pointer-events so wheel/drag scroll lands here instead of being
			    swallowed by the button painted on top — the parent is `display:contents`,
			    so the shell's `[&>*]:relative [&>*]:z-10` never reaches this grandchild.
			    Because the body now covers the select button, plain clicks on it are
			    forwarded to onSelect (see handleBodyClick) so whole-card selection still
			    works, while genuinely interactive descendants keep their own behavior. */}
			<div
				className="pointer-events-auto relative z-10 flex min-h-0 flex-auto flex-col gap-3 overflow-y-auto px-4 pt-2 [scrollbar-gutter:stable]"
				data-slot="card-directory-scroll"
				onClick={onSelect ? handleBodyClick : undefined}
				onScroll={handleBodyScroll}
				style={bodyScrolled ? ENTITY_CARD_SCROLL_MASK_STYLE : undefined}
			>
				{sources.length > 0 ? (
					<EntityCardSection label="Works with">
						<TWGAppstack animated={false} className="justify-start" iconSize="small" maxVisible={8} sources={sources} />
					</EntityCardSection>
				) : null}

				{skills.length > 0 ? (
					<EntityCardSection label="Skills">
						<SkillTagGroup className={ENTITY_CARD_SKILLS_GROUP_CLASS_NAME} maxRows={ENTITY_CARD_SKILLS_MAX_ROWS}>
							{skills.map((skill) => (
								<SkillTag color={skill.color ?? "default"} icon={skill.icon} key={skill.label}>
									{skill.label}
								</SkillTag>
							))}
						</SkillTagGroup>
					</EntityCardSection>
				) : null}

				<div className="py-1.5">
					<Separator />
				</div>

				<div className="pb-4">
					<EntityCardCapabilities items={capabilities} label={capabilitiesLabel} />
				</div>
			</div>

			{showFooter ? (
				<div className="relative shrink-0 overflow-clip border-t border-border bg-surface">
					<EntityCardFooter className="justify-between px-4 py-3 transition-opacity duration-fast ease-out group-hover/card:opacity-0 group-has-[:focus-visible]/card:opacity-0">
						<div className="flex items-center gap-6">
							{showStats ? (
								stats.map((stat) => (
									<div className="flex flex-col" key={stat.label}>
										<span className="text-sm font-semibold leading-5 text-text">{stat.value}</span>
										<span className="leading-4">{stat.label}</span>
									</div>
								))
							) : (
								<div className="flex items-center gap-4">
									{showRating ? (
										<EntityCardStat
											icon={<StarUnstarredIcon label="" size="small" spacing="none" color="currentColor" />}
										>
											{rating.toFixed(1)}
											{typeof feedbackCount === "number" ? ` (${formatCompact(feedbackCount)} feedback)` : null}
										</EntityCardStat>
									) : null}
									{showChats ? (
										<EntityCardStat
											icon={<AiChatIcon label="" size="small" spacing="none" color="currentColor" />}
										>
											{formatCompact(chatCount)} chats
										</EntityCardStat>
									) : null}
								</div>
							)}
						</div>
						{showCollaborators ? (
							<AvatarGroup label="Collaborators">
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
						) : null}
					</EntityCardFooter>
					<div className="pointer-events-none absolute inset-0 flex items-center px-4 py-2 opacity-0 transition-opacity duration-fast ease-out group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100">
						<Button
							className="w-full"
							onClick={handleUseTemplateClick}
							tabIndex={-1}
							type="button"
							variant="outline"
						>
							Use template
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}
