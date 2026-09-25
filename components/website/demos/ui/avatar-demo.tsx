"use client";

import Image from "next/image";
import AddIcon from "@atlaskit/icon/core/add";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";

import { PlusIcon } from "@/components/ui/vpk-icons";
import { Avatar, AvatarBadge, AvatarCompanyBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage, AvatarPresenceIndicator, AvatarProjectBadge, AvatarStatusIndicator, AvatarUnassigned } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AtlassianLogo } from "@/components/ui/logo";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";

const PRIMARY_AVATAR_SRC = "/avatar-user/venn/venn.png";
const BADGE_ICON_AVATAR_SRC = "/avatar-user/ali/color/asow-teamwork-blue.png";
const BADGE_AVATAR_SRC = "/avatar-user/olivia-yang/color/asow-service-yellow.png";
const GROUP_AVATAR_TWO_SRC = "/avatar-user/nova/color/asow-service-yellow.png";
const GROUP_AVATAR_THREE_SRC = "/avatar-user/maia-ma/color/asow-service-yellow.png";
const AVATAR_GROUP_SIZES = [
	{ label: "16px", size: "xs", sizePx: 16 },
	{ label: "24px", size: "sm", sizePx: 24 },
	{ label: "32px", size: "default", sizePx: 32 },
	{ label: "40px", size: "lg", sizePx: 40 },
] as const;
const HUMAN_GROUP_AVATARS = [
	{ alt: "Team member", fallback: "CN", src: PRIMARY_AVATAR_SRC },
	{ alt: "Nova", fallback: "LR", src: GROUP_AVATAR_TWO_SRC },
	{ alt: "Maia Ma", fallback: "ER", src: GROUP_AVATAR_THREE_SRC },
] as const;
const AGENT_GROUP_AVATARS = [
	{ label: "Code planner", src: "/avatar-agent/dev-agents/code-planner.svg" },
	{ label: "Feedback analyzer", src: "/avatar-agent/product-agents/feedback-analyzer.svg" },
	{ label: "Service triage", src: "/avatar-agent/service-agents/service-triage.svg" },
] as const;

export default function AvatarDemo() {
	return (
		<div className="flex items-center gap-2">
			<Avatar>
				<AvatarImage src={PRIMARY_AVATAR_SRC} alt="User" />
				<AvatarFallback>SC</AvatarFallback>
			</Avatar>
			<Avatar>
				<AvatarFallback>JD</AvatarFallback>
			</Avatar>
			<Avatar size="sm">
				<AvatarFallback>SM</AvatarFallback>
			</Avatar>
		</div>
	);
}

export function AvatarDemoBadgeWithIcon() {
	return (
		<div className="flex flex-col items-start gap-6">
			<div className="flex flex-wrap items-center gap-2">
				<Avatar size="sm">
					<AvatarImage
						src={BADGE_ICON_AVATAR_SRC}
						alt="Ali"
					/>
					<AvatarFallback>PP</AvatarFallback>
					<AvatarBadge>
						<Icon aria-hidden render={<AddIcon label="" size="small" />} />
					</AvatarBadge>
				</Avatar>
				<Avatar>
					<AvatarImage
						src={BADGE_ICON_AVATAR_SRC}
						alt="Ali"
					/>
					<AvatarFallback>PP</AvatarFallback>
					<AvatarBadge>
						<Icon aria-hidden render={<AddIcon label="" size="small" />} />
					</AvatarBadge>
				</Avatar>
				<Avatar size="lg">
					<AvatarImage
						src={BADGE_ICON_AVATAR_SRC}
						alt="Ali"
					/>
					<AvatarFallback>PP</AvatarFallback>
					<AvatarBadge>
						<Icon aria-hidden render={<AddIcon label="" size="small" />} />
					</AvatarBadge>
				</Avatar>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Avatar size="sm">
					<AvatarFallback>PP</AvatarFallback>
					<AvatarBadge>
						<Icon aria-hidden render={<CheckMarkIcon label="" size="small" />} />
					</AvatarBadge>
				</Avatar>
				<Avatar>
					<AvatarFallback>PP</AvatarFallback>
					<AvatarBadge>
						<Icon aria-hidden render={<CheckMarkIcon label="" size="small" />} />
					</AvatarBadge>
				</Avatar>
				<Avatar size="lg">
					<AvatarFallback>PP</AvatarFallback>
					<AvatarBadge>
						<Icon aria-hidden render={<CheckMarkIcon label="" size="small" />} />
					</AvatarBadge>
				</Avatar>
			</div>
		</div>
	);
}

export function AvatarDemoBadge() {
	return (
		<div className="flex flex-col items-start gap-6">
			<div className="flex flex-wrap items-center gap-2">
				<Avatar size="sm">
					<AvatarImage
						src={BADGE_AVATAR_SRC}
						alt="Olivia Yang"
					/>
					<AvatarFallback>JZ</AvatarFallback>
					<AvatarBadge />
				</Avatar>
				<Avatar>
					<AvatarImage
						src={BADGE_AVATAR_SRC}
						alt="Olivia Yang"
					/>
					<AvatarFallback>JZ</AvatarFallback>
					<AvatarBadge />
				</Avatar>
				<Avatar size="lg">
					<AvatarImage
						src={BADGE_AVATAR_SRC}
						alt="Olivia Yang"
					/>
					<AvatarFallback>JZ</AvatarFallback>
					<AvatarBadge />
				</Avatar>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Avatar size="sm">
					<AvatarFallback>JZ</AvatarFallback>
					<AvatarBadge />
				</Avatar>
				<Avatar>
					<AvatarFallback>JZ</AvatarFallback>
					<AvatarBadge />
				</Avatar>
				<Avatar size="lg">
					<AvatarFallback>JZ</AvatarFallback>
					<AvatarBadge />
				</Avatar>
			</div>
		</div>
	);
}

export function AvatarDemoDefault() {
	return (
		<Avatar>
			<AvatarImage src={PRIMARY_AVATAR_SRC} alt="User avatar" />
			<AvatarFallback>CN</AvatarFallback>
		</Avatar>
	);
}

export function AvatarDemoUnassigned() {
	return (
		<div className="flex flex-wrap items-center gap-4">
			<div className="flex flex-col items-center gap-1">
				<AvatarUnassigned />
				<span className="text-xs text-text-subtle">Person</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<AvatarUnassigned kind="agent" />
				<span className="text-xs text-text-subtle">Agent</span>
			</div>
		</div>
	);
}

export function AvatarDemoGroupWithCount() {
	return (
		<div className="flex flex-col items-start gap-6">
			<AvatarGroup>
				<Avatar size="sm">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Team member" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar size="sm">
					<AvatarImage
						src={GROUP_AVATAR_TWO_SRC}
						alt="Nova"
					/>
					<AvatarFallback>LR</AvatarFallback>
				</Avatar>
				<Avatar size="sm">
					<AvatarImage
						src={GROUP_AVATAR_THREE_SRC}
						alt="Maia Ma"
					/>
					<AvatarFallback>ER</AvatarFallback>
				</Avatar>
				<AvatarGroupCount>+3</AvatarGroupCount>
			</AvatarGroup>
			<AvatarGroup>
				<Avatar>
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Team member" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage
						src={GROUP_AVATAR_TWO_SRC}
						alt="Nova"
					/>
					<AvatarFallback>LR</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage
						src={GROUP_AVATAR_THREE_SRC}
						alt="Maia Ma"
					/>
					<AvatarFallback>ER</AvatarFallback>
				</Avatar>
				<AvatarGroupCount>+3</AvatarGroupCount>
			</AvatarGroup>
			<AvatarGroup>
				<Avatar size="lg">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Team member" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarImage
						src={GROUP_AVATAR_TWO_SRC}
						alt="Nova"
					/>
					<AvatarFallback>LR</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarImage
						src={GROUP_AVATAR_THREE_SRC}
						alt="Maia Ma"
					/>
					<AvatarFallback>ER</AvatarFallback>
				</Avatar>
				<AvatarGroupCount>+3</AvatarGroupCount>
			</AvatarGroup>
		</div>
	);
}

export function AvatarDemoGroupWithIconCount() {
	return (
		<div className="flex flex-col items-start gap-6">
			<AvatarGroup size="sm">
				<Avatar size="sm">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Team member" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar size="sm">
					<AvatarImage
						src={GROUP_AVATAR_TWO_SRC}
						alt="Nova"
					/>
					<AvatarFallback>LR</AvatarFallback>
				</Avatar>
				<Avatar size="sm">
					<AvatarImage
						src={GROUP_AVATAR_THREE_SRC}
						alt="Maia Ma"
					/>
					<AvatarFallback>ER</AvatarFallback>
				</Avatar>
				<AvatarGroupCount>
					<PlusIcon />
				</AvatarGroupCount>
			</AvatarGroup>
			<AvatarGroup label="24px agent avatar group with icon count" size="sm">
				{AGENT_GROUP_AVATARS.map((agent) => (
					<AgentAvatarVisual
						avatarSrc={agent.src}
						key={agent.label}
						label={agent.label}
						sizePx={24}
					/>
				))}
				<Avatar
					aria-hidden
					className="pointer-events-none relative z-10 text-icon-subtle"
					shape="hexagon"
					size="sm"
				>
					<span className="flex size-full items-center justify-center bg-bg-neutral text-icon-subtle">
						<PlusIcon size="small" />
					</span>
				</Avatar>
			</AvatarGroup>
			<AvatarGroup size="default">
				<Avatar>
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Team member" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage
						src={GROUP_AVATAR_TWO_SRC}
						alt="Nova"
					/>
					<AvatarFallback>LR</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage
						src={GROUP_AVATAR_THREE_SRC}
						alt="Maia Ma"
					/>
					<AvatarFallback>ER</AvatarFallback>
				</Avatar>
				<AvatarGroupCount>
					<PlusIcon />
				</AvatarGroupCount>
			</AvatarGroup>
			<AvatarGroup size="lg">
				<Avatar size="lg">
					<AvatarImage
						src={PRIMARY_AVATAR_SRC}
						alt="Team member"
						className="grayscale"
					/>
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarImage
						src={GROUP_AVATAR_TWO_SRC}
						alt="Nova"
						className="grayscale"
					/>
					<AvatarFallback>LR</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarImage
						src={GROUP_AVATAR_THREE_SRC}
						alt="Maia Ma"
						className="grayscale"
					/>
					<AvatarFallback>ER</AvatarFallback>
				</Avatar>
				<AvatarGroupCount>
					<PlusIcon />
				</AvatarGroupCount>
			</AvatarGroup>
		</div>
	);
}

export function AvatarDemoGroup() {
	return (
		<div className="flex flex-col items-start gap-6">
			{AVATAR_GROUP_SIZES.map(({ label, size }) => (
				<div className="flex flex-col items-center gap-1.5" key={size}>
					<AvatarGroup label={`${label} human avatar group`}>
						{HUMAN_GROUP_AVATARS.map((avatar) => (
							<Avatar key={avatar.alt} size={size}>
								<AvatarImage alt={avatar.alt} src={avatar.src} />
								<AvatarFallback>{avatar.fallback}</AvatarFallback>
							</Avatar>
						))}
					</AvatarGroup>
					<span className="text-xs text-text-subtle">{label}</span>
				</div>
			))}
		</div>
	);
}

export function AvatarDemoInEmpty() {
	return (
		<Empty className="w-full flex-none border">
			<EmptyHeader>
				<EmptyMedia>
					<AvatarGroup>
						<Avatar size="lg">
							<AvatarImage
								src={PRIMARY_AVATAR_SRC}
								alt="Team member"
								className="grayscale"
							/>
							<AvatarFallback>CN</AvatarFallback>
						</Avatar>
						<Avatar size="lg">
							<AvatarImage
								src={GROUP_AVATAR_TWO_SRC}
								alt="Nova"
								className="grayscale"
							/>
							<AvatarFallback>LR</AvatarFallback>
						</Avatar>
						<Avatar size="lg">
							<AvatarImage
								src={GROUP_AVATAR_THREE_SRC}
								alt="Maia Ma"
								className="grayscale"
							/>
							<AvatarFallback>ER</AvatarFallback>
						</Avatar>
						<AvatarGroupCount>
							<PlusIcon />
						</AvatarGroupCount>
					</AvatarGroup>
				</EmptyMedia>
				<EmptyTitle>No Team Members</EmptyTitle>
				<EmptyDescription>
					Invite your team to collaborate on this project.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button>
					<PlusIcon />
					Invite Members
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export function AvatarDemoSizes() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<Avatar size="sm">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="User avatar" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="User avatar" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="User avatar" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Avatar size="sm">
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar>
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<Avatar size="lg">
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
			</div>
		</div>
	);
}

export function AvatarDemoShapes() {
	return (
		<div className="flex flex-wrap items-center gap-4">
			<div className="flex flex-col items-center gap-1">
				<Avatar>
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Circle" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">Circle</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar shape="square">
					<AvatarImage src="/avatar-project/group.svg" alt="Square" />
					<AvatarFallback>SQ</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">Square</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar shape="hexagon">
					<AvatarImage src="/avatar-agent/dev-agents/code-planner.svg" alt="Hexagon" />
					<AvatarFallback>HX</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">Hexagon</span>
			</div>
		</div>
	);
}

export function AvatarDemoAgentTiers() {
	return (
		<div className="flex flex-wrap items-center gap-6" data-agent-avatar-tiers>
			{[
				{
					label: "Rovo",
					avatar: <AgentAvatarVisual label="Rovo agent" sizePx={32} vpkLogo="rovo" />,
				},
				{
					label: "1P",
					avatar: <AgentAvatarVisual avatarSrc="/avatar-agent/teamwork-agents/customer-insights.svg" label="Atlassian agent" sizePx={32} />,
				},
				{
					label: "2P",
					avatar: <AgentAvatarVisual avatarSrc="/2p/appfire.png" label="Appfire agent" sizePx={32} />,
				},
				{
					label: "3P",
					avatar: <AgentAvatarVisual brandName="slack" label="Slack agent" sizePx={32} />,
				},
				{
					label: "Claude",
					avatar: <AgentAvatarVisual appearance="coding" brandName="claude" label="Claude agent" sizePx={32} />,
				},
				{
					label: "Cursor",
					avatar: <AgentAvatarVisual appearance="coding" brandName="cursor" label="Cursor agent" sizePx={32} />,
				},
				{
					label: "Codex",
					avatar: <AgentAvatarVisual appearance="coding" brandName="openai-codex" label="Codex agent" sizePx={32} />,
				},
				{
					label: "GitHub Copilot",
					avatar: <AgentAvatarVisual appearance="coding" brandName="github-copilot" label="GitHub Copilot agent" sizePx={32} />,
				},
			].map(({ avatar, label }) => (
				<div className="flex flex-col items-center gap-1.5" key={label}>
					{avatar}
					<span className="text-xs text-text-subtle">{label}</span>
				</div>
			))}
		</div>
	);
}

export function AvatarDemoCodingAgents() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-6" data-coding-agent-avatars>
			{([
				{ name: "Claude", brandName: "claude" },
				{ name: "Codex", brandName: "openai-codex" },
				{ name: "GitHub Copilot", brandName: "github-copilot" },
				{ name: "Cursor", brandName: "cursor" },
			] as const).map(({ name, brandName }) => (
				<div className="flex flex-col items-center gap-1.5" key={brandName}>
					<AgentAvatarVisual appearance="coding" brandName={brandName} label={`${name} coding agent`} sizePx={32} />
					<span className="text-xs text-text-subtle">{name}</span>
				</div>
			))}
		</div>
	);
}

export function AvatarDemoAgentGroup() {
	return (
		<div className="flex flex-col items-start gap-6">
			{AVATAR_GROUP_SIZES.map(({ label, size, sizePx }) => (
					<div className="flex flex-col items-center gap-1.5" key={size}>
						<AvatarGroup label={`${label} agent avatar group`}>
							{AGENT_GROUP_AVATARS.map((agent) => (
								<AgentAvatarVisual
									avatarSrc={agent.src}
									key={agent.label}
									label={agent.label}
									sizePx={sizePx}
								/>
							))}
						</AvatarGroup>
						<span className="text-xs text-text-subtle">{label}</span>
					</div>
			))}
		</div>
	);
}

const AGENT_AVATAR_SRC = "/avatar-agent/dev-agents/code-planner.svg";
const BADGE_SIZES = ["sm", "default", "lg", "xl", "2xl"] as const;

export function AvatarDemoCompany() {
	return (
		<div className="flex flex-wrap items-end gap-4">
			{BADGE_SIZES.map((size) => (
				<div className="flex flex-col items-center gap-1" key={size}>
					<Avatar shape="hexagon" size={size}>
						<AvatarImage src={AGENT_AVATAR_SRC} alt="Code Planner" />
						<AvatarFallback>CP</AvatarFallback>
						<AvatarCompanyBadge>
							<AtlassianLogo
								appearance="inverse"
								label=""
								name="atlassian"
								shouldUseNewLogoDesign
								size="xxsmall"
								themeAware={false}
							/>
						</AvatarCompanyBadge>
					</Avatar>
					<span className="text-xs text-text-subtle">{size}</span>
				</div>
			))}
		</div>
	);
}

export function AvatarDemoProject() {
	return (
		<div className="flex flex-wrap items-end gap-4">
			{BADGE_SIZES.map((size) => (
				<div className="flex flex-col items-center gap-1" key={size}>
					<Avatar shape="hexagon" size={size}>
						<AvatarImage src={AGENT_AVATAR_SRC} alt="Code Planner" />
						<AvatarFallback>CP</AvatarFallback>
						<AvatarProjectBadge>
							<Image src="/avatar-project/group.svg" alt="" width={24} height={24} />
						</AvatarProjectBadge>
					</Avatar>
					<span className="text-xs text-text-subtle">{size}</span>
				</div>
			))}
		</div>
	);
}

export function AvatarDemoAllSizes() {
	return (
		<div className="flex flex-wrap items-end gap-3">
			<div className="flex flex-col items-center gap-1">
				<Avatar size="xs">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="xs" />
					<AvatarFallback>XS</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">xs</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar size="sm">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="sm" />
					<AvatarFallback>SM</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">sm</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar size="default">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="default" />
					<AvatarFallback>DF</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">default</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar size="lg">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="lg" />
					<AvatarFallback>LG</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">lg</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar size="xl">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="xl" />
					<AvatarFallback>XL</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">xl</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar size="2xl">
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="2xl" />
					<AvatarFallback>2X</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">2xl</span>
			</div>
		</div>
	);
}

export function AvatarDemoPresence() {
	return (
		<div className="flex flex-wrap items-center gap-4">
			<div className="flex flex-col items-center gap-1">
				<Avatar>
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Online" />
					<AvatarFallback>CN</AvatarFallback>
					<AvatarPresenceIndicator presence="online" />
				</Avatar>
				<span className="text-xs text-text-subtle">Online</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar>
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Busy" />
					<AvatarFallback>CN</AvatarFallback>
					<AvatarPresenceIndicator presence="busy" />
				</Avatar>
				<span className="text-xs text-text-subtle">Busy</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar>
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Focus" />
					<AvatarFallback>CN</AvatarFallback>
					<AvatarPresenceIndicator presence="focus" />
				</Avatar>
				<span className="text-xs text-text-subtle">Focus</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar>
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Offline" />
					<AvatarFallback>CN</AvatarFallback>
					<AvatarPresenceIndicator presence="offline" />
				</Avatar>
				<span className="text-xs text-text-subtle">Offline</span>
			</div>
		</div>
	);
}

export function AvatarDemoStatus() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-4">
				<div className="flex flex-col items-center gap-1">
					<Avatar>
						<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Approved" />
						<AvatarFallback>CN</AvatarFallback>
						<AvatarStatusIndicator status="approved" />
					</Avatar>
					<span className="text-xs text-text-subtle">Approved</span>
				</div>
				<div className="flex flex-col items-center gap-1">
					<Avatar>
						<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Declined" />
						<AvatarFallback>CN</AvatarFallback>
						<AvatarStatusIndicator status="declined" />
					</Avatar>
					<span className="text-xs text-text-subtle">Declined</span>
				</div>
				<div className="flex flex-col items-center gap-1">
					<Avatar>
						<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Locked" />
						<AvatarFallback>CN</AvatarFallback>
						<AvatarStatusIndicator status="locked" />
					</Avatar>
					<span className="text-xs text-text-subtle">Locked</span>
				</div>
				<div className="flex flex-col items-center gap-1">
					<Avatar>
						<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Warning" />
						<AvatarFallback>CN</AvatarFallback>
						<AvatarStatusIndicator status="warning" />
					</Avatar>
					<span className="text-xs text-text-subtle">Warning</span>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-4 overflow-visible">
				<div className="flex flex-col items-center gap-1 overflow-visible">
					<AgentAvatarVisual
						avatarSrc={AGENT_AVATAR_SRC}
						label="Code planner, Needs input"
						sizePx={32}
						status="needs-input"
					/>
					<span className="text-xs text-text-subtle">Needs input</span>
				</div>
				<div className="flex flex-col items-center gap-1 overflow-visible">
					<AgentAvatarVisual
						avatarSrc={AGENT_AVATAR_SRC}
						label="Code planner, Finished"
						sizePx={32}
						status="finished"
					/>
					<span className="text-xs text-text-subtle">Finished</span>
				</div>
			</div>
		</div>
	);
}

export function AvatarDemoDisabled() {
	return (
		<div className="flex flex-wrap items-center gap-4">
			<div className="flex flex-col items-center gap-1">
				<Avatar disabled>
					<AvatarImage src={PRIMARY_AVATAR_SRC} alt="Disabled circle" />
					<AvatarFallback>CN</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">Circle</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar disabled shape="square">
					<AvatarImage src="/avatar-project/group.svg" alt="Disabled square" />
					<AvatarFallback>SQ</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">Square</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<Avatar disabled shape="hexagon">
					<AvatarImage src="/avatar-agent/dev-agents/code-planner.svg" alt="Disabled hexagon" />
					<AvatarFallback>HX</AvatarFallback>
				</Avatar>
				<span className="text-xs text-text-subtle">Hexagon</span>
			</div>
		</div>
	);
}
