"use client";

import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import BranchIcon from "@atlaskit/icon/core/branch";
import LockLockedIcon from "@atlaskit/icon/core/lock-locked";
import ScreenIcon from "@atlaskit/icon/core/screen";
import { useState } from "react";

import {
	AgentListPrStatusIcon,
	AgentListTime,
} from "@/components/blocks/agent-list/agent-list-card";
import { AgentListAttributionAvatarGroup } from "@/components/blocks/agent-list/agent-list-identity";
import { PullRequest } from "@/components/blocks/pull-request/components/pull-request";
import { PullRequestList } from "@/components/blocks/jira-issue/pull-request-cluster";
import { RelativeTime } from "@/components/ui/elapsed-time";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { describeRelativeTimeLabel } from "@/lib/elapsed-time";
import { cn } from "@/lib/utils";

import {
	AGENT_SESSION_STATUS_LABEL,
	isActiveAgentSessionState,
	toAgentSessionMetadataSegments,
	type AgentSessionMetadataSegment,
} from "./agent-session-long-metadata";
import { getAgentSessionRole, type AgentSessionItem, type AgentSessionProps } from "./agent-session-types";
import type { AgentSessionAvatarPreview } from "./agent-session-avatar-preview";
import { AgentSessionLifecycleLabel } from "./agent-session-lifecycle";

/** The `·` between metadata chunks. Decorative — the chunks read fine without it. */
function MetadataDot() {
	return (
		<span aria-hidden="true" className="shrink-0 text-text-subtlest">
			·
		</span>
	);
}

/**
 * Who a session is private to, or `null` for the viewer's own session. A
 * session is either yours (no mark) or private to its owner — there is no
 * team-shared state, so someone else's session always shows the padlock.
 */
function sessionAccessOwner(item: AgentSessionItem): string | null {
	if (item.privateTo) return item.privateTo;
	return getAgentSessionRole(item) === "viewer" ? item.invokedBy?.name ?? "" : null;
}

/** Trailing padlock for a session the viewer does not own. */
function AccessMark({ person }: Readonly<{ person: string }>) {
	const mark = (
		<span aria-label={`Private session${person ? ` by ${person}` : ""}`} className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-icon-subtlest outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3!" data-access-mark="private" role="img" tabIndex={person ? 0 : undefined}>
			<LockLockedIcon color="currentColor" label="" size="small" />
		</span>
	);
	return person ? <Tooltip><TooltipTrigger render={mark} /><TooltipContent positionerClassName="z-[650]" role="tooltip">Session by {person}</TooltipContent></Tooltip> : mark;
}

/**
 * Where the session runs — icon only, with an accessible host label. The
 * timestamp sits beside this mark so the byline never prints "Cloud" or
 * "Local".
 *
 * `cloud` comes from icon-lab because `@atlaskit/icon/core` only ships
 * `cloud-arrow-up` (an upload action, not a location); `screen` is core. Same
 * pairing the Jira session flyout's Session row uses, so the glyph means the
 * same thing wherever it appears.
 */
// react-doctor-disable-next-line react-doctor/no-multi-component-file -- These are the sub-parts of one metadata line, colocated so short and long densities cannot drift apart; splitting six presentational fragments across six files would cost more than it explains.
export function AgentSessionHostSegment({ compact = false, isLocal }: Readonly<{ compact?: boolean; isLocal: boolean }>) {
	const label = isLocal ? "Local session" : "Cloud session";
	const HostIcon = isLocal ? ScreenIcon : CloudIcon;

	return (
		<span
			aria-label={label}
			className={cn("grid shrink-0 place-items-center text-icon-subtlest", compact ? "size-3 [&_span]:size-3! [&_svg]:size-3!" : "size-4 [&_span]:size-4! [&_svg]:size-4!")}
			role="img"
		>
			<HostIcon color="currentColor" label="" size="small" />
		</span>
	);
}

/** `#1306: Add guest checkout`, the identifier convention shared with Smart Links. */
function toArtifactLabel(item: AgentSessionItem): string | undefined {
	if ((item.pullRequests?.length ?? 0) > 1) return `${item.pullRequests?.length} pull requests`;
	const number = item.sessionDetails?.pullRequestNumber;
	if (number === undefined) {
		return undefined;
	}

	const title = item.sessionDetails?.pullRequestTitle;
	return title === undefined ? `#${number}` : `#${number}: ${title}`;
}

/** `#1306` — the compact short-byline form, without the pull-request title. */
function toPullRequestNumberLabel(item: AgentSessionItem): string | undefined {
	if ((item.pullRequests?.length ?? 0) > 1) return `${item.pullRequests?.length} pull requests`;
	const number = item.sessionDetails?.pullRequestNumber;
	return number === undefined ? undefined : `#${number}`;
}

function SessionTimestamp({ item }: Readonly<{ item: AgentSessionItem }>) {
	const timestamp = item.updatedAtMs ?? item.completedAtMs ?? item.startedAtMs;
	const relativeLabel = describeRelativeTimeLabel(item.timeLabel ?? "", timestamp);
	const relativeTime = relativeLabel ?? (Number.isFinite(timestamp) ? <RelativeTime format="long" timestampMs={timestamp} /> : undefined);
	if (relativeTime === undefined) return <span data-last-update=""><AgentListTime item={item} /></span>;
	return (
		<Tooltip>
			<TooltipTrigger render={<span className="rounded-sm text-text-subtle underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring" data-last-update="" data-session-drag-ignore="" tabIndex={0} />}>
				<AgentListTime item={item} />
			</TooltipTrigger>
			<TooltipContent positionerClassName="z-[650]" role="tooltip" side="bottom">
				{relativeTime}
			</TooltipContent>
		</Tooltip>
	);
}

function SingleSessionPullRequest({ item, label }: Readonly<{ item: AgentSessionItem; label: string }>) {
	const details = item.sessionDetails;
	const number = details?.pullRequestNumber;
	if (!details || number === undefined) return null;
	const status = item.prStatus ?? "created";
	return <PullRequest additions={details.additions ?? 0} author={details.pullRequestAuthor ? { name: details.pullRequestAuthor.name, avatarUrl: details.pullRequestAuthor.src } : undefined} branch={details.branch} checks={item.pullRequestChecks} checksExpandable={false} className="border-none bg-transparent shadow-none" deletions={details.deletions ?? 0} filesChanged={details.files} number={number} repository={details.repository} showFix={false} status={status === "merged" ? "Merged" : status === "failed" ? "Failed" : "Open"} targetBranch={details.targetBranch} title={details.pullRequestTitle ?? label} variant="flyout" />;
}

function SessionPullRequest({ item, label }: Readonly<{ item: AgentSessionItem; label: string }>) {
	const [open, setOpen] = useState(false);
	const details = item.sessionDetails;
	const number = details?.pullRequestNumber;
	const multiple = (item.pullRequests?.length ?? 0) > 1;
	if (!multiple && (!details || number === undefined)) return null;
	const status = item.prStatus ?? "created";
	const color = status === "merged" ? "group-hover/agent-row:text-icon-accent-purple group-focus-within/agent-row:text-icon-accent-purple" : status === "failed" ? "group-hover/agent-row:text-icon-danger group-focus-within/agent-row:text-icon-danger" : "group-hover/agent-row:text-icon-success group-focus-within/agent-row:text-icon-success";
	return (
		<HoverCard open={open} onOpenChange={setOpen}>
			<HoverCardTrigger aria-label={multiple ? label : `Pull request ${label}`} onFocus={() => setOpen(true)} render={<span className="group/session-pr flex min-w-0 shrink items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" data-session-drag-ignore="" role="group" tabIndex={0} />}>
				<AgentListPrStatusIcon className={cn("size-3 text-icon-subtlest [&_span]:size-3! [&_svg]:size-3!", !multiple && color)} status={multiple ? "created" : status} />
				<span className="min-w-0 truncate text-text-subtle underline-offset-2 group-hover/session-pr:underline group-focus-visible/session-pr:underline" data-session-pr-title="">{label}</span>
			</HoverCardTrigger>
			<HoverCardContent align="start" aria-label={multiple ? "Pull requests" : `Pull request #${number} details`} className="w-[320px] max-w-[calc(100vw-48px)] overflow-hidden p-0" positionerClassName="z-[650]" role="region" sideOffset={8}>
				{multiple ? <PullRequestList pullRequests={item.pullRequests ?? []} /> : <SingleSessionPullRequest item={item} label={label} />}
			</HoverCardContent>
		</HoverCard>
	);
}

/**
 * The agent mark inside the metadata line.
 *
 * A bare session shows its agent at 16px, flush with the text. A session with a
 * known invoker overlaps the agent hexagon and person photo in the shared
 * AvatarGroup facepile at 16px.
 */
// react-doctor-disable-next-line react-doctor/no-multi-component-file -- These are the sub-parts of one metadata line, colocated so short and long densities cannot drift apart; splitting six presentational fragments across six files would cost more than it explains.
function LongMetadataIdentity({ item, renderAgentAvatar }: Readonly<{ item: AgentSessionItem; renderAgentAvatar?: AgentSessionAvatarPreview }>) {
	const attributedBy = item.invokedBy;
	if (attributedBy) {
		return (
			<AgentListAttributionAvatarGroup
				agent={item.agent}
				attributedBy={attributedBy}
				attributionOrder="agent-first"
				sizePx={16}
				appearance="coding"
				renderAgentAvatar={renderAgentAvatar}
			/>
		);
	}

	const avatar = (
		<AgentAvatarVisual
			appearance="coding"
			avatarClassName="after:border-0"
			avatarSrc={item.agent.avatarSrc}
			brandName={item.agent.brandName}
			label=""
			sizePx={16}
			vpkLogo={item.agent.vpkLogo}
		/>
	);
	return <span className="flex size-4 shrink-0 items-center justify-center">{renderAgentAvatar?.(item.agent, avatar) ?? avatar}</span>;
}

// react-doctor-disable-next-line react-doctor/no-multi-component-file -- These are the sub-parts of one metadata line, colocated so short and long densities cannot drift apart; splitting six presentational fragments across six files would cost more than it explains.
function LongMetadataSegment({
	hideAgentAvatar,
	item,
	lifecycleLabelPlacement,
	renderAgentAvatar,
	segment,
}: Readonly<{ hideAgentAvatar?: boolean; item: AgentSessionItem; lifecycleLabelPlacement: AgentSessionProps["lifecycleLabelPlacement"]; renderAgentAvatar?: AgentSessionAvatarPreview; segment: AgentSessionMetadataSegment }>) {
	switch (segment.kind) {
		case "agent":
			return (
				<span className="flex min-w-0 items-center gap-1" data-agent-session-agent="">
					{hideAgentAvatar ? null : <LongMetadataIdentity item={item} renderAgentAvatar={renderAgentAvatar} />}
					{segment.label === undefined ? null : (
						<span className="min-w-0 truncate text-text-subtle" title={segment.label}>
							{lifecycleLabelPlacement === "metadata" ? <AgentSessionLifecycleLabel state={item.state} /> : segment.label}
						</span>
					)}
				</span>
			);
		case "branch":
			return <span className="flex min-w-0 items-center gap-1"><span className="grid size-3 shrink-0 place-items-center [&_span]:size-3! [&_svg]:size-3!"><BranchIcon label="" size="small" /></span><span className="min-w-0 truncate" title={segment.label}>{segment.label}</span></span>;
		case "artifact":
			return segment.label ? <SessionPullRequest item={item} label={segment.label} /> : null;
		case "time":
			return (
				<span className="flex shrink-0 items-center gap-1 text-nowrap">
					{segment.host === undefined ? null : (
						<AgentSessionHostSegment compact isLocal={segment.host === "local"} />
					)}
					<SessionTimestamp item={item} />
				</span>
			);
		default: {
			const _exhaustive: never = segment.kind;
			return _exhaustive;
		}
	}
}

/**
 * Long-form metadata: `<mark> Claude · #1306: … · ☁ 2m`.
 *
 * The state label can replace the agent name; its glyph stays trailing. The
 * chunk list comes from the pure, unit-tested metadata builder.
 */
// react-doctor-disable-next-line react-doctor/no-multi-component-file -- These are the sub-parts of one metadata line, colocated so short and long densities cannot drift apart; splitting six presentational fragments across six files would cost more than it explains.
export function AgentSessionLongMetadata({ compact = false, hideAgentAvatar = false, item, lifecycleLabelPlacement = "trailing", renderAgentAvatar, showArtifact = true, showBranch = false }: Readonly<{ compact?: boolean; hideAgentAvatar?: boolean; item: AgentSessionItem; lifecycleLabelPlacement?: AgentSessionProps["lifecycleLabelPlacement"]; renderAgentAvatar?: AgentSessionAvatarPreview; showArtifact?: boolean; showBranch?: boolean }>) {
	// Deliberately not `getAgentListHost`, which answers "cloud" for a payload
	// that simply never said. Undefined here means the row stays quiet about
	// where it ran rather than asserting a default onto the card.
	const declaredHost = item.host ?? item.sessionDetails?.host;
	const accessOwner = sessionAccessOwner(item);
	const showLifecycleInMetadata = lifecycleLabelPlacement === "metadata";
	const segments = toAgentSessionMetadataSegments({
		agentName: showLifecycleInMetadata ? AGENT_SESSION_STATUS_LABEL[item.state] : item.agent.name,
		branch: showBranch ? item.branch : undefined,
		artifactLabel: toArtifactLabel(item),
		showArtifact,
		compact: compact && !showLifecycleInMetadata,
		host: declaredHost,
		prStatus: item.prStatus,
	});

	return (
		<span className="@container/session-metadata flex w-full min-w-0 items-center gap-1 text-xs text-text-subtle">
			{segments.map((segment, index) => (
				<span
					className={cn(
						"flex items-center gap-1",
						segment.kind === "agent"
							? segment.label === undefined ? "shrink-0" : "min-w-0 shrink"
							: segment.kind === "time"
								? "shrink-0"
								: "min-w-0 max-w-28 flex-initial @[32rem]/session-metadata:max-w-72",
					)}
					key={segment.kind}
				>
					{/* An unnamed avatar stack joins its first metadata clause directly. */}
					{index > 0 && !(segments[index - 1]?.kind === "agent" && segments[index - 1]?.label === undefined) ? <MetadataDot /> : null}
					<LongMetadataSegment hideAgentAvatar={hideAgentAvatar} item={item} lifecycleLabelPlacement={showLifecycleInMetadata ? "metadata" : "trailing"} renderAgentAvatar={renderAgentAvatar} segment={segment} />
					{segment.kind === "time" && accessOwner !== null ? <><MetadataDot /><AccessMark person={accessOwner} /></> : null}
				</span>
			))}
		</span>
	);
}

/**
 * Owner short byline: `Claude · ☁ Last week` or `#1306 Add guest checkout · ☁ Last week`.
 *
 * The leading 32px identity already shows the agent (and invoker). This line
 * names who ran it until a pull request exists, then leads with the PR. It pairs
 * the host icon with when. Lifecycle stays outside the byline in the trailing control
 * slot shared with the more-actions button.
 */
// react-doctor-disable-next-line react-doctor/no-multi-component-file -- Short and long metadata stay together so the two densities cannot drift apart.
export function AgentSessionShortMetadata({ item }: Readonly<{ item: AgentSessionItem }>) {
	const declaredHost = item.host ?? item.sessionDetails?.host;
	const pullRequestLabel = toPullRequestNumberLabel(item);
	const pullRequestTitle = item.sessionDetails?.pullRequestTitle;
	const accessOwner = sessionAccessOwner(item);

	return (
		<span className="flex w-full min-w-0 items-center gap-1 text-xs text-text-subtle">
			{pullRequestLabel === undefined ? (
				isActiveAgentSessionState(item.state) ? null : (
					<span className="min-w-0 truncate text-text-subtle" title={item.agent.name}>
						{item.agent.name}
					</span>
				)
			) : (
				<SessionPullRequest item={item} label={(item.pullRequests?.length ?? 0) > 1 || pullRequestTitle === undefined ? pullRequestLabel : `${pullRequestLabel} ${pullRequestTitle}`} />
			)}
			{pullRequestLabel === undefined && isActiveAgentSessionState(item.state) ? null : <MetadataDot />}
			<span className="flex shrink-0 items-center gap-1 text-nowrap">
				{declaredHost === undefined ? null : (
					<AgentSessionHostSegment compact isLocal={declaredHost === "local"} />
				)}
				<SessionTimestamp item={item} />
			</span>
			{accessOwner === null ? null : <><MetadataDot /><AccessMark person={accessOwner} /></>}
		</span>
	);
}
