"use client";

import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import ScreenIcon from "@atlaskit/icon/core/screen";

import {
	AgentListPrStatusIcon,
	AgentListTime,
} from "@/components/blocks/agent-list/agent-list-card";
import { AgentListAttributionAvatarGroup } from "@/components/blocks/agent-list/agent-list-identity";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
	toAgentSessionMetadataSegments,
	type AgentSessionMetadataSegment,
} from "./agent-session-long-metadata";
import type { AgentSessionItem } from "./agent-session-types";

/** The `·` between metadata chunks. Decorative — the chunks read fine without it. */
function MetadataDot() {
	return (
		<span aria-hidden="true" className="shrink-0 text-text-subtlest">
			·
		</span>
	);
}

/**
 * Where the session runs — icon only. The tooltip names the host; the
 * timestamp sits beside this mark so the byline never prints "Cloud" or
 * "Local".
 *
 * `cloud` comes from icon-lab because `@atlaskit/icon/core` only ships
 * `cloud-arrow-up` (an upload action, not a location); `screen` is core. Same
 * pairing the Jira session flyout's Session row uses, so the glyph means the
 * same thing wherever it appears.
 */
// react-doctor-disable-next-line react-doctor/no-multi-component-file -- These are the sub-parts of one metadata line, colocated so short and long densities cannot drift apart; splitting six presentational fragments across six files would cost more than it explains.
export function AgentSessionHostSegment({ isLocal }: Readonly<{ isLocal: boolean }>) {
	const label = isLocal ? "Local session" : "Cloud session";

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<span
						aria-label={label}
						className="grid size-4 shrink-0 place-items-center text-text-subtle"
						role="img"
						tabIndex={0}
					/>
				}
			>
				{isLocal ? (
					<ScreenIcon color="currentColor" label="" size="small" />
				) : (
					<CloudIcon color="currentColor" label="" size="small" />
				)}
			</TooltipTrigger>
			<TooltipContent positionerClassName="z-[600]">{label}</TooltipContent>
		</Tooltip>
	);
}

/** `#1306: Add guest checkout`, the identifier convention shared with Smart Links. */
function toArtifactLabel(item: AgentSessionItem): string | undefined {
	const number = item.sessionDetails?.pullRequestNumber;
	if (number === undefined) {
		return undefined;
	}

	const title = item.sessionDetails?.pullRequestTitle;
	return title === undefined ? `#${number}` : `#${number}: ${title}`;
}

/**
 * The agent mark inside the metadata line.
 *
 * A bare session shows its agent at 16px, flush with the text. A session with a
 * known invoker overlaps the agent hexagon and person photo in the shared
 * AvatarGroup facepile at 16px.
 */
// react-doctor-disable-next-line react-doctor/no-multi-component-file -- These are the sub-parts of one metadata line, colocated so short and long densities cannot drift apart; splitting six presentational fragments across six files would cost more than it explains.
function LongMetadataIdentity({ item }: Readonly<{ item: AgentSessionItem }>) {
	if (item.invokedBy) {
		return (
			<AgentListAttributionAvatarGroup
				agent={item.agent}
				attributedBy={item.invokedBy}
				sizePx={16}
			/>
		);
	}

	return (
		<span className="flex size-4 shrink-0 items-center justify-center">
			<AgentAvatarVisual
				avatarClassName="after:border-0"
				avatarSrc={item.agent.avatarSrc}
				brandName={item.agent.brandName}
				label=""
				sizePx={16}
				vpkLogo={item.agent.vpkLogo}
			/>
		</span>
	);
}

// react-doctor-disable-next-line react-doctor/no-multi-component-file -- These are the sub-parts of one metadata line, colocated so short and long densities cannot drift apart; splitting six presentational fragments across six files would cost more than it explains.
function LongMetadataSegment({
	item,
	segment,
}: Readonly<{ item: AgentSessionItem; segment: AgentSessionMetadataSegment }>) {
	switch (segment.kind) {
		case "agent":
			return (
				<span className="flex min-w-0 items-center gap-1">
					<LongMetadataIdentity item={item} />
					<span className="min-w-0 truncate text-text-subtle" title={segment.label}>
						{segment.label}
					</span>
				</span>
			);
		case "artifact":
			return (
				<span className="flex min-w-0 shrink items-center gap-1">
					<AgentListPrStatusIcon status={segment.prStatus ?? "created"} />
					<span className="min-w-0 truncate text-text-subtle" title={segment.label}>
						{segment.label}
					</span>
				</span>
			);
		case "time":
			return (
				<span className="flex shrink-0 items-center gap-1 text-nowrap">
					{segment.host === undefined ? null : (
						<AgentSessionHostSegment isLocal={segment.host === "local"} />
					)}
					<span title="Last update">
						<AgentListTime item={item} />
					</span>
				</span>
			);
		default: {
			const _exhaustive: never = segment.kind;
			return _exhaustive;
		}
	}
}

/**
 * Long-form metadata: `<mark> Claude · ☁ 2m` or `Claude · #1306: … · ☁ 2m`.
 *
 * Progression is the trailing lifecycle icon, not a byline clause. The chunk
 * list comes from {@link toAgentSessionMetadataSegments}, which is pure and
 * unit-tested; this component only decides how each chunk looks.
 */
// react-doctor-disable-next-line react-doctor/no-multi-component-file -- These are the sub-parts of one metadata line, colocated so short and long densities cannot drift apart; splitting six presentational fragments across six files would cost more than it explains.
export function AgentSessionLongMetadata({ item }: Readonly<{ item: AgentSessionItem }>) {
	// Deliberately not `getAgentListHost`, which answers "cloud" for a payload
	// that simply never said. Undefined here means the row stays quiet about
	// where it ran rather than asserting a default onto the card.
	const declaredHost = item.host ?? item.sessionDetails?.host;
	const segments = toAgentSessionMetadataSegments({
		agentName: item.agent.name,
		artifactLabel: toArtifactLabel(item),
		host: declaredHost,
		prStatus: item.prStatus,
	});

	return (
		<span className="flex w-full min-w-0 items-center gap-1 text-xs text-text-subtlest">
			{segments.map((segment, index) => (
				// Artifact and agent names yield width so the trailing lifecycle
				// icon stays clear. Time and host stay shrink-0 so separators hold.
				<span
					className={cn(
						"flex items-center gap-1",
						segment.kind === "artifact" || segment.kind === "agent"
							? "min-w-0 shrink"
							: "shrink-0",
					)}
					key={segment.kind}
				>
					{index > 0 ? <MetadataDot /> : null}
					<LongMetadataSegment item={item} segment={segment} />
				</span>
			))}
		</span>
	);
}

/**
 * Owner short byline: `Claude · ☁ Last week`.
 *
 * The leading 32px identity already shows the agent (and invoker). This line
 * only names who ran it and pairs the host icon with when — no status or
 * artifact chip, and no "Cloud" / "Local" label.
 */
// react-doctor-disable-next-line react-doctor/no-multi-component-file -- Short and long metadata stay together so the two densities cannot drift apart.
export function AgentSessionShortMetadata({ item }: Readonly<{ item: AgentSessionItem }>) {
	const declaredHost = item.host ?? item.sessionDetails?.host;

	return (
		<span className="flex w-full min-w-0 items-center gap-1 text-xs text-text-subtlest">
			<span className="min-w-0 truncate text-text-subtle" title={item.agent.name}>
				{item.agent.name}
			</span>
			<MetadataDot />
			<span className="flex shrink-0 items-center gap-1 text-nowrap">
				{declaredHost === undefined ? null : (
					<AgentSessionHostSegment isLocal={declaredHost === "local"} />
				)}
				<span title="Last update">
					<AgentListTime item={item} />
				</span>
			</span>
		</span>
	);
}
