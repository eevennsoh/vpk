"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

import CloudIcon from "@atlaskit/icon-lab/core/cloud";
import ScreenIcon from "@atlaskit/icon/core/screen";

import {
	AgentListPrStatusIcon,
	AgentListTime,
} from "@/components/blocks/agent-list/agent-list-card";
import { AgentListAttributionAvatarGroup } from "@/components/blocks/agent-list/agent-list-identity";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { CyclingByline } from "@/components/ui-custom/chain-of-thought";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

import {
	toAgentSessionMetadataSegments,
	type AgentSessionMetadataSegment,
} from "./agent-session-long-metadata";
import type { AgentSessionItem } from "./agent-session-types";

const TOOL_CALL_CYCLE_MS = 2_200;

/** The `·` between metadata chunks. Decorative — the chunks read fine without it. */
function MetadataDot() {
	return (
		<span aria-hidden="true" className="shrink-0 text-text-subtlest">
			·
		</span>
	);
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
export function AgentSessionHostSegment({ isLocal }: Readonly<{ isLocal: boolean }>) {
	const label = isLocal ? "Local session" : "Cloud session";

	return (
		<span
			aria-label={label}
			className="grid size-4 shrink-0 place-items-center text-icon-subtlest"
			role="img"
		>
			{isLocal ? (
				<ScreenIcon color="currentColor" label="" size="small" />
			) : (
				<CloudIcon color="currentColor" label="" size="small" />
			)}
		</span>
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

/** `#1306` — the compact short-byline form, without the pull-request title. */
function toPullRequestNumberLabel(item: AgentSessionItem): string | undefined {
	const number = item.sessionDetails?.pullRequestNumber;
	return number === undefined ? undefined : `#${number}`;
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
				attributionOrder="human-first"
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

/** Cycles only while visible; reduced motion holds the first tool call still. */
// react-doctor-disable-next-line react-doctor/no-multi-component-file -- The tool call is one metadata segment and stays beside the segment renderer it serves.
function AgentSessionToolCall({ toolCalls }: Readonly<{ toolCalls: readonly string[] }>) {
	const [cycleIndex, setCycleIndex] = useState(0);
	const shouldReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const wrapperRef = useRef<HTMLSpanElement>(null);
	const isInView = useInView(wrapperRef);

	useEffect(() => {
		if (!isInView || shouldReduceMotion || toolCalls.length < 2) {
			return undefined;
		}

		const intervalId = window.setInterval(() => {
			setCycleIndex((index) => index + 1);
		}, TOOL_CALL_CYCLE_MS);
		return () => window.clearInterval(intervalId);
	}, [isInView, shouldReduceMotion, toolCalls.length]);

	const toolCall = toolCalls[cycleIndex % toolCalls.length];
	if (toolCall === undefined) {
		return null;
	}

	return (
		<span className="min-w-0 max-w-28 truncate" ref={wrapperRef}>
			<span className="sr-only">Tool call: </span>
			<CyclingByline
				className="text-xs leading-4 text-text-subtle"
				contentKey={toolCall}
			>
				<Shimmer
					as="span"
					className="max-w-full truncate text-text-subtle"
					data-agent-session-tool-call=""
					duration={1.4}
					spread={2}
					title={toolCall}
				>
					{toolCall}
				</Shimmer>
			</CyclingByline>
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
		case "tool-call":
			return <AgentSessionToolCall toolCalls={segment.toolCalls ?? []} />;
		case "artifact":
			return (
				<span className="flex min-w-0 shrink items-center gap-1">
					<AgentListPrStatusIcon
						className="text-icon-subtlest"
						status={segment.prStatus ?? "created"}
					/>
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
		toolCalls: item.toolCalls,
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

	return (
		<span className="flex w-full min-w-0 items-center gap-1 text-xs text-text-subtlest">
			{pullRequestLabel === undefined ? (
				<span className="min-w-0 truncate text-text-subtlest" title={item.agent.name}>
					{item.agent.name}
				</span>
			) : (
				<span className="flex min-w-0 shrink items-center gap-1">
					<AgentListPrStatusIcon
						className="text-icon-subtlest"
						status={item.prStatus ?? "created"}
					/>
					<span
						className="flex min-w-0 items-center gap-1 text-text-subtlest underline-offset-2 hover:underline"
						title={pullRequestTitle === undefined ? pullRequestLabel : `${pullRequestLabel} ${pullRequestTitle}`}
					>
						<span className="shrink-0 text-nowrap">
							{pullRequestLabel}{pullRequestTitle === undefined ? null : " "}
						</span>
						{pullRequestTitle === undefined ? null : (
							<span className="min-w-0 truncate text-nowrap">{pullRequestTitle}</span>
						)}
					</span>
				</span>
			)}
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
