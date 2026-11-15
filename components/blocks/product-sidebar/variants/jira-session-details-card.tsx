"use client";

import { useEffect, useId, type ReactNode } from "react";
import { preload } from "react-dom";

import BranchIcon from "@atlaskit/icon/core/branch";
import ScreenIcon from "@atlaskit/icon/core/screen";
import CloudIcon from "@atlaskit/icon-lab/core/cloud";

import { LazyAgentProfileCard, preloadAgentProfileCard } from "@/components/blocks/agent-profile-card/lazy";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Lozenge } from "@/components/ui/lozenge";
import { MetadataPathLink, MetadataPathValue } from "@/components/ui/metadata-path-link";
import { Tag } from "@/components/ui/tag";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { getAgentProfileBannerSrc } from "@/lib/agent-avatars";

import type {
	JiraSidebarSessionHost,
	JiraSidebarSessionItem,
} from "./jira";
import { JiraSessionFlyoutCard } from "./jira-session-flyout-card";
import {
	formatSessionChecks,
	JIRA_SESSION_UPDATED_LABEL,
	sessionArtifactItems,
} from "./jira-session-flyout-data";

function actorInitials(name: string): string {
	return name
		.split(/\s+/u)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

/** Hover-card host glyph: Screen for local (Figma), Cloud for hosted sessions. */
function detailsHostIcon(host: JiraSidebarSessionHost): ReactNode {
	return host === "cloud" ? (
		<CloudIcon label="" size="small" />
	) : (
		<ScreenIcon label="" size="small" />
	);
}

function DetailsMetaRow({
	icon,
	label,
	children,
}: Readonly<{ icon: ReactNode; label: string; children: ReactNode }>) {
	return (
		<div className="flex min-w-0 items-center gap-1 text-xs leading-5">
			<span className="grid size-4 shrink-0 place-items-center text-icon-subtlest" aria-hidden="true">
				{icon}
			</span>
			<span className="sr-only">{label}</span>
			<span className="flex min-w-0 flex-1 items-center text-text">{children}</span>
		</div>
	);
}

function DetailsInvokerMeta({
	animateAvatars,
	session,
}: Readonly<{
	animateAvatars: boolean;
	session: JiraSidebarSessionItem;
}>) {
	return (
		<div className="flex h-4 min-w-0 items-center gap-1">
			{session.invokedBy ? (
				<>
					<Avatar
						animate={animateAvatars}
						className="shrink-0"
						label={session.invokedBy.name}
						shape="circle"
						size="xs"
					>
						{session.invokedBy.src ? (
							<AvatarImage alt="" src={session.invokedBy.src} />
						) : null}
						<AvatarFallback>{actorInitials(session.invokedBy.name)}</AvatarFallback>
					</Avatar>
					<p className="min-w-0 truncate text-xs leading-4 text-text-subtlest">
						{session.invokedBy.name}
					</p>
					<span aria-hidden="true" className="shrink-0 text-xs leading-4 text-text-subtlest">
						·
					</span>
				</>
			) : null}
			<p className="shrink-0 text-xs leading-4 text-text-subtlest">
				{JIRA_SESSION_UPDATED_LABEL[session.status]}
			</p>
		</div>
	);
}

function DetailsAgentTag({
	animateAvatars,
	session,
}: Readonly<{
	animateAvatars: boolean;
	session: JiraSidebarSessionItem;
}>) {
	const agentBannerSrc = getAgentProfileBannerSrc(session.agentAvatarSrc);
	preload(agentBannerSrc, { as: "image" });
	useEffect(preloadAgentProfileCard, []);

	return (
		<div className="flex min-w-0 items-center">
			<span className="sr-only">Agent</span>
			<HoverCard closeDelay={120} openDelay={0}>
				<HoverCardTrigger
					closeDelay={120}
					delay={0}
					render={
						<Tag
							color="gray"
							elemBefore={
								<span aria-hidden>
									<AgentAvatarVisual
										animate={animateAvatars}
										avatarClassName="after:border-0"
										avatarSrc={session.agentAvatarSrc}
										brandName={session.brandName}
										fallbackText={session.agentName}
										label={session.agentName}
										sizePx={16}
										vpkLogo={session.vpkLogo}
									/>
								</span>
							}
							type="agent"
							variant="editor"
						>
							{session.agentName}
						</Tag>
					}
				/>
				<HoverCardContent
					align="center"
					alignOffset={0}
					className="w-[360px] max-w-[calc(100vw-48px)] rounded-xl border-0 bg-transparent p-0 shadow-none"
					side="right"
					sideOffset={8}
				>
					<LazyAgentProfileCard
						avatarSrc={session.agentAvatarSrc}
						name={session.agentName}
						surface="overlay"
					/>
				</HoverCardContent>
			</HoverCard>
		</div>
	);
}

function DetailsBranchRow({ session }: Readonly<{ session: JiraSidebarSessionItem }>) {
	if (!session.branch || session.pullRequestNumber) {
		return null;
	}
	return (
		<DetailsMetaRow icon={<BranchIcon label="" size="small" />} label="Branch">
			<MetadataPathLink className="min-w-0 truncate text-xs leading-5" segmented title={session.branch}>
				<MetadataPathValue path={session.branch} />
			</MetadataPathLink>
		</DetailsMetaRow>
	);
}

function DetailsChecksRow({ session }: Readonly<{ session: JiraSidebarSessionItem }>) {
	const visibleChecks = session.status === "merged" && session.checks?.failed === 0
		? undefined
		: session.checks;
	if (!visibleChecks) {
		return null;
	}
	const checksTotal = visibleChecks.passed + visibleChecks.failed;
	return (
		<DetailsMetaRow
			icon={(
				<ProgressCircle
					aria-hidden
					animated={false}
					size="xs"
					value={checksTotal > 0 ? Math.round((visibleChecks.passed / checksTotal) * 100) : 0}
					variant="outline"
				/>
			)}
			label="Checks"
		>
			<span className="shrink-0 text-xs font-normal text-text">
				{formatSessionChecks(visibleChecks)}
			</span>
		</DetailsMetaRow>
	);
}

/** Shared middle layer used by both details and untracked-work flyouts. */
export function JiraSessionDetailsBody({
	animateAvatars = true,
	hideAgentRow = false,
	hideSessionRow = false,
	session,
}: Readonly<{
	animateAvatars?: boolean;
	hideAgentRow?: boolean;
	hideSessionRow?: boolean;
	session: JiraSidebarSessionItem;
}>) {
	return (
		<>
			{hideSessionRow ? null : (
				<DetailsMetaRow icon={detailsHostIcon(session.host)} label="Session">
					{session.host === "cloud" ? "Cloud" : "Local"}
				</DetailsMetaRow>
			)}
			{hideAgentRow ? null : (
				<DetailsAgentTag animateAvatars={animateAvatars} session={session} />
			)}
			<DetailsBranchRow session={session} />
			<DetailsChecksRow session={session} />
		</>
	);
}

/**
 * Compact session hover card: title, invoker meta, Local/Cloud, agent Tag,
 * Artifacts Smart Link for the PR, and checks when present. Branch appears
 * only when there is no PR yet. Repo, worktree, and work item stay on
 * `JiraSessionFlyoutBody` for detail panels.
 */
export function JiraSessionDetailsCard({
	animateAvatars = true,
	session,
}: Readonly<{
	animateAvatars?: boolean;
	session: JiraSidebarSessionItem;
}>) {
	const titleId = useId();

	return (
		<JiraSessionFlyoutCard
			artifacts={sessionArtifactItems(session)}
			body={<JiraSessionDetailsBody animateAvatars={animateAvatars} session={session} />}
			bodyClassName="gap-1"
			meta={<DetailsInvokerMeta animateAvatars={animateAvatars} session={session} />}
			title={session.title}
			titleId={titleId}
			trailing={
				session.status === "awaiting-input" ? (
					<Lozenge className="shrink-0" variant="information">Needs input</Lozenge>
				) : null
			}
		/>
	);
}
