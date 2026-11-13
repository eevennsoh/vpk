"use client";

import { Fragment, useState } from "react";
import Image from "next/image";

import EditIcon from "@atlaskit/icon/core/edit";

import {
	AGENT_AVATAR_OPTION_GROUPS,
	AGENT_AVATAR_OPTION_SRCS,
} from "@/components/blocks/agent/data/agent-avatar-options";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	dropdownStyles,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AtlassianLogo, isAtlassianLogoSource } from "@/components/ui/logo";
import { getUnmaskedAgentAvatarSrc } from "@/lib/agent-avatars";

const AGENT_AVATAR_HEXAGON_PATH = "M19.01 0.922148C20.24 0.212148 21.76 0.212148 23 0.922148L40 10.6921C41.24 11.4021 42.01 12.7321 42.01 14.1621V33.6721C42.01 35.1021 41.24 36.4221 40 37.1421L23 46.9121C21.77 47.6221 20.25 47.6221 19.01 46.9121L2.01 37.1321C0.77 36.4221 0 35.0921 0 33.6621V14.1621C0 12.7321 0.77 11.4121 2.01 10.6921L19.01 0.922148Z";
export const AGENT_AVATAR_SRC = "/avatar-agent-new/blue/backlog-buddy.svg";
const AGENT_AVATAR_OPTION_SRC_SET = new Set<string>(AGENT_AVATAR_OPTION_SRCS);
const DEFAULT_AGENT_PROFILE_COVER_COLOR = "#1868DB";
const AGENT_AVATAR_PROFILE_COVER_COLORS: Record<string, string> = {
	"dev-agents": "#82B536",
	lime: "#82B536",
	"product-agents": "#BF63F3",
	purple: "#BF63F3",
	"service-agents": "#FFC716",
	yellow: "#FFC716",
	"strategy-agents": "#FCA700",
	orange: "#FCA700",
	"teamwork-agents": DEFAULT_AGENT_PROFILE_COVER_COLOR,
	blue: DEFAULT_AGENT_PROFILE_COVER_COLOR,
};

function getAgentProfileCoverBackgroundColor(avatarSrc: string | undefined): string {
	const category = avatarSrc?.match(/\/avatar-agent(?:-new)?\/([^/]+)\//u)?.[1];
	return (category ? AGENT_AVATAR_PROFILE_COVER_COLORS[category] : undefined) ?? DEFAULT_AGENT_PROFILE_COVER_COLOR;
}

function AgentProfileAvatarGraphic({
	avatarSrc,
	isAtlassianAvatar,
}: Readonly<{
	avatarSrc: string;
	isAtlassianAvatar: boolean;
}>) {
	return isAtlassianAvatar ? (
		<span className="flex h-12 w-[42px] items-center justify-center">
			<AtlassianLogo name="atlassian" label="Agent avatar" size="large" />
		</span>
	) : (
		<Image
			alt="Agent avatar"
			className="h-12 w-[42px]"
			height={48}
			src={avatarSrc}
			width={42}
		/>
	);
}

function AgentProfileAvatarHexStroke() {
	return (
		<svg
			aria-hidden="true"
			className="pointer-events-none absolute top-0 left-0 size-auto h-12 w-[42px] overflow-visible"
			focusable="false"
			viewBox="0 0 43 48"
		>
			<path
				className="stroke-surface"
				d={AGENT_AVATAR_HEXAGON_PATH}
				fill="none"
				strokeWidth={2}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

function AgentAvatarOptionPreview({ src }: Readonly<{ src: string }>) {
	return (
		<Avatar aria-hidden shape="hexagon" size="sm" className="h-10 w-[35px]">
			<AvatarImage alt="" src={src} className="object-contain" />
		</Avatar>
	);
}

/**
 * Stable screen-assistant target id for one avatar swatch, so the cursor can
 * point at or click a specific option. Mirrors the trigger id
 * (`<prefix>:avatar`) with the group id and the option's file slug appended.
 */
function getAgentAvatarOptionTargetId(prefix: string, groupId: string, src: string): string {
	const optionId = src.split("/").pop()?.replace(/\.svg$/, "") ?? src;
	return `${prefix}:avatar:${groupId}:${optionId}`;
}

function AgentAvatarPickerMenu({
	avatarSrc,
	isAtlassianAvatar,
	onAvatarChange,
	screenAssistantTargetPrefix,
}: Readonly<{
	avatarSrc: string;
	isAtlassianAvatar: boolean;
	onAvatarChange: (avatarSrc: string) => void;
	screenAssistantTargetPrefix?: string;
}>) {
	const [open, setOpen] = useState(false);
	const selectedAvatarSrc = AGENT_AVATAR_OPTION_SRC_SET.has(avatarSrc) ? avatarSrc : "";

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger
				aria-label="Change agent avatar"
				data-agent-field="avatar"
				data-screen-assistant-target={screenAssistantTargetPrefix ? `${screenAssistantTargetPrefix}:avatar` : undefined}
				render={(
					<Button
						className="group/avatar-picker relative h-12 w-[42px] overflow-visible rounded-xl border-0 bg-transparent p-0 hover:bg-transparent active:bg-transparent aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:text-text-subtle focus-visible:ring-3 focus-visible:ring-ring/50"
						size="icon"
						type="button"
						variant="ghost"
					/>
				)}
			>
				<AgentProfileAvatarGraphic avatarSrc={avatarSrc} isAtlassianAvatar={isAtlassianAvatar} />
				{!open ? (
					<span
						aria-hidden
						className="pointer-events-none absolute top-0 left-0 flex h-12 w-[42px] items-center justify-center bg-blanket/80 text-icon-inverse opacity-0 transition-opacity [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] group-hover/avatar-picker:opacity-100 group-focus-visible/avatar-picker:opacity-100 [&_svg]:size-4"
						data-agent-avatar-edit-cue
					>
						<EditIcon label="" size="small" />
					</span>
				) : null}
				<AgentProfileAvatarHexStroke />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[348px] p-2" sideOffset={8}>
				<DropdownMenuRadioGroup
					value={selectedAvatarSrc}
					onValueChange={(nextAvatarSrc) => {
						onAvatarChange(nextAvatarSrc);
						setOpen(false);
					}}
				>
					{AGENT_AVATAR_OPTION_GROUPS.map((group) => (
						<Fragment key={group.id}>
							<div className={dropdownStyles.label}>{group.label}</div>
							<div className="grid grid-cols-7 gap-1 px-1 pb-1">
								{group.options.map((option) => (
									<DropdownMenuRadioItem
										aria-label={`Use ${group.label} ${option.label} avatar`}
										className="group/avatar-option h-12 min-h-0 w-11 justify-center rounded-lg bg-transparent p-1! pr-1! pl-1! data-[highlighted]:bg-bg-neutral-subtle-hovered data-[highlighted]:text-text active:bg-bg-neutral-subtle-pressed data-checked:bg-bg-selected data-checked:text-text-selected data-checked:data-[highlighted]:bg-bg-selected-hovered data-checked:data-[highlighted]:text-text-selected data-checked:active:bg-bg-selected-pressed [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
										key={option.src}
										title={`${group.label} ${option.label}`}
										data-screen-assistant-target={screenAssistantTargetPrefix ? getAgentAvatarOptionTargetId(screenAssistantTargetPrefix, group.id, option.src) : undefined}
										value={option.src}
									>
										<AgentAvatarOptionPreview
											src={option.src}
										/>
									</DropdownMenuRadioItem>
								))}
							</div>
						</Fragment>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function AgentProfileCover({
	avatarSrc = AGENT_AVATAR_SRC,
	onAvatarChange,
	bannerSrc,
	screenAssistantTargetPrefix,
}: Readonly<{
	avatarSrc?: string;
	onAvatarChange?: (avatarSrc: string) => void;
	// Cover-banner artwork from `/smart-folders`, picked deterministically per
	// agent so every cover shows a varied design + color (see
	// getDeterministicAgentBannerSrc). The solid color below shows only until the
	// artwork paints.
	bannerSrc: string;
	screenAssistantTargetPrefix?: string;
}>) {
	const coverBackgroundColor = getAgentProfileCoverBackgroundColor(avatarSrc);
	const isAtlassianAvatar = isAtlassianLogoSource(avatarSrc);

	return (
		<div className="relative overflow-hidden rounded-t-xl bg-surface text-text">
			<div
				className="relative h-20 overflow-hidden bg-cover bg-center"
				style={{
					backgroundColor: coverBackgroundColor,
					backgroundImage: `url("${bannerSrc}")`,
				}}
			>
				{isAtlassianAvatar ? (
					<span className="absolute top-1/2 left-[88%] -translate-x-1/2 -translate-y-1/2 opacity-95">
						<AtlassianLogo name="atlassian" label="Atlassian" size="xlarge" />
					</span>
				) : (
					<Image
						alt=""
						aria-hidden
						className="absolute top-1/2 left-[88%] h-48 w-[168px] -translate-x-1/2 -translate-y-1/2 opacity-95"
						height={192}
						src={getUnmaskedAgentAvatarSrc(avatarSrc)}
						width={168}
					/>
				)}
			</div>
			<div aria-hidden className="h-6" />
			{/* Avatar straddles the banner's bottom edge: top = bannerHeight - 24px
			    (half the 48px avatar). The 80px banner puts it at top-14, and the
			    24px overhang below the banner keeps the h-6 spacer above correct. */}
			<div className="absolute top-14 left-4 size-12">
				{onAvatarChange ? (
					<AgentAvatarPickerMenu
						avatarSrc={avatarSrc}
						isAtlassianAvatar={isAtlassianAvatar}
						onAvatarChange={onAvatarChange}
						screenAssistantTargetPrefix={screenAssistantTargetPrefix}
					/>
				) : (
					<>
						<AgentProfileAvatarGraphic avatarSrc={avatarSrc} isAtlassianAvatar={isAtlassianAvatar} />
						<AgentProfileAvatarHexStroke />
					</>
				)}
			</div>
		</div>
	);
}
