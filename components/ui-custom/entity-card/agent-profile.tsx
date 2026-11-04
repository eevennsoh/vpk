"use client";

import Image from "next/image";
import { type ComponentProps, type ReactElement, useCallback, useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import EditIcon from "@atlaskit/icon/core/edit";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StatusVerifiedIcon from "@atlaskit/icon/core/status-verified";

import { FloatingComposer } from "@/components/projects/shared/components/floating-composer";
import { RovoComposerActionButton } from "@/components/projects/shared/components/rovo-composer-send-controls";
import { floatingComposerTextareaClassName } from "@/components/projects/shared/components/rovo-composer-styles";
import { PromptInputButton, PromptInputTextarea } from "@/components/ui-custom/prompt-input";
import {
	Avatar,
	AvatarCompanyBadge,
	AvatarFallback,
	AvatarImage,
	AvatarProjectBadge,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AtlassianLogo, isAtlassianLogoSource } from "@/components/ui/logo";
import { LogoThirdParty } from "@/components/ui/logo-third-party";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { DEFAULT_AGENT_PROFILE_AVATAR_SRC, getAgentProfileBannerSrc, getUnmaskedAgentAvatarSrc } from "@/lib/agent-avatars";
import { cn } from "@/lib/utils";

const AGENT_CATEGORY_BANNER_COLOR: Record<string, string> = {
	"dev-agents": "#82B536",
	lime: "#82B536",
	"product-agents": "#BF63F3",
	purple: "#BF63F3",
	"service-agents": "#FFC716",
	yellow: "#FFC716",
	"strategy-agents": "#FCA700",
	orange: "#FCA700",
	"teamwork-agents": "#1868DB",
	blue: "#1868DB",
};

const DEFAULT_BANNER_COLOR = "#1868DB";

function getBannerColorFromAvatarSrc(src: string): string {
	const category = src.match(/\/avatar-agent(?:-new)?\/([^/]+)\//)?.[1];
	return (category && AGENT_CATEGORY_BANNER_COLOR[category]) ?? DEFAULT_BANNER_COLOR;
}

// How the agent is attributed below its name. Mirrors agent-card's
// `attributionKind`: a first/third-party company (logo company badge), a team
// (project tile badge), or a person (round photo badge).
export type AgentProfileAttributionKind = "company" | "team" | "person";

export interface EntityCardAgentProfileProps extends Omit<ComponentProps<"section">, "children"> {
	name?: string;
	partnerName?: string;
	/** Who published the agent. Drives the avatar attribution badge. Defaults to `"company"`. */
	attributionKind?: AgentProfileAttributionKind;
	/**
	 * Logo/photo for the attribution badge. A 3p app tile or company logo for
	 * `"company"`, a project tile for `"team"`, a headshot for `"person"`. When
	 * omitted, `"company"` falls back to the Atlassian glyph.
	 */
	partnerLogoSrc?: string;
	/** 3P partner brand id — renders the upstream package mark on the company badge. */
	partnerBrandName?: ThirdPartyLogoName;
	/** Shows the verified check beside the partner name. Defaults to `true`. */
	verified?: boolean;
	/** Elevation treatment. Overlay is intended for floating preview surfaces. */
	surface?: "raised" | "overlay";
	/**
	 * Footer affordance. `"chat"` (default) shows the AI input box for talking to
	 * the agent; `"preview"` swaps it for a single "View agent" call-to-action
	 * button that opens the agent.
	 */
	variant?: "chat" | "preview";
	description?: string;
	avatarSrc?: string;
	coverSrc?: string;
	avatarAlt?: string;
	coverBackgroundColor?: string;
	inputPlaceholder?: string;
	inputActionLabel?: string;
	editActionLabel?: string;
	moreActionLabel?: string;
	swapActionLabel?: string;
	/** Visible label for the `"preview"` variant button. Defaults to `"View agent"`. */
	previewActionLabel?: string;
	onInputAction?: (prompt: string) => void | Promise<void>;
	onEditAction?: () => void;
	onMoreAction?: () => void;
	onSwapAction?: () => void;
	onVoiceInput?: () => void;
	/** Called when the `"preview"` variant "View agent" button is selected. */
	onPreviewAction?: () => void;
}

export function EntityCardAgentProfile({
	name = "Task Improver",
	partnerName = "Atlassian",
	attributionKind = "company",
	partnerLogoSrc,
	partnerBrandName,
	verified = true,
	surface = "raised",
	variant = "chat",
	description = "Proactively assists by automatically suggesting subtasks when you start adding one and providing comment summaries.",
	avatarSrc = DEFAULT_AGENT_PROFILE_AVATAR_SRC,
	coverSrc = avatarSrc,
	avatarAlt = "",
	coverBackgroundColor,
	inputPlaceholder = "Ask, @mention, or / for actions",
	inputActionLabel,
	editActionLabel,
	moreActionLabel,
	swapActionLabel,
	previewActionLabel = "View agent",
	onInputAction,
	onEditAction,
	onMoreAction,
	onSwapAction,
	onVoiceInput,
	onPreviewAction,
	className,
	...props
}: Readonly<EntityCardAgentProfileProps>): ReactElement {
	const resolvedMoreActionLabel = moreActionLabel ?? `More actions for ${name}`;
	const resolvedSwapActionLabel = swapActionLabel ?? "Chat with agent";
	const resolvedEditActionLabel = editActionLabel ?? `Edit ${name}`;
	const resolvedCoverBackgroundColor =
		coverBackgroundColor ?? getBannerColorFromAvatarSrc(avatarSrc);
	// Smart-folder cover artwork picked deterministically per agent; its color
	// follows the avatar family so it matches the solid fallback shown until the
	// SVG paints. Mirrors AgentProfileCover backdrop.
	const resolvedBannerSrc = getAgentProfileBannerSrc(avatarSrc);
	const isAtlassianCover = isAtlassianLogoSource(coverSrc);
	const surfaceClassName = surface === "overlay" ? "bg-surface-overlay" : "bg-surface-raised";
	const shadowClassName = surface === "overlay" ? "shadow-2xl" : "shadow-sm";

	// Chat footer composer state. Mirrors the kanban card's
	// JiraIssueAgentActivityPanel so the agent profile card's input matches the
	// interactive FloatingComposer used across the app. `onVoiceInput` (legacy
	// prop) is folded into the realtime-voice toggle so existing callers keep
	// firing when voice is engaged.
	const [reply, setReply] = useState("");
	const [realtimeVoiceActive, setRealtimeVoiceActive] = useState(false);
	const [clickyActive, setClickyActive] = useState(false);
	const canSubmit = Boolean(reply.trim());

	const handleToggleRealtimeVoice = useCallback(() => {
		setClickyActive(false);
		setRealtimeVoiceActive((active) => !active);
		onVoiceInput?.();
	}, [onVoiceInput]);
	const handleStop = useCallback(() => {
		setRealtimeVoiceActive(false);
		setClickyActive(false);
	}, []);
	const handleToggleClicky = useCallback(() => {
		setRealtimeVoiceActive(true);
		setClickyActive((active) => !active);
	}, []);
	const handleComposerSubmit = useCallback(() => {
		const prompt = reply.trim();
		if (!prompt) return;
		setReply("");
		void onInputAction?.(prompt);
	}, [onInputAction, reply]);

	// Attribution badge overlaid on the agent avatar. Mirrors agent-card's
	// renderAvatarBadge: a company logo tile (Atlassian glyph when no logo is
	// supplied), a square project tile for a team, or a round headshot for a
	// person. The supplied assets are self-contained tiles, so `size-full
	// object-cover` lets them fill the badge regardless of intrinsic size.
	const renderAttributionBadge = () => {
		if (attributionKind === "person") {
			return partnerLogoSrc ? (
				<AvatarProjectBadge className="rounded-full">
					<Image alt="" aria-hidden className="size-full object-cover" height={40} src={partnerLogoSrc} width={40} />
				</AvatarProjectBadge>
			) : null;
		}
		if (attributionKind === "team") {
			return partnerLogoSrc ? (
				<AvatarProjectBadge>
					<Image alt="" aria-hidden className="size-full object-cover" height={40} src={partnerLogoSrc} width={40} />
				</AvatarProjectBadge>
			) : null;
		}
		return (
			<AvatarCompanyBadge>
				{partnerBrandName ? (
					<LogoThirdParty label="" name={partnerBrandName} size="xsmall" />
				) : partnerLogoSrc ? (
					<Image alt="" aria-hidden className="size-full object-cover" height={40} src={partnerLogoSrc} width={40} />
				) : (
					<AtlassianLogo
						appearance="inverse"
						label=""
						name="atlassian"
						shouldUseNewLogoDesign
						size="xxsmall"
						themeAware={false}
					/>
				)}
			</AvatarCompanyBadge>
		);
	};

	return (
		<section
			aria-label={`${name} agent card`}
			className={cn(
				"relative flex !h-auto w-[360px] max-w-full self-start flex-col overflow-hidden rounded-xl",
				surfaceClassName,
				shadowClassName,
				className,
			)}
			data-slot="agent-card"
			{...props}
		>
			<div
				aria-hidden="true"
				className="relative h-12 shrink-0 overflow-hidden bg-cover bg-center"
				style={{
					backgroundColor: resolvedCoverBackgroundColor,
					backgroundImage: `url("${resolvedBannerSrc}")`,
				}}
			>
				{isAtlassianCover ? (
					<span className="absolute top-1/2 left-[76%] -translate-x-1/2 -translate-y-1/2 opacity-95">
						<AtlassianLogo label="" name="atlassian" size="xlarge" />
					</span>
				) : (
					<Image
						alt=""
						aria-hidden
						className="absolute top-1/2 left-[76%] h-48 w-[168px] -translate-x-1/2 -translate-y-1/2 opacity-95"
						height={192}
						src={getUnmaskedAgentAvatarSrc(coverSrc)}
						width={168}
					/>
				)}
			</div>

			<div className={cn("flex flex-col gap-4 pt-6", surfaceClassName)}>
				<div className="flex w-full items-center justify-between gap-3 px-4 pt-2">
					<div className="flex min-w-0 flex-col gap-0">
						<h3 className="min-w-0 truncate text-base font-bold leading-5 text-text">
							{name}
						</h3>
						<p className="flex items-center gap-1 text-xs leading-4 text-text-subtle">
							<span>By</span>
							<span className="truncate text-link">{partnerName}</span>
							{verified ? (
								<Icon
									className="text-icon-information"
									render={<StatusVerifiedIcon label="Verified" size="small" color="currentColor" />}
								/>
							) : null}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Button
							aria-label={resolvedSwapActionLabel}
							className="size-6 rounded-md bg-surface p-0 text-icon-subtle"
							onClick={onSwapAction}
							size="icon-compact"
							type="button"
							variant="outline"
						>
							<AiChatIcon label="" size="small" />
						</Button>
						<Button
							aria-label={resolvedEditActionLabel}
							className="size-6 rounded-md bg-surface p-0 text-icon-subtle"
							onClick={onEditAction}
							size="icon-compact"
							type="button"
							variant="outline"
						>
							<EditIcon label="" size="small" />
						</Button>
						<Button
							aria-label={resolvedMoreActionLabel}
							className="size-6 rounded-md bg-surface p-0 text-icon-subtle"
							onClick={onMoreAction}
							size="icon-compact"
							type="button"
							variant="outline"
						>
							<ShowMoreHorizontalIcon label="" size="small" />
						</Button>
					</div>
				</div>
				<p className="px-4 pb-4 text-sm leading-5 text-text">
					{description}
				</p>
			</div>

			<div className={cn("flex px-3 pb-3", surfaceClassName)}>
				{variant === "preview" ? (
					<Button className="w-full" onClick={onPreviewAction} type="button" variant="outline">
						{previewActionLabel}
					</Button>
				) : (
					<FloatingComposer
						actions={
							<RovoComposerActionButton
								canSubmit={canSubmit}
								clickyActive={clickyActive}
								composerStatus="ready"
								onStop={handleStop}
								onToggleClicky={handleToggleClicky}
								onToggleRealtimeVoice={handleToggleRealtimeVoice}
								realtimeVoiceActive={realtimeVoiceActive}
							/>
						}
						addButton={
							<PromptInputButton aria-label="Add" size="icon-sm" variant="ghost">
								<AddIcon label="" />
							</PromptInputButton>
						}
						allowOverflow
						aria-label={inputActionLabel ?? inputPlaceholder}
						onSubmit={handleComposerSubmit}
					>
						<PromptInputTextarea
							aria-label={inputActionLabel ?? inputPlaceholder}
							className={cn(floatingComposerTextareaClassName, "text-sm leading-5")}
							enableDirectoryAutocomplete={false}
							onChange={(event) => setReply(event.currentTarget.value)}
							placeholder={inputPlaceholder}
							rows={1}
							value={reply}
						/>
					</FloatingComposer>
				)}
			</div>

			<Avatar
				aria-hidden={avatarAlt === ""}
				className={cn(
					"absolute top-6 left-4",
					// Card-only 2px white border tracing the hexagon. The shared hexagon
					// border draws via an SVG <polygon> with mix-blend-darken, which would
					// erase a white stroke — so reset the blend mode, then recolor/thicken
					// the stroke to match the white ring on the adjacent company badge.
					"[&>svg]:mix-blend-normal dark:[&>svg]:mix-blend-normal",
					"[&>svg>polygon]:stroke-white [&>svg>polygon]:[stroke-width:2]",
				)}
				shape="hexagon"
				size="xl"
			>
				<AvatarImage alt={avatarAlt} src={avatarSrc} />
				<AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
				{renderAttributionBadge()}
			</Avatar>
		</section>
	);
}
